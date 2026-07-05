'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface ReceiveItemInput {
  product_id: string
  quantity_received: number
  unit_cost: number
  batch_number?: string | null
  expiry_date?: string | null
}

export async function updatePurchaseOrderStatus(
  poId: string,
  status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled'
) {
  try {
    const validStatuses = ['draft', 'pending', 'approved', 'received', 'cancelled']
    if (!validStatuses.includes(status)) {
      return { success: false, error: 'Invalid status' }
    }

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', poId)
      .select()
      .single()

    if (error) throw error

    const label = status === 'approved' ? 'approved' : status === 'cancelled' ? 'cancelled' : `status updated to ${status}`
    return {
      success: true,
      purchase_order: data,
      message: `Purchase order ${label}`,
    }
  } catch (error) {
    logger.error('Error updating purchase order status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update purchase order status',
    }
  }
}

export async function getPurchaseOrders(opts?: {
  branchId?: string
  supplierId?: string
  status?: string
  fromDate?: string
  toDate?: string
  limit?: number
}) {
  try {
    let query = supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(id, name, contact_person, phone),
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

    if (opts?.branchId) query = query.eq('branch_id', opts.branchId)
    if (opts?.supplierId) query = query.eq('supplier_id', opts.supplierId)
    if (opts?.status) query = query.eq('status', opts.status)
    if (opts?.fromDate) query = query.gte('created_at', opts.fromDate)
    if (opts?.toDate) query = query.lte('created_at', opts.toDate)

    query = query
      .order('created_at', { ascending: false })
      .limit(opts?.limit || 50)

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching purchase orders:', error)
    return []
  }
}

export async function getPurchaseOrderById(poId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(id, name, contact_person, phone),
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
      .eq('id', poId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching purchase order:', error)
    return null
  }
}

export async function receivePurchaseOrder(
  poId: string,
  items: ReceiveItemInput[],
  notes?: string
) {
  try {
    const po = await getPurchaseOrderById(poId)
    if (!po) return { success: false, error: 'Purchase order not found' }
    if (po.status === 'received' || po.status === 'cancelled') {
      return { success: false, error: `Cannot receive a ${po.status} purchase order` }
    }

    if (!items || items.length === 0) {
      return { success: false, error: 'At least one item must be received' }
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser()
    const receivedBy = user?.id || '00000000-0000-0000-0000-000000000000'

    const { data: receipt, error: receiptError } = await supabaseAdmin
      .from('purchase_receipts')
      .insert({
        purchase_order_id: poId,
        supplier_id: po.supplier_id,
        received_by: receivedBy,
        notes: notes || null,
        status: 'completed',
      })
      .select()
      .single()

    if (receiptError) throw receiptError

    const receiptItems = items.map((item) => ({
      purchase_receipt_id: receipt.id,
      product_id: item.product_id,
      quantity_received: item.quantity_received,
      unit_cost: item.unit_cost,
      batch_number: item.batch_number || null,
      expiry_date: item.expiry_date || null,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('purchase_receipt_items')
      .insert(receiptItems)

    if (itemsError) throw itemsError

    for (const item of items) {
      const { data: inv } = await supabaseAdmin
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', po.branch_id)
        .single()

      if (inv) {
        await supabaseAdmin
          .from('inventory')
          .update({
            quantity: inv.quantity + item.quantity_received,
            updated_at: new Date().toISOString(),
          })
          .eq('id', inv.id)
      } else {
        await supabaseAdmin
          .from('inventory')
          .insert({
            product_id: item.product_id,
            branch_id: po.branch_id,
            quantity: item.quantity_received,
          })
      }

      await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          branch_id: po.branch_id,
          type: 'receipt',
          quantity: item.quantity_received,
          reference_type: 'purchase_receipt',
          reference_id: receipt.id,
          notes: `Received from purchase order ${po.id}`,
          created_by: receivedBy,
        })

      const poItem = po.items?.find((i: any) => i.product_id === item.product_id)
      if (poItem) {
        await supabaseAdmin
          .from('purchase_order_items')
          .update({
            received_quantity: (poItem.received_quantity || 0) + item.quantity_received,
          })
          .eq('id', poItem.id)
      }
    }

    await supabaseAdmin
      .from('purchase_orders')
      .update({
        status: 'received',
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)

    const { data: supplier } = await supabaseAdmin
      .from('suppliers')
      .select('balance')
      .eq('id', po.supplier_id)
      .single()

    if (supplier) {
      await supabaseAdmin
        .from('suppliers')
        .update({
          balance: (supplier.balance || 0) + po.total_amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', po.supplier_id)
    }

    return {
      success: true,
      message: 'Goods received and inventory updated successfully',
    }
  } catch (error) {
    logger.error('Error receiving purchase order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to receive purchase order',
    }
  }
}

export async function getPurchaseReceipts(poId?: string) {
  try {
    let query = supabaseAdmin
      .from('purchase_receipts')
      .select(`
        *,
        supplier:suppliers(id, name),
        purchase_order:purchase_orders(id, status, total_amount)
      `)
      .order('created_at', { ascending: false })

    if (poId) query = query.eq('purchase_order_id', poId)

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching purchase receipts:', error)
    return []
  }
}

export async function getPurchaseReceiptById(id: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_receipts')
      .select(`
        *,
        supplier:suppliers(id, name, contact_person, phone),
        purchase_order:purchase_orders(id, status, total_amount, expected_delivery),
        items:purchase_receipt_items(
          id,
          product_id,
          quantity_received,
          unit_cost,
          batch_number,
          expiry_date,
          product:products(id, sku, name)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching purchase receipt:', error)
    return null
  }
}
