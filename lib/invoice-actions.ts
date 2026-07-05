'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  branch_id: string
  sale_id: string | null
  total_amount_cents: number
  paid_amount_cents: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'partially_paid'
  due_date: string
  issued_date: string
  paid_date: string | null
  notes: string | null
  terms: string | null
  created_by: string
  created_at: string
  updated_at: string
  customer_name?: string
  customer_phone?: string
  branch_name?: string
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price_cents: number
  total_cents: number
  tax_percent: number
  tax_cents: number
  sort_order: number
}

// ─── Generate invoice number ───────────────────────────────────────────────

async function generateInvoiceNumber(branchId: string) {
  const { data, error } = await supabaseAdmin
    .rpc('generate_invoice_number', { p_branch_id: branchId })

  if (error) {
    // Fallback: manual generation
    const prefix = 'INV'
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    return `${prefix}-${dateStr}-${rand}`
  }
  return data
}

// ─── Create invoice from a credit sale ─────────────────────────────────────

export async function createInvoiceFromSale(saleId: string, dueDate?: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    // Fetch the sale
    const { data: sale, error: saleErr } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()
    if (saleErr) return { error: 'Sale not found: ' + saleErr.message }
    if (!sale.customer_id) return { error: 'Sale has no customer' }

    // Fetch sale items
    const { data: saleItems } = await supabaseAdmin
      .from('sale_items')
      .select('*, product:products(name)')
      .eq('sale_id', saleId)

    // Check if invoice already exists for this sale
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number')
      .eq('sale_id', saleId)
      .single()

    if (existing) {
      return { error: 'Invoice already exists', invoice: existing }
    }

    // Generate number
    const invoiceNumber = await generateInvoiceNumber(sale.branch_id)

    // Calculate totals
    const totalAmount = sale.total_amount || 0
    const defaultDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Create invoice
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_id: sale.customer_id,
        branch_id: sale.branch_id,
        sale_id: sale.id,
        // NOTE: Column name says _cents but value is in KES (post-migration convention)
        total_amount_cents: totalAmount,
        paid_amount_cents: 0,
        status: 'sent',
        due_date: defaultDueDate,
        issued_date: new Date().toISOString().split('T')[0],
        created_by: auth.profile.id,
      })
      .select()
      .single()

    if (invErr) return { error: invErr.message }

    // Create invoice items
    if (saleItems && saleItems.length > 0) {
      const items = saleItems.map((si: any, idx: number) => ({
        invoice_id: invoice.id,
        product_id: si.product_id,
        product_name: si.product?.name || si.product_name || 'Unknown Product',
        quantity: si.quantity,
        // NOTE: Column name says _cents but value is in KES (post-migration convention)
        unit_price_cents: Math.round(si.unit_price),
        total_cents: Math.round(si.unit_price * si.quantity),
        tax_percent: si.tax_percent || 0,
        tax_cents: Math.round((si.unit_price * si.quantity * (si.tax_percent || 0)) / 100),
        sort_order: idx,
      }))

      const { error: itemsErr } = await supabaseAdmin
        .from('invoice_items')
        .insert(items)

      if (itemsErr) return { error: 'Invoice created but items failed: ' + itemsErr.message }
    }

    revalidatePath('/invoices')
    return { success: true, invoice }
  } catch (err: any) {
    return { error: err.message || 'Failed to create invoice' }
  }
}

// ─── List invoices ─────────────────────────────────────────────────────────

export async function getInvoices(options?: {
  status?: string
  customerId?: string
  branchId?: string
  limit?: number
}) {
  let query = supabaseAdmin
    .from('invoice_summary')
    .select('*')

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  if (options?.customerId) {
    query = query.eq('customer_id', options.customerId)
  }
  if (options?.branchId) {
    query = query.eq('branch_id', options.branchId)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100)

  if (error) throw new Error(error.message)
  return (data || []) as Invoice[]
}

// ─── Get single invoice with items ─────────────────────────────────────────

