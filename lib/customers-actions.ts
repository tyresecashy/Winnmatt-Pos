'use server'

import { authenticateServerAction, authorizePOSProfile } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  type: 'retail' | 'wholesale' | 'business'
  loyalty_points: number
  credit_limit: number
  credit_balance: number
  created_at: string
  updated_at: string
}

export interface CustomerWithStats extends Customer {
  total_purchases: number
  purchase_count: number
  last_visit?: string
  visit_count: number
}

interface DuplicateCustomerMatch {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

function formatCustomerReference(customer: {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}) {
  return `${customer.name} (${customer.phone || customer.email || `ID ${customer.id.slice(-6).toUpperCase()}`})`
}

function mergeDuplicateMatches(
  existingMatches: DuplicateCustomerMatch[],
  incomingMatches: DuplicateCustomerMatch[]
) {
  const mergedById = new Map<string, DuplicateCustomerMatch>()

  for (const customer of [...existingMatches, ...incomingMatches]) {
    mergedById.set(customer.id, customer)
  }

  return Array.from(mergedById.values())
}

/**
 * Get all customers for display
 */
export async function getCustomers(limit: number = 100) {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching customers:', error)
    return []
  }
}

/**
 * Get customer by ID with statistics from sales
 */
export async function getCustomerById(customerId: string) {
  try {
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError) throw customerError
    if (!customer) return null

    // Get purchase stats from sales
    const { data: stats, error: statsError } = await supabaseAdmin
      .rpc('get_customer_stats', { customer_id: customerId })

    if (!statsError && stats) {
      return {
        ...customer,
        total_purchases: stats[0]?.total_purchases || 0,
        purchase_count: stats[0]?.purchase_count || 0,
        last_visit: stats[0]?.last_visit,
      }
    }

    return customer
  } catch (error) {
    console.error('Error fetching customer:', error)
    return null
  }
}

/**
 * Search customers by name or phone
 */
export async function searchCustomers(query: string) {
  try {
    if (!query.trim()) return []

    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      console.warn('[CUSTOMERS] Search denied:', authResult.error)
      return []
    }

    const posAccess = authorizePOSProfile(authResult.profile)
    if (!posAccess.authorized) {
      console.warn('[CUSTOMERS] POS search denied:', posAccess.error)
      return []
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('id, name, phone, email, type, loyalty_points, updated_at, created_at')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .order('name', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching customers:', error)
    return []
  }
}

/**
 * Get customers filtered by type
 */
export async function getCustomersByType(type: 'retail' | 'wholesale' | 'business') {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('type', type)
      .order('name')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching customers by type:', error)
    return []
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(
  name: string,
  type: 'retail' | 'wholesale' | 'business' = 'retail',
  phone?: string,
  email?: string,
  creditLimit: number = 0
) {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      return { success: false, error: authResult.error || 'Unauthorized' }
    }

    if (!name.trim()) {
      return { success: false, error: 'Customer name is required' }
    }

    const normalizedName = name.trim()
    const normalizedPhone = phone?.trim() || null
    const normalizedEmail = email?.trim().toLowerCase() || null
    let potentialDuplicates: DuplicateCustomerMatch[] = []
    const matchedFields: Array<'phone' | 'email'> = []

    if (normalizedPhone) {
      const { data: phoneMatches, error: phoneError } = await supabaseAdmin
        .from('customers')
        .select('id, name, phone, email')
        .eq('phone', normalizedPhone)
        .limit(5)

      if (phoneError) throw phoneError
      if ((phoneMatches || []).length > 0) {
        matchedFields.push('phone')
        potentialDuplicates = mergeDuplicateMatches(potentialDuplicates, phoneMatches || [])
      }
    }

    if (normalizedEmail) {
      const { data: emailMatches, error: emailError } = await supabaseAdmin
        .from('customers')
        .select('id, name, phone, email')
        .ilike('email', normalizedEmail)
        .limit(5)

      if (emailError) throw emailError
      if ((emailMatches || []).length > 0) {
        matchedFields.push('email')
        potentialDuplicates = mergeDuplicateMatches(potentialDuplicates, emailMatches || [])
      }
    }

    if (potentialDuplicates.length > 0) {
      const duplicateSummary = potentialDuplicates
        .map((customer) => formatCustomerReference(customer))
        .join(', ')

      console.warn('[CUSTOMERS] Blocked potential duplicate customer creation', {
        requestedName: normalizedName,
        requestedPhone: normalizedPhone,
        requestedEmail: normalizedEmail,
        createdBy: authResult.profile.id,
        matchedFields,
        potentialDuplicates: potentialDuplicates.map((customer) => customer.id),
      })

      return {
        success: false,
        error: `A customer with the same ${matchedFields.join(' and ')} already exists: ${duplicateSummary}. Search for the existing customer before creating a new record.`,
        duplicateFields: matchedFields,
        duplicateMatches: potentialDuplicates,
      }
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        name: normalizedName,
        type,
        phone: normalizedPhone,
        email: normalizedEmail,
        credit_limit: creditLimit,
        credit_balance: 0,
        loyalty_points: 0,
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      customer: data,
      message: `Customer "${name}" created successfully`,
    }
  } catch (error) {
    console.error('Error creating customer:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create customer',
    }
  }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  customerId: string,
  updates: {
    name?: string
    phone?: string
    email?: string
    type?: 'retail' | 'wholesale' | 'business'
    credit_limit?: number
  }
) {
  try {
    if (updates.name && !updates.name.trim()) {
      return { success: false, error: 'Customer name cannot be empty' }
    }

    const cleanUpdates: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name) cleanUpdates.name = updates.name.trim()
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone?.trim() || null
    if (updates.email !== undefined) cleanUpdates.email = updates.email?.trim() || null
    if (updates.type) cleanUpdates.type = updates.type
    if (updates.credit_limit !== undefined) cleanUpdates.credit_limit = updates.credit_limit

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(cleanUpdates)
      .eq('id', customerId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      customer: data,
      message: 'Customer updated successfully',
    }
  } catch (error) {
    console.error('Error updating customer:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update customer',
    }
  }
}

