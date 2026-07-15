/**
 * ExpenseRepository — Comprehensive Unit Tests
 *
 * Tests all repository methods including constructor, reads, writes,
 * edge cases, and error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExpenseRepository, expenseRepo } from '@/lib/modules/expenses/repository'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/modules/core/audit-engine', () => ({
  recordAudit: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/modules/core/lock-manager', () => ({
  acquireLock: vi.fn(() => Promise.resolve()),
  releaseLock: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/modules/core/identity-context', () => ({
  getCurrentUserId: vi.fn(() => 'test-user-id'),
  getCurrentBranchId: vi.fn(() => 'test-branch-id'),
  getCurrentRole: vi.fn(() => 'admin'),
  getCurrentDeviceId: vi.fn(() => 'test-device'),
}))

vi.mock('@/lib/modules/core/correlation-id', () => ({
  getCorrelationId: vi.fn(() => 'test-correlation-id'),
  generateCorrelationId: vi.fn(() => 'new-correlation-id'),
}))

// ─── Mock error class ──────────────────────────────────────────────────────

class MockDbError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'MockDbError'
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeQueryBuilder() {
  const chain: Record<string, any> = {}
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.neq = vi.fn(() => chain)
  chain.gte = vi.fn(() => chain)
  chain.lte = vi.fn(() => chain)
  chain.like = vi.fn(() => chain)
  chain.ilike = vi.fn(() => chain)
  chain.or = vi.fn(() => chain)
  chain.range = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => chain)
  chain.single = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.insert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.then = vi.fn()
  chain.toString = vi.fn(() => '[QueryBuilder]')

  const thenable: any = (resolve: (value: any) => void) => {
    resolve(chain._mockResolveValue ?? { data: [], error: null, count: 0 })
    return Promise.resolve(chain._mockResolveValue ?? { data: [], error: null, count: 0 })
  }
  chain.then = thenable

  chain._resolve = (value: any) => {
    chain._mockResolveValue = value
  }

  return chain
}

function makeClient() {
  const client: Record<string, any> = {}
  client.from = vi.fn(() => {
    const qb = makeQueryBuilder()
    return qb
  })
  return client
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

const sampleCategory: Record<string, any> = {
  id: 'cat-001',
  name: 'Utilities',
  description: 'Water, electricity, internet',
  color: '#FF5733',
  icon: 'Zap',
  sort_order: 1,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

const sampleExpense: Record<string, any> = {
  id: 'exp-001',
  branch_id: 'branch-1',
  category_id: 'cat-001',
  amount_cents: 50000,
  description: 'Monthly electricity bill',
  vendor: 'Kenya Power',
  expense_date: '2026-06-15',
  payment_method: 'bank_transfer',
  reference_number: 'INV-2026-001',
  receipt_url: null,
  notes: 'Paid on time',
  status: 'approved',
  approved_by: 'user-1',
  approved_at: '2026-06-16T00:00:00Z',
  rejection_reason: null,
  created_by: 'user-1',
  is_recurring: false,
  recurring_id: null,
  created_at: '2026-06-15T10:00:00Z',
  updated_at: '2026-06-16T10:00:00Z',
}

const sampleRecurring: Record<string, any> = {
  id: 'rec-001',
  branch_id: 'branch-1',
  category_id: 'cat-001',
  amount_cents: 25000,
  description: 'Monthly rent',
  vendor: 'Landlord',
  frequency: 'monthly',
  next_date: '2026-07-01',
  end_date: null,
  payment_method: 'bank_transfer',
  notes: null,
  is_active: true,
  last_generated_date: '2026-06-01',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ExpenseRepository', () => {
  let repo: ExpenseRepository
  let client: Record<string, any>

  beforeEach(() => {
    vi.clearAllMocks()
    client = makeClient()
    vi.mocked(getSupabaseAdmin).mockReturnValue(client as any)
    repo = new ExpenseRepository()
  })

  // ── Singleton ──────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('exports a pre-built expenseRepo instance', () => {
      expect(expenseRepo).toBeInstanceOf(ExpenseRepository)
    })
  })

  // ── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates a repository for the expenses table', () => {
      expect(repo).toBeInstanceOf(ExpenseRepository)
    })

    it('lazily calls getSupabaseAdmin on first method call', () => {
      vi.mocked(getSupabaseAdmin).mockReturnValue(client as any)
      const defaultRepo = new ExpenseRepository()
      expect(getSupabaseAdmin).not.toHaveBeenCalled()
      // Trigger lazy client initialization by accessing a method
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      client.from.mockReturnValue(qb)
      void defaultRepo.getExpenseCategories()
      expect(getSupabaseAdmin).toHaveBeenCalled()
      expect(defaultRepo).toBeInstanceOf(ExpenseRepository)
    })
  })

  // ── getExpenseCategories ───────────────────────────────────────────────

  describe('getExpenseCategories', () => {
    it('returns all categories ordered by sort_order', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [sampleCategory, { ...sampleCategory, id: 'cat-002', name: 'Office Supplies', sort_order: 2 }], error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getExpenseCategories()

      expect(client.from).toHaveBeenCalledWith('expense_categories')
      expect(qb.select).toHaveBeenCalledWith('*')
      expect(qb.order).toHaveBeenCalledWith('sort_order', { ascending: true })
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('cat-001')
    })

    it('returns empty array when no categories exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getExpenseCategories()
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Connection failed', 'CONN_ERR') })
      client.from.mockReturnValue(qb)

      await expect(repo.getExpenseCategories()).rejects.toThrow('getExpenseCategories')
    })
  })

  // ── getExpenses ────────────────────────────────────────────────────────

  describe('getExpenses', () => {
    it('returns paginated expenses with joins', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [sampleExpense], error: null, count: 1 })
      client.from.mockReturnValue(qb)

      const result = await repo.getExpenses({ branchId: 'branch-1' })

      expect(client.from).toHaveBeenCalledWith('expenses')
      expect(qb.select).toHaveBeenCalledWith(
        '*, category:category_id(*), creator:created_by(id, full_name), approver:approved_by(id, full_name), branch:branch_id(id, name)',
        { count: 'exact' },
      )
      expect(qb.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('applies all optional filters', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [sampleExpense], error: null, count: 1 })
      client.from.mockReturnValue(qb)

      await repo.getExpenses({
        branchId: 'branch-1',
        categoryId: 'cat-001',
        status: 'approved',
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        vendor: 'Kenya Power',
        search: 'electricity',
        limit: 50,
        offset: 10,
      })

      expect(qb.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(qb.eq).toHaveBeenCalledWith('category_id', 'cat-001')
      expect(qb.eq).toHaveBeenCalledWith('status', 'approved')
      expect(qb.gte).toHaveBeenCalledWith('expense_date', '2026-01-01')
      expect(qb.lte).toHaveBeenCalledWith('expense_date', '2026-12-31')
      expect(qb.ilike).toHaveBeenCalledWith('vendor', '%Kenya Power%')
      expect(qb.or).toHaveBeenCalledWith(
        'description.ilike.%electricity%,vendor.ilike.%electricity%,reference_number.ilike.%electricity%',
      )
      expect(qb.limit).toHaveBeenCalledWith(50)
      expect(qb.range).toHaveBeenCalledWith(10, 59)
    })

    it('uses default pagination when not specified', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null, count: 0 })
      client.from.mockReturnValue(qb)

      await repo.getExpenses()

      expect(qb.limit).toHaveBeenCalledWith(100)
      expect(qb.range).toHaveBeenCalledWith(0, 99)
    })

    it('returns empty pagination when data is null', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 0 })
      client.from.mockReturnValue(qb)

      const result = await repo.getExpenses()
      expect(result).toEqual({ data: [], total: 0 })
    })

    it('throws on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('DB down', 'DB_ERR') })
      client.from.mockReturnValue(qb)

      await expect(repo.getExpenses()).rejects.toThrow('getExpenses')
    })
  })

  // ── getExpenseById ─────────────────────────────────────────────────────

  describe('getExpenseById', () => {
    it('returns expense with joins when found', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleExpense, error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getExpenseById('exp-001')

      expect(client.from).toHaveBeenCalledWith('expenses')
      expect(qb.select).toHaveBeenCalledWith(
        '*, category:category_id(*), creator:created_by(id, full_name), approver:approved_by(id, full_name)',
      )
      expect(qb.eq).toHaveBeenCalledWith('id', 'exp-001')
      expect(qb.single).toHaveBeenCalled()
      expect(result).not.toBeNull()
      expect(result!.id).toBe('exp-001')
    })

    it('returns null when not found (PGRST116)', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Not found', 'PGRST116') })
      client.from.mockReturnValue(qb)

      const result = await repo.getExpenseById('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on other database errors', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Timeout', 'TIMEOUT') })
      client.from.mockReturnValue(qb)

      await expect(repo.getExpenseById('fail-id')).rejects.toThrow('getExpenseById')
    })
  })

  // ── getRecurringExpenses ───────────────────────────────────────────────

  describe('getRecurringExpenses', () => {
    it('returns active recurring expenses for branch with joins', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [sampleRecurring], error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getRecurringExpenses('branch-1')

      expect(client.from).toHaveBeenCalledWith('recurring_expenses')
      expect(qb.select).toHaveBeenCalledWith('*, category:category_id(*)')
      expect(qb.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(qb.eq).toHaveBeenCalledWith('is_active', true)
      expect(qb.order).toHaveBeenCalledWith('next_date', { ascending: true })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('rec-001')
    })

    it('returns empty array when none exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getRecurringExpenses('branch-1')
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Query failed', 'QUERY_ERR') })
      client.from.mockReturnValue(qb)

      await expect(repo.getRecurringExpenses('branch-1')).rejects.toThrow('getRecurringExpenses')
    })
  })

  // ── createExpenseCategory ──────────────────────────────────────────────

  describe('createExpenseCategory', () => {
    it('inserts and returns the new category', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleCategory, error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.createExpenseCategory({
        name: 'Utilities',
        description: 'Water, electricity, internet',
      })

      expect(client.from).toHaveBeenCalledWith('expense_categories')
      expect(qb.insert).toHaveBeenCalledWith({ name: 'Utilities', description: 'Water, electricity, internet' })
      expect(qb.select).toHaveBeenCalled()
      expect(qb.single).toHaveBeenCalled()
      expect(result.id).toBe('cat-001')
    })

    it('throws on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Insert failed', 'INSERT_ERR') })
      client.from.mockReturnValue(qb)

      await expect(repo.createExpenseCategory({ name: 'Fail' })).rejects.toThrow('createExpenseCategory')
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 1 })
      client.from.mockReturnValue(qb)

      const result = await repo.exists({ name: 'Utilities' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 0 })
      client.from.mockReturnValue(qb)

      const result = await repo.exists({ name: 'Nonexistent' })
      expect(result).toBe(false)
    })
  })
})
