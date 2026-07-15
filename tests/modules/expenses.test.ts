/**
 * Expenses Module Facade — Unit Tests
 *
 * Tests that read operations correctly route through ExpenseRepository
 * and write/stats/invoice operations still delegate to action files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock ExpenseRepository (reads) ─────────────────────────────────────────
const mockGetExpenseCategories = vi.fn()
const mockGetExpenses = vi.fn()
const mockGetExpenseById = vi.fn()
const mockGetRecurringExpenses = vi.fn()

vi.mock('@/lib/modules/expenses/repository', () => ({
  expenseRepo: {
    getExpenseCategories: (...args: unknown[]) => mockGetExpenseCategories(...args),
    getExpenses: (...args: unknown[]) => mockGetExpenses(...args),
    getExpenseById: (...args: unknown[]) => mockGetExpenseById(...args),
    getRecurringExpenses: (...args: unknown[]) => mockGetRecurringExpenses(...args),
  },
}))

// ─── Mock lib/expenses-actions (writes + stats) ─────────────────────────────
vi.mock('@/lib/expenses-actions', () => ({
  createExpenseCategory: vi.fn(),
  updateExpenseCategory: vi.fn(),
  deleteExpenseCategory: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  approveExpense: vi.fn(),
  getExpenseStats: vi.fn(),
  createRecurringExpense: vi.fn(),
  toggleRecurringExpense: vi.fn(),
  deleteRecurringExpense: vi.fn(),
}))

// ─── Mock lib/invoice-actions (invoice operations) ──────────────────────────
vi.mock('@/lib/invoice-actions', () => ({
  createInvoiceFromSale: vi.fn(),
  getInvoices: vi.fn(),
  getInvoice: vi.fn(),
  updateInvoiceStatus: vi.fn(),
  recordInvoicePayment: vi.fn(),
  deleteInvoice: vi.fn(),
  getInvoiceStats: vi.fn(),
}))

// ─── Import facade AFTER mocks ──────────────────────────────────────────────
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  getExpenses,
  getExpensesPaginated,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  getExpenseStats,
  getRecurringExpenses,
  createRecurringExpense,
  toggleRecurringExpense,
  deleteRecurringExpense,
} from '@/lib/modules/expenses'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getExpenseCategories (reads via repository) ────────────────────────────

describe('getExpenseCategories', () => {
  it('delegates to repository getExpenseCategories', async () => {
    const categories = [
      { id: 'cat-1', name: 'Utilities', color: '#FF5733', sort_order: 1, is_active: true },
      { id: 'cat-2', name: 'Office Supplies', color: '#33FF57', sort_order: 2, is_active: true },
    ]
    mockGetExpenseCategories.mockResolvedValue(categories)

    const result = await getExpenseCategories()
    expect(mockGetExpenseCategories).toHaveBeenCalledOnce()
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('cat-1')
  })

  it('returns empty array on repository error', async () => {
    mockGetExpenseCategories.mockRejectedValue(new Error('DB error'))

    const result = await getExpenseCategories()
    expect(result).toEqual([])
  })
})

// ─── getExpenses (reads via repository) ─────────────────────────────────────

describe('getExpenses', () => {
  it('delegates to repository getExpenses and returns data array', async () => {
    mockGetExpenses.mockResolvedValue({ data: [{ id: 'exp-1', description: 'Test' }], total: 1 })

    const result = await getExpenses({ branchId: 'branch-1' })
    expect(mockGetExpenses).toHaveBeenCalledWith({ branchId: 'branch-1' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('exp-1')
  })

  it('returns empty array on repository error', async () => {
    mockGetExpenses.mockRejectedValue(new Error('DB error'))

    const result = await getExpenses()
    expect(result).toEqual([])
  })
})

// ─── getExpensesPaginated (reads via repository, returns full result) ───────

describe('getExpensesPaginated', () => {
  it('delegates to repository getExpenses and returns paginated result', async () => {
    mockGetExpenses.mockResolvedValue({
      data: [{ id: 'exp-1', description: 'Test' }],
      total: 1,
    })

    const result = await getExpensesPaginated({ branchId: 'branch-1', limit: 10 })
    expect(mockGetExpenses).toHaveBeenCalledWith({ branchId: 'branch-1', limit: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('returns fallback pagination on repository error', async () => {
    mockGetExpenses.mockRejectedValue(new Error('DB error'))

    const result = await getExpensesPaginated()
    expect(result).toEqual({ data: [], total: 0 })
  })
})

// ─── getExpenseById (reads via repository) ──────────────────────────────────

describe('getExpenseById', () => {
  it('delegates to repository getExpenseById', async () => {
    mockGetExpenseById.mockResolvedValue({ id: 'exp-1', description: 'Test expense' })

    const result = await getExpenseById('exp-1')
    expect(mockGetExpenseById).toHaveBeenCalledWith('exp-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('exp-1')
  })

  it('returns null when not found', async () => {
    mockGetExpenseById.mockResolvedValue(null)

    const result = await getExpenseById('nonexistent')
    expect(result).toBeNull()
  })

  it('returns null on repository error', async () => {
    mockGetExpenseById.mockRejectedValue(new Error('DB error'))

    const result = await getExpenseById('fail-id')
    expect(result).toBeNull()
  })
})

// ─── getRecurringExpenses (reads via repository) ────────────────────────────

describe('getRecurringExpenses', () => {
  it('delegates to repository getRecurringExpenses', async () => {
    mockGetRecurringExpenses.mockResolvedValue([
      { id: 'rec-1', description: 'Monthly rent', frequency: 'monthly' },
    ])

    const result = await getRecurringExpenses('branch-1')
    expect(mockGetRecurringExpenses).toHaveBeenCalledWith('branch-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('rec-1')
  })

  it('returns empty array on repository error', async () => {
    mockGetRecurringExpenses.mockRejectedValue(new Error('DB error'))

    const result = await getRecurringExpenses('branch-1')
    expect(result).toEqual([])
  })
})

// ─── createExpenseCategory (write — delegates to action file) ──────────────

describe('createExpenseCategory', () => {
  it('delegates to action file createExpenseCategory', async () => {
    const { createExpenseCategory: createAction } = await import('@/lib/expenses-actions')
    vi.mocked(createAction).mockResolvedValue({ id: 'cat-new', name: 'New Cat', color: '#000', icon: 'Folder', description: null, sort_order: 0, is_active: true, created_at: '2026-01-01T00:00:00Z' })

    const result = await createExpenseCategory({ name: 'New Cat', color: '#000' })
    expect(createAction).toHaveBeenCalledWith({ name: 'New Cat', color: '#000' })
    expect(result).toEqual({ success: true, id: 'cat-new' })
  })

  it('returns error when action returns falsy result', async () => {
    const { createExpenseCategory: createAction } = await import('@/lib/expenses-actions')
    vi.mocked(createAction).mockResolvedValue(null)

    const result = await createExpenseCategory({ name: 'Fail' })
    expect(result).toEqual({ success: false, error: 'Failed to create category' })
  })

  it('returns error on action exception', async () => {
    const { createExpenseCategory: createAction } = await import('@/lib/expenses-actions')
    vi.mocked(createAction).mockRejectedValue(new Error('Validation error'))

    const result = await createExpenseCategory({ name: 'Fail' })
    expect(result).toEqual({ success: false, error: 'Operation failed. Please try again.' })
  })
})

// ─── updateExpenseCategory (write — delegates to action file) ──────────────

describe('updateExpenseCategory', () => {
  it('delegates to action file updateExpenseCategory', async () => {
    const { updateExpenseCategory: updateAction } = await import('@/lib/expenses-actions')
    vi.mocked(updateAction).mockResolvedValue(true)

    const result = await updateExpenseCategory('cat-1', { name: 'Updated' })
    expect(updateAction).toHaveBeenCalledWith('cat-1', { name: 'Updated' })
    expect(result).toEqual({ success: true })
  })

  it('returns error on action exception', async () => {
    const { updateExpenseCategory: updateAction } = await import('@/lib/expenses-actions')
    vi.mocked(updateAction).mockRejectedValue(new Error('Not found'))

    const result = await updateExpenseCategory('bad-id', {})
    expect(result).toEqual({ success: false, error: 'Operation failed. Please try again.' })
  })
})

// ─── deleteExpenseCategory (write — delegates to action file) ──────────────

describe('deleteExpenseCategory', () => {
  it('delegates to action file deleteExpenseCategory', async () => {
    const { deleteExpenseCategory: deleteAction } = await import('@/lib/expenses-actions')
    vi.mocked(deleteAction).mockResolvedValue({ success: true })

    const result = await deleteExpenseCategory('cat-1')
    expect(deleteAction).toHaveBeenCalledWith('cat-1')
    expect(result).toEqual({ success: true })
  })
})

// ─── createExpense (write — delegates to action file) ──────────────────────

describe('createExpense', () => {
  it('delegates to action file createExpense', async () => {
    const { createExpense: createAction } = await import('@/lib/expenses-actions')
    vi.mocked(createAction).mockResolvedValue({ success: true, data: { id: 'exp-new' } } as any)

    const result = await createExpense({
      description: 'Test expense',
      amount_cents: 10000,
      category_id: 'cat-1',
    }) as any
    expect(createAction).toHaveBeenCalledWith({
      description: 'Test expense',
      amount_cents: 10000,
      category_id: 'cat-1',
    })
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('exp-new')
  })
})

// ─── updateExpense (write — delegates to action file) ──────────────────────

describe('updateExpense', () => {
  it('delegates to action file updateExpense', async () => {
    const { updateExpense: updateAction } = await import('@/lib/expenses-actions')
    vi.mocked(updateAction).mockResolvedValue({ success: true })

    const result = await updateExpense('exp-1', { description: 'Updated' })
    expect(updateAction).toHaveBeenCalledWith('exp-1', { description: 'Updated' })
    expect(result).toEqual({ success: true })
  })
})

// ─── deleteExpense (write — delegates to action file) ──────────────────────

describe('deleteExpense', () => {
  it('delegates to action file deleteExpense', async () => {
    const { deleteExpense: deleteAction } = await import('@/lib/expenses-actions')
    vi.mocked(deleteAction).mockResolvedValue({ success: true })

    const result = await deleteExpense('exp-1')
    expect(deleteAction).toHaveBeenCalledWith('exp-1')
    expect(result).toEqual({ success: true })
  })
})

// ─── approveExpense (write — delegates to action file) ─────────────────────

describe('approveExpense', () => {
  it('delegates to action file approveExpense', async () => {
    const { approveExpense: approveAction } = await import('@/lib/expenses-actions')
    vi.mocked(approveAction).mockResolvedValue({ success: true })

    const result = await approveExpense('exp-1', 'approved')
    expect(approveAction).toHaveBeenCalledWith('exp-1', 'approved', undefined)
    expect(result).toEqual({ success: true })
  })

  it('passes rejection reason when rejecting', async () => {
    const { approveExpense: approveAction } = await import('@/lib/expenses-actions')
    vi.mocked(approveAction).mockResolvedValue({ success: true })

    await approveExpense('exp-1', 'rejected', 'No receipt attached')
    expect(approveAction).toHaveBeenCalledWith('exp-1', 'rejected', 'No receipt attached')
  })
})

// ─── getExpenseStats (computed — delegates to action file) ─────────────────

describe('getExpenseStats', () => {
  it('delegates to action file getExpenseStats', async () => {
    const { getExpenseStats: statsAction } = await import('@/lib/expenses-actions')
    const stats = {
      total_expenses_cents: 500000,
      expense_count: 10,
      pending_count: 2,
      approved_count: 7,
      rejected_count: 1,
      category_breakdown: [],
      monthly_totals: [],
      top_vendors: [],
    }
    vi.mocked(statsAction).mockResolvedValue(stats)

    const result = await getExpenseStats('branch-1', 6)
    expect(statsAction).toHaveBeenCalledWith('branch-1', 6)
    expect(result).toEqual(stats)
  })

  it('returns null on action exception', async () => {
    const { getExpenseStats: statsAction } = await import('@/lib/expenses-actions')
    vi.mocked(statsAction).mockRejectedValue(new Error('Stats error'))

    const result = await getExpenseStats('branch-1')
    expect(result).toBeNull()
  })
})

// ─── createRecurringExpense (write — delegates to action file) ─────────────

describe('createRecurringExpense', () => {
  it('delegates to action file createRecurringExpense', async () => {
    const { createRecurringExpense: createAction } = await import('@/lib/expenses-actions')
    vi.mocked(createAction).mockResolvedValue({ success: true, data: { id: 'rec-new' } } as any)

    const result = await createRecurringExpense({
      description: 'Monthly internet',
      amount_cents: 5000,
      frequency: 'monthly',
      branch_id: 'branch-1',
    }) as any
    expect(createAction).toHaveBeenCalledWith({
      description: 'Monthly internet',
      amount_cents: 5000,
      frequency: 'monthly',
      branch_id: 'branch-1',
    })
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('rec-new')
  })
})

// ─── toggleRecurringExpense (write — delegates to action file) ─────────────

describe('toggleRecurringExpense', () => {
  it('delegates to action file toggleRecurringExpense', async () => {
    const { toggleRecurringExpense: toggleAction } = await import('@/lib/expenses-actions')
    vi.mocked(toggleAction).mockResolvedValue({ success: true })

    const result = await toggleRecurringExpense('rec-1', false)
    expect(toggleAction).toHaveBeenCalledWith('rec-1', false)
    expect(result).toEqual({ success: true })
  })
})

// ─── deleteRecurringExpense (write — delegates to action file) ─────────────

describe('deleteRecurringExpense', () => {
  it('delegates to action file deleteRecurringExpense', async () => {
    const { deleteRecurringExpense: deleteAction } = await import('@/lib/expenses-actions')
    vi.mocked(deleteAction).mockResolvedValue({ success: true })

    const result = await deleteRecurringExpense('rec-1')
    expect(deleteAction).toHaveBeenCalledWith('rec-1')
    expect(result).toEqual({ success: true })
  })
})
