import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock lib/finance-actions and lib/finance-reports ──────────────────────
const mockGetAccounts = vi.fn()
const mockCreateJournalEntry = vi.fn()
const mockGetJournalEntries = vi.fn()
const mockGenerateTrialBalance = vi.fn()
const mockGenerateProfitAndLoss = vi.fn()

vi.mock('@/lib/finance-actions', () => ({
  getAccounts: (...args: unknown[]) => mockGetAccounts(...args),
  createJournalEntry: (...args: unknown[]) => mockCreateJournalEntry(...args),
  getJournalEntries: (...args: unknown[]) => mockGetJournalEntries(...args),
}))

vi.mock('@/lib/finance-reports', () => ({
  generateTrialBalance: (...args: unknown[]) => mockGenerateTrialBalance(...args),
  generateProfitAndLoss: (...args: unknown[]) => mockGenerateProfitAndLoss(...args),
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { createJournalEntry, getAccounts, getGeneralLedger, generateTrialBalance, generateProfitAndLoss } from '@/lib/modules/finance'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createJournalEntry ─────────────────────────────────────────────────────

describe('createJournalEntry', () => {
  const validInput = {
    description: 'Test entry',
    entry_date: '2026-07-01',
    branch_id: 'branch-1',
    reference_type: 'sale',
    reference_id: 'sale-1',
    lines: [{ account_id: 'acct-1', debit: 100, credit: 0 }],
    created_by: 'user-1',
  }

  it('delegates to real createJournalEntry', async () => {
    mockCreateJournalEntry.mockResolvedValue({ success: true, entry: { id: 'je-1' } })

    const result = await createJournalEntry(validInput)

    expect(mockCreateJournalEntry).toHaveBeenCalledWith({
      description: 'Test entry',
      entry_date: '2026-07-01',
      branch_id: 'branch-1',
      notes: 'sale:sale-1',
      lines: [{ account_id: 'acct-1', debit: 100, credit: 0 }],
    })
    expect(result.success).toBe(true)
  })

  it('returns error on failure', async () => {
    mockCreateJournalEntry.mockResolvedValue({ success: false, error: 'Debits must equal credits' })

    const result = await createJournalEntry(validInput)
    expect(result).toEqual({ success: false, error: 'Debits must equal credits' })
  })
})

// ─── getAccounts ────────────────────────────────────────────────────────────

describe('getAccounts', () => {
  it('delegates to real getAccounts', async () => {
    mockGetAccounts.mockResolvedValue([{ id: 'acct-1', code: '1000', name: 'Cash' }])

    const result = await getAccounts('branch-1')
    expect(mockGetAccounts).toHaveBeenCalledWith('branch-1')
    expect(result).toHaveLength(1)
  })

  it('returns empty on null', async () => {
    mockGetAccounts.mockResolvedValue(null)
    const result = await getAccounts()
    expect(result).toEqual([])
  })
})

// ─── getGeneralLedger ───────────────────────────────────────────────────────

describe('getGeneralLedger', () => {
  it('delegates to getJournalEntries and wraps result', async () => {
    mockGetJournalEntries.mockResolvedValue([
      { id: 'je-1', entry_number: 'JE-001', description: 'Test', status: 'posted', lines: [{ account_id: 'acct-1' }] },
    ])

    const result = await getGeneralLedger({ branch_id: 'branch-1', start_date: '2026-01-01', limit: 10 })

    expect(mockGetJournalEntries).toHaveBeenCalledWith({
      branchId: 'branch-1',
      startDate: '2026-01-01',
      endDate: undefined,
      limit: 10,
      offset: 0,
    })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('filters by account_id client-side', async () => {
    mockGetJournalEntries.mockResolvedValue([
      { id: 'je-1', lines: [{ account_id: 'acct-1' }] },
      { id: 'je-2', lines: [{ account_id: 'acct-2' }] },
    ])

    const result = await getGeneralLedger({ account_id: 'acct-1' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('je-1')
  })

  it('returns empty on null entries', async () => {
    mockGetJournalEntries.mockResolvedValue(null)
    const result = await getGeneralLedger({})
    expect(result.data).toEqual([])
  })
})

// ─── generateTrialBalance ───────────────────────────────────────────────────

describe('generateTrialBalance', () => {
  it('delegates and maps result', async () => {
    mockGenerateTrialBalance.mockResolvedValue({
      accounts: [{ id: 'acct-1', code: '1000', name: 'Cash', debit: 500, credit: 0 }],
      totalDebit: 500,
      totalCredit: 0,
    })

    const result = await generateTrialBalance('2026-01-01', '2026-12-31')
    expect(mockGenerateTrialBalance).toHaveBeenCalledWith('2026-01-01', '2026-12-31')
    expect(result.totalDebit).toBe(500)
    expect(result.accounts).toHaveLength(1)
  })
})

// ─── generateProfitAndLoss ──────────────────────────────────────────────────

describe('generateProfitAndLoss', () => {
  it('delegates and maps result', async () => {
    mockGenerateProfitAndLoss.mockResolvedValue({
      revenue: [{ id: 'acct-1', balance: 1000 }],
      expenses: [{ id: 'acct-2', balance: 600 }],
      totalRevenue: 1000,
      totalExpenses: 600,
      netIncome: 400,
    })

    const result = await generateProfitAndLoss('2026-01-01', '2026-12-31')
    expect(result.totalRevenue).toBe(1000)
    expect(result.netIncome).toBe(400)
  })
})
