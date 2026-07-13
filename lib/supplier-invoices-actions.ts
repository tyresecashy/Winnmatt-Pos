'use server'

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { runInvoiceMatching } from '@/lib/modules/reports'

export interface SupplierInvoice {
  id: string
  invoice_number: string
  supplier_id: string
  purchase_order_id: string | null
  amount: number
  tax_amount: number
  total_amount: number
  due_date: string
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'overdue' | 'cancelled'
  documents: Record<string, unknown> | null
  notes: string | null
  created_by: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
  supplier?: { id: string; name: string } | null
  purchase_order?: { id: string; po_number: string; total_amount: number } | null
}

export async function getSupplierInvoices(supplierId?: string, status?: string) {
  try {
    await authenticateServerAction()
    let q = supabaseAdmin
      .from('supplier_invoices')
      .select('*, supplier:suppliers(id, name), purchase_order:purchase_orders(id, po_number, total_amount)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (supplierId) q = q.eq('supplier_id', supplierId)
    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw error
    return (data || []) as unknown as SupplierInvoice[]
  } catch (error) {
    logger.error('Error fetching supplier invoices:', error)
    return []
  }
}

export async function getSupplierInvoice(id: string) {
  try {
    await authenticateServerAction()
    const { data, error } = await supabaseAdmin
      .from('supplier_invoices')
      .select('*, supplier:suppliers(id, name, contact_person, phone), purchase_order:purchase_orders(id, po_number, total_amount, items:purchase_order_items(id, product_id, quantity, unit_price, line_total, received_quantity))')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as unknown as SupplierInvoice | null
  } catch (error) {
    logger.error('Error fetching supplier invoice:', error)
    return null
  }
}

export async function createSupplierInvoice(data: {
  invoice_number: string
  supplier_id: string
  purchase_order_id?: string
  amount: number
  tax_amount: number
  total_amount: number
  due_date: string
  notes?: string
}) {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const { data: invoice, error } = await supabaseAdmin
      .from('supplier_invoices')
      .insert({
        invoice_number: data.invoice_number,
        supplier_id: data.supplier_id,
        purchase_order_id: data.purchase_order_id || null,
        amount: data.amount,
        tax_amount: data.tax_amount,
        total_amount: data.total_amount,
        due_date: data.due_date,
        notes: data.notes || null,
        created_by: profile.id,
        status: 'submitted',
      })
      .select('id')
      .single()

    if (error) throw error

    // Auto-run matching if linked to a PO
    if (data.purchase_order_id && invoice) {
      runInvoiceMatching(invoice.id).catch(err =>
        logger.error('Auto-matching failed for invoice', invoice.id, err)
      )
    }

    return { success: true, id: invoice.id }
  } catch (error) {
    logger.error('Error creating supplier invoice:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveSupplierInvoice(id: string) {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const { error } = await supabaseAdmin
      .from('supplier_invoices')
      .update({ status: 'approved', approved_by: profile.id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'submitted')

    if (error) throw error

    // Re-run matching on approval (receipts may have been updated since submission)
    runInvoiceMatching(id).catch(err =>
      logger.error('Auto-matching on approval failed', id, err)
    )

    return { success: true }
  } catch (error) {
    logger.error('Error approving supplier invoice:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelSupplierInvoice(id: string) {
  try {
    await authenticateServerAction()
    const { error } = await supabaseAdmin
      .from('supplier_invoices')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['draft', 'submitted'])

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Error cancelling supplier invoice:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function markInvoicePaid(id: string, paymentDate?: string) {
  try {
    await authenticateServerAction()
    const { error } = await supabaseAdmin
      .from('supplier_invoices')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'approved')

    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Error marking invoice paid:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getSupplierInvoiceStats() {
  try {
    await authenticateServerAction()
    const { data, error } = await supabaseAdmin
      .from('supplier_invoices')
      .select('status, total_amount')

    if (error) throw error

    const invoices = (data || []) as { status: string; total_amount: number }[]
    return {
      total: invoices.length,
      totalAmount: invoices.reduce((s: number, i) => s + (i.total_amount || 0), 0),
      draft: invoices.filter((i) => i.status === 'draft').length,
      submitted: invoices.filter((i) => i.status === 'submitted').length,
      approved: invoices.filter((i) => i.status === 'approved').length,
      paid: invoices.filter((i) => i.status === 'paid').length,
      overdue: invoices.filter((i) => i.status === 'overdue').length,
      cancelled: invoices.filter((i) => i.status === 'cancelled').length,
    }
  } catch (error) {
    logger.error('Error fetching invoice stats:', error)
    return { total: 0, totalAmount: 0, draft: 0, submitted: 0, approved: 0, paid: 0, overdue: 0, cancelled: 0 }
  }
}
