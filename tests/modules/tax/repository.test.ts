/**
 * TaxRepository — Comprehensive Unit Tests
 *
 * Tests all repository methods including constructor, reads, edge cases,
 * and error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaxRepository, taxRepo } from '@/lib/modules/tax/repository'
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

const sampleTaxRate = {
  id: 'rate-001',
  name: 'VAT Standard 16%',
  percentage: 16,
  tax_type: 'vat' as const,
  description: 'Standard VAT rate',
  is_active: true,
  is_default: true,
  effective_from: null,
  effective_to: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const sampleTaxRates = [
  sampleTaxRate,
  {
    ...sampleTaxRate,
    id: 'rate-002',
    name: 'Excise 10%',
    percentage: 10,
    tax_type: 'excise' as const,
    is_default: false,
  },
  {
    ...sampleTaxRate,
    id: 'rate-003',
    name: 'VAT Zero 0%',
    percentage: 0,
    tax_type: 'vat' as const,
    is_default: false,
    is_active: false,
  },
]

const sampleTaxGroups = [
  {
    group_id: 'group-001',
    group_name: 'Standard VAT',
    description: 'Standard 16% VAT',
    is_active: true,
    combined_percentage: 16,
    rate_count: 1,
    rates: [{ rate_id: 'rate-001', rate_name: 'VAT Standard 16%', percentage: 16, tax_type: 'vat' }],
  },
]

const sampleAssignments = [
  {
    id: 'assign-001',
    category_id: 'cat-001',
    category_name: 'Beverages',
    tax_group_id: 'group-001',
    group_name: 'Standard VAT',
    is_tax_inclusive: true,
    effective_from: null,
    effective_to: null,
    tax_rates: [{ rate_id: 'rate-001', rate_name: 'VAT Standard 16%', percentage: 16, tax_type: 'vat' }],
  },
]

const sampleCategories = [
  { id: 'cat-001', name: 'Beverages' },
  { id: 'cat-002', name: 'Snacks' },
  { id: 'cat-003', name: 'Dairy' },
]

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('TaxRepository', () => {
  let mockClient: ReturnType<typeof makeClient>

  beforeEach(() => {
    vi.resetAllMocks()
    mockClient = makeClient()
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockClient as any)
  })

  describe('constructor', () => {
    it('should create a repository for the tax_rates table', () => {
      const repo = new TaxRepository()
      expect(repo).toBeInstanceOf(TaxRepository)
    })

    it('should export a singleton instance', () => {
      expect(taxRepo).toBeInstanceOf(TaxRepository)
      expect(taxRepo).toBe(taxRepo)
    })
  })

  describe('getTaxRates', () => {
    it('should return all active tax rates by default', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleTaxRates.filter(r => r.is_active), error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getTaxRates()

      expect(mockClient.from).toHaveBeenCalledWith('tax_rates')
      expect(qb.select).toHaveBeenCalledWith('*')
      expect(qb.order).toHaveBeenCalledWith('percentage', { ascending: false })
      expect(qb.eq).toHaveBeenCalledWith('is_active', true)
      expect(result).toHaveLength(2)
    })

    it('should include inactive rates when requested', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleTaxRates, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getTaxRates(true)

      expect(qb.eq).not.toHaveBeenCalledWith('is_active', true)
      expect(result).toHaveLength(3)
    })

    it('should return empty array when no rates exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getTaxRates()

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('DB error') })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      await expect(repo.getTaxRates()).rejects.toThrow(/getTaxRates/)
    })
  })

  describe('getDefaultTaxRate', () => {
    it('should return the default active rate', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleTaxRate, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getDefaultTaxRate()

      expect(mockClient.from).toHaveBeenCalledWith('tax_rates')
      expect(qb.select).toHaveBeenCalledWith('*')
      expect(qb.eq).toHaveBeenCalledWith('is_default', true)
      expect(qb.eq).toHaveBeenCalledWith('is_active', true)
      expect(qb.single).toHaveBeenCalled()
      expect(result).toEqual(sampleTaxRate)
    })

    it('should return null when no default configured', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: { message: 'No rows', code: 'PGRST116' } })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getDefaultTaxRate()

      expect(result).toBeNull()
    })

    it('should return null on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('Connection failed') })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getDefaultTaxRate()

      expect(result).toBeNull()
    })
  })

  describe('getTaxGroups', () => {
    it('should return all tax groups from the view', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleTaxGroups, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getTaxGroups()

      expect(mockClient.from).toHaveBeenCalledWith('tax_group_combined_view')
      expect(qb.select).toHaveBeenCalledWith('*')
      expect(result).toEqual(sampleTaxGroups)
      expect(result[0].group_name).toBe('Standard VAT')
    })

    it('should return empty array when no groups exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getTaxGroups()

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('View error') })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      await expect(repo.getTaxGroups()).rejects.toThrow(/getTaxGroups/)
    })
  })

  describe('getCategoryTaxAssignments', () => {
    it('should return all assignments ordered by category name', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleAssignments, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getCategoryTaxAssignments()

      expect(mockClient.from).toHaveBeenCalledWith('category_tax_view')
      expect(qb.select).toHaveBeenCalledWith('*')
      expect(qb.order).toHaveBeenCalledWith('category_name', { ascending: true })
      expect(result).toHaveLength(1)
      expect(result[0].category_name).toBe('Beverages')
    })

    it('should return empty array when no assignments exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getCategoryTaxAssignments()

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('View error') })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      await expect(repo.getCategoryTaxAssignments()).rejects.toThrow(/getCategoryTaxAssignments/)
    })
  })

  describe('getProductCategories', () => {
    it('should return product categories ordered by name', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleCategories, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getProductCategories()

      expect(mockClient.from).toHaveBeenCalledWith('categories')
      expect(qb.select).toHaveBeenCalledWith('id, name')
      expect(qb.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('cat-001')
    })

    it('should return empty array when no categories exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getProductCategories()

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('Categories error') })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      await expect(repo.getProductCategories()).rejects.toThrow(/getProductCategories/)
    })
  })

  describe('getTaxForCategory', () => {
    it('should resolve tax for a category', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: {
        group_id: 'group-001',
        group_name: 'Standard VAT',
        is_tax_inclusive: true,
        effective_from: null,
        effective_to: null,
        tax_rates: [{ rate_id: 'rate-001', rate_name: 'VAT Standard 16%', percentage: 16, tax_type: 'vat' }],
      }, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.getTaxForCategory('cat-001')

      expect(mockClient.from).toHaveBeenCalledWith('category_tax_view')
      expect(qb.eq).toHaveBeenCalledWith('category_id', 'cat-001')
      expect(result.group_id).toBe('group-001')
      expect(result.combined_percentage).toBe(16)
      expect(result.rates).toHaveLength(1)
    })

    it('should fallback to default rate when no assignment exists', async () => {
      // First call: category lookup fails
      const viewQb = makeQueryBuilder()
      viewQb._resolve({ data: null, error: { message: 'Not found', code: 'PGRST116' } })
      // Second call: default rate lookup succeeds
      const defaultQb = makeQueryBuilder()
      defaultQb._resolve({ data: sampleTaxRate, error: null })

      mockClient.from
        .mockReturnValueOnce(viewQb)
        .mockReturnValueOnce(defaultQb)

      const repo = new TaxRepository()
      const result = await repo.getTaxForCategory('cat-none')

      expect(result.group_id).toBeNull()
      expect(result.combined_percentage).toBe(16)
      expect(result.rates).toHaveLength(1)
      expect(result.rates[0].rate_name).toBe('VAT Standard 16%')
    })

    it('should return zero tax when no assignment and no default', async () => {
      const viewQb = makeQueryBuilder()
      viewQb._resolve({ data: null, error: { message: 'Not found', code: 'PGRST116' } })
      const defaultQb = makeQueryBuilder()
      defaultQb._resolve({ data: null, error: { message: 'No default', code: 'PGRST116' } })

      mockClient.from
        .mockReturnValueOnce(viewQb)
        .mockReturnValueOnce(defaultQb)

      const repo = new TaxRepository()
      const result = await repo.getTaxForCategory('cat-none')

      expect(result.group_id).toBeNull()
      expect(result.combined_percentage).toBe(0)
      expect(result.rates).toEqual([])
    })

    it('should fallback gracefully when view lookup returns error', async () => {
      const viewQb = makeQueryBuilder()
      viewQb._resolve({ data: null, error: new Error('View error') })
      const defaultQb = makeQueryBuilder()
      defaultQb._resolve({ data: sampleTaxRate, error: null })

      mockClient.from
        .mockReturnValueOnce(viewQb)
        .mockReturnValueOnce(defaultQb)

      const repo = new TaxRepository()
      const result = await repo.getTaxForCategory('cat-001')

      // Falls back to default rate
      expect(result.combined_percentage).toBe(16)
      expect(result.group_id).toBeNull()
    })
  })

  describe('exists (inherited)', () => {
    it('should return true when a record matches', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 1 })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.exists({ is_default: true })

      expect(result).toBe(true)
    })

    it('should return false when no records match', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 0 })
      mockClient.from.mockReturnValue(qb)

      const repo = new TaxRepository()
      const result = await repo.exists({ is_default: true, is_active: false })

      expect(result).toBe(false)
    })
  })
})