export async function getInvoice(invoiceId: string) {
  const { data: invoice, error: invErr } = await supabaseAdmin
    .from('invoice_summary')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (invErr) throw new Error(invErr.message)

  const { data: items } = await supabaseAdmin
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order')

  return {
    ...invoice,
    items: items || [],
  } as Invoice
}

// ─── Update invoice status ─────────────────────────────────────────────────

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    const updates: Record<string, any> = { status, updated_at: new Date().toISOString() }
    if (status === 'paid') {
      updates.paid_date = new Date().toISOString().split('T')[0]
      const { data: inv } = await supabaseAdmin
        .from('invoices')
        .select('total_amount_cents')
        .eq('id', invoiceId)
        .single()
      updates.paid_amount_cents = inv?.total_amount_cents || 0
    }
    if (status === 'cancelled') {
      updates.paid_amount_cents = 0
    }

    const { error } = await supabaseAdmin
      .from('invoices')
      .update(updates)
      .eq('id', invoiceId)

    if (error) return { error: error.message }

    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to update invoice status' }
  }
}

// ─── Record payment against invoice ────────────────────────────────────────

export async function recordInvoicePayment(invoiceId: string, amountCents: number) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    // Get current invoice
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (!invoice) return { error: 'Invoice not found' }
    if (invoice.status === 'paid') return { error: 'Invoice is already paid' }
    if (invoice.status === 'cancelled') return { error: 'Invoice is cancelled' }

    const newPaid = Math.min(invoice.paid_amount_cents + amountCents, invoice.total_amount_cents)
    const newStatus = newPaid >= invoice.total_amount_cents ? 'paid' : (newPaid > 0 ? 'partially_paid' : invoice.status)
    const paidDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : invoice.paid_date

    // Optimistic lock: ensure paid_amount_cents hasn't changed since we read it
    const { data: updatedRows, error } = await supabaseAdmin
      .from('invoices')
      .update({
        paid_amount_cents: newPaid,
        status: newStatus,
        paid_date: paidDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('paid_amount_cents', invoice.paid_amount_cents)
      .select('id')

    if (error) return { error: error.message }
    if (!updatedRows || updatedRows.length === 0) {
      return { error: 'Concurrent modification detected — please retry' }
    }

    revalidatePath('/invoices')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to record payment' }
  }
}

// ─── Delete invoice (draft only) ───────────────────────────────────────────

export async function deleteInvoice(invoiceId: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { error: 'Not authenticated' }

    // Only allow deleting draft invoices
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('status')
      .eq('id', invoiceId)
      .single()

    if (!invoice) return { error: 'Invoice not found' }
    if (invoice.status !== 'draft') return { error: 'Only draft invoices can be deleted' }

    const { error } = await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('id', invoiceId)

    if (error) return { error: error.message }

    revalidatePath('/invoices')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to delete invoice' }
  }
}

// ─── Dashboard stats ───────────────────────────────────────────────────────

export async function getInvoiceStats() {
  const { data: allInvoices } = await supabaseAdmin
    .from('invoice_summary')
    .select('*')

  if (!allInvoices) {
    return {
      total_count: 0,
      total_value_cents: 0,
      total_paid_cents: 0,
      total_outstanding_cents: 0,
      overdue_count: 0,
      overdue_total_cents: 0,
      status_breakdown: {} as Record<string, number>,
    }
  }

  const statusBreakdown: Record<string, number> = {}
  let overdueCount = 0
  let overdueTotal = 0
  let totalValue = 0
  let totalPaid = 0

  for (const inv of allInvoices as any[]) {
    totalValue += inv.total_amount_cents || 0
    totalPaid += inv.paid_amount_cents || 0
    statusBreakdown[inv.status] = (statusBreakdown[inv.status] || 0) + 1
    if (inv.status === 'overdue') {
      overdueCount++
      overdueTotal += (inv.total_amount_cents - inv.paid_amount_cents)
    }
  }

  return {
    total_count: allInvoices.length,
    total_value_cents: totalValue,
    total_paid_cents: totalPaid,
    total_outstanding_cents: totalValue - totalPaid,
    overdue_count: overdueCount,
    overdue_total_cents: overdueTotal,
    status_breakdown: statusBreakdown,
  }
}
