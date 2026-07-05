'use server'
import { logger } from '@/lib/logger';

import { supabaseAdmin } from '@/lib/supabase-server'

export interface PurchaseOrderItem {
  product_id: string
  quantity: number
  unit_price: number
}

export interface CreatePurchaseOrderInput {
  supplier_id: string
  branch_id: string
  items: PurchaseOrderItem[]
  expected_delivery: string
  notes?: string
}

/**
 * Create a new purchase order with items
 */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  try {
    const { supplier_id, branch_id, items, expected_delivery, notes } = input

    if (!supplier_id || !branch_id || !items || items.length === 0) {
      return { success: false, error: 'Supplier, branch, and at least one item are required' }
    }

    // Calculate totals
    let subtotal = 0
    const itemsToInsert: Array<{
      product_id: string
      quantity: number
      unit_price: number
      line_total: number
      received_quantity: number
    }> = []

    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price
      subtotal += lineTotal

      itemsToInsert.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: lineTotal,
        received_quantity: 0,
      })
    }

    const taxPercent = 16 // 16% VAT
    const taxAmount = Math.round(subtotal * (taxPercent / 100))
    const totalAmount = subtotal + taxAmount

    // Create purchase order
    const { data: poData, error: poError } = await supabaseAdmin
      .from('purchase_orders')
      .insert({
        supplier_id,
        branch_id,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        expected_delivery,
        notes: notes || null,
      })
      .select()
      .single()

    if (poError) throw poError

    // Create purchase order items
    const itemsWithOrderId = itemsToInsert.map((item) => ({
      ...item,
      purchase_order_id: poData.id,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('purchase_order_items')
      .insert(itemsWithOrderId)

    if (itemsError) throw itemsError

    return {
      success: true,
      purchase_order: poData,
      message: `Purchase order created successfully`,
    }
  } catch (error) {
    logger.error('Error creating purchase order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create purchase order',
    }
  }
}

/**
 * Get all purchase orders for a branch
 */
export async function getPurchaseOrders(branchId: string, limit: number = 50) {
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
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching purchase orders:', error)
    return []
  }
}

/**
 * Get purchase order by ID with items
 */
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

/**
 * Receive goods - update inventory and create stock movements
 * This is the critical workflow that brings stock into the business
 */
export async function receivePurchaseOrder(poId: string, partial?: boolean) {
  try {
    // Get the PO with all items
    const po = await getPurchaseOrderById(poId)
    if (!po) {
      return { success: false, error: 'Purchase order not found' }
    }

    if (po.status === 'received' || po.status === 'cancelled') {
      return { success: false, error: `Cannot receive a ${po.status} purchase order` }
    }

    // Update inventory for each item
    for (const item of po.items) {
      // Get current inventory record
      const { data: currentInventory, error: fetchError } = await supabaseAdmin
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', po.branch_id)
        .single()

      if (fetchError) {
        // If no inventory record exists, create one
        const { error: createError } = await supabaseAdmin
          .from('inventory')
          .insert({
            product_id: item.product_id,
            branch_id: po.branch_id,
            quantity: item.quantity,
          })

        if (createError) throw new Error(`Failed to create inventory for product ${item.product_id}`)
      } else {
        // Update existing inventory
        const newQuantity = currentInventory.quantity + item.quantity

        const { error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentInventory.id)

        if (updateError) throw new Error(`Failed to update inventory for product ${item.product_id}`)
      }

      // Create stock movement for audit trail
      const { error: movementError } = await supabaseAdmin
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          branch_id: po.branch_id,
          type: 'receipt',
          quantity: item.quantity,
          reference_id: poId,
          notes: `Received from purchase order ${po.id}`,
        })

      if (movementError) throw new Error(`Failed to create stock movement for product ${item.product_id}`)

      // Update the received_quantity in purchase_order_items
      const { error: itemUpdateError } = await supabaseAdmin
        .from('purchase_order_items')
        .update({
          received_quantity: item.quantity,
        })
        .eq('id', item.id)

      if (itemUpdateError) throw new Error(`Failed to update purchase order item ${item.id}`)
    }

    // Update PO status to received
    const { error: poUpdateError } = await supabaseAdmin
      .from('purchase_orders')
      .update({
        status: 'received',
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)

    if (poUpdateError) throw poUpdateError

    // Update supplier balance (add to what we owe them)
    const { error: balanceError } = await supabaseAdmin
      .rpc('increment', {
        table_name: 'suppliers',
        id_column: 'id',
        id_value: po.supplier_id,
        increment_column: 'balance',
        increment_amount: po.total_amount,
      })

    // If RPC fails, try direct update instead
    if (balanceError) {
      const { data: supplier, error: supplierFetchError } = await supabaseAdmin
        .from('suppliers')
        .select('balance')
        .eq('id', po.supplier_id)
        .single()

      if (!supplierFetchError && supplier) {
        await supabaseAdmin
          .from('suppliers')
          .update({
            balance: (supplier.balance || 0) + po.total_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', po.supplier_id)
      }
    }

    return {
      success: true,
      message: 'Purchase order received and inventory updated successfully',
    }
  } catch (error) {
    logger.error('Error receiving purchase order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to receive purchase order',
    }
  }
}

/**
 * Update purchase order status
 */
export async function updatePurchaseOrderStatus(poId: string, status: 'draft' | 'pending' | 'received' | 'cancelled') {
  try {
    const validStatuses = ['draft', 'pending', 'received', 'cancelled']
    if (!validStatuses.includes(status)) {
      return { success: false, error: 'Invalid status' }
    }

    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      purchase_order: data,
      message: `Purchase order status updated to ${status}`,
    }
  } catch (error) {
    logger.error('Error updating purchase order status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update purchase order status',
    }
  }
}

/**
 * Cancel a purchase order
 */
export async function cancelPurchaseOrder(poId: string, reason?: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      message: 'Purchase order cancelled',
    }
  } catch (error) {
    logger.error('Error cancelling purchase order:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel purchase order',
    }
  }
}

/**
 * Get purchase statistics for a branch
 */
export async function getPurchaseStats(branchId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('purchase_orders')
      .select('status, total_amount')
      .eq('branch_id', branchId)

    if (error) throw error

    const stats = {
      total_orders: data?.length || 0,
      total_spent: 0,
      draft: 0,
      pending: 0,
      approved: 0,
      received: 0,
      cancelled: 0,
    }

    data?.forEach((po) => {
      stats.total_spent += po.total_amount || 0
      if (po.status === 'draft') stats.draft++
      else if (po.status === 'pending') stats.pending++
      else if (po.status === 'approved') stats.approved++
      else if (po.status === 'received') stats.received++
      else if (po.status === 'cancelled') stats.cancelled++
    })

    return stats
  } catch (error) {
    logger.error('Error fetching purchase stats:', error)
    return { total_orders: 0, total_spent: 0, draft: 0, pending: 0, approved: 0, received: 0, cancelled: 0 }
  }
}
