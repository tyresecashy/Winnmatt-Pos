/**
 * Warehouse Repository Tests
 *
 * Tests for WarehouseRepository enterprise core data access layer.
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

import { WarehouseRepository, warehouseRepo } from '@/lib/modules/warehouse/repository'
import type { WarehouseRow, WarehouseLocationRow, StockMovementRow } from '@/lib/modules/warehouse/repository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MockQuery {
  then: (resolve: (v: unknown) => void) => void
  _terminalData: { data: unknown; error: unknown; count: number }
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const _terminalData = { data: null, error: null, count: 0 }

  const methods = ['select', 'eq', 'order', 'or', 'single'] as const

  const query: Record<string, unknown> = {
    then: function (this: Record<string, unknown>, resolve: (value: unknown) => void) {
      return resolve(this._terminalData as { data: unknown; error: unknown; count: number })
    },
    _terminalData,
  }

  for (const method of methods) {
    const spy = vi.fn((..._args: unknown[]) => query)
    query[method] = spy
  }

  return query as unknown as MockQuery
}

let repo: WarehouseRepository
let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  repo = new WarehouseRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WarehouseRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name', () => {
      expect(repo).toBeInstanceOf(WarehouseRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(warehouseRepo).toBeInstanceOf(WarehouseRepository)
    })
  })

  describe('getWarehouses', () => {
    it('returns all warehouses ordered by name', async () => {
      const data: Partial<WarehouseRow>[] = [
        { id: 'w-1', name: 'Central', code: 'C', status: 'active' },
        { id: 'w-2', name: 'North', code: 'N', status: 'active' },
      ]
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getWarehouses()

      expect(mockFrom).toHaveBeenCalledWith('warehouses')
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.order).toHaveBeenCalledWith('name')
      expect(result).toEqual(data)
    })

    it('filters by branch when branchId provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getWarehouses('branch-1')

      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getWarehouses()
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'DB error' }, count: 0 }

      await expect(repo.getWarehouses()).rejects.toThrow()
    })
  })

  describe('getWarehouseById', () => {
    it('returns a single warehouse by ID', async () => {
      const data: Partial<WarehouseRow> = { id: 'w-1', name: 'Central', code: 'C' }
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getWarehouseById('w-1')

      expect(query.eq).toHaveBeenCalledWith('id', 'w-1')
      expect(query.single).toHaveBeenCalled()
      expect(result).toEqual(data)
    })

    it('returns null on PGRST116', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST116', message: 'Not found' }, count: 0 }

      const result = await repo.getWarehouseById('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on other database errors', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST301', message: 'DB error' }, count: 0 }

      await expect(repo.getWarehouseById('w-1')).rejects.toThrow()
    })
  })

  describe('getLocations', () => {
    it('returns locations ordered by zone/aisle/row', async () => {
      const data: Partial<WarehouseLocationRow>[] = [
        { id: 'l-1', warehouse_id: 'w-1', zone: 'A', aisle: '1', row: '1' },
        { id: 'l-2', warehouse_id: 'w-1', zone: 'A', aisle: '1', row: '2' },
      ]
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getLocations('w-1')

      expect(mockFrom).toHaveBeenCalledWith('warehouse_locations')
      expect(query.eq).toHaveBeenCalledWith('warehouse_id', 'w-1')
      expect(query.order).toHaveBeenCalledWith('zone')
      expect(query.order).toHaveBeenCalledWith('aisle')
      expect(query.order).toHaveBeenCalledWith('row')
      expect(result).toEqual(data)
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getLocations('w-1')
      expect(result).toEqual([])
    })
  })

  describe('getLocationById', () => {
    it('returns a single location by ID', async () => {
      const data: Partial<WarehouseLocationRow> = { id: 'l-1', warehouse_id: 'w-1', zone: 'A' }
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getLocationById('l-1')

      expect(query.eq).toHaveBeenCalledWith('id', 'l-1')
      expect(query.single).toHaveBeenCalled()
      expect(result).toEqual(data)
    })

    it('returns null on PGRST116', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST116', message: 'Not found' }, count: 0 }

      const result = await repo.getLocationById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getProductStockMovements', () => {
    it('returns stock movements for a product', async () => {
      const data: Partial<StockMovementRow>[] = [
        { id: 'sm-1', product_id: 'p-1', type: 'transfer', quantity: 10 },
      ]
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getProductStockMovements('p-1')

      expect(mockFrom).toHaveBeenCalledWith('stock_movements')
      expect(query.eq).toHaveBeenCalledWith('product_id', 'p-1')
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(data)
    })

    it('filters by warehouse when warehouseId provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getProductStockMovements('p-1', 'warehouse-1')

      expect(query.or).toHaveBeenCalledWith('from_warehouse_id.eq.warehouse-1,to_warehouse_id.eq.warehouse-1')
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getProductStockMovements('p-1')
      expect(result).toEqual([])
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      query._terminalData = { data: [], error: null, count: 1 }
      const result = await repo.exists({ id: 'w-1' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      const result = await repo.exists({ id: 'nonexistent' })
      expect(result).toBe(false)
    })
  })
})