/**
 * Get customers with purchase statistics
 */
export async function getCustomersWithStats() {
  try {
    // First get all customers
    const { data: customers, error: customersError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (customersError) throw customersError

    // Then get stats for each via sales table
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('sales')
      .select(`
        customer_id,
        total_amount
      `)

    if (statsError) {
      // If stats unavailable, return customers without stats
      return customers || []
    }

    // Calculate stats per customer
    const statsMap: Record<string, any> = {}
    stats?.forEach((sale) => {
      if (!statsMap[sale.customer_id]) {
        statsMap[sale.customer_id] = {
          total_purchases: 0,
          purchase_count: 0,
        }
      }
      statsMap[sale.customer_id].total_purchases += sale.total_amount || 0
      statsMap[sale.customer_id].purchase_count += 1
    })

    return customers?.map((customer) => ({
      ...customer,
      total_purchases: statsMap[customer.id]?.total_purchases || 0,
      purchase_count: statsMap[customer.id]?.purchase_count || 0,
    })) || []
  } catch (error) {
    console.error('Error fetching customers with stats:', error)
    return []
  }
}

/**
 * Get recent purchases for a customer
 */
export async function getCustomerPurchases(customerId: string, limit: number = 10) {
  try {
    const { data, error } = await supabaseAdmin
      .from('sales')
      .select(`
        id,
        receipt_number,
        total_amount,
        created_at,
        sale_items(quantity)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data?.map((sale) => ({
      ...sale,
      item_count:
        sale.sale_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
    })) || []
  } catch (error) {
    console.error('Error fetching customer purchases:', error)
    return []
  }
}

/**
 * Get customer count by type
 */
export async function getCustomerCounts() {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('type')

    if (error) throw error

    const counts = {
      total: data?.length || 0,
      retail: data?.filter((c) => c.type === 'retail').length || 0,
      wholesale: data?.filter((c) => c.type === 'wholesale').length || 0,
      business: data?.filter((c) => c.type === 'business').length || 0,
    }

    return counts
  } catch (error) {
    console.error('Error getting customer counts:', error)
    return { total: 0, retail: 0, wholesale: 0, business: 0 }
  }
}
