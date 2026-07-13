'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { formatKSh } from '@/lib/currency'
import { sendEmailNotification, sendSMSNotification } from '@/lib/notification-service'

// ─── Convert Cart to Quote (Draft Invoice) ─────

export interface CartItemForQuote {
  productId: string | null
  productName: string
  quantity: number
  price: number // cents
}

export interface ConvertQuoteResult {
  success: boolean
  invoiceId?: string
  invoiceNumber?: string
  error?: string
}

export async function convertCartToQuote(
  customerId: string,
  branchId: string,
  items: CartItemForQuote[],
  notes?: string
): Promise<ConvertQuoteResult> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    if (!customerId) {
      return { success: false, error: 'Customer is required' }
    }
    if (!items || items.length === 0) {
      return { success: false, error: 'Cart is empty' }
    }

    // Calculate total
    const totalCents = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    // Generate invoice number via DB function
    const { data: invoiceNumber, error: seqError } = await supabaseAdmin
      .rpc('generate_invoice_number', { p_branch_id: branchId })

    if (seqError || !invoiceNumber) {
      logger.warn('[POS] generate_invoice_number RPC failed, using fallback', { error: seqError })
    }

    const invNum = invoiceNumber || `QTE-${Date.now()}`

    // Create invoice
    const { data: invoice, error: invError } = await supabaseAdmin
      .from('invoices')
      .insert({
        invoice_number: invNum,
        customer_id: customerId,
        branch_id: branchId,
        total_amount_cents: totalCents,
        paid_amount_cents: 0,
        status: 'draft',
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        issued_date: new Date().toISOString().split('T')[0],
        notes: notes || null,
        created_by: auth.profile.id,
      })
      .select('id')
      .single()

    if (invError || !invoice) {
      logger.error('[POS] Failed to create quote invoice:', invError)
      return { success: false, error: 'Operation failed. Please try again.' }
    }

    // Create invoice items
    const invoiceItems = items.map((item, i) => ({
      invoice_id: invoice.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price_cents: item.price,
      total_cents: item.price * item.quantity,
      sort_order: i,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('invoice_items')
      .insert(invoiceItems)

    if (itemsError) {
      logger.error('[POS] Failed to create invoice items:', itemsError)
      // Clean up the invoice if items fail
      await supabaseAdmin.from('invoices').delete().eq('id', invoice.id)
      return { success: false, error: 'Operation failed. Please try again.' }
    }

    logger.info('[POS] Quote created', { invoiceId: invoice.id, invoiceNumber: invNum })

    return { success: true, invoiceId: invoice.id, invoiceNumber: invNum }
  } catch (error) {
    logger.error('[POS] convertCartToQuote error:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Email Sale Receipt ─────────────────────────

export async function emailSaleReceipt(
  saleId: string,
  customerEmail: string,
  customerName: string,
  receiptNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    if (!saleId || !customerEmail) {
      return { success: false, error: 'Sale ID and customer email are required' }
    }

    // Fetch sale items for the receipt body
    const { data: sale } = await supabaseAdmin
      .from('sales')
      .select(`
        id, receipt_number, total_amount, created_at,
        items:sale_items(id, product_id, quantity, unit_price, line_total, product:products(id, name, sku))
      `)
      .eq('id', saleId)
      .single()

    // Build receipt text for the notification log
    const itemsText = ((sale?.items || []) as Record<string, unknown>[]).map((item) => {
      const product = item.product as Record<string, unknown> | null
      return `${product?.name || 'Unknown'} x${item.quantity} @ ${formatKSh(item.unit_price as number)} = ${formatKSh(item.line_total as number)}`
    }).join('\n')

    const receiptBody = [
      `Receipt #${receiptNumber}`,
      `Customer: ${customerName}`,
      `Date: ${sale?.created_at ? new Date(sale.created_at).toLocaleString() : 'N/A'}`,
      '',
      '--- Items ---',
      itemsText,
      '',
      `Total: ${formatKSh(sale?.total_amount || 0)}`,
      '',
      'Thank you for your purchase!',
    ].join('\n')

    // Send via notification service (handles provider + logging)
    await sendEmailNotification(
      customerEmail,
      `Receipt #${receiptNumber} from Winnmatt POS`,
      receiptBody
    )

    logger.info('[POS] Email receipt sent', { saleId, email: customerEmail })
    return { success: true }
  } catch (error) {
    logger.error('[POS] emailSaleReceipt error:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── SMS Sale Receipt ───────────────────────────

export async function smsSaleReceipt(
  saleId: string,
  customerPhone: string,
  customerName: string,
  receiptNumber: string,
  totalAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) {
      return { success: false, error: 'Authentication required' }
    }

    if (!saleId || !customerPhone) {
      return { success: false, error: 'Sale ID and customer phone are required' }
    }

    const smsBody = [
      `Winnmatt POS`,
      `Receipt #${receiptNumber}`,
      `Customer: ${customerName}`,
      `Total: ${formatKSh(totalAmount)}`,
      `Thank you for your purchase!`,
    ].join('\n')

    // Send via notification service (handles provider + logging)
    await sendSMSNotification(customerPhone, smsBody)

    logger.info('[POS] SMS receipt sent', { saleId, phone: customerPhone })
    return { success: true }
  } catch (error) {
    logger.error('[POS] smsSaleReceipt error:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
