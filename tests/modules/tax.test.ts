/**
 * Tax Module Facade — Unit Tests
 *
 * Tests that read operations correctly route through TaxRepository
 * and write operations still delegate to action files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock TaxRepository (reads) ────────────────────────────────────────────
const mockGetTaxRates = vi.fn()
const mockGetTaxGroups = vi.fn()
const mockGetCategoryTaxAssignments = vi.fn()
const mockGetProductCategories = vi.fn()
const mockGetDefaultTaxRate = vi.fn()
const mockGetTaxForCategory = vi.fn()

vi.mock('@/lib/modules/tax/repository', () => ({
  taxRepo: {
    getTaxRates: (...args: unknown[]) => mockGetTaxRates(...args),
    getTaxGroups: (...args: unknown[]) => mockGetTaxGroups(...args),
    getCategoryTaxAssignments: (...args: unknown[]) => mockGetCategoryTaxAssignments(...args),
    getProductCategories: (...args: unknown[]) => mockGetProductCategories(...args),
    getDefaultTaxRate: (...args: unknown[]) => mockGetDefaultTaxRate(...args),
    getTaxForCategory: (...args: unknown[]) => mockGetTaxForCategory(...args),
  },
}))

// ─── Mock lib/tax-actions (writes) ─────────────────────────────────────────
vi.mock('@/lib/tax-actions', () => ({
  createTaxRate: vi.fn(),
  updateTaxRate: vi.fn(),
  deleteTaxRate: vi.fn(),
  createTaxGroup: vi.fn(),
  updateTaxGroup: vi.fn(),
  deleteTaxGroup: vi.fn(),
  assignTaxToCategory: vi.fn(),
  removeCategoryTaxAssignment: vi.fn(),
}))

// ─── Import facade AFTER mocks ─────────────────────────────────────────────
import {
  getTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  getTaxGroups,
  createTaxGroup,
  updateTaxGroup,
  deleteTaxGroup,
  getCategoryTaxAssignments,
  assignTaxToCategory,
  removeCategoryTaxAssignment,
  getProductCategories,
  getDefaultTaxRate,
  getTaxForCategory,
} from '@/lib/modules/tax'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getTaxRates (reads via repository) ────────────────────────────────────

describe('getTaxRates', () => {
  it('delegates to repository', async () => {
    mockGetTaxRates.mockResolvedValue([{ id: 'rate-1', name: 'VAT 16%' }])

    const result = await getTaxRates()
    expect(mockGetTaxRates).toHaveBeenCalledWith(undefined)
    expect(result).toHaveLength(1)
  })

  it('passes includeInactive to repository', async () => {
    mockGetTaxRates.mockResolvedValue([{ id: 'rate-1', name: 'VAT 16%' }])

    await getTaxRates(true)
    expect(mockGetTaxRates).toHaveBeenCalledWith(true)
  })

  it('returns empty array on repository error', async () => {
    mockGetTaxRates.mockRejectedValue(new Error('DB error'))

    const result = await getTaxRates()
    expect(result).toEqual([])
  })
})

// ─── getTaxGroups (reads via repository) ───────────────────────────────────

describe('getTaxGroups', () => {
  it('delegates to repository', async () => {
    mockGetTaxGroups.mockResolvedValue([{ group_id: 'g-1', group_name: 'Standard' }])

    const result = await getTaxGroups()
    expect(mockGetTaxGroups).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
  })

  it('returns empty array on error', async () => {
    mockGetTaxGroups.mockRejectedValue(new Error('Error'))

    const result = await getTaxGroups()
    expect(result).toEqual([])
  })
})

// ─── getCategoryTaxAssignments (reads via repository) ──────────────────────

describe('getCategoryTaxAssignments', () => {
  it('delegates to repository', async () => {
    mockGetCategoryTaxAssignments.mockResolvedValue([{ id: 'a-1', category_name: 'Beverages' }])

    const result = await getCategoryTaxAssignments()
    expect(mockGetCategoryTaxAssignments).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
  })

  it('returns empty array on error', async () => {
    mockGetCategoryTaxAssignments.mockRejectedValue(new Error('Error'))

    const result = await getCategoryTaxAssignments()
    expect(result).toEqual([])
  })
})

// ─── getProductCategories (reads via repository) ───────────────────────────

describe('getProductCategories', () => {
  it('delegates to repository', async () => {
    mockGetProductCategories.mockResolvedValue([{ id: 'c-1', name: 'Beverages' }])

    const result = await getProductCategories()
    expect(mockGetProductCategories).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
  })

  it('returns empty array on error', async () => {
    mockGetProductCategories.mockRejectedValue(new Error('Error'))

    const result = await getProductCategories()
    expect(result).toEqual([])
  })
})

// ─── getDefaultTaxRate (reads via repository) ──────────────────────────────

describe('getDefaultTaxRate', () => {
  it('delegates to repository', async () => {
    mockGetDefaultTaxRate.mockResolvedValue({ id: 'rate-1', name: 'VAT 16%', percentage: 16 })

    const result = await getDefaultTaxRate()
    expect(mockGetDefaultTaxRate).toHaveBeenCalledOnce()
    expect(result).not.toBeNull()
    expect(result!.percentage).toBe(16)
  })

  it('returns null when none configured', async () => {
    mockGetDefaultTaxRate.mockResolvedValue(null)

    const result = await getDefaultTaxRate()
    expect(result).toBeNull()
  })

  it('returns null on error', async () => {
    mockGetDefaultTaxRate.mockRejectedValue(new Error('Error'))

    const result = await getDefaultTaxRate()
    expect(result).toBeNull()
  })
})

// ─── getTaxForCategory (reads via repository) ──────────────────────────────

describe('getTaxForCategory', () => {
  it('delegates to repository', async () => {
    mockGetTaxForCategory.mockResolvedValue({
      group_id: 'g-1', group_name: 'Standard', is_tax_inclusive: true,
      combined_percentage: 16, rates: [],
    })

    const result = await getTaxForCategory('cat-1')
    expect(mockGetTaxForCategory).toHaveBeenCalledWith('cat-1')
    expect(result.combined_percentage).toBe(16)
  })

  it('returns fallback on error', async () => {
    mockGetTaxForCategory.mockRejectedValue(new Error('Error'))

    const result = await getTaxForCategory('cat-err')
    expect(result).toEqual({
      group_id: null, group_name: null, is_tax_inclusive: true,
      combined_percentage: 0, rates: [],
    })
  })
})

// ─── createTaxRate (write — delegates to action file) ──────────────────────

describe('createTaxRate', () => {
  it('delegates to action file', async () => {
    const { createTaxRate: createAction } = await import('@/lib/tax-actions')
    vi.mocked(createAction).mockResolvedValue({ success: true, data: { id: 'rate-new' } } as any)

    const result = await createTaxRate({ name: 'New Rate', percentage: 10, tax_type: 'vat' })
    expect(createAction).toHaveBeenCalledWith({ name: 'New Rate', percentage: 10, tax_type: 'vat' })
    expect(result).toEqual({ success: true, data: { id: 'rate-new' } })
  })
})

// ─── updateTaxRate (write — delegates to action file) ──────────────────────

describe('updateTaxRate', () => {
  it('delegates to action file', async () => {
    const { updateTaxRate: updateAction } = await import('@/lib/tax-actions')
    vi.mocked(updateAction).mockResolvedValue({ success: true })

    const result = await updateTaxRate('rate-1', { name: 'Updated' })
    expect(updateAction).toHaveBeenCalledWith('rate-1', { name: 'Updated' })
    expect(result).toEqual({ success: true })
  })
})

// ─── deleteTaxRate (write — delegates to action file) ──────────────────────

describe('deleteTaxRate', () => {
  it('delegates to action file', async () => {
    const { deleteTaxRate: deleteAction } = await import('@/lib/tax-actions')
    vi.mocked(deleteAction).mockResolvedValue({ success: true })

    const result = await deleteTaxRate('rate-1')
    expect(deleteAction).toHaveBeenCalledWith('rate-1')
    expect(result).toEqual({ success: true })
  })
})

// ─── createTaxGroup (write — delegates to action file) ─────────────────────

describe('createTaxGroup', () => {
  it('delegates to action file', async () => {
    const { createTaxGroup: createAction } = await import('@/lib/tax-actions')
    vi.mocked(createAction).mockResolvedValue({ success: true, data: { id: 'group-new' } } as any)

    const result = await createTaxGroup({ name: 'New Group' })
    expect(createAction).toHaveBeenCalledWith({ name: 'New Group' })
    expect(result).toEqual({ success: true, data: { id: 'group-new' } })
  })
})

// ─── updateTaxGroup (write — delegates to action file) ─────────────────────

describe('updateTaxGroup', () => {
  it('delegates to action file', async () => {
    const { updateTaxGroup: updateAction } = await import('@/lib/tax-actions')
    vi.mocked(updateAction).mockResolvedValue({ success: true })

    const result = await updateTaxGroup('group-1', { name: 'Updated' })
    expect(updateAction).toHaveBeenCalledWith('group-1', { name: 'Updated' })
    expect(result).toEqual({ success: true })
  })
})

// ─── deleteTaxGroup (write — delegates to action file) ─────────────────────

describe('deleteTaxGroup', () => {
  it('delegates to action file', async () => {
    const { deleteTaxGroup: deleteAction } = await import('@/lib/tax-actions')
    vi.mocked(deleteAction).mockResolvedValue({ success: true })

    const result = await deleteTaxGroup('group-1')
    expect(deleteAction).toHaveBeenCalledWith('group-1')
    expect(result).toEqual({ success: true })
  })
})

// ─── assignTaxToCategory (write — delegates to action file) ────────────────

describe('assignTaxToCategory', () => {
  it('delegates to action file', async () => {
    const { assignTaxToCategory: assignAction } = await import('@/lib/tax-actions')
    vi.mocked(assignAction).mockResolvedValue({ success: true })

    const result = await assignTaxToCategory('cat-1', 'group-1')
    expect(assignAction).toHaveBeenCalledWith({ category_id: 'cat-1', tax_group_id: 'group-1' })
    expect(result).toEqual({ success: true })
  })
})

// ─── removeCategoryTaxAssignment (write — delegates to action file) ────────

describe('removeCategoryTaxAssignment', () => {
  it('delegates to action file', async () => {
    const { removeCategoryTaxAssignment: removeAction } = await import('@/lib/tax-actions')
    vi.mocked(removeAction).mockResolvedValue({ success: true })

    const result = await removeCategoryTaxAssignment('cat-1', 'group-1')
    expect(removeAction).toHaveBeenCalledWith('cat-1', 'group-1')
    expect(result).toEqual({ success: true })
  })
})
