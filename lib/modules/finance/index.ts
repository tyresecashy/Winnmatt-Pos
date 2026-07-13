/**
 * Finance Module — Public API
 *
 * Handles chart of accounts, journal entries, banking, reports.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/finance-actions.ts and lib/finance-reports.ts.
 */

import { logger } from '@/lib/logger'
import {
  getAccounts as realGetAccounts,
  createJournalEntry as realCreateJournalEntry,
  getJournalEntries as realGetJournalEntries,
  getJournalEntry as realGetJournalEntry,
  voidJournalEntry as realVoidJournalEntry,
  getAccountBalances as realGetAccountBalances,
  getFinanceStats as realGetFinanceStats,
  getAccountsByType as realGetAccountsByType,
  createAccount as realCreateAccount,
  updateAccount as realUpdateAccount,
  deleteAccount as realDeleteAccount,
  getBankAccounts as realGetBankAccounts,
  createBankAccount as realCreateBankAccount,
  deleteBankAccount as realDeleteBankAccount,
  getBankTransactions as realGetBankTransactions,
  createBankTransaction as realCreateBankTransaction,
  reconcileBankTransaction as realReconcileBankTransaction,
  getBankStats as realGetBankStats,
  getReconciliations as realGetReconciliations,
  getUnreconciledTransactions as realGetUnreconciledTransactions,
  getUnmatchedJournalEntries as realGetUnmatchedJournalEntries,
  createReconciliation as realCreateReconciliation,
  completeReconciliation as realCompleteReconciliation,
  getFinancialPeriods as realGetFinancialPeriods,
  createFinancialPeriod as realCreateFinancialPeriod,
  closeFinancialPeriod as realCloseFinancialPeriod,
} from '@/lib/finance-actions'
import { generateTrialBalance as realGenerateTrialBalance, generateProfitAndLoss as realGenerateProfitAndLoss } from '@/lib/finance-reports'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type BankTransactionRow = Awaited<ReturnType<typeof realGetBankTransactions>>[number]
type BankStatsResult = Awaited<ReturnType<typeof realGetBankStats>>
type ReconciliationRow = Awaited<ReturnType<typeof realGetReconciliations>>[number]
type UnreconciledTransactionRow = Awaited<ReturnType<typeof realGetUnreconciledTransactions>>[number]
type UnmatchedJournalEntryRow = Awaited<ReturnType<typeof realGetUnmatchedJournalEntries>>[number]

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Account {
  id: string
  code: string
  name: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parent_id: string | null
  branch_id: string | null
  is_active: boolean
  description: string | null
  opening_balance: number
  current_balance: number
  currency: string
  created_at: string
  updated_at: string
}

