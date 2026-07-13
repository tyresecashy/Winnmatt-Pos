'use server'
import { logger } from '@/lib/logger'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface InvoiceMatchItem {
  id: string
  invoice_id: string
  po_item_id: string | null
  receipt_item_id: string | null
  quantity_ordered: number
  quantity_received: number
  quantity_invoiced: number
  quantity_matched: number
  price_ordered: number
  price_received: number
  price_invoiced: number
  match_status: 'pending' | 'matched' | 'quantity_discrepancy' | 'price_discrepancy' | 'unmatched'
  discrepancy_notes: string | null
  created_at: string
  updated_at: string
  po_item?: { id: string; purchase_order_id: string } | null
  receipt_item?: { id: string; receipt_id: string } | null
}

export async function getInvoiceMatchItems(invoiceId: string): Promise<InvoiceMatchItem[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []
    const { data, error } = await supabaseAdmin
      .from('invoice_match_items')
      .select('*, po_item:purchase_order_items(id, purchase_order_id), receipt_item:purchase_receipt_items(id, receipt_id)')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data as unknown as InvoiceMatchItem[]) || []
  } catch (error) {
    logger.error('Error fetching invoice match items:', error)
    return []
  }
}

export async function getInvoiceMatchById(id: string): Promise<InvoiceMatchItem | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null
    const { data, error } = await supabaseAdmin
      .from('invoice_match_items')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as InvoiceMatchItem
  } catch (error) {
    logger.error('Error fetching invoice match item:', error)
    return null
  }
}

export async function updateInvoiceMatchItem(
  id: string,
  updates: Partial<InvoiceMatchItem>
): Promise<InvoiceMatchItem | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null
    const { data, error } = await supabaseAdmin
      .from('invoice_match_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as InvoiceMatchItem
  } catch (error) {
    logger.error('Error updating invoice match item:', error)
    return null
  }
}

export async function getMatchesByStatus(status: string): Promise<any[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []
    const { data, error } = await supabaseAdmin
      .from('invoice_match_items')
      .select(`*, invoice:supplier_invoices(id, invoice_number, total_amount, status, supplier:suppliers(name))`)
      .eq('match_status', status)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching matches by status:', error)
    return []
  }
}

export async function getInvoiceMatchingStats(): Promise<{
  total: number
  matched: number
  pending: number
  discrepancies: number
}> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { total: 0, matched: 0, pending: 0, discrepancies: 0 }
    const { data, error } = await supabaseAdmin
      .from('invoice_match_items')
      .select('match_status')
    if (error) throw error
    const items = data || []
    return {
      total: items.length,
      matched: items.filter(i => i.match_status === 'matched').length,
      pending: items.filter(i => i.match_status === 'pending').length,
      discrepancies: items.filter(i => ['quantity_discrepancy', 'price_discrepancy', 'unmatched'].includes(i.match_status)).length,
    }
  } catch (error) {
    logger.error('Error fetching matching stats:', error)
    return { total: 0, matched: 0, pending: 0, discrepancies: 0 }
  }
}

/**
 * Run 3-way matching for a supplier invoice.
 * Compares PO ordered quantities/prices against received quantities/prices
 * and the invoice amounts, creating invoice_match_items rows.
 */
export async function runInvoiceMatching(invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    // Get the invoice with PO info
    const { data: invoice, error: invError } = await supabaseAdmin
      .from('supplier_invoices')
      .select('*, purchase_order:purchase_orders(id, total_amount, items:purchase_order_items(id, product_id, quantity, unit_price, line_total, received_quantity))')
      .eq('id', invoiceId)
      .single()

    if (invError || !invoice) return { success: false, error: 'Invoice not found' }

    const invoiceData = invoice as unknown as { purchase_order?: { items?: Array<{ id: string; product_id: string; quantity: number; unit_price: number; line_total: number; received_quantity: number }>; total_amount: number }; purchase_order_id: string; total_amount: number }
    const poItems = invoiceData.purchase_order?.items || []
    if (poItems.length === 0) return { success: false, error: 'No PO items to match' }

    // Delete existing match items for this invoice (re-run clears old matches)
    await supabaseAdmin.from('invoice_match_items').delete().eq('invoice_id', invoiceId)

    // For each PO item, find the corresponding receipt items
    const matchRows: Record<string, unknown>[] = []
    for (const poItem of poItems) {
      // Get receipts for this PO, then receipt items for the product
      const { data: poReceipts } = await supabaseAdmin
        .from('purchase_receipts')
        .select('id')
        .eq('purchase_order_id', invoiceData.purchase_order_id)

      const receiptIds = (poReceipts || []).map(r => r.id)
      let totalReceived = 0
      let avgUnitCost = poItem.unit_price
      let firstReceiptItemId: string | null = null

      if (receiptIds.length > 0) {
        const { data: receiptItemsRaw } = await supabaseAdmin
          .from('purchase_receipt_items')
          .select('id, unit_cost')
          .in('purchase_receipt_id', receiptIds)
          .eq('product_id', poItem.product_id)

        const receiptItems = (receiptItemsRaw || []) as unknown as Array<{ id: string; quantity: number; unit_cost: number }>
        const items = receiptItems
        totalReceived = receiptItems.reduce((s, ri) => s + (ri.quantity || 0), 0)
        if (items.length > 0) {
          avgUnitCost = Math.round(receiptItems.reduce((s, ri) => s + (ri.unit_cost || 0), 0) / items.length)
          firstReceiptItemId = items[0].id
        }
      }

      // Proportionally allocate invoice amount across PO items
      const poTotal = (invoiceData.purchase_order?.total_amount || 1)
      const invoiceAllocation = poTotal > 0
        ? Math.round((poItem.line_total || 0) / poTotal * invoiceData.total_amount)
        : 0

      // Determine match status
      let matchStatus = 'matched'
      const discrepancies: string[] = []

      if (poItem.quantity !== poItem.received_quantity) {
        discrepancies.push(`Ordered ${poItem.quantity}, received ${poItem.received_quantity || 0}`)
      }
      if (poItem.unit_price !== avgUnitCost) {
        discrepancies.push(`Price: ordered ${poItem.unit_price}, received avg ${avgUnitCost}`)
      }
      if (invoiceAllocation > 0 && poItem.line_total > 0 && Math.abs(invoiceAllocation - poItem.line_total) > Math.round(poItem.line_total * 0.05)) {
        discrepancies.push(`Invoice amount ${invoiceAllocation} vs expected ${poItem.line_total}`)
      }

      if (discrepancies.length > 0) {
        if (discrepancies.some(d => d.includes('Invoice amount') || d.includes('Price'))) {
          matchStatus = 'price_discrepancy'
        } else {
          matchStatus = 'quantity_discrepancy'
        }
      }

      // Link to first receipt item if exists

      matchRows.push({
        invoice_id: invoiceId,
        po_item_id: poItem.id,
        receipt_item_id: firstReceiptItemId,
        quantity_ordered: poItem.quantity,
        quantity_received: totalReceived,
        quantity_invoiced: poItem.quantity,
        quantity_matched: Math.min(poItem.quantity, totalReceived),
        price_ordered: poItem.unit_price,
        price_received: avgUnitCost,
        price_invoiced: poItem.line_total > 0 ? Math.round(invoiceAllocation / poItem.quantity) : 0,
        match_status: matchStatus,
        discrepancy_notes: discrepancies.length > 0 ? discrepancies.join('; ') : null,
      })
    }

    if (matchRows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('invoice_match_items')
        .insert(matchRows)

      if (insertError) throw insertError
    }

    return { success: true }
  } catch (error) {
    logger.error('Error running invoice matching:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
