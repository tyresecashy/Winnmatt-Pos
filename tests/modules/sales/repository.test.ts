/**
 * Sales Repository Tests
 *
 * Tests for SalesRepository enterprise core data access layer.
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

import { SalesRepository, salesRepo, type SaleRow } from '@/lib/modules/sales/repository'

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
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const _terminalData = { data: null, error: null, count: 0 }

  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'ilike', 'order', 'limit', 'range',
    'single', 'maybeSingle',
  ] as const

  // Use a regular function so `this` refers to the query object
  // This way `this._terminalData` always reads the live reference
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

let repo: SalesRepository
let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  repo = new SalesRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SalesRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name and options', () => {
      expect(repo).toBeInstanceOf(SalesRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(salesRepo).toBeInstanceOf(SalesRepository)
    })
  })

  describe('findById', () => {
    it('returns sale when found', async () => {
      const sale: Partial<SaleRow> = { id: 'sale-1', receipt_number: 'RCP-001', total_amount: 1000 }
      query._terminalData = { data: sale, error: null, count: 0 }

      const result = await repo.findById('sale-1')

      expect(mockFrom).toHaveBeenCalledWith('sales')
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.eq).toHaveBeenCalledWith('id', 'sale-1')
      expect(query.maybeSingle).toHaveBeenCalled()
      expect(result).toEqual(sale)
    })

    it('returns null when not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST116', message: 'Database error' }, count: 0 }

      await expect(repo.findById('sale-1')).rejects.toThrow()
    })
  })

  describe('getSaleWithDetails', () => {
    it('returns sale with items and related data', async () => {
      const saleData = {
        id: 'sale-1',
        receipt_number: 'RCP-001',
        branch: { id: 'b1', name: 'Main', code: 'M' },
        cashier: { id: 'u1', full_name: 'Alice' },
        customer: { id: 'c1', name: 'Walk-in', phone: '123' },
      }
      const itemsData = [
        { id: 'item-1', sale_id: 'sale-1', product_id: 'p1', quantity: 2, unit_price: 500, line_total: 1000 },
      ]

      // First: getSaleWithDetails calls from('sales') -> select -> eq -> maybeSingle
      query._terminalData = { data: saleData, error: null, count: 0 }

      // Second: getSaleItems calls from('sale_items') -> select -> eq -> order
      const itemsQuery = createMockQuery()
      itemsQuery._terminalData = { data: itemsData, error: null, count: 1 }
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(itemsQuery)

      const result = await repo.getSaleWithDetails('sale-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('sale-1')
      expect(result!.items).toHaveLength(1)
      expect(result!.items[0].product_id).toBe('p1')
      expect(mockFrom).toHaveBeenCalledWith('sale_items')
    })

    it('returns null when sale not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getSaleWithDetails('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getSaleItems', () => {
    it('returns items ordered by created_at', async () => {
      const items = [{ id: 'item-1', sale_id: 'sale-1', product_id: 'p1' }]
      query._terminalData = { data: items, error: null, count: 1 }

      const result = await repo.getSaleItems('sale-1')

      expect(mockFrom).toHaveBeenCalledWith('sale_items')
      expect(query.eq).toHaveBeenCalledWith('sale_id', 'sale-1')
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: true })
      expect(result).toEqual(items)
    })

    it('returns empty array when no items', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getSaleItems('sale-1')
      expect(result).toEqual([])
    })
  })

  describe('getSalesList', () => {
    it('returns paginated sales with filters', async () => {
      const data = [
        { id: 'sale-1', receipt_number: 'RCP-001', total_amount: 1000 },
        { id: 'sale-2', receipt_number: 'RCP-002', total_amount: 2000 },
      ]
      query._terminalData = { data, error: null, count: 2 }

      const result = await repo.getSalesList('branch-1', {
        cashierId: 'cashier-1',
        status: 'completed',
        limit: 10,
        offset: 0,
      })

      expect(mockFrom).toHaveBeenCalledWith('sales')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(query.eq).toHaveBeenCalledWith('cashier_id', 'cashier-1')
      expect(query.eq).toHaveBeenCalledWith('sale_status', 'completed')
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('applies date range filters', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getSalesList('branch-1', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })

      expect(query.gte).toHaveBeenCalledWith('created_at', '2026-01-01')
      expect(query.lte).toHaveBeenCalledWith('created_at', '2026-01-31')
    })
  })

  describe('searchSales', () => {
    it('searches with ILIKE on receipt_number', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.searchSales({ query: 'RCP-00', page: 1, pageSize: 20 })

      expect(query.ilike).toHaveBeenCalledWith('receipt_number', '%RCP-00%')
      expect(query.range).toHaveBeenCalledWith(0, 19)
    })

    it('filters by payment method, status, and branch', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.searchSales({
        branchId: 'branch-1',
        paymentMethod: 'cash',
        status: 'completed',
        page: 2,
        pageSize: 10,
      })

      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(query.eq).toHaveBeenCalledWith('payment_method', 'cash')
      expect(query.eq).toHaveBeenCalledWith('sale_status', 'completed')
      expect(query.range).toHaveBeenCalledWith(10, 19) // page 2 → offset=10
    })
  })

  describe('receiptExists', () => {
    it('returns true when receipt exists', async () => {
      query._terminalData = { data: null, error: null, count: 1 }

      const result = await repo.receiptExists('RCP-001')
      expect(result).toBe(true)
    })

    it('returns false when receipt does not exist', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.receiptExists('RCP-NONEXISTENT')
      expect(result).toBe(false)
    })
  })

  describe('getLastReceiptNumber', () => {
    it('returns last receipt number for a branch', async () => {
      query._terminalData = { data: { receipt_number: 'RCP-100' }, error: null, count: 0 }

      const result = await repo.getLastReceiptNumber('branch-1')

      expect(result).toBe('RCP-100')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })

    it('returns null when no sales exist', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getLastReceiptNumber('branch-1')
      expect(result).toBeNull()
    })
  })

  describe('voidSale', () => {
    it('updates sale status to voided with reason', async () => {
      const voidedSale: Partial<SaleRow> = {
        id: 'sale-1',
        sale_status: 'voided',
        void_reason: 'Customer request',
        voided_by: 'user-1',
      }
      // update() returns a query whose select() returns the updated row
      const updateQuery = createMockQuery()
      updateQuery._terminalData = { data: voidedSale, error: null, count: 0 }
      mockFrom.mockReturnValue(updateQuery)

      const result = await repo.voidSale('sale-1', 'Customer request', 'user-1')

      expect(mockFrom).toHaveBeenCalledWith('sales')
      expect(updateQuery.update).toHaveBeenCalled()
      expect(result.sale_status).toBe('voided')
      expect(result.void_reason).toBe('Customer request')
    })
  })

  describe('returnSale', () => {
    it('updates sale status to returned with details', async () => {
      const returnedSale: Partial<SaleRow> = {
        id: 'sale-1',
        sale_status: 'returned',
        returned_amount: 500,
        returned_qty: 1,
      }
      const updateQuery = createMockQuery()
      updateQuery._terminalData = { data: returnedSale, error: null, count: 0 }
      mockFrom.mockReturnValue(updateQuery)

      const result = await repo.returnSale('sale-1', 'Damaged', 'user-1', 500, 1)

      expect(result.sale_status).toBe('returned')
      expect(result.returned_amount).toBe(500)
      expect(result.returned_qty).toBe(1)
    })
  })

  describe('getHeldSales', () => {
    it('returns held sales with customer name and items', async () => {
      const data = [
        {
          id: 'sale-1',
          receipt_number: 'HOLD-123',
          sale_status: 'on_hold',
          customers: { name: 'John' },
          sale_items: [{ id: 'item-1', product_id: 'p1', quantity: 1 }],
        },
      ]
      query._terminalData = { data, error: null, count: 1 }

      const result = await repo.getHeldSales('branch-1')

      expect(result).toHaveLength(1)
      expect(result[0].customer_name).toBe('John')
      expect(result[0].items).toHaveLength(1)
      expect(query.eq).toHaveBeenCalledWith('sale_status', 'on_hold')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })

    it('filters by cashier when provided', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getHeldSales('branch-1', 'cashier-1')

      expect(query.eq).toHaveBeenCalledWith('cashier_id', 'cashier-1')
    })
  })

  describe('cancelHeldSale', () => {
    it('deletes held sale with correct filters', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.cancelHeldSale('sale-1', 'branch-1')

      expect(result.success).toBe(true)
      expect(query.delete).toHaveBeenCalled()
      expect(query.eq).toHaveBeenCalledWith('id', 'sale-1')
      expect(query.eq).toHaveBeenCalledWith('sale_status', 'on_hold')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
    })

    it('returns error on deletion failure', async () => {
      query._terminalData = { data: null, error: { code: 'PGRST116', message: 'Not found' }, count: 0 }

      const result = await repo.cancelHeldSale('nonexistent', 'branch-1')

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('holdSale', () => {
    it('creates a held sale with items', async () => {
      const insertQuery = createMockQuery()
      insertQuery._terminalData = {
        data: { id: 'sale-hold-1', receipt_number: 'HOLD-999', sale_status: 'on_hold' },
        error: null,
        count: 0,
      }
      mockFrom.mockReturnValue(insertQuery)

      const result = await repo.holdSale(
        'branch-1',
        'cashier-1',
        [{ productId: 'p1', quantity: 2, unitPrice: 1000 }],
        null,
        2000,
        0,
        2000,
        'Test hold',
      )

      expect(insertQuery.insert).toHaveBeenCalled()
      expect(result.sale_status).toBe('on_hold')
      expect(result.receipt_number).toMatch(/^HOLD-/)
    })
  })

  describe('createSaleWithItems', () => {
    it('creates sale and items atomically', async () => {
      // First from('sales') — inserts sale
      const saleInsertQuery = createMockQuery()
      saleInsertQuery._terminalData = {
        data: { id: 'sale-new', receipt_number: 'RCP-001', total_amount: 2000 },
        error: null,
        count: 0,
      }

      // Second from('sale_items') — inserts items
      const itemInsertQuery = createMockQuery()
      itemInsertQuery._terminalData = {
        data: { id: 'item-new', sale_id: 'sale-new', product_id: 'p1', quantity: 2, line_total: 2000 },
        error: null,
        count: 0,
      }

      mockFrom.mockReturnValueOnce(saleInsertQuery).mockReturnValueOnce(itemInsertQuery)

      const result = await repo.createSaleWithItems(
        {
          branchId: 'branch-1',
          cashierId: 'cashier-1',
          subtotal: 2000,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: 2000,
          paymentMethod: 'cash',
          receiptNumber: 'RCP-001',
        },
        [{ productId: 'p1', quantity: 2, unitPrice: 1000, lineTotal: 2000 }],
      )

      expect(result.sale.id).toBe('sale-new')
      expect(result.sale.receipt_number).toBe('RCP-001')
      expect(result.items).toHaveLength(1)
      expect(result.items[0].product_id).toBe('p1')
    })
  })

  describe('resumeHeldSale', () => {
    it('returns sale and items when sale is on hold', async () => {
      // First call: findById → from('sales') → maybeSingle
      query._terminalData = {
        data: { id: 'sale-1', receipt_number: 'HOLD-1', sale_status: 'on_hold' },
        error: null,
        count: 0,
      }

      // Second call: getSaleItems → from('sale_items')
      const itemsQuery = createMockQuery()
      itemsQuery._terminalData = {
        data: [{ id: 'item-1', sale_id: 'sale-1', product_id: 'p1' }],
        error: null,
        count: 1,
      }
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(itemsQuery)

      const result = await repo.resumeHeldSale('sale-1', 'branch-1')

      expect(result).not.toBeNull()
      expect(result!.sale.sale_status).toBe('on_hold')
      expect(result!.items).toHaveLength(1)
    })

    it('returns null when sale is not on hold', async () => {
      query._terminalData = {
        data: { id: 'sale-1', sale_status: 'completed' },
        error: null,
        count: 0,
      }

      const result = await repo.resumeHeldSale('sale-1', 'branch-1')
      expect(result).toBeNull()
    })
  })

  describe('getTodaySummary', () => {
    it('returns summary with total sales and count', async () => {
      query._terminalData = {
        data: [{ total_amount: 1000 }, { total_amount: 2000 }, { total_amount: 3000 }],
        error: null,
        count: 3,
      }

      const result = await repo.getTodaySummary('branch-1')

      expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-1')
      expect(query.eq).toHaveBeenCalledWith('payment_status', 'completed')
      expect(result.totalSales).toBe(6000)
      expect(result.saleCount).toBe(3)
      expect(result.averageSale).toBe(2000)
    })

    it('returns zeros when no sales today', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      const result = await repo.getTodaySummary('branch-1')

      expect(result.totalSales).toBe(0)
      expect(result.saleCount).toBe(0)
      expect(result.averageSale).toBe(0)
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when a record matches the filter', async () => {
      query._terminalData = { data: [], error: null, count: 1 }
      const result = await repo.exists({ receipt_number: 'RCP-100' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      const result = await repo.exists({ receipt_number: 'INVALID' })
      expect(result).toBe(false)
    })
  })
})
