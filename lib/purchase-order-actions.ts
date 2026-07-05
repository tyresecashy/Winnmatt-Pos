'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

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
  if (error) throw new Error(error.message)
  return (data || []) as PurchaseOrder[]
}

export async function getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
  await authenticateServerAction()
  const { data, error } = await supabaseAdmin
    .from('purchase_orders').select('*, items:purchase_order_items(*)')
    .eq('id', poId).single()
  if (error) throw new Error(error.message)
  return data as PurchaseOrder
}

export async function createPurchaseOrder(data: {
  branch_id: string; supplier_name: string; supplier_contact?: string;
  expected_date?: string; notes?: string;
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

    const { data: po, error } = await supabaseAdmin.from('purchase_orders').insert({
      po_number: poNumber, branch_id: data.branch_id, supplier_name: data.supplier_name,
      supplier_contact: data.supplier_contact || null, status: 'draft',
      order_date: now.toISOString().split('T')[0],
      expected_date: data.expected_date || null,
      subtotal: subtotalCents, tax_amount: taxCents, total_amount: totalCents,
      notes: data.notes || null, created_by: profile.id,
    }).select('id').single()
    if (error) throw error

    if (data.items.length > 0) {
      const items = data.items.map(i => ({
        purchase_order_id: po.id, product_id: i.product_id || null, product_name: i.product_name,
        sku: i.sku || null, quantity: i.quantity_ordered, received_quantity: 0,
        unit_price: i.unit_price, line_total: i.quantity_ordered * i.unit_price,
      }))
      await supabaseAdmin.from('purchase_order_items').insert(items)
    }
    return { success: true, id: po.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create PO' }
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
    return { success: false, error: error instanceof Error ? error.message : 'Failed' }
  }
}

export async function receivePurchaseOrder(
  poId: string, receivedItems: Array<{ item_id: string; quantity_received: number }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')
    for (const item of receivedItems) {
      await supabaseAdmin.from('purchase_order_items')
        .update({ received_quantity: item.quantity_received }).eq('id', item.item_id)
    }
    const { error } = await supabaseAdmin.from('purchase_orders')
      .update({ status: 'received', received_by: profile.id, received_date: new Date().toISOString().split('T')[0], updated_at: new Date().toISOString() })
      .eq('id', poId).in('status', ['approved'])
    if (error) throw error
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed' }
  }
}

export async function cancelPurchaseOrder(poId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from('purchase_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', poId).in('status', ['draft'])
    if (error) throw error
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed' }
  }
}
