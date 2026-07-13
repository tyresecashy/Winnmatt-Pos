'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface ReceiveItemInput {
  product_id: string
  quantity_received: number
  unit_cost: number
  batch_number?: string | null
  expiry_date?: string | null
  quantity_damaged?: number
  quantity_rejected?: number
  rejection_reason?: string | null
}

export async function updatePurchaseOrderStatus(
  poId: string,
  status: 'draft' | 'pending' | 'approved' | 'partially_received' | 'received' | 'cancelled'
) {
  try {
    const validStatuses = ['draft', 'pending', 'approved', 'partially_received', 'received', 'cancelled']
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

    const label = status === 'approved' ? 'approved' : status === 'cancelled' ? 'cancelled' : status === 'received' ? 'received' : status === 'partially_received' ? 'partially received' : `status updated to ${status}`
    return {
      success: true,
      purchase_order: data,
      message: `Purchase order ${label}`,
    }
  } catch (error) {
    logger.error('Error updating purchase order status:', error)
    return {
      success: false,
      error: 'Operation failed. Please try again.',
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

    // Auto-generate GRN number
    const now = new Date()
    const yr = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `GRN-${yr}${mo}-`
    const { count } = await supabaseAdmin
      .from('purchase_receipts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${yr}-${mo}-01`)
      .lt('created_at', `${yr}-${String(now.getMonth() + 2).padStart(2, '0')}-01`)
    const seq = (count || 0) + 1
    const receiptNumber = `${prefix}${String(seq).padStart(4, '0')}`

    const { data: receipt, error: receiptError } = await supabaseAdmin
      .from('purchase_receipts')
      .insert({
        purchase_order_id: poId,
        supplier_id: po.supplier_id,
        received_by: receivedBy,
        notes: notes || null,
        status: 'completed',
        receipt_number: receiptNumber,
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
      quantity_rejected: item.quantity_rejected || 0,
      is_damaged: (item.quantity_damaged || 0) > 0,
      quantity_accepted: item.quantity_received - (item.quantity_damaged || 0) - (item.quantity_rejected || 0),
      rejection_reason: item.rejection_reason || null,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('purchase_receipt_items')
      .insert(receiptItems as never)

    if (itemsError) throw itemsError

    for (const item of items) {
      // Only add acceptable quantity to inventory (exclude damaged/rejected)
      const acceptedQty = item.quantity_received - (item.quantity_damaged || 0) - (item.quantity_rejected || 0)

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
            quantity: inv.quantity + acceptedQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', inv.id)
      } else if (acceptedQty > 0) {
        await supabaseAdmin
          .from('inventory')
          .insert({
            product_id: item.product_id,
            branch_id: po.branch_id,
            quantity: acceptedQty,
          })
      }

      // Stock movement for received quantity (including damaged/rejected for traceability)
      await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          branch_id: po.branch_id,
          type: 'receipt',
          quantity: item.quantity_received,
          reference_type: 'purchase_receipt',
          reference_id: receipt.id,
          notes: `Received from purchase order ${po.id}${acceptedQty !== item.quantity_received ? ` (${acceptedQty} accepted, ${item.quantity_received - acceptedQty} damaged/rejected)` : ''}`,
          created_by: receivedBy,
        })

      // Sync batch tracking if batch number provided
      if (item.batch_number) {
        const { data: existingBatch } = await supabaseAdmin
          .from('batch_tracking')
          .select('id, quantity')
          .eq('batch_number', item.batch_number)
          .eq('product_id', item.product_id)
          .maybeSingle()

        if (existingBatch) {
          await supabaseAdmin
            .from('batch_tracking')
            .update({
              quantity: existingBatch.quantity + acceptedQty,
              expiry_date: item.expiry_date || (existingBatch as Record<string, unknown>).expiry_date,
              status: 'active',
            } as never)
            .eq('id', existingBatch.id)
        } else {
          await supabaseAdmin
            .from('batch_tracking')
            .insert({
              batch_number: item.batch_number,
              product_id: item.product_id,
              supplier_id: po.supplier_id,
              quantity: acceptedQty,
              expiry_date: item.expiry_date || null,
              received_date: new Date().toISOString(),
              status: 'active',
            })
        }
      }

      const poItem = (po.items as Record<string, unknown>[] | undefined)?.find((i) => i.product_id === item.product_id)
      if (poItem) {
        await supabaseAdmin
          .from('purchase_order_items')
          .update({
            received_quantity: ((poItem.received_quantity as number) || 0) + item.quantity_received,
          })
          .eq('id', poItem.id as string)
      }
    }

    // Determine if partially or fully received
    const { data: updatedPO } = await supabaseAdmin
      .from('purchase_orders')
      .select('items:purchase_order_items(id, quantity, received_quantity)')
      .eq('id', poId)
      .single()

    const allFull = (updatedPO?.items as Record<string, unknown>[] | undefined)?.every((i) => ((i.received_quantity as number) || 0) >= (i.quantity as number)) ?? false
    const anyReceived = (updatedPO?.items as Record<string, unknown>[] | undefined)?.some((i) => ((i.received_quantity as number) || 0) > 0) ?? false
    const newStatus = allFull ? 'received' : anyReceived ? 'partially_received' : 'approved'

    await supabaseAdmin
      .from('purchase_orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)

    // Auto-create / clear backorder for items
    for (const item of items) {
      const poItem = (po.items as Record<string, unknown>[] | undefined)?.find((i) => i.product_id === item.product_id)
      if (!poItem) continue
      const newReceivedQty = ((poItem.received_quantity as number) || 0) + item.quantity_received
      if (newReceivedQty < (poItem.quantity as number)) {
        await supabaseAdmin.from('purchase_order_items')
          .update({ backorder_quantity: (poItem.quantity as number) - newReceivedQty } as never)
          .eq('id', poItem.id as string)
      } else {
        // Clear backorder when fully received
        await supabaseAdmin.from('purchase_order_items')
          .update({ backorder_quantity: 0 } as never)
          .eq('id', poItem.id as string)
          .neq('backorder_quantity' as never, 0 as never)
      }
    }

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
      error: 'Operation failed. Please try again.',
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

export async function getBackorders() {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_order_items')
      .select(`
        id, product_id, quantity, received_quantity, backorder_quantity,
        unit_price,
        purchase_order:purchase_orders!inner(id, po_number, supplier_name, status, order_date, expected_date),
        product:products(id, sku, name)
      `)
      .gt('backorder_quantity', 0)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching backorders:', error)
    return []
  }
}
