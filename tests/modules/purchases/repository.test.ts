/**
 * PurchaseRepository — Comprehensive Unit Tests
 *
 * Tests all repository methods including constructor, reads, edge cases,
 * and error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PurchaseRepository, purchaseRepo } from '@/lib/modules/purchases/repository'
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

const samplePurchaseOrder: Record<string, any> = {
  id: 'po-001',
  supplier_id: 'sup-001',
  branch_id: 'branch-1',
  status: 'pending',
  subtotal: 100000,
  tax_amount: 16000,
  total_amount: 116000,
  expected_delivery: '2026-07-20',
  notes: 'Urgent order',
  created_at: '2026-07-14T10:00:00Z',
  updated_at: '2026-07-14T10:00:00Z',
  supplier: { id: 'sup-001', name: 'Fresh Beverages Ltd', contact_person: 'Mr. Kiprop', phone: '0701234567' },
  items: [
    {
      id: 'poi-001',
      product_id: 'prod-001',
      quantity: 100,
      unit_price: 1000,
      line_total: 100000,
      received_quantity: 0,
      product: { id: 'prod-001', sku: 'BEV-001', name: 'Soda 500ml' },
    },
  ],
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('PurchaseRepository', () => {
  let repo: PurchaseRepository
  let client: Record<string, any>

  beforeEach(() => {
    vi.clearAllMocks()
    client = makeClient()
    vi.mocked(getSupabaseAdmin).mockReturnValue(client as any)
    repo = new PurchaseRepository()
  })

  // ── Singleton ──────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('exports a pre-built purchaseRepo instance', () => {
      expect(purchaseRepo).toBeInstanceOf(PurchaseRepository)
    })
  })

  // ── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates a repository for the purchase_orders table', () => {
      expect(repo).toBeInstanceOf(PurchaseRepository)
    })

    it('lazily calls getSupabaseAdmin on first method call', () => {
      vi.mocked(getSupabaseAdmin).mockReturnValue(client as any)
      const defaultRepo = new PurchaseRepository()
      expect(getSupabaseAdmin).not.toHaveBeenCalled()
      // Trigger lazy client initialization by accessing a method
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      client.from.mockReturnValue(qb)
      void defaultRepo.getPurchaseOrders('branch-1')
      expect(getSupabaseAdmin).toHaveBeenCalled()
      expect(defaultRepo).toBeInstanceOf(PurchaseRepository)
    })
  })

  // ── getPurchaseOrders ──────────────────────────────────────────────────

  describe('getPurchaseOrders', () => {
    it('returns purchase orders with joins ordered by created_at desc', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [samplePurchaseOrder], error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getPurchaseOrders('branch-1')

      expect(client.from).toHaveBeenCalledWith('purchase_orders')
      expect(qb.select).toHaveBeenCalledWith(`
        *,
        supplier:suppliers(id, name, contact_person, phone),
        items:purchase_order_items(
          id,
          product_id,
          quantity,
          unit_price,
          line_total,
          received_quantity,
          product:products(id, sku, name)
        )
      `)
      expect(qb.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(qb.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(qb.limit).toHaveBeenCalledWith(50)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('po-001')
      expect(result[0].supplier).toBeDefined()
      expect(result[0].items).toHaveLength(1)
    })

    it('uses default limit of 50 when not specified', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      client.from.mockReturnValue(qb)

      await repo.getPurchaseOrders('branch-1')
      expect(qb.limit).toHaveBeenCalledWith(50)
    })

    it('respects custom limit parameter', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: [], error: null })
      client.from.mockReturnValue(qb)

      await repo.getPurchaseOrders('branch-1', 10)
      expect(qb.limit).toHaveBeenCalledWith(10)
    })

    it('returns empty array when no purchase orders exist', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getPurchaseOrders('branch-1')
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Connection failed', 'CONN_ERR') })
      client.from.mockReturnValue(qb)

      await expect(repo.getPurchaseOrders('branch-1')).rejects.toThrow('getPurchaseOrders')
    })
  })

  // ── getPurchaseOrderById ───────────────────────────────────────────────

  describe('getPurchaseOrderById', () => {
    it('returns purchase order with joins when found', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: samplePurchaseOrder, error: null })
      client.from.mockReturnValue(qb)

      const result = await repo.getPurchaseOrderById('po-001')

      expect(client.from).toHaveBeenCalledWith('purchase_orders')
      expect(qb.select).toHaveBeenCalledWith(`
        *,
        supplier:suppliers(id, name, contact_person, phone),
        items:purchase_order_items(
          id,
          product_id,
          quantity,
          unit_price,
          line_total,
          received_quantity,
          product:products(id, sku, name)
        )
      `)
      expect(qb.eq).toHaveBeenCalledWith('id', 'po-001')
      expect(qb.single).toHaveBeenCalled()
      expect(result).not.toBeNull()
      expect(result!.id).toBe('po-001')
    })

    it('returns null when not found (PGRST116)', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Not found', 'PGRST116') })
      client.from.mockReturnValue(qb)

      const result = await repo.getPurchaseOrderById('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on other database errors', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: new MockDbError('Timeout', 'TIMEOUT') })
      client.from.mockReturnValue(qb)

      await expect(repo.getPurchaseOrderById('fail-id')).rejects.toThrow('getPurchaseOrderById')
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 1 })
      client.from.mockReturnValue(qb)

      const result = await repo.exists({ supplier_id: 'sup-001' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      const qb = makeQueryBuilder()
      qb._resolve({ data: null, error: null, count: 0 })
      client.from.mockReturnValue(qb)

      const result = await repo.exists({ supplier_id: 'nonexistent' })
      expect(result).toBe(false)
    })
  })
})
