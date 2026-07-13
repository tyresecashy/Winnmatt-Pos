/**
 * Expenses Module — Public API
 *
 * Manages expense categories, expenses, recurring expenses, and invoices.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/expenses-actions.ts and lib/invoice-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as expenseActions from '@/lib/expenses-actions'
import * as invoiceActions from '@/lib/invoice-actions'
import type { Expense, ExpenseCategory, ExpenseStats, RecurringExpense } from '@/lib/expenses-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type InvoiceRow = Awaited<ReturnType<typeof invoiceActions.getInvoices>>[number]
type InvoiceResult = Awaited<ReturnType<typeof invoiceActions.getInvoice>>
type InvoiceStatsResult = Awaited<ReturnType<typeof invoiceActions.getInvoiceStats>>

// Ensure InvoiceResult and InvoiceStatsResult allow null
type NullableInvoiceResult = InvoiceResult | null
type NullableInvoiceStatsResult = InvoiceStatsResult | null

// ─── Public API - Expense Categories ────────────────────────────────────────

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    return await expenseActions.getExpenseCategories()
  } catch (error) {
    logger.error('[Expenses Module] getExpenseCategories failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createExpenseCategory(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await expenseActions.createExpenseCategory(data as Parameters<typeof expenseActions.createExpenseCategory>[0])
    if (!result) return { success: false, error: 'Failed to create category' }
    return { success: true, id: result.id }
  } catch (error) {
    logger.error('[Expenses Module] createExpenseCategory failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateExpenseCategory(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await expenseActions.updateExpenseCategory(id, data)
    return { success: result }
  } catch (error) {
    logger.error('[Expenses Module] updateExpenseCategory failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteExpenseCategory(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await expenseActions.deleteExpenseCategory(id)
    return result
  } catch (error) {
    logger.error('[Expenses Module] deleteExpenseCategory failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Expenses ──────────────────────────────────────────────────

export async function getExpenses(filters?: Record<string, unknown>): Promise<Expense[]> {
  try {
    const result = await expenseActions.getExpenses(filters as unknown as Parameters<typeof expenseActions.getExpenses>[0])
    return result.data ?? []
  } catch (error) {
    logger.error('[Expenses Module] getExpenses failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  try {
    return await expenseActions.getExpenseById(id)
  } catch (error) {
    logger.error('[Expenses Module] getExpenseById failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function createExpense(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await expenseActions.createExpense(data as Parameters<typeof expenseActions.createExpense>[0])
  } catch (error) {
    logger.error('[Expenses Module] createExpense failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function updateExpense(id: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    return await expenseActions.updateExpense(id, data)
  } catch (error) {
    logger.error('[Expenses Module] updateExpense failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await expenseActions.deleteExpense(id)
  } catch (error) {
    logger.error('[Expenses Module] deleteExpense failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function approveExpense(id: string, action: 'approved' | 'rejected', rejectionReason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await expenseActions.approveExpense(id, action, rejectionReason)
  } catch (error) {
    logger.error('[Expenses Module] approveExpense failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getExpenseStats(branchId: string, months?: number): Promise<ExpenseStats | null> {
  try {
    return await expenseActions.getExpenseStats(branchId, months)
  } catch (error) {
    logger.error('[Expenses Module] getExpenseStats failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

// ─── Public API - Recurring Expenses ────────────────────────────────────────

export async function getRecurringExpenses(branchId: string): Promise<RecurringExpense[]> {
  try {
    return await expenseActions.getRecurringExpenses(branchId)
  } catch (error) {
    logger.error('[Expenses Module] getRecurringExpenses failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createRecurringExpense(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    return await expenseActions.createRecurringExpense(data as Parameters<typeof expenseActions.createRecurringExpense>[0])
  } catch (error) {
    logger.error('[Expenses Module] createRecurringExpense failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function toggleRecurringExpense(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    return await expenseActions.toggleRecurringExpense(id, isActive)
  } catch (error) {
    logger.error('[Expenses Module] toggleRecurringExpense failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteRecurringExpense(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await expenseActions.deleteRecurringExpense(id)
  } catch (error) {
    logger.error('[Expenses Module] deleteRecurringExpense failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Invoices ──────────────────────────────────────────────────

export async function createInvoiceFromSale(saleId: string, branchId?: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await invoiceActions.createInvoiceFromSale(saleId, branchId)
    if ('error' in result && result.error) return { success: false, error: result.error as string }
    if ('success' in result) return { success: true, id: (result as { invoice?: { id: string } }).invoice?.id }
    return { success: true }
  } catch (error) {
    logger.error('[Expenses Module] createInvoiceFromSale failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getInvoices(filters?: Record<string, unknown>): Promise<InvoiceRow[]> {
  try {
    return await invoiceActions.getInvoices(filters)
  } catch (error) {
    logger.error('[Expenses Module] getInvoices failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getInvoice(id: string): Promise<NullableInvoiceResult> {
  try {
    return await invoiceActions.getInvoice(id)
  } catch (error) {
    logger.error('[Expenses Module] getInvoice failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function updateInvoiceStatus(id: string, status: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await invoiceActions.updateInvoiceStatus(id, status)
    if ('error' in result && result.error) return { success: false, error: result.error as string }
    return { success: true }
  } catch (error) {
    logger.error('[Expenses Module] updateInvoiceStatus failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function recordInvoicePayment(id: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await invoiceActions.recordInvoicePayment(id, amount)
    if ('error' in result && result.error) return { success: false, error: result.error as string }
    return { success: true }
  } catch (error) {
    logger.error('[Expenses Module] recordInvoicePayment failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteInvoice(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await invoiceActions.deleteInvoice(id)
    if ('error' in result && result.error) return { success: false, error: result.error as string }
    return { success: true }
  } catch (error) {
    logger.error('[Expenses Module] deleteInvoice failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getInvoiceStats(): Promise<NullableInvoiceStatsResult> {
  try {
    const result = await invoiceActions.getInvoiceStats()
    return result
  } catch (error) {
    logger.error('[Expenses Module] getInvoiceStats failed', error instanceof Error ? error.message : String(error))
    return null as unknown as NullableInvoiceStatsResult
  }
}

// ─── Backward-Compatible Type Re-exports ─────────────────────────────────────
export type { Expense, ExpenseCategory, ExpenseStats, RecurringExpense } from '@/lib/expenses-actions'
