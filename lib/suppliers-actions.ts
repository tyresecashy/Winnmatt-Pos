'use server'
import { logger } from '@/lib/logger';
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  payment_terms: string | null
  balance: number | null
  code: string | null
  company_name: string | null
  address: string | null
  tax_number: string | null
  bank_name: string | null
  bank_account: string | null
  bank_code: string | null
  credit_limit: number | null
  credit_days: number | null
  delivery_days: string | null
  lead_time: number | null
  rating: number | null
  performance_score: number | null
  quality_score: number | null
  late_delivery_pct: number | null
  rejected_deliveries: number | null
  total_purchase_amount: number | null
  total_orders: number | null
  outstanding_orders: number | null
  status: string | null
  website: string | null
  notes: string | null
  search_vector: unknown
  created_at: string | null
  updated_at: string | null
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
    logger.error('Error creating supplier:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
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
    address?: string
    tax_number?: string
    bank_name?: string
    bank_account?: string
    bank_code?: string
    credit_limit?: number
    credit_days?: number
    delivery_days?: string
    lead_time?: number
    status?: string
    website?: string
    notes?: string
  }
) {
  try {
    const cleanUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name) cleanUpdates.name = updates.name.trim()
    if (updates.contact_person) cleanUpdates.contact_person = updates.contact_person.trim()
    if (updates.phone) cleanUpdates.phone = updates.phone.trim()
    if (updates.email !== undefined) cleanUpdates.email = updates.email?.trim() || null
    if (updates.payment_terms) cleanUpdates.payment_terms = updates.payment_terms.trim()
    if (updates.address !== undefined) cleanUpdates.address = updates.address?.trim() || null
    if (updates.tax_number !== undefined) cleanUpdates.tax_number = updates.tax_number?.trim() || null
    if (updates.bank_name !== undefined) cleanUpdates.bank_name = updates.bank_name?.trim() || null
    if (updates.bank_account !== undefined) cleanUpdates.bank_account = updates.bank_account?.trim() || null
    if (updates.bank_code !== undefined) cleanUpdates.bank_code = updates.bank_code?.trim() || null
    if (updates.credit_limit !== undefined) cleanUpdates.credit_limit = updates.credit_limit
    if (updates.credit_days !== undefined) cleanUpdates.credit_days = updates.credit_days
    if (updates.delivery_days !== undefined) cleanUpdates.delivery_days = updates.delivery_days?.trim() || null
    if (updates.lead_time !== undefined) cleanUpdates.lead_time = updates.lead_time
    if (updates.status !== undefined) cleanUpdates.status = updates.status?.trim() || null
    if (updates.website !== undefined) cleanUpdates.website = updates.website?.trim() || null
    if (updates.notes !== undefined) cleanUpdates.notes = updates.notes?.trim() || null

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
    logger.error('Error updating supplier:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
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
    logger.error('Error deleting supplier:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
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
    logger.error('Error fetching supplier orders:', error)
    return []
  }
}

/**
 * Get payment history for a supplier
 */
export async function getSupplierPayments(supplierId: string, limit = 50) {
  try {
    const { data, error } = await supabaseAdmin
      .from('supplier_payments')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('[Suppliers] Failed to fetch payments:', error)
    return []
  }
}

/**
 * Record a payment against a supplier (reduces their outstanding balance).
 * Creates a permanent supplier_payments record for audit trail.
 */
export async function recordSupplierPayment(
  supplierId: string,
  amountKSh: number,
  paymentDate?: string,
  paymentMethod?: string,
  referenceNumber?: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Unauthorized' }
    }

    const amount = Math.round(parseFloat(String(amountKSh)))
    if (amount <= 0) return { success: false, error: 'Payment amount must be positive' }

    // Fetch current supplier balance
    const { data: supplier } = await supabaseAdmin
      .from('suppliers')
      .select('balance')
      .eq('id', supplierId)
      .single()

    if (!supplier) return { success: false, error: 'Supplier not found' }

    const updatedBalance = Math.max(0, (supplier.balance || 0) - amount)

    // Insert payment record
    const { error: paymentError } = await supabaseAdmin
      .from('supplier_payments')
      .insert({
        supplier_id: supplierId,
        amount,
        payment_date: paymentDate || new Date().toISOString().split('T')[0],
        payment_method: (paymentMethod && ['bank_transfer', 'cheque', 'cash', 'mpesa'].includes(paymentMethod) ? paymentMethod : 'bank_transfer'),
        reference_number: referenceNumber || null,
        notes: notes || null,
        recorded_by: auth.profile.id,
      })

    if (paymentError) {
      logger.error('[Suppliers] Failed to create supplier_payments record:', paymentError)
      return { success: false, error: 'Failed to record payment: could not create audit trail entry' }
    }

    // Update supplier balance
    const { error } = await supabaseAdmin
      .from('suppliers')
      .update({ balance: updatedBalance, updated_at: new Date().toISOString() })
      .eq('id', supplierId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('[Suppliers] Failed to record payment:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
