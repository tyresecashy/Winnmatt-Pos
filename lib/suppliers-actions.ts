'use server'

import { supabaseAdmin } from '@/lib/supabase-server'

export interface Supplier {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string | null
  payment_terms: string
  balance: number
  created_at: string
  updated_at: string
}

/**
 * Get all suppliers
 */
export async function getSuppliers() {
  try {
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return []
  }
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(supplierId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return null
  }
}

/**
 * Search suppliers by name, contact person, or phone
 */
export async function searchSuppliers(query: string) {
  try {
    if (!query.trim()) return []

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .or(`name.ilike.%${query}%,contact_person.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching suppliers:', error)
    return []
  }
}

/**
 * Create a new supplier
 */
export async function createSupplier(
  name: string,
  contact_person: string,
  phone: string,
  email?: string,
  payment_terms: string = 'Net 30'
) {
  try {
    if (!name.trim() || !contact_person.trim() || !phone.trim()) {
      return { success: false, error: 'Name, contact person, and phone are required' }
    }

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .insert({
        name: name.trim(),
        contact_person: contact_person.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        payment_terms: payment_terms.trim(),
        balance: 0,
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      supplier: data,
      message: `Supplier "${name}" created successfully`,
    }
  } catch (error) {
    console.error('Error creating supplier:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create supplier',
    }
  }
}

/**
 * Update an existing supplier
 */
export async function updateSupplier(
  supplierId: string,
  updates: {
    name?: string
    contact_person?: string
    phone?: string
    email?: string
    payment_terms?: string
  }
) {
  try {
    const cleanUpdates: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name) cleanUpdates.name = updates.name.trim()
    if (updates.contact_person) cleanUpdates.contact_person = updates.contact_person.trim()
    if (updates.phone) cleanUpdates.phone = updates.phone.trim()
    if (updates.email !== undefined) cleanUpdates.email = updates.email?.trim() || null
    if (updates.payment_terms) cleanUpdates.payment_terms = updates.payment_terms.trim()

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .update(cleanUpdates)
      .eq('id', supplierId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      supplier: data,
      message: 'Supplier updated successfully',
    }
  } catch (error) {
    console.error('Error updating supplier:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update supplier',
    }
  }
}

/**
 * Delete a supplier (soft delete / deactivate could be better)
 */
export async function deleteSupplier(supplierId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('suppliers')
      .delete()
      .eq('id', supplierId)

    if (error) throw error

    return {
      success: true,
      message: 'Supplier deleted successfully',
    }
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete supplier',
    }
  }
}

/**
 * Get supplier's purchase orders
 */
export async function getSupplierOrders(supplierId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        items:purchase_order_items(
          id,
          product_id,
          quantity,
          unit_price,
          line_total,
          received_quantity,
          product:products(id, sku, name)
        )
      `)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching supplier orders:', error)
    return []
  }
}
