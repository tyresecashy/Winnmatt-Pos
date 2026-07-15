/**
 * Finance Repository — Enterprise Core Data Access for Finance
 *
 * Encapsulates ALL direct Supabase access for accounts, journal entries,
 * bank accounts, bank transactions, reconciliations, and financial periods.
 * Callers (module facade, server actions) use this repository instead of
 * calling supabase directly.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { BaseRepository } from '@/lib/modules/core/repository'
import type { PaginatedResult } from '@/lib/modules/core/repository'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AccountRow {
  id: string
  account_number: string
  name: string
  description: string | null
  account_type: string
  account_subtype: string | null
  parent_id: string | null
  currency: string | null
  is_active: boolean | null
  is_system: boolean | null
  normal_balance: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface JournalEntryRow {
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
  [key: string]: unknown
}

export interface JournalEntryLineRow {
  id: string
  journal_entry_id: string
  account_id: string
  debit: number | null
  credit: number | null
  description: string | null
  line_number: number
  created_at: string
  [key: string]: unknown
}

export interface BankAccountRow {
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
  [key: string]: unknown
}

export interface BankTransactionRow {
  id: string
  bank_account_id: string
  transaction_date: string
  description: string
  transaction_type: string
  amount: number
  balance_after: number | null
  reference_number: string | null
  is_reconciled: boolean | null
  reconciled_at: string | null
  journal_entry_id: string | null
  branch_id: string | null
  created_by: string | null
  created_at: string
  [key: string]: unknown
}

export interface BankReconciliationRow {
  id: string
  bank_account_id: string
  reconciliation_date: string
  statement_balance: number
  books_balance: number
  difference: number
  status: string | null
  notes: string | null
  created_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface FinancialPeriodRow {
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
  [key: string]: unknown
}

export interface AccountBalance {
  account_id: string
  account_number: string
  account_name: string
  account_type: string
  balance: number
  /** Internal alias: maps from the DB's `name` column. */
  name?: string
}

