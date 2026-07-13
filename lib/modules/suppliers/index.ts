/**
 * Suppliers Module — Public API
 *
 * Manages supplier profiles, invoices, and returns.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/suppliers-actions.ts, lib/supplier-invoices-actions.ts, lib/supplier-returns-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as suppliers from '@/lib/suppliers-actions'
import * as invoices from '@/lib/supplier-invoices-actions'
import * as returns from '@/lib/supplier-returns-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type SupplierOrderRow = Awaited<ReturnType<typeof suppliers.getSupplierOrders>>[number]
type SupplierPaymentRow = Awaited<ReturnType<typeof suppliers.getSupplierPayments>>[number]
type SupplierInvoiceRow = Awaited<ReturnType<typeof invoices.getSupplierInvoices>>[number]
type SupplierInvoiceResult = Awaited<ReturnType<typeof invoices.getSupplierInvoice>>
type SupplierReturnRow = Awaited<ReturnType<typeof returns.getSupplierReturns>>[number]
type SupplierReturnResult = Awaited<ReturnType<typeof returns.getSupplierReturn>>

// ─── Types ──────────────────────────────────────────────────────────────────

export type { Supplier } from '@/lib/suppliers-actions'
export type { SupplierInvoice } from '@/lib/supplier-invoices-actions'
export type { SupplierReturn, SupplierReturnItem } from '@/lib/supplier-returns-actions'

// ─── Public API - Suppliers ─────────────────────────────────────────────────

export async function getSuppliers(): Promise<suppliers.Supplier[]> {
  try {
    return await suppliers.getSuppliers()
  } catch (error) {
    logger.error('[Suppliers Module] getSuppliers failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getSupplierById(supplierId: string): Promise<suppliers.Supplier | null> {
  try {
    return await suppliers.getSupplierById(supplierId)
  } catch (error) {
    logger.error('[Suppliers Module] getSupplierById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function searchSuppliers(query: string): Promise<suppliers.Supplier[]> {
  try {
    return await suppliers.searchSuppliers(query)
  } catch (error) {
    logger.error('[Suppliers Module] searchSuppliers failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createSupplier(data: {
  name: string; contact_person: string; phone: string; email?: string; payment_terms?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await suppliers.createSupplier(data.name, data.contact_person, data.phone, data.email, data.payment_terms)
    if (!result.success) return { success: false, error: result.error }
    return { success: true, id: result.supplier?.id }
  } catch (error) {
    logger.error('[Suppliers Module] createSupplier failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateSupplier(supplierId: string, updates: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await suppliers.updateSupplier(supplierId, updates as Parameters<typeof suppliers.updateSupplier>[1])
    if (!result.success) return { success: false, error: result.error }
    return { success: true }
  } catch (error) {
    logger.error('[Suppliers Module] updateSupplier failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteSupplier(supplierId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await suppliers.deleteSupplier(supplierId)
    if (!result.success) return { success: false, error: result.error }
    return { success: true }
  } catch (error) {
    logger.error('[Suppliers Module] deleteSupplier failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getSupplierOrders(supplierId: string): Promise<SupplierOrderRow[]> {
  try {
    return await suppliers.getSupplierOrders(supplierId)
  } catch (error) {
    logger.error('[Suppliers Module] getSupplierOrders failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getSupplierPayments(supplierId: string, limit?: number): Promise<SupplierPaymentRow[]> {
  try {
    return await suppliers.getSupplierPayments(supplierId, limit)
  } catch (error) {
    logger.error('[Suppliers Module] getSupplierPayments failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function recordSupplierPayment(data: {
  supplierId: string; amountKSh: number; paymentDate?: string; paymentMethod?: string; referenceNumber?: string; notes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    return await suppliers.recordSupplierPayment(data.supplierId, data.amountKSh, data.paymentDate, data.paymentMethod, data.referenceNumber, data.notes)
  } catch (error) {
    logger.error('[Suppliers Module] recordSupplierPayment failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Supplier Invoices ─────────────────────────────────────────

export async function getSupplierInvoices(supplierId?: string, status?: string): Promise<SupplierInvoiceRow[]> {
  try {
    return await invoices.getSupplierInvoices(supplierId, status)
  } catch (error) {
    logger.error('[Suppliers Module] getSupplierInvoices failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getSupplierInvoice(id: string): Promise<SupplierInvoiceResult> {
  try {
    return await invoices.getSupplierInvoice(id)
  } catch (error) {
    logger.error('[Suppliers Module] getSupplierInvoice failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createSupplierInvoice(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await invoices.createSupplierInvoice(data as Parameters<typeof invoices.createSupplierInvoice>[0])
  } catch (error) {
    logger.error('[Suppliers Module] createSupplierInvoice failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveSupplierInvoice(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await invoices.approveSupplierInvoice(id)
  } catch (error) {
    logger.error('[Suppliers Module] approveSupplierInvoice failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelSupplierInvoice(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await invoices.cancelSupplierInvoice(id)
  } catch (error) {
    logger.error('[Suppliers Module] cancelSupplierInvoice failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function markInvoicePaid(id: string, paymentDate?: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await invoices.markInvoicePaid(id, paymentDate)
  } catch (error) {
    logger.error('[Suppliers Module] markInvoicePaid failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Supplier Returns ──────────────────────────────────────────

export async function getSupplierReturns(status?: string): Promise<SupplierReturnRow[]> {
  try {
    return await returns.getSupplierReturns(status)
  } catch (error) {
    logger.error('[Suppliers Module] getSupplierReturns failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getSupplierReturn(id: string): Promise<SupplierReturnResult> {
  try {
    return await returns.getSupplierReturn(id)
  } catch (error) {
    logger.error('[Suppliers Module] getSupplierReturn failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createSupplierReturn(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await returns.createSupplierReturn(data as Parameters<typeof returns.createSupplierReturn>[0])
  } catch (error) {
    logger.error('[Suppliers Module] createSupplierReturn failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveSupplierReturn(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await returns.approveSupplierReturn(id)
  } catch (error) {
    logger.error('[Suppliers Module] approveSupplierReturn failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function cancelSupplierReturn(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await returns.cancelSupplierReturn(id)
  } catch (error) {
    logger.error('[Suppliers Module] cancelSupplierReturn failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Backward-Compatible Re-exports (stats only — not locally declared) ──────

export { getSupplierInvoiceStats } from '@/lib/supplier-invoices-actions'
export { getSupplierReturnStats } from '@/lib/supplier-returns-actions'
