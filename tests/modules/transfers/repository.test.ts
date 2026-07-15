/**
 * Transfers Repository Tests
 *
 * Tests for TransferRepository enterprise core data access layer.
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

import { TransferRepository, transferRepo } from '@/lib/modules/transfers/repository'
import type { StockTransferRow, TransferWizardRow, LegacyTransferRow, ProductWithStock } from '@/lib/modules/transfers/repository'

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MockQuery {
  then: (resolve: (v: unknown) => void) => void
  _terminalData: { data: unknown; error: unknown; count: number }
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const _terminalData = { data: null, error: null, count: 0 }

  const methods = ['select', 'eq', 'order', 'or', 'single', 'limit', 'in'] as const

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

let repo: TransferRepository
let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  repo = new TransferRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TransferRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name', () => {
      expect(repo).toBeInstanceOf(TransferRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(transferRepo).toBeInstanceOf(TransferRepository)
    })
  })

  describe('getStockTransfers', () => {
    it('returns transfers with branch joins ordered by created_at desc', async () => {
      const data: Partial<StockTransferRow>[] = [
        { id: 't-1', transfer_number: 'TRF-001', status: 'pending' },
      ]
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getStockTransfers()

      expect(mockFrom).toHaveBeenCalledWith('stock_transfers')
      expect(query.select).toHaveBeenCalledWith(
        '*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name)'
      )
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(data)
    })

    it('filters by branch via or() when branchId provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getStockTransfers('branch-1')

      expect(query.or).toHaveBeenCalledWith('from_branch_id.eq.branch-1,to_branch_id.eq.branch-1')
    })

    it('filters by status when provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getStockTransfers(undefined, 'pending')

      expect(query.eq).toHaveBeenCalledWith('status', 'pending')
    })
  })

  describe('getStockTransfer', () => {
    it('returns a single transfer with full details', async () => {
      const data: Partial<StockTransferRow> = {
        id: 't-1',
        transfer_number: 'TRF-001',
        items: [{ id: 'item-1', transfer_id: 't-1', product_id: 'p-1', quantity_requested: 5, quantity_received: 0, notes: null, product: { name: 'Widget', sku: 'W-001' } }],
      }
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getStockTransfer('t-1')

      expect(query.select).toHaveBeenCalledWith(
        '*, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name), items:stock_transfer_items(*, product:products(name, sku))'
      )
      expect(query.eq).toHaveBeenCalledWith('id', 't-1')
      expect(query.single).toHaveBeenCalled()
      expect(result).toEqual(data)
    })

    it('returns null on PGRST116', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST116', message: 'Not found' }, count: 0 }

      const result = await repo.getStockTransfer('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getTransferWizards', () => {
    it('returns normalized transfer wizards with deep joins', async () => {
      const rawData = [
        {
          id: 't-1',
          transfer_number: 'TRF-001',
          status: 'pending',
          items: [{ id: 'item-1', product_id: 'p-1', quantity_requested: 5, quantity_dispatched: 0, quantity_received: 0, quantity_damaged: 0, variance: 0, product_name: '', product_sku: '', unit_cost: 0 }],
          from_warehouse: { id: 'wh-1', name: 'Central' },
          to_warehouse: { id: 'wh-2', name: 'North' },
          requester: { id: 'u-1', name: 'Alice' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ]
      query._terminalData = { data: rawData, error: null, count: 0 }

      const result = await repo.getTransferWizards()

      expect(mockFrom).toHaveBeenCalledWith('stock_transfers')
      expect(query.limit).toHaveBeenCalledWith(50)
      expect(result).toHaveLength(1)
      expect(result[0].from_warehouse_name).toBe('Central')
      expect(result[0].requested_by_name).toBe('Alice')
    })

    it('returns empty array when table does not exist (42P01)', async () => {
      query._terminalData = { data: null, error: { code: '42P01', message: 'Table not found' }, count: 0 }

      const result = await repo.getTransferWizards()
      expect(result).toEqual([])
    })
  })

  describe('getLegacyTransfers', () => {
    it('returns legacy transfers from stock_movements', async () => {
      const rawData = [
        {
          id: 'lm-1',
          product_id: 'p-1',
          branch_id: 'b-1',
          type: 'transfer',
          quantity: 10,
          reference_id: 'ref-1',
          notes: null,
          created_at: '2026-01-01T00:00:00Z',
          product: { id: 'p-1', sku: 'W-001', name: 'Widget' },
          branch: { id: 'b-1', name: 'Main Branch', code: 'M' },
        },
      ]
      query._terminalData = { data: rawData, error: null, count: 0 }

      const result = await repo.getLegacyTransfers(10)

      expect(mockFrom).toHaveBeenCalledWith('stock_movements')
      expect(query.eq).toHaveBeenCalledWith('type', 'transfer')
      expect(query.limit).toHaveBeenCalledWith(10)
      expect(result.mode).toBe('legacy')
      expect(result.transfers).toHaveLength(1)
    })

    it('returns empty mode when table does not exist', async () => {
      query._terminalData = { data: null, error: { code: '42P01', message: 'Table not found' }, count: 0 }

      const result = await repo.getLegacyTransfers()
      expect(result.mode).toBe('empty')
      expect(result.transfers).toEqual([])
    })

    it('handles array-wrapped joined relations', async () => {
      const rawData = [
        {
          id: 'lm-1',
          product_id: 'p-1',
          branch_id: 'b-1',
          type: 'transfer',
          quantity: 5,
          reference_id: 'ref-1',
          notes: null,
          created_at: '2026-01-01T00:00:00Z',
          product: [{ id: 'p-1', sku: 'W-001', name: 'Widget' }],
          branch: [{ id: 'b-1', name: 'Main', code: 'M' }],
        },
      ]
      query._terminalData = { data: rawData, error: null, count: 0 }

      const result = await repo.getLegacyTransfers()
      expect(result.transfers[0].product.name).toBe('Widget')
      expect(result.transfers[0].branch.name).toBe('Main')
    })
  })

  describe('getAllBranches', () => {
    it('returns branches with id, name, code', async () => {
      const data = [
        { id: 'b-1', name: 'Main', code: 'M' },
        { id: 'b-2', name: 'North', code: 'N' },
      ]
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getAllBranches()

      expect(mockFrom).toHaveBeenCalledWith('branches')
      expect(query.select).toHaveBeenCalledWith('id, name, code')
      expect(query.order).toHaveBeenCalledWith('name')
      expect(result).toEqual(data)
    })

    it('returns empty array on null data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getAllBranches()
      expect(result).toEqual([])
    })
  })

  describe('getProductsAtBranch', () => {
    it('returns products with stock info for a branch', async () => {
      const data: ProductWithStock[] = [
        {
          id: 'p-1',
          name: 'Widget',
          sku: 'W-001',
          category_id: null,
          stock: [{ quantity: 10, branch_id: 'b-1' }],
        },
      ]
      query._terminalData = { data, error: null, count: 0 }

      const result = await repo.getProductsAtBranch('b-1')

      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(query.select).toHaveBeenCalledWith('*, stock:inventory(*)')
      expect(query.order).toHaveBeenCalledWith('name')
      expect(result[0].stock[0].quantity).toBe(10)
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      query._terminalData = { data: [], error: null, count: 1 }
      const result = await repo.exists({ id: 't-1' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      const result = await repo.exists({ id: 'nonexistent' })
      expect(result).toBe(false)
    })
  })
})