export interface JournalEntryWithLines extends JournalEntryRow {
  lines?: JournalEntryLineRow[]
  accounts?: Record<string, unknown>[]
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class FinanceRepository extends BaseRepository<AccountRow> {
  constructor() {
    super('accounts', {
      audit: { eventType: 'account.*', aggregateType: 'account' },
      lock: { resourcePrefix: 'account:' },
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Chart of Accounts
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all accounts, optionally filtered by branch.
   * Sorted by account_number (ascending).
   */
  async getAccounts(branchId?: string): Promise<AccountRow[]> {
    let query = this.client
      .from('accounts')
      .select('*')
      .order('account_number', { ascending: true })

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'getAccounts')
    return (data ?? []) as AccountRow[]
  }

  /**
   * Get accounts grouped by account_type.
   * Returns a map of type → accounts array.
   */
  async getAccountsByType(): Promise<Record<string, AccountRow[]>> {
    const all = await this.getAccounts()
    const grouped: Record<string, AccountRow[]> = {}

    for (const account of all) {
      const type = account.account_type || 'unknown'
      if (!grouped[type]) grouped[type] = []
      grouped[type].push(account)
    }

    return grouped
  }

  /**
   * Get account balances as of a given date.
   * Aggregates journal_entry_lines by account.
   */
  async getAccountBalances(
    branchId?: string,
  ): Promise<AccountBalance[]> {
    let linesQuery = this.client
      .from('journal_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        account:accounts!inner(account_number, name, account_type)
      `)

    if (branchId) {
      // Filter via journal_entries.branch_id
      linesQuery = linesQuery.not('journal_entries!inner', 'is', null)
    }

    const { data, error } = await linesQuery

    if (error) throw this._toError(error, 'getAccountBalances')

    // Aggregate in-memory
    const lines = (data ?? []) as Array<{
      account_id: string
      debit: number
      credit: number
      account: { account_number: string; name: string; account_type: string }
    }>

    const balanceMap = new Map<
      string,
      { account_number: string; name: string; account_type: string; balance: number }
    >()

    for (const line of lines) {
      const existing = balanceMap.get(line.account_id) ?? {
        account_number: line.account?.account_number ?? '',
        name: line.account?.name ?? '',
        account_type: line.account?.account_type ?? '',
        balance: 0,
      }
      existing.balance += (line.debit ?? 0) - (line.credit ?? 0)
      balanceMap.set(line.account_id, existing)
    }

    return Array.from(balanceMap.entries()).map(([accountId, data]) => ({
      account_id: accountId,
      ...data,
      account_name: data.name,
    }))
  }

  /**
   * Get filtered account balances using branch filter via journal_entries.
   */
  async getAccountBalancesByBranch(
    branchId: string,
  ): Promise<AccountBalance[]> {
    // Get journal entries for this branch
    const { data: entries } = await this.client
      .from('journal_entries')
      .select('id')
      .eq('branch_id', branchId)

    if (!entries || entries.length === 0) return []

    const entryIds = entries.map((e: { id: string }) => e.id)

    const { data, error } = await this.client
      .from('journal_entry_lines')
      .select(`
        account_id,
        debit,
        credit,
        account:accounts!inner(account_number, name, account_type)
      `)
      .in('journal_entry_id', entryIds)

    if (error) throw this._toError(error, 'getAccountBalancesByBranch')

    const lines = (data ?? []) as Array<{
      account_id: string
      debit: number
      credit: number
      account: { account_number: string; name: string; account_type: string }
    }>

    const balanceMap = new Map<
      string,
      { account_number: string; name: string; account_type: string; balance: number }
    >()

    for (const line of lines) {
      const existing = balanceMap.get(line.account_id) ?? {
        account_number: line.account?.account_number ?? '',
        name: line.account?.name ?? '',
        account_type: line.account?.account_type ?? '',
        balance: 0,
      }
      existing.balance += (line.debit ?? 0) - (line.credit ?? 0)
      balanceMap.set(line.account_id, existing)
    }

    return Array.from(balanceMap.entries()).map(([accountId, data]) => ({
      account_id: accountId,
      ...data,
      account_name: data.name,
    }))
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Journal Entries
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get paginated journal entries with lines and accounts.
   */
  async getJournalEntries(params?: {
    branchId?: string
    startDate?: string
    endDate?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<JournalEntryWithLines[]> {
    const limit = params?.limit ?? 50
    const offset = params?.offset ?? 0

    let query = this.client
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(account_number, name)
        )
      `)
      .order('entry_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params?.branchId) query = query.eq('branch_id', params.branchId)
    if (params?.startDate) query = query.gte('entry_date', params.startDate)
    if (params?.endDate) query = query.lte('entry_date', params.endDate)
    if (params?.status) query = query.eq('status', params.status)

    const { data, error } = await query

    if (error) throw this._toError(error, 'getJournalEntries')
    return (data ?? []) as JournalEntryWithLines[]
  }

  /**
   * Get a single journal entry by ID with all lines and account info.
   */
  async getJournalEntry(entryId: string): Promise<JournalEntryWithLines | null> {
    const { data, error } = await this.client
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(account_number, name)
        )
      `)
      .eq('id', entryId)
      .maybeSingle()

    if (error) throw this._toError(error, 'getJournalEntry')
    return (data ?? null) as JournalEntryWithLines | null
  }

  /**
   * Get journal entry count for finance stats.
   */
  async getJournalEntryCount(params?: {
    branchId?: string
    startDate?: string
    endDate?: string
  }): Promise<number> {
    let query = this.client
      .from('journal_entries')
      .select('*', { count: 'exact', head: true })

    if (params?.branchId) query = query.eq('branch_id', params.branchId)
    if (params?.startDate) query = query.gte('entry_date', params.startDate)
    if (params?.endDate) query = query.lte('entry_date', params.endDate)

    const { count, error } = await query

    if (error) throw this._toError(error, 'getJournalEntryCount')
    return count ?? 0
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Finance Stats (dashboard summaries)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get finance dashboard statistics using aggregation queries.
   */
  async getFinanceStats(): Promise<{
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    cashPosition: number
    accountsReceivable: number
    accountsPayable: number
  }> {
    // Revenue: sum of credits on revenue accounts
    const { data: revenueData } = await this.client
      .from('journal_entry_lines')
      .select('credit')
      .not('credit', 'eq', 0)
      .in('account_id', (
        await this.client
          .from('accounts')
          .select('id')
          .eq('account_type', 'revenue')
      ).data?.map((a: { id: string }) => a.id) ?? [])

    // Expenses: sum of debits on expense accounts
    const { data: expenseData } = await this.client
      .from('journal_entry_lines')
      .select('debit')
      .not('debit', 'eq', 0)
      .in('account_id', (
        await this.client
          .from('accounts')
          .select('id')
          .eq('account_type', 'expense')
      ).data?.map((a: { id: string }) => a.id) ?? [])

    // Cash accounts
    const { data: cashAccounts } = await this.client
      .from('accounts')
      .select('id')
      .eq('account_type', 'asset')
      .in('account_subtype', ['cash', 'bank'])

    const cashAccountIds = (cashAccounts ?? []).map((a: { id: string }) => a.id)
    const { data: cashLines } = cashAccountIds.length > 0
      ? await this.client
          .from('journal_entry_lines')
          .select('debit, credit')
          .in('account_id', cashAccountIds)
      : { data: [] }

    // AR: accounts_receivable subtype
    const { data: arAccounts } = await this.client
      .from('accounts')
      .select('id')
      .eq('account_subtype', 'accounts_receivable')

    const arIds = (arAccounts ?? []).map((a: { id: string }) => a.id)
    const { data: arLines } = arIds.length > 0
      ? await this.client
          .from('journal_entry_lines')
          .select('debit, credit')
          .in('account_id', arIds)
      : { data: [] }

    // AP: accounts_payable subtype
    const { data: apAccounts } = await this.client
      .from('accounts')
      .select('id')
      .eq('account_subtype', 'accounts_payable')

    const apIds = (apAccounts ?? []).map((a: { id: string }) => a.id)
    const { data: apLines } = apIds.length > 0
      ? await this.client
          .from('journal_entry_lines')
          .select('debit, credit')
          .in('account_id', apIds)
      : { data: [] }

    const sumLines = (lines: Array<{ debit?: number; credit?: number }> | null, useCredit = false) =>
      (lines ?? []).reduce((s, l) => s + (useCredit ? (l.credit ?? 0) : (l.debit ?? 0)), 0)

    const totalRevenue = sumLines(revenueData as Array<{ credit?: number }> | null, true)
    const totalExpenses = sumLines(expenseData as Array<{ debit?: number }> | null, false)
    const cashBalance = sumLines(cashLines as Array<{ debit?: number; credit?: number }> | null, false) -
      sumLines(cashLines as Array<{ debit?: number; credit?: number }> | null, true)

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      cashPosition: cashBalance,
      accountsReceivable: sumLines(arLines as Array<{ debit?: number; credit?: number }> | null, false) -
        sumLines(arLines as Array<{ debit?: number; credit?: number }> | null, true),
      accountsPayable: sumLines(apLines as Array<{ debit?: number; credit?: number }> | null, true) -
        sumLines(apLines as Array<{ debit?: number; credit?: number }> | null, false),
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bank Accounts
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all bank accounts with linked chart account info.
   */
  async getBankAccounts(branchId?: string): Promise<BankAccountRow[]> {
    let query = this.client
      .from('bank_accounts')
      .select('*, account:accounts(account_number, name, account_type)')

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'getBankAccounts')
    return (data ?? []) as unknown as BankAccountRow[]
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bank Transactions
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get transactions for a bank account, ordered by date desc.
   */
  async getBankTransactions(
    accountId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<BankTransactionRow[]> {
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0

    const { data, error } = await this.client
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', accountId)
      .order('transaction_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw this._toError(error, 'getBankTransactions')
    return (data ?? []) as BankTransactionRow[]
  }

  /**
   * Get unreconciled transactions for a bank account.
   */
  async getUnreconciledTransactions(
    accountId: string,
  ): Promise<BankTransactionRow[]> {
    const { data, error } = await this.client
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', accountId)
      .eq('is_reconciled', false)
      .order('transaction_date', { ascending: false })

    if (error) throw this._toError(error, 'getUnreconciledTransactions')
    return (data ?? []) as BankTransactionRow[]
  }

  /**
   * Get bank stats for dashboard.
   */
  async getBankStats(branchId?: string): Promise<{
    totalBalance: number
    accountCount: number
    recentTransactions: number
    unreconciled: number
  }> {
    let accountsQuery = this.client
      .from('bank_accounts')
      .select('current_balance', { count: 'exact' })

    if (branchId) {
      accountsQuery = accountsQuery.eq('branch_id', branchId)
    }

    const { data: accounts, count: accountCount } = await accountsQuery

    const totalBalance = (accounts ?? []).reduce(
      (sum: number, a: { current_balance: number | null }) => sum + (a.current_balance ?? 0),
      0,
    )

    let txQuery = this.client
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })

    if (branchId) {
      txQuery = txQuery.eq('branch_id', branchId)
    }

    const { count: recentCount } = await txQuery

    let unreconciledQuery = this.client
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('is_reconciled', false)

    if (branchId) {
      unreconciledQuery = unreconciledQuery.eq('branch_id', branchId)
    }

    const { count: unreconciledCount } = await unreconciledQuery

    return {
      totalBalance,
      accountCount: accountCount ?? 0,
      recentTransactions: recentCount ?? 0,
      unreconciled: unreconciledCount ?? 0,
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bank Reconciliations
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get reconciliation history for a bank account.
   */
  async getReconciliations(accountId: string): Promise<BankReconciliationRow[]> {
    const { data, error } = await this.client
      .from('bank_reconciliations')
      .select('*')
      .eq('bank_account_id', accountId)
      .order('reconciliation_date', { ascending: false })

    if (error) throw this._toError(error, 'getReconciliations')
    return (data ?? []) as BankReconciliationRow[]
  }

  /**
   * Get journal entries that reference the bank's chart account but aren't reconciled.
   */
  async getUnmatchedJournalEntries(
    accountId: string,
  ): Promise<JournalEntryLineRow[]> {
    // First resolve the chart account_id from the bank account
    const { data: bankAccount } = await this.client
      .from('bank_accounts')
      .select('account_id')
      .eq('id', accountId)
      .single()

    if (!bankAccount) return []

    const chartAccountId = bankAccount.account_id as string

    // Find journal entry lines referencing this account that don't have
    // a matching bank_transaction via reconciliation
    const { data, error } = await this.client
      .from('journal_entry_lines')
      .select(`
        *,
        journal_entry:journal_entries!inner(entry_number, entry_date, description)
      `)
      .eq('account_id', chartAccountId)

    if (error) throw this._toError(error, 'getUnmatchedJournalEntries')
    return (data ?? []) as JournalEntryLineRow[]
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Financial Periods
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all financial periods, ordered by start_date desc.
   */
  async getFinancialPeriods(branchId?: string): Promise<FinancialPeriodRow[]> {
    let query = this.client
      .from('financial_periods')
      .select('*')
      .order('start_date', { ascending: false })

    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'getFinancialPeriods')
    return (data ?? []) as FinancialPeriodRow[]
  }

  /**
   * Find the active financial period for a given date and branch.
   */
  async getActivePeriod(
    date: string,
    branchId?: string,
  ): Promise<FinancialPeriodRow | null> {
    let query = this.client
      .from('financial_periods')
      .select('*')
      .eq('status', 'open')
      .lte('start_date', date)
      .gte('end_date', date)
      .limit(1)
      .maybeSingle()

    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw this._toError(error, 'getActivePeriod')
    return (data ?? null) as FinancialPeriodRow | null
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

/** Shared finance repository instance. */
export const financeRepo = new FinanceRepository()
