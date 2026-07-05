/**
 * Finance Module — Public API
 *
 * Handles chart of accounts, journal entries, banking, reports.
 * Other modules should ONLY import from this file.
 */

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
  throw new Error('Not implemented')
}

/**
 * Get chart of accounts.
 */
export async function getAccounts(branchId?: string): Promise<Account[]> {
  throw new Error('Not implemented')
}

/**
 * Get general ledger entries.
 */
export async function getGeneralLedger(filters: {
  account_id?: string
  branch_id?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}): Promise<{ data: JournalEntry[]; total: number }> {
  throw new Error('Not implemented')
}

/**
 * Generate trial balance.
 */
export async function generateTrialBalance(
  startDate: string,
  endDate: string
): Promise<{
  accounts: Array<Account & { debit: number; credit: number }>
  totalDebit: number
  totalCredit: number
}> {
  throw new Error('Not implemented')
}

/**
 * Generate profit & loss statement.
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
  throw new Error('Not implemented')
}
