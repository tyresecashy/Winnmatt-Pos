'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

export interface SupplierReturn {
  id: string
  return_number: string
  supplier_id: string
  purchase_order_id: string | null
  receipt_id: string | null
  reason: string | null
  status: 'draft' | 'submitted' | 'approved' | 'completed' | 'cancelled'
  credit_amount: number
  replacement_required: boolean
  notes: string | null
  created_by: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
  supplier?: { id: string; name: string } | null
  purchase_order?: { id: string; po_number: string } | null
  items?: SupplierReturnItem[]
}

export interface SupplierReturnItem {
  id: string
  supplier_return_id: string
  product_id: string
  quantity_returned: number
  unit_price: number
  reason: string | null
  batch_number: string | null
  condition_notes: string | null
  product?: { id: string; sku: string; name: string } | null
}

export async function getSupplierReturns(status?: string) {
  try {
    await authenticateServerAction()
    let q = supabaseAdmin
      .from('supplier_returns')
      .select('*, supplier:suppliers(id, name), purchase_order:purchase_orders(id, po_number)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw error
    return (data || []) as unknown as SupplierReturn[]
  } catch (error) {
    logger.error('Error fetching supplier returns:', error)
    return []
  }
}

export async function getSupplierReturn(id: string) {
  try {
    await authenticateServerAction()
    const { data, error } = await supabaseAdmin
      .from('supplier_returns')
      .select(`
        *, supplier:suppliers(id, name),
        purchase_order:purchase_orders(id, po_number),
        items:supplier_return_items(*, product:products(id, sku, name))
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data as unknown as SupplierReturn | null
  } catch (error) {
    logger.error('Error fetching supplier return:', error)
    return null
  }
}

export async function createSupplierReturn(data: {
  supplier_id: string
  purchase_order_id?: string
  receipt_id?: string
  reason?: string
  notes?: string
  replacement_required?: boolean
  items: Array<{
    product_id: string
    quantity_returned: number
    unit_price: number
    reason?: string
    batch_number?: string
  }>
}) {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    // Generate return number
    const now = new Date()
    const prefix = `SR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`
    const { count } = await supabaseAdmin
      .from('supplier_returns')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
    const returnNumber = `${prefix}${String((count || 0) + 1).padStart(4, '0')}`

    const totalCredit = data.items.reduce((s, i) => s + i.quantity_returned * i.unit_price, 0)

    const { data: returnRec, error: retError } = await supabaseAdmin
      .from('supplier_returns')
      .insert({
        return_number: returnNumber,
        supplier_id: data.supplier_id,
        purchase_order_id: data.purchase_order_id || null,
        receipt_id: data.receipt_id || null,
        reason: data.reason || null,
        notes: data.notes || null,
        replacement_required: data.replacement_required || false,
        credit_amount: totalCredit,
        created_by: profile.id,
        status: 'submitted',
      })
      .select('id')
      .single()

    if (retError) throw retError

    // Insert items
    if (data.items.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from('supplier_return_items')
        .insert(data.items.map(i => ({
          supplier_return_id: returnRec.id,
          product_id: i.product_id,
          quantity_returned: i.quantity_returned,
          unit_price: i.unit_price,
          reason: i.reason || null,
          batch_number: i.batch_number || null,
        })))

      if (itemsError) throw itemsError
    }

    return { success: true, id: returnRec.id, return_number: returnNumber }
  } catch (error) {
    logger.error('Error creating supplier return:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveSupplierReturn(id: string) {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const returnData = await getSupplierReturn(id)
    if (!returnData) return { success: false, error: 'Return not found' }

    // Update status to approved, then completed with inventory adjustments
    const { error: updateError } = await supabaseAdmin
      .from('supplier_returns')
      .update({
        status: 'completed',
        approved_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'submitted')

    if (updateError) throw updateError

    // Decrement inventory and create stock movements for each returned item
    if (returnData.items) {
      for (const item of returnData.items) {
        // Decrement inventory
        const { data: inv } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .maybeSingle()

        if (inv) {
          await supabaseAdmin
            .from('inventory')
            .update({ quantity: Math.max(0, inv.quantity - item.quantity_returned) })
            .eq('id', inv.id)
        }

        // Create stock movement
        await supabaseAdmin
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            type: 'return',
            quantity: item.quantity_returned,
            branch_id: profile.branch_id ?? '',
            reference_type: 'supplier_return',
            reference_id: id,
            notes: `Returned to supplier ${returnData.supplier?.name || ''}: ${item.reason || ''}`,
            created_by: profile.id,
          })
      }
    }

    // Update supplier balance (credit)
    const { data: supplier } = await supabaseAdmin
      .from('suppliers')
      .select('balance')
      .eq('id', returnData.supplier_id)
      .single()

    if (supplier) {
      await supabaseAdmin
        .from('suppliers')
        .update({ balance: Math.max(0, (supplier.balance || 0) - returnData.credit_amount) })
        .eq('id', returnData.supplier_id)
    }

    return { success: true }
  } catch (error) {
    logger.error('Error approving supplier return:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelSupplierReturn(id: string) {
  try {
    await authenticateServerAction()
    const { error } = await supabaseAdmin
      .from('supplier_returns')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['draft', 'submitted'])

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Error cancelling supplier return:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getSupplierReturnStats() {
  try {
    await authenticateServerAction()
    const { data, error } = await supabaseAdmin
      .from('supplier_returns')
      .select('status, credit_amount')

    if (error) throw error

    const returns = (data || []) as { status: string; credit_amount: number }[]
    return {
      total: returns.length,
      totalCredit: returns.reduce((s: number, r) => s + (r.credit_amount || 0), 0),
      draft: returns.filter((r) => r.status === 'draft').length,
      submitted: returns.filter((r) => r.status === 'submitted').length,
      completed: returns.filter((r) => r.status === 'completed').length,
      cancelled: returns.filter((r) => r.status === 'cancelled').length,
    }
  } catch (error) {
    logger.error('Error fetching return stats:', error)
    return { total: 0, totalCredit: 0, draft: 0, submitted: 0, completed: 0, cancelled: 0 }
  }
}
