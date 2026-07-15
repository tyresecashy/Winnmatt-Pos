/**
 * Finance Repository Tests
 *
 * Tests for FinanceRepository enterprise core data access layer.
 * All Supabase calls are mocked to test only business logic
 * (query construction, error handling, data shaping).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase client (hoisted) ─────────────────────────────────────────
const { mockFrom, mockSupabaseAdmin } = vi.hoisted(() => {
  const _mockFrom = vi.fn()
  return { mockFrom: _mockFrom, mockSupabaseAdmin: { from: _mockFrom } }
})

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
}))

import { FinanceRepository, financeRepo, type AccountRow, type JournalEntryRow, type BankAccountRow, type BankTransactionRow, type FinancialPeriodRow } from '@/lib/modules/finance/repository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MockQuery {
  then: (resolve: (v: unknown) => void) => void
  _terminalData: { data: unknown; error: unknown; count: number }
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  ilike: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'ilike', 'or', 'not', 'in',
    'order', 'limit', 'range',
    'single', 'maybeSingle',
  ] as const

  // Store a stable thenable: the resolve chain always reads __data via getter
  const q = {
    _promise: Promise.resolve({ data: null, error: null, count: 0 }),
    __data: { data: null, error: null, count: 0 },
  }

  const query: Record<string, unknown> = {
    get _terminalData() { return q.__data },
    set _terminalData(v) {
      q.__data = v
      q._promise = Promise.resolve(v)
    },
    then(resolve: (value: unknown) => void) {
      return q._promise.then(resolve)
    },
  }

  for (const method of methods) {
    const spy = vi.fn((..._args: unknown[]) => query)
    query[method] = spy
  }

  return query as unknown as MockQuery
}

let repo: FinanceRepository
let query: MockQuery

beforeEach(() => {
  vi.resetAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  repo = new FinanceRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('FinanceRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name and options', () => {
      expect(repo).toBeInstanceOf(FinanceRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(financeRepo).toBeInstanceOf(FinanceRepository)
    })
  })

  describe('getAccounts', () => {
    it('returns all accounts ordered by account_number', async () => {
      const accounts: Partial<AccountRow>[] = [
        { id: 'a1', account_number: '1000', name: 'Cash', account_type: 'asset' },
        { id: 'a2', account_number: '2000', name: 'AP', account_type: 'liability' },
      ]
      query._terminalData = { data: accounts, error: null, count: 2 }

      const result = await repo.getAccounts()

      expect(mockFrom).toHaveBeenCalledWith('accounts')
      expect(query.order).toHaveBeenCalledWith('account_number', { ascending: true })
      expect(result).toHaveLength(2)
    })

    it('filters by branch when branchId provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getAccounts('branch-1')

      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })

    it('returns empty array on no data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getAccounts()
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'ERR', message: 'DB fail' }, count: 0 }
      await expect(repo.getAccounts()).rejects.toThrow()
    })
  })

  describe('getAccountsByType', () => {
    it('groups accounts by account_type', async () => {
      query._terminalData = {
        data: [
          { id: 'a1', account_number: '1000', name: 'Cash', account_type: 'asset' },
          { id: 'a2', account_number: '2000', name: 'AP', account_type: 'liability' },
          { id: 'a3', account_number: '3000', name: 'Revenue', account_type: 'revenue' },
        ],
        error: null,
        count: 3,
      }

      const result = await repo.getAccountsByType()

      expect(result.asset).toHaveLength(1)
      expect(result.liability).toHaveLength(1)
      expect(result.revenue).toHaveLength(1)
      expect(result.asset[0].id).toBe('a1')
    })

    it('returns empty object when no accounts', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getAccountsByType()
      expect(result).toEqual({})
    })
  })

  describe('getJournalEntries', () => {
    it('returns paginated entries with lines and accounts', async () => {
      const entries = [
        {
          id: 'je-1',
          entry_number: 'JE-001',
          description: 'Test entry',
          lines: [
            { id: 'l1', account_id: 'a1', debit: 100, credit: 0, account: { account_number: '1000', name: 'Cash' } },
          ],
        },
      ]
      query._terminalData = { data: entries, error: null, count: 1 }

      const result = await repo.getJournalEntries({ limit: 10, offset: 0 })

      expect(mockFrom).toHaveBeenCalledWith('journal_entries')
      expect(query.range).toHaveBeenCalledWith(0, 9)
      expect(result).toHaveLength(1)
      expect(result[0].lines).toHaveLength(1)
    })

    it('applies filters', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getJournalEntries({
        branchId: 'b1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'posted',
      })

      expect(query.eq).toHaveBeenCalledWith('branch_id', 'b1')
      expect(query.gte).toHaveBeenCalledWith('entry_date', '2026-01-01')
      expect(query.lte).toHaveBeenCalledWith('entry_date', '2026-12-31')
      expect(query.eq).toHaveBeenCalledWith('status', 'posted')
    })

    it('returns empty array on no data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getJournalEntries()
      expect(result).toEqual([])
    })
  })

  describe('getJournalEntry', () => {
    it('returns a single entry with lines', async () => {
      const entry = {
        id: 'je-1',
        entry_number: 'JE-001',
        lines: [{ id: 'l1', account_id: 'a1', debit: 100, credit: 0 }],
      }
      query._terminalData = { data: entry, error: null, count: 0 }

      const result = await repo.getJournalEntry('je-1')

      expect(mockFrom).toHaveBeenCalledWith('journal_entries')
      expect(query.eq).toHaveBeenCalledWith('id', 'je-1')
      expect(query.maybeSingle).toHaveBeenCalled()
      expect(result?.id).toBe('je-1')
    })

    it('returns null when not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getJournalEntry('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getJournalEntryCount', () => {
    it('returns count of entries', async () => {
      query._terminalData = { data: [], error: null, count: 42 }

      const result = await repo.getJournalEntryCount()

      expect(result).toBe(42)
    })

    it('applies branch filter', async () => {
      query._terminalData = { data: [], error: null, count: 10 }
      await repo.getJournalEntryCount({ branchId: 'b1' })

      expect(query.eq).toHaveBeenCalledWith('branch_id', 'b1')
    })
  })

  describe('getBankAccounts', () => {
    it('returns bank accounts with account join', async () => {
      const accounts: Partial<BankAccountRow>[] = [
        { id: 'ba-1', bank_name: 'Equity', account_name: 'Main A/C', account_id: 'a1' },
      ]
      query._terminalData = { data: accounts, error: null, count: 1 }

      const result = await repo.getBankAccounts()

      expect(mockFrom).toHaveBeenCalledWith('bank_accounts')
      expect(result).toHaveLength(1)
    })

    it('filters by branch', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getBankAccounts('branch-1')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })
  })

  describe('getBankTransactions', () => {
    it('returns paginated transactions', async () => {
      const txs: Partial<BankTransactionRow>[] = [
        { id: 'tx-1', bank_account_id: 'ba-1', amount: 1000, transaction_type: 'deposit' },
      ]
      query._terminalData = { data: txs, error: null, count: 1 }

      const result = await repo.getBankTransactions('ba-1')

      expect(mockFrom).toHaveBeenCalledWith('bank_transactions')
      expect(query.eq).toHaveBeenCalledWith('bank_account_id', 'ba-1')
      expect(query.range).toHaveBeenCalledWith(0, 99)
      expect(result).toHaveLength(1)
    })

    it('respects custom limit', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getBankTransactions('ba-1', { limit: 5 })
      expect(query.range).toHaveBeenCalledWith(0, 4)
    })
  })

  describe('getUnreconciledTransactions', () => {
    it('returns only unreconciled transactions', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getUnreconciledTransactions('ba-1')

      expect(query.eq).toHaveBeenCalledWith('bank_account_id', 'ba-1')
      expect(query.eq).toHaveBeenCalledWith('is_reconciled', false)
    })
  })

  describe('getReconciliations', () => {
    it('returns reconciliation history', async () => {
      query._terminalData = { data: [{ id: 'r-1', bank_account_id: 'ba-1', status: 'completed' }], error: null, count: 1 }

      const result = await repo.getReconciliations('ba-1')

      expect(mockFrom).toHaveBeenCalledWith('bank_reconciliations')
      expect(query.eq).toHaveBeenCalledWith('bank_account_id', 'ba-1')
      expect(result).toHaveLength(1)
    })
  })

  describe('getFinancialPeriods', () => {
    it('returns all periods ordered by start_date desc', async () => {
      const periods: Partial<FinancialPeriodRow>[] = [
        { id: 'fp-1', name: '2026 Q2', period_type: 'quarter', start_date: '2026-04-01', end_date: '2026-06-30' },
      ]
      query._terminalData = { data: periods, error: null, count: 1 }

      const result = await repo.getFinancialPeriods()

      expect(mockFrom).toHaveBeenCalledWith('financial_periods')
      expect(query.order).toHaveBeenCalledWith('start_date', { ascending: false })
      expect(result).toHaveLength(1)
    })

    it('filters by branch with null fallback', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getFinancialPeriods('branch-1')

      expect(query.or).toHaveBeenCalledWith('branch_id.eq.branch-1,branch_id.is.null')
    })
  })

  describe('getBankStats', () => {
    it('returns computed bank statistics', async () => {
      // Mock bank accounts query
      const acctQuery = createMockQuery()
      acctQuery._terminalData = {
        data: [{ current_balance: 50000 }, { current_balance: 30000 }],
        error: null,
        count: 2,
      }

      // Mock recent transactions count
      const txQuery = createMockQuery()
      txQuery._terminalData = { data: [], error: null, count: 15 }

      // Mock unreconciled count
      const unrecQuery = createMockQuery()
      unrecQuery._terminalData = { data: [], error: null, count: 3 }

      mockFrom
        .mockReturnValueOnce(acctQuery)   // bank_accounts select
        .mockReturnValueOnce(txQuery)      // bank_transactions count
        .mockReturnValueOnce(unrecQuery)   // bank_transactions unreconciled count

      const result = await repo.getBankStats()

      expect(result.totalBalance).toBe(80000)
      expect(result.accountCount).toBe(2)
      expect(result.recentTransactions).toBe(15)
      expect(result.unreconciled).toBe(3)
    })

    it('filters by branch', async () => {
      const q1 = createMockQuery()
      q1._terminalData = { data: [], error: null, count: 0 }
      const q2 = createMockQuery()
      q2._terminalData = { data: [], error: null, count: 0 }
      const q3 = createMockQuery()
      q3._terminalData = { data: [], error: null, count: 0 }

      mockFrom.mockReturnValueOnce(q1).mockReturnValueOnce(q2).mockReturnValueOnce(q3)
      await repo.getBankStats('branch-1')

      expect(q1.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(q2.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(q3.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })
  })

  describe('getUnmatchedJournalEntries', () => {
    it('resolves bank account and returns journal lines', async () => {
      // Mock: journal_entry_lines query (OUTER call first)
      const jelsQuery = createMockQuery()
      jelsQuery._terminalData = {
        data: [{ id: 'jel-1', account_id: 'a1', debit: 100, journal_entry: { entry_number: 'JE-001' } }],
        error: null,
        count: 1,
      }

      // Mock: look up bank account (INNER call second, inside .select().eq().single())
      const baQuery = createMockQuery()
      baQuery._terminalData = { data: { account_id: 'a1' }, error: null, count: 0 }

      // Order: first mockFrom call is for bank_accounts (entry point), second is for journal_entry_lines
      // Actually: bank_accounts.select('account_id').eq('id','ba-1').single() → then jels
      mockFrom.mockReturnValueOnce(baQuery).mockReturnValueOnce(jelsQuery)

      const result = await repo.getUnmatchedJournalEntries('ba-1')

      expect(mockFrom).toHaveBeenNthCalledWith(1, 'bank_accounts')
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'journal_entry_lines')
      expect(baQuery.eq).toHaveBeenCalledWith('id', 'ba-1')
      expect(jelsQuery.eq).toHaveBeenCalledWith('account_id', 'a1')
      expect(result).toHaveLength(1)
    })

    it('returns empty when bank account not found', async () => {
      const baQuery = createMockQuery()
      baQuery._terminalData = { data: null, error: null, count: 0 }
      mockFrom.mockReturnValueOnce(baQuery)

      const result = await repo.getUnmatchedJournalEntries('nonexistent')
      expect(result).toEqual([])
    })
  })

  describe('getFinanceStats', () => {
    it('computes financial dashboard stats', async () => {
      // Each pair: outer query (journal_entry_lines) first, inner query (accounts) second
      // because the inner query is evaluated as an argument to .in() during
      // the outer chain construction.

      // Pair 1: Revenue → Lines (outer) first, then accounts lookup (inner)
      const revLinesQ = createMockQuery()
      revLinesQ._terminalData = { data: [{ credit: 50000 }], error: null, count: 1 }

      const revAcctsQ = createMockQuery()
      revAcctsQ._terminalData = { data: [{ id: 'a-rev-1' }], error: null, count: 1 }

      // Pair 2: Expense
      const expLinesQ = createMockQuery()
      expLinesQ._terminalData = { data: [{ debit: 30000 }], error: null, count: 1 }

      const expAcctsQ = createMockQuery()
      expAcctsQ._terminalData = { data: [{ id: 'a-exp-1' }], error: null, count: 1 }

      // Pair 3: Cash/bank
      const cashLinesQ = createMockQuery()
      cashLinesQ._terminalData = { data: [{ debit: 100000, credit: 40000 }], error: null, count: 2 }

      const cashAcctsQ = createMockQuery()
      cashAcctsQ._terminalData = { data: [{ id: 'a-cash-1' }], error: null, count: 1 }

      // Pair 4: AR (standalone — accounts query used only to check IDs)
      const arAcctsQ = createMockQuery()
      arAcctsQ._terminalData = { data: [], error: null, count: 0 }
      // AR lines query skipped because IDs are empty

      // Pair 5: AP (standalone — accounts query used only to check IDs)
      const apAcctsQ = createMockQuery()
      apAcctsQ._terminalData = { data: [], error: null, count: 0 }
      // AP lines query skipped because IDs are empty

      // NOTE: The cash/accts order differs from revenue/expense:
      // - Revenue & expense: nested .in() → lines outer, accounts inner
      // - Cash, AR, AP: standalone await → accounts first, lines second
      mockFrom
        .mockReturnValueOnce(revLinesQ)
        .mockReturnValueOnce(revAcctsQ)
        .mockReturnValueOnce(expLinesQ)
        .mockReturnValueOnce(expAcctsQ)
        .mockReturnValueOnce(cashAcctsQ)   // standalone accounts query
        .mockReturnValueOnce(cashLinesQ)   // standalone lines query (conditional)
        .mockReturnValueOnce(arAcctsQ)     // standalone accounts query (IDs empty → lines skipped)
        .mockReturnValueOnce(apAcctsQ)     // standalone accounts query (IDs empty → lines skipped)

      const result = await repo.getFinanceStats()

      expect(result.totalRevenue).toBe(50000)
      expect(result.totalExpenses).toBe(30000)
      expect(result.netProfit).toBe(20000)
      expect(result.cashPosition).toBe(60000)  // 100000 - 40000
      expect(result.accountsReceivable).toBe(0)
      expect(result.accountsPayable).toBe(0)
    })
  })

  describe('getActivePeriod', () => {
    it('finds active period for a date', async () => {
      const period = { id: 'fp-1', name: 'Q2 2026', status: 'open', start_date: '2026-04-01', end_date: '2026-06-30' }
      query._terminalData = { data: period, error: null, count: 0 }

      const result = await repo.getActivePeriod('2026-05-15')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('fp-1')
      expect(mockFrom).toHaveBeenCalledWith('financial_periods')
      expect(query.eq).toHaveBeenCalledWith('status', 'open')
    })

    it('returns null when no active period', async () => {
      // Default mock already has _terminalData.data = null — no setup needed
      const result = await repo.getActivePeriod('2099-01-01')
      expect(result).toBeNull()
    })
  })

  describe('base class CRUD integration', () => {
    it('findById works via base class', async () => {
      query._terminalData = { data: { id: 'a1', name: 'Cash' }, error: null, count: 0 }
      const result = await repo.findById('a1')
      expect(result?.id).toBe('a1')
    })

    it('findMany works via base class', async () => {
      query._terminalData = { data: [{ id: 'a1' }, { id: 'a2' }], error: null, count: 2 }
      const result = await repo.findMany()
      expect(result).toHaveLength(2)
    })

    it('count works via base class', async () => {
      query._terminalData = { data: [], error: null, count: 10 }
      const result = await repo.count({ is_active: true })
      expect(result).toBe(10)
    })

    it('exists returns true when count > 0', async () => {
      query._terminalData = { data: [], error: null, count: 1 }
      const result = await repo.exists({ id: 'a1' })
      expect(result).toBe(true)
    })

    it('exists returns false when count is 0', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      const result = await repo.exists({ id: 'nonexistent' })
      expect(result).toBe(false)
    })
  })
})