export interface JournalEntry {
  id: string
  entry_number: string
  entry_date: string
  description: string
  reference_type: string | null
  reference_id: string | null
  period_id: string | null
  branch_id: string | null
  status: string | null
  is_adjusting: boolean | null
  total_debit: number | null
  total_credit: number | null
  posted_by: string | null
  posted_at: string | null
  voided_by: string | null
  voided_at: string | null
  void_reason: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface JournalEntryLine {
  id: string
  journal_entry_id: string
  account_id: string
  debit: number | null
  credit: number | null
  description: string | null
  line_number: number
  created_at: string
}

export interface BankAccount {
  id: string
  account_id: string
  bank_name: string
  account_name: string
  account_number: string | null
  account_type: string | null
  current_balance: number | null
  opening_balance: number | null
  currency: string | null
  branch_id: string | null
  is_active: boolean | null
  last_reconciled_at: string | null
  created_at: string
  updated_at: string
}

export interface FinancialPeriod {
  id: string
  name: string
  period_type: string
  start_date: string
  end_date: string
  status: string | null
  branch_id: string | null
  closed_by: string | null
  closed_at: string | null
  created_at: string
}

// ─── Events Emitted ─────────────────────────────────────────────────────────

export const FINANCE_EVENTS = {
  JOURNAL_POSTED: 'journal_entry.posted',
  PERIOD_CLOSED: 'period.closed',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',
} as const

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a journal entry with lines.
 * Delegates to createJournalEntry in lib/finance-actions.ts.
 * Emits: journal_entry.posted
 */
export async function createJournalEntry(input: {
  description: string
  entry_date: string
  branch_id?: string
  reference_type?: string
  reference_id?: string
  lines: Array<{
    account_id: string
    debit: number
    credit: number
    description?: string
  }>
  created_by: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await realCreateJournalEntry({
      description: input.description,
      entry_date: input.entry_date,
      branch_id: input.branch_id,
      notes: input.reference_type ? `${input.reference_type}:${input.reference_id ?? ''}` : undefined,
      lines: input.lines.map((l) => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      })),
    })
    // realCreateJournalEntry returns { success, error?, entry? }
    if (!result.success) return { success: false, error: result.error }
    return { success: true, id: (result as Record<string, unknown>).entry as string | undefined }
  } catch (error) {
    logger.error('[Finance Module] createJournalEntry failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get chart of accounts.
 * Delegates to getAccounts in lib/finance-actions.ts.
 */
export async function getAccounts(branchId?: string): Promise<Account[]> {
  try {
    const result = await realGetAccounts(branchId)
    if (!Array.isArray(result)) return []
    return result as unknown as Account[]
  } catch (error) {
    logger.error('[Finance Module] getAccounts failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Get general ledger entries.
 * Delegates to getJournalEntries in lib/finance-actions.ts.
 * Supports account_id filtering (applied client-side after fetch).
 */
export async function getGeneralLedger(filters: {
  account_id?: string
  branch_id?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}): Promise<{ data: JournalEntry[]; total: number }> {
  try {
    const limit = filters.limit || 50
    const offset = filters.offset || 0
    const entries = await realGetJournalEntries({
      branchId: filters.branch_id,
      startDate: filters.start_date,
      endDate: filters.end_date,
      limit,
      offset,
    })

    if (!Array.isArray(entries)) return { data: [], total: 0 }

    // If account_id filter is provided, filter entries that reference that account
    let filtered = entries as unknown as JournalEntry[]
    if (filters.account_id) {
      filtered = filtered.filter((entry) => {
        const lines = (entry as unknown as Record<string, unknown>).lines as Array<Record<string, unknown>> | undefined
        if (!lines) return false
        return lines.some((l) => l.account_id === filters.account_id)
      })
    }

    return { data: filtered.slice(0, limit), total: filtered.length }
  } catch (error) {
    logger.error('[Finance Module] getGeneralLedger failed', error instanceof Error ? error.message : String(error))
    return { data: [], total: 0 }
  }
}

/**
 * Generate trial balance.
 * Delegates to generateTrialBalance in lib/finance-reports.ts.
 */
export async function generateTrialBalance(
  startDate: string,
  endDate: string
): Promise<{
  accounts: Array<Account & { debit: number; credit: number }>
  totalDebit: number
  totalCredit: number
}> {
  try {
    const result = await realGenerateTrialBalance(startDate, endDate)
    return {
      accounts: (result.accounts || []) as unknown as Array<Account & { debit: number; credit: number }>,
      totalDebit: result.totalDebit ?? 0,
      totalCredit: result.totalCredit ?? 0,
    }
  } catch (error) {
    logger.error('[Finance Module] generateTrialBalance failed', error instanceof Error ? error.message : String(error))
    return { accounts: [], totalDebit: 0, totalCredit: 0 }
  }
}

/**
 * Generate profit & loss statement.
 * Delegates to generateProfitAndLoss in lib/finance-reports.ts.
 */
export async function generateProfitAndLoss(
  startDate: string,
  endDate: string
): Promise<{
  revenue: Array<Account & { balance: number }>
  expenses: Array<Account & { balance: number }>
  totalRevenue: number
  totalExpenses: number
  netIncome: number
}> {
  try {
    const result = await realGenerateProfitAndLoss(startDate, endDate)
    return {
      revenue: (result.revenue || []) as unknown as Array<Account & { balance: number }>,
      expenses: (result.expenses || []) as unknown as Array<Account & { balance: number }>,
      totalRevenue: result.totalRevenue ?? 0,
      totalExpenses: result.totalExpenses ?? 0,
      netIncome: result.netIncome ?? 0,
    }
  } catch (error) {
    logger.error('[Finance Module] generateProfitAndLoss failed', error instanceof Error ? error.message : String(error))
    return { revenue: [], expenses: [], totalRevenue: 0, totalExpenses: 0, netIncome: 0 }
  }
}

// ─── Finance Stats ──────────────────────────────────────────

/**
 * Get high-level finance dashboard stats.
 * Delegates to getFinanceStats in lib/finance-actions.ts.
 */
export async function getFinanceStats(
  startDate: string,
  endDate: string
): Promise<{
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  revenueGrowth: number
  expenseGrowth: number
  cashBalance: number
  accountReceivable: number
  accountPayable: number
}> {
  try {
    const result = await realGetFinanceStats()
    return {
      totalRevenue: (result as Record<string, unknown>).totalRevenue as number ?? 0,
      totalExpenses: (result as Record<string, unknown>).totalExpenses as number ?? 0,
      netIncome: ((result as Record<string, unknown>).netProfit as number ?? 0),
      revenueGrowth: 0,
      expenseGrowth: 0,
      cashBalance: (result as Record<string, unknown>).cashPosition as number ?? 0,
      accountReceivable: (result as Record<string, unknown>).accountsReceivable as number ?? 0,
      accountPayable: (result as Record<string, unknown>).accountsPayable as number ?? 0,
    }
  } catch (error) {
    logger.error('[Finance Module] getFinanceStats failed', error instanceof Error ? error.message : String(error))
    return { totalRevenue: 0, totalExpenses: 0, netIncome: 0, revenueGrowth: 0, expenseGrowth: 0, cashBalance: 0, accountReceivable: 0, accountPayable: 0 }
  }
}

// ─── Account Balances ──────────────────────────────────────

/**
 * Get balances for all accounts, optionally filtered by branch.
 * Delegates to getAccountBalances in lib/finance-actions.ts.
 */
export async function getAccountBalances(branchId?: string): Promise<Array<{ id: string; code: string; name: string; account_type: string; balance: number }>> {
  try {
    const result = await realGetAccountBalances(branchId)
    if (!Array.isArray(result)) return []
    return result.map((b: Record<string, unknown>) => ({
      id: (b.account_id as string) ?? '',
      code: (b.account_number as string) ?? '',
      name: (b.account_name as string) ?? '',
      account_type: (b.account_type as string) ?? '',
      balance: (b.balance as number) ?? 0,
    }))
  } catch (error) {
    logger.error('[Finance Module] getAccountBalances failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Journal Entries List ──────────────────────────────────

/**
 * Get paginated journal entries with optional filters.
 * Delegates to getJournalEntries in lib/finance-actions.ts.
 */
export async function getJournalEntries(params?: {
  branchId?: string
  startDate?: string
  endDate?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<JournalEntry[]> {
  try {
    const result = await realGetJournalEntries(params)
    if (!Array.isArray(result)) return []
    return result as unknown as JournalEntry[]
  } catch (error) {
    logger.error('[Finance Module] getJournalEntries failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Journal Entry Detail ──────────────────────────────────

/**
 * Get a single journal entry by ID with its lines.
 * Delegates to getJournalEntry in lib/finance-actions.ts.
 */
export async function getJournalEntry(entryId: string): Promise<JournalEntry | null> {
  try {
    const result = await realGetJournalEntry(entryId)
    if (!result) return null
    return result as unknown as JournalEntry
  } catch (error) {
    logger.error('[Finance Module] getJournalEntry failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

// ─── Void Journal Entry ────────────────────────────────────

/**
 * Void a posted journal entry.
 * Delegates to voidJournalEntry in lib/finance-actions.ts.
 */
export async function voidJournalEntry(entryId: string, reason: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realVoidJournalEntry(entryId, reason)
    return { success: result.success, error: result.error }
  } catch (error) {
    logger.error('[Finance Module] voidJournalEntry failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Account CRUD ──────────────────────────────────────────

/**
 * Create a new chart of accounts entry.
 * Delegates to createAccount in lib/finance-actions.ts.
 */
export async function createAccount(input: {
  code: string
  name: string
  account_type: string
  parent_id?: string
  description?: string
  opening_balance?: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await realCreateAccount({
      account_number: input.code,
      name: input.name,
      account_type: input.account_type,
      parent_id: input.parent_id,
      description: input.description,
    })
    if (!result.success) return { success: false, error: (result as Record<string, unknown>).error as string | undefined }
    const created = (result as Record<string, unknown>).data as Record<string, unknown> | undefined
    return { success: true, id: created?.id as string | undefined }
  } catch (error) {
    logger.error('[Finance Module] createAccount failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Update an existing account.
 * Delegates to updateAccount in lib/finance-actions.ts.
 */
export async function updateAccount(accountId: string, input: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realUpdateAccount(accountId, input as { name?: string; description?: string; account_subtype?: string; is_active?: boolean })
    return { success: result.success }
  } catch (error) {
    logger.error('[Finance Module] updateAccount failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Soft-delete an account (deactivation).
 * Delegates to deleteAccount in lib/finance-actions.ts.
 */
export async function deleteAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realDeleteAccount(accountId)
    return { success: result.success, error: result.error }
  } catch (error) {
    logger.error('[Finance Module] deleteAccount failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Accounts By Type ──────────────────────────────────────

/**
 * Get all accounts grouped by type.
 * Delegates to getAccountsByType in lib/finance-actions.ts.
 */
export async function getAccountsByType(accountType: string): Promise<Account[]> {
  try {
    const result = await realGetAccountsByType()
    const grouped = result as Record<string, unknown[]>
    const accounts = grouped[accountType]
    if (!Array.isArray(accounts)) return []
    return accounts as unknown as Account[]
  } catch (error) {
    logger.error('[Finance Module] getAccountsByType failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Bank Accounts ─────────────────────────────────────────

/**
 * Get all bank accounts, optionally filtered by branch.
 * Delegates to getBankAccounts in lib/finance-actions.ts.
 */
export async function getBankAccounts(branchId?: string): Promise<BankAccount[]> {
  try {
    const result = await realGetBankAccounts(branchId)
    if (!Array.isArray(result)) return []
    return result as unknown as BankAccount[]
  } catch (error) {
    logger.error('[Finance Module] getBankAccounts failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Create a new bank account.
 * Delegates to createBankAccount in lib/finance-actions.ts.
 */
export async function createBankAccount(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await realCreateBankAccount(data as Parameters<typeof realCreateBankAccount>[0])
    if (!result.success) return { success: false, error: (result as Record<string, unknown>).error as string | undefined }
    const created = (result as Record<string, unknown>).data as Record<string, unknown> | undefined
    return { success: true, id: created?.id as string | undefined }
  } catch (error) {
    logger.error('[Finance Module] createBankAccount failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Soft-delete a bank account.
 * Delegates to deleteBankAccount in lib/finance-actions.ts.
 */
export async function deleteBankAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realDeleteBankAccount(accountId)
    return { success: result.success, error: result.error }
  } catch (error) {
    logger.error('[Finance Module] deleteBankAccount failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Bank Transactions ─────────────────────────────────────

/**
 * Get transactions for a bank account.
 * Delegates to getBankTransactions in lib/finance-actions.ts.
 */
export async function getBankTransactions(accountId: string, limit?: number): Promise<BankTransactionRow[]> {
  try {
    const result = await realGetBankTransactions(accountId, { limit: limit ?? 100 })
    if (!Array.isArray(result)) return []
    return result as unknown as BankTransactionRow[]
  } catch (error) {
    logger.error('[Finance Module] getBankTransactions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Create a new bank transaction.
 * Delegates to createBankTransaction in lib/finance-actions.ts.
 */
export async function createBankTransaction(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await realCreateBankTransaction(data as Parameters<typeof realCreateBankTransaction>[0])
    if (!result.success) return { success: false, error: (result as Record<string, unknown>).error as string | undefined }
    const created = (result as Record<string, unknown>).data as Record<string, unknown> | undefined
    return { success: true, id: created?.id as string | undefined }
  } catch (error) {
    logger.error('[Finance Module] createBankTransaction failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Bank Reconciliation ───────────────────────────────────

/**
 * Mark a bank transaction as reconciled.
 * Delegates to reconcileBankTransaction in lib/finance-actions.ts.
 */
export async function reconcileBankTransaction(transactionId: string, reconciliationData: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realReconcileBankTransaction(transactionId)
    return { success: result.success }
  } catch (error) {
    logger.error('[Finance Module] reconcileBankTransaction failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get bank statistics (total balance, account count, recent txns, unreconciled).
 * Delegates to getBankStats in lib/finance-actions.ts.
 */
export async function getBankStats(branchId?: string): Promise<BankStatsResult> {
  try {
    const result = await realGetBankStats(branchId)
    return result as BankStatsResult
  } catch (error) {
    logger.error('[Finance Module] getBankStats failed', error instanceof Error ? error.message : String(error))
    return {} as BankStatsResult
  }
}

/**
 * Get reconciliation history for a bank account.
 * Delegates to getReconciliations in lib/finance-actions.ts.
 */
export async function getReconciliations(accountId: string, limit?: number): Promise<ReconciliationRow[]> {
  try {
    const result = await realGetReconciliations(accountId)
    if (!Array.isArray(result)) return []
    return (limit ? result.slice(0, limit) : result) as unknown as ReconciliationRow[]
  } catch (error) {
    logger.error('[Finance Module] getReconciliations failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Get unreconciled bank transactions for an account.
 * Delegates to getUnreconciledTransactions in lib/finance-actions.ts.
 */
export async function getUnreconciledTransactions(accountId: string): Promise<UnreconciledTransactionRow[]> {
  try {
    const result = await realGetUnreconciledTransactions(accountId)
    if (!Array.isArray(result)) return []
    return result as unknown as UnreconciledTransactionRow[]
  } catch (error) {
    logger.error('[Finance Module] getUnreconciledTransactions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Get journal entries that reference the bank's chart account but aren't reconciled.
 * Delegates to getUnmatchedJournalEntries in lib/finance-actions.ts.
 */
export async function getUnmatchedJournalEntries(accountId: string): Promise<UnmatchedJournalEntryRow[]> {
  try {
    const result = await realGetUnmatchedJournalEntries(accountId)
    if (!Array.isArray(result)) return []
    return result as unknown as UnmatchedJournalEntryRow[]
  } catch (error) {
    logger.error('[Finance Module] getUnmatchedJournalEntries failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Create a new bank reconciliation with matched transactions.
 * Delegates to createReconciliation in lib/finance-actions.ts.
 */
export async function createReconciliation(data: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await realCreateReconciliation(data as Parameters<typeof realCreateReconciliation>[0])
    return { success: result.success, id: result.id }
  } catch (error) {
    logger.error('[Finance Module] createReconciliation failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Complete a draft reconciliation.
 * Delegates to completeReconciliation in lib/finance-actions.ts.
 */
export async function completeReconciliation(reconciliationId: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realCompleteReconciliation(reconciliationId)
    return { success: result.success }
  } catch (error) {
    logger.error('[Finance Module] completeReconciliation failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Financial Periods ─────────────────────────────────────

/**
 * Create a new financial period.
 * Delegates to createFinancialPeriod in lib/finance-actions.ts.
 */
export async function createFinancialPeriod(data: {
  name: string
  period_type: string
  start_date: string
  end_date: string
  branch_id?: string
}): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const result = await realCreateFinancialPeriod(data)
    if (!result.success) return { success: false, error: 'Failed to create financial period' }
    return { success: true, data: result.data as Record<string, unknown> }
  } catch (error) {
    logger.error('[Finance Module] createFinancialPeriod failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

/**
 * Get all financial periods, optionally filtered by branch.
 * Delegates to getFinancialPeriods in lib/finance-actions.ts.
 */
export async function getFinancialPeriods(branchId?: string): Promise<FinancialPeriod[]> {
  try {
    const result = await realGetFinancialPeriods()
    if (!Array.isArray(result)) return []
    let periods = result as unknown as FinancialPeriod[]
    if (branchId) {
      periods = periods.filter((p) => p.branch_id === branchId || p.branch_id === null)
    }
    return periods
  } catch (error) {
    logger.error('[Finance Module] getFinancialPeriods failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * Close a financial period (posts closing entries and locks it).
 * Delegates to closeFinancialPeriod in lib/finance-actions.ts.
 */
// ─── Finance Report Re-exports ────────────────────────────────

export { generateBalanceSheet, generateCashFlowStatement } from '@/lib/finance-reports'
export type { TrialBalanceRow, PLReport, BalanceSheetReport } from '@/lib/finance-reports'

export async function closeFinancialPeriod(periodId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await realCloseFinancialPeriod(periodId)
    if (result.success) return { success: true }
    logger.error('[Finance Module] closeFinancialPeriod failed', { result })
    return { success: false, error: 'Operation failed. Please try again.' }
  } catch (error) {
    logger.error('[Finance Module] closeFinancialPeriod failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
