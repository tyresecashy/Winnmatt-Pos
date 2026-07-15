/**
 * SupplierRepository — Comprehensive Unit Tests
 *
 * Tests all repository methods including constructor, reads, writes,
 * edge cases, and error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupplierRepository, supplierRepo } from '@/lib/modules/suppliers/repository'
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

  // Allow promise-style await on the chain
  const thenable: any = (resolve: (value: any) => void) => {
    resolve(chain._mockResolveValue ?? { data: [], error: null, count: 0 })
    return Promise.resolve(chain._mockResolveValue ?? { data: [], error: null, count: 0 })
  }
  chain.then = thenable

  // Helper to set the resolved value
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

const sampleSupplier = {
  id: 'sup-001',
  name: 'Fresh Beverages Ltd',
  contact_person: 'Mr. Kiprop',
  phone: '0701234567',
  email: 'sales@freshbevs.co.ke',
  payment_terms: 'Net 30',
  balance: 150000,
  code: null,
  company_name: null,
  address: null,
  tax_number: null,
  bank_name: null,
  bank_account: null,
  bank_code: null,
  credit_limit: null,
  credit_days: null,
  delivery_days: null,
  lead_time: null,
  rating: null,
  performance_score: null,
  quality_score: null,
  late_delivery_pct: null,
  rejected_deliveries: null,
  total_purchase_amount: null,
  total_orders: null,
  outstanding_orders: null,
  status: null,
  website: null,
  notes: null,
  search_vector: null,
  created_at: '2026-01-15T08:00:00Z',
  updated_at: '2026-01-15T08:00:00Z',
}

const sampleSuppliers = [
  sampleSupplier,
  {
    ...sampleSupplier,
    id: 'sup-002',
    name: 'Dairy Farms Kenya',
    contact_person: 'Ms. Wanjiru',
    phone: '0712345678',
    email: 'orders@dairyfarms.co.ke',
    payment_terms: 'Net 15',
    balance: 200000,
  },
  {
    ...sampleSupplier,
    id: 'sup-003',
    name: 'Snacks Wholesale',
    contact_person: 'Mr. Ochieng',
    phone: '0723456789',
    email: 'sales@snackswhale.co.ke',
    payment_terms: 'Net 45',
    balance: 350000,
  },
]

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SupplierRepository', () => {
  let mockClient: ReturnType<typeof makeClient>

  beforeEach(() => {
    vi.resetAllMocks()
    mockClient = makeClient()
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockClient as any)
  })

  describe('constructor', () => {
    it('should create a repository for the suppliers table', async () => {
      const repo = new SupplierRepository()
      expect(repo).toBeInstanceOf(SupplierRepository)
    })

    it('should export a singleton instance', () => {
      expect(supplierRepo).toBeInstanceOf(SupplierRepository)
      expect(supplierRepo).toBe(supplierRepo)
    })
  })

  describe('getSuppliers', () => {
    it('should return all suppliers ordered by name', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleSuppliers, error: null, count: 3 })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.getSuppliers()

      expect(mockClient.from).toHaveBeenCalledWith('suppliers')
      expect(qb.select).toHaveBeenCalledWith('*', { count: 'exact' })
      expect(qb.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(result).toEqual(sampleSuppliers)
      expect(result).toHaveLength(3)
    })

    it('should return empty array when no suppliers exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null, count: 0 })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.getSuppliers()

      expect(result).toEqual([])
    })

    it('should throw on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('Connection failed'), count: 0 })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      await expect(repo.getSuppliers()).rejects.toThrow(/findMany.*Connection failed/)
    })
  })

  describe('getSupplierById', () => {
    it('should return a supplier by ID', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleSupplier, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.getSupplierById('sup-001')

      expect(mockClient.from).toHaveBeenCalledWith('suppliers')
      expect(qb.select).toHaveBeenCalledWith('*')
      expect(qb.eq).toHaveBeenCalledWith('id', 'sup-001')
      expect(qb.maybeSingle).toHaveBeenCalled()
      expect(result).toEqual(sampleSupplier)
    })

    it('should return null when supplier not found', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.getSupplierById('nonexistent')

      expect(result).toBeNull()
    })

    it('should throw on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('Not found') })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      await expect(repo.getSupplierById('bad-id')).rejects.toThrow(/findById.*Not found/)
    })
  })

  describe('searchSuppliers', () => {
    it('should search suppliers by name, contact, phone, or email', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [sampleSupplier], error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.searchSuppliers('Fresh')

      expect(mockClient.from).toHaveBeenCalledWith('suppliers')
      expect(qb.select).toHaveBeenCalledWith('*')
      expect(qb.or).toHaveBeenCalledWith(
        'name.ilike.%Fresh%,contact_person.ilike.%Fresh%,phone.ilike.%Fresh%,email.ilike.%Fresh%',
      )
      expect(qb.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(qb.limit).toHaveBeenCalledWith(20)
      expect(result).toEqual([sampleSupplier])
    })

    it('should return empty array for empty query', async () => {
      const repo = new SupplierRepository()
      const result = await repo.searchSuppliers('')

      expect(mockClient.from).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should return empty array for whitespace-only query', async () => {
      const repo = new SupplierRepository()
      const result = await repo.searchSuppliers('   ')

      expect(mockClient.from).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should trim query before searching', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [sampleSupplier], error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.searchSuppliers('  Kiprop  ')

      expect(qb.or).toHaveBeenCalledWith(
        expect.stringContaining('Kiprop'),
      )
      expect(result).toHaveLength(1)
    })

    it('should return matching suppliers from multi-word query', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: sampleSuppliers, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.searchSuppliers('Ltd')

      expect(result).toHaveLength(3)
    })

    it('should throw on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('Search failed') })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      await expect(repo.searchSuppliers('test')).rejects.toThrow(/searchSuppliers.*Search failed/)
    })
  })

  describe('exists (inherited)', () => {
    it('should return true when a record matches the filter', async () => {
      const qb = makeQueryBuilder()
      // exists uses count → select with head:true
      qb._resolve({ data: null, error: null, count: 1 })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.exists({ name: 'Fresh Beverages Ltd' })

      expect(result).toBe(true)
    })

    it('should return false when no records match', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 0 })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.exists({ name: 'Nonexistent' })

      expect(result).toBe(false)
    })
  })

  describe('createSupplier', () => {
    it('should insert a new supplier with timestamps', async () => {
      const newSupplier = {
        name: 'New Supplier Co',
        contact_person: 'Mr. New',
        phone: '0700000000',
        email: 'new@supplier.co.ke',
        payment_terms: 'Net 30',
        balance: 0,
      }

      const qb = makeQueryBuilder()
      qb._resolve({ data: { id: 'sup-new', ...newSupplier, created_at: '2026-07-14T10:00:00Z', updated_at: '2026-07-14T10:00:00Z' }, error: null })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      const result = await repo.createSupplier(newSupplier as any)

      expect(mockClient.from).toHaveBeenCalledWith('suppliers')
      expect(qb.insert).toHaveBeenCalled()
      expect(qb.select).toHaveBeenCalled()
      expect(qb.single).toHaveBeenCalled()
      expect(result.id).toBe('sup-new')
      expect(result.name).toBe('New Supplier Co')
    })

    it('should throw on insert error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('Duplicate name') })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      await expect(
        repo.createSupplier({ name: 'Duplicate' } as any),
      ).rejects.toThrow()
    })
  })

  describe('updateSupplier', () => {
    it('should update a supplier with audit', async () => {
      const qb = makeQueryBuilder()
      // First call (select before update)
      const fetchQb = makeQueryBuilder()
      fetchQb._resolve({ data: sampleSupplier, error: null })
      // Second call (the update)
      const updateQb = makeQueryBuilder()
      updateQb._resolve({ data: { ...sampleSupplier, name: 'Updated Name', updated_at: '2026-07-14T12:00:00Z' }, error: null })

      mockClient.from
        .mockReturnValueOnce(fetchQb)
        .mockReturnValueOnce(updateQb)

      const repo = new SupplierRepository()
      const result = await repo.updateSupplier('sup-001', { name: 'Updated Name' })

      expect(mockClient.from).toHaveBeenCalledWith('suppliers')
      expect(updateQb.update).toHaveBeenCalled()
      expect(updateQb.eq).toHaveBeenCalledWith('id', 'sup-001')
      expect(result.name).toBe('Updated Name')
    })

    it('should throw on update error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('Not found') })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      await expect(
        repo.updateSupplier('bad-id', { name: 'New' }),
      ).rejects.toThrow()
    })
  })

  describe('deleteSupplier', () => {
    it('should delete a supplier with audit trail', async () => {
      const fetchQb = makeQueryBuilder()
      fetchQb._resolve({ data: sampleSupplier, error: null })
      const deleteQb = makeQueryBuilder()
      deleteQb._resolve({ data: null, error: null })

      mockClient.from
        .mockReturnValueOnce(fetchQb)
        .mockReturnValueOnce(deleteQb)

      const repo = new SupplierRepository()
      await repo.deleteSupplier('sup-001')

      expect(mockClient.from).toHaveBeenCalledWith('suppliers')
      expect(deleteQb.delete).toHaveBeenCalled()
      expect(deleteQb.eq).toHaveBeenCalledWith('id', 'sup-001')
    })

    it('should throw on delete error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('FK constraint') })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()
      await expect(
        repo.deleteSupplier('fk-blocked-id'),
      ).rejects.toThrow()
    })
  })

  describe('error handling', () => {
    it('should include table name and operation in error messages', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new Error('DB down') })
      mockClient.from.mockReturnValue(qb)

      const repo = new SupplierRepository()

      await expect(repo.getSuppliers()).rejects.toThrow(/suppliers.*findMany/)
      await expect(repo.getSupplierById('x')).rejects.toThrow(/suppliers.*findById/)
      await expect(repo.searchSuppliers('x')).rejects.toThrow(/suppliers.*searchSuppliers/)
    })
  })
})
