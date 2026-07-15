'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { receivePurchaseOrder as receivePOCanonical, type ReceiveItemInput } from '@/lib/procurement-actions'

export interface PurchaseOrder {
  id: string; po_number: string; branch_id: string; supplier_name: string;
  supplier_contact: string | null; status: string; order_date: string;
  expected_date: string | null; received_date: string | null;
  subtotal: number; tax_amount: number; total_amount: number;
  notes: string | null; created_by: string | null; approved_by: string | null;
  received_by: string | null; created_at: string; updated_at: string;
  items?: PurchaseOrderItem[];
}
export interface PurchaseOrderItem {
  id: string; po_id: string; product_id: string | null; product_name: string;
  sku: string | null; quantity_ordered: number; quantity_received: number;
  unit_price: number; line_total: number;
}

export async function getPurchaseOrders(branchId?: string, status?: string): Promise<PurchaseOrder[]> {
  await authenticateServerAction()
  let q = supabaseAdmin.from('purchase_orders').select('*').order('created_at', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return (data || []) as unknown as PurchaseOrder[]
}

export async function getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
  await authenticateServerAction()
  const { data, error } = await supabaseAdmin
    .from('purchase_orders').select('*, items:purchase_order_items(*)')
    .eq('id', poId).single()
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  // Map DB column 'quantity' to expected 'quantity_ordered'
  const po = data as Record<string, unknown> & { items?: Array<Record<string, unknown>> }
  if (po?.items) {
    po.items = po.items.map((item: Record<string, unknown>) => ({
      ...item,
      quantity_ordered: (item.quantity as number) ?? (item.quantity_ordered as number) ?? 0,
    }))
  }
  return po as unknown as PurchaseOrder
}

export async function createPurchaseOrder(data: {
  branch_id: string; supplier_name: string; supplier_contact?: string;
  supplier_id?: string; expected_date?: string; notes?: string;
  items: Array<{ product_id?: string; product_name: string; sku?: string; quantity_ordered: number; unit_price: number }>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')
    const now = new Date()
    const poNumber = `PO-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${Math.random().toString(36).substring(2,6).toUpperCase()}`

    const subtotalCents = data.items.reduce((s, i) => s + i.quantity_ordered * i.unit_price, 0)
    const taxCents = Math.round(subtotalCents * 0.16) // 16% VAT
    const totalCents = subtotalCents + taxCents

    const { data: po, error } = await supabaseAdmin.from('purchase_orders' as never).insert({
      po_number: poNumber, branch_id: data.branch_id, supplier_name: data.supplier_name,
      supplier_contact: data.supplier_contact || null,
      supplier_id: data.supplier_id || null,
      status: 'draft',
      order_date: now.toISOString().split('T')[0],
      expected_date: data.expected_date || null,
      subtotal: subtotalCents, tax_amount: taxCents, total_amount: totalCents,
      notes: data.notes || null, created_by: profile.id,
    } as never).select('id').single()
    if (error) throw error
    const poRecord = po as unknown as { id: string }

    if (data.items.length > 0) {
      const items = data.items.map(i => ({
        purchase_order_id: poRecord.id, product_id: i.product_id || null, product_name: i.product_name,
        sku: i.sku || null, quantity: i.quantity_ordered, received_quantity: 0,
        unit_price: i.unit_price, line_total: i.quantity_ordered * i.unit_price,
      }))
      await supabaseAdmin.from('purchase_order_items' as never).insert(items as never)
    }
    return { success: true, id: poRecord.id }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approvePurchaseOrder(poId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')
    const { error } = await supabaseAdmin.from('purchase_orders')
      .update({ status: 'approved', approver_id: profile.id, updated_at: new Date().toISOString() })
      .eq('id', poId).eq('status', 'draft')
    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Operation failed', { error: error })
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Receive a purchase order.
 *
 * This is a thin wrapper that maps item_id-based inputs to product_id-based
 * ReceiveItemInput[], then delegates all business logic to the canonical
 * implementation in @/lib/procurement-actions.
 */
export interface ReceiveItem {
  item_id: string
  quantity_received: number
  batch_number?: string | null
  expiry_date?: string | null
  quantity_damaged?: number
  quantity_rejected?: number
  rejection_reason?: string | null
}

export async function receivePurchaseOrder(
  poId: string,
  receivedItems: ReceiveItem[],
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    // Fetch PO items to map item_id → product_id + unit_cost
    const { data: poItems, error: poError } = await supabaseAdmin
      .from('purchase_order_items')
      .select('id, product_id, unit_price')
      .eq('purchase_order_id', poId)

    if (poError) return { success: false, error: 'Failed to fetch purchase order items' }

    // Map to ReceiveItemInput format
    const canonicalItems: ReceiveItemInput[] = []
    for (const received of receivedItems) {
      const poItem = poItems?.find((i) => i.id === received.item_id)
      if (!poItem) {
        logger.warn(`[PO] Item ${received.item_id} not found in PO ${poId}, skipping`)
        continue
      }
      canonicalItems.push({
        product_id: poItem.product_id,
        quantity_received: received.quantity_received,
        unit_cost: poItem.unit_price || 0,
        batch_number: received.batch_number || null,
        expiry_date: received.expiry_date || null,
        quantity_damaged: received.quantity_damaged || 0,
        quantity_rejected: received.quantity_rejected || 0,
        rejection_reason: received.rejection_reason || null,
      })
    }

    if (canonicalItems.length === 0) {
      return { success: false, error: 'No valid items to receive' }
    }

    // Delegate to canonical implementation
    const result = await receivePOCanonical(poId, canonicalItems, notes)
    return { success: result.success, error: result.error }
  } catch (error) {
    logger.error('[PO] Failed to receive purchase order:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}


