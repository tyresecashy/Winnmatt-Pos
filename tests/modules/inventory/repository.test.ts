/**
 * Inventory Repository Tests
 *
 * Tests for InventoryRepository enterprise core data access layer.
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

import { InventoryRepository, inventoryRepo, type ProductRow, type InventoryRow, type StockMovementRow } from '@/lib/modules/inventory/repository'

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
  or: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
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
    'ilike', 'or', 'in', 'order', 'limit', 'range',
    'single', 'maybeSingle',
  ] as const

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

let repo: InventoryRepository
let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  repo = new InventoryRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('InventoryRepository', () => {
  describe('constructor', () => {
    it('initializes with correct table name and options', () => {
      expect(repo).toBeInstanceOf(InventoryRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(inventoryRepo).toBeInstanceOf(InventoryRepository)
    })
  })

  describe('findById', () => {
    it('returns product by ID', async () => {
      const product: Partial<ProductRow> = { id: 'p1', sku: 'SKU-001', name: 'Test Product' }
      query._terminalData = { data: product, error: null, count: 0 }

      const result = await repo.findById('p1')

      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.eq).toHaveBeenCalledWith('id', 'p1')
      expect(query.maybeSingle).toHaveBeenCalled()
      expect(result).toEqual(product)
    })

    it('returns null when not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'DB_ERR', message: 'Connection failed' }, count: 0 }
      await expect(repo.findById('p1')).rejects.toThrow()
    })
  })

  describe('findBySku', () => {
    it('finds product by SKU', async () => {
      const product: Partial<ProductRow> = { id: 'p1', sku: 'SKU-001', name: 'Product A' }
      query._terminalData = { data: product, error: null, count: 0 }

      const result = await repo.findBySku('SKU-001')

      expect(query.eq).toHaveBeenCalledWith('sku', 'SKU-001')
      expect(query.maybeSingle).toHaveBeenCalled()
      expect(result?.id).toBe('p1')
    })
  })

  describe('searchProducts', () => {
    it('searches by name or SKU with ILIKE', async () => {
      const products: Partial<ProductRow>[] = [
        { id: 'p1', sku: 'SKU-001', name: 'Widget' },
      ]
      query._terminalData = { data: products, error: null, count: 1 }

      const result = await repo.searchProducts('widget')

      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(query.or).toHaveBeenCalledWith('name.ilike.%widget%,sku.ilike.%widget%')
      expect(query.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(query.limit).toHaveBeenCalledWith(20)
      expect(result).toHaveLength(1)
    })

    it('respects custom limit', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.searchProducts('test', 5)
      expect(query.limit).toHaveBeenCalledWith(5)
    })

    it('returns empty array on no results', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.searchProducts('zzz')
      expect(result).toEqual([])
    })

    it('throws on database error', async () => {
      query._terminalData = { data: null, error: { code: 'ERR', message: 'Fail' }, count: 0 }
      await expect(repo.searchProducts('test')).rejects.toThrow()
    })
  })

  describe('getAllProducts', () => {
    it('returns all products with category join', async () => {
      const products = [
        { id: 'p1', name: 'Widget', category: { name: 'Gadgets' } },
        { id: 'p2', name: 'Gizmo', category: null },
      ]
      query._terminalData = { data: products, error: null, count: 2 }

      const result = await repo.getAllProducts()

      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(query.select).toHaveBeenCalledWith('*, category:categories(name)')
      expect(query.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(result).toHaveLength(2)
    })

    it('returns empty array on no data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getAllProducts()
      expect(result).toEqual([])
    })
  })

  describe('getProductsForPOS', () => {
    it('returns products with inventory join for a branch', async () => {
      const products = [
        { id: 'p1', name: 'Widget', inventory: { branch_id: 'b1', quantity: 10 } },
      ]
      query._terminalData = { data: products, error: null, count: 1 }

      const result = await repo.getProductsForPOS('b1')

      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(query.eq).toHaveBeenCalledWith('inventory.branch_id', 'b1')
      expect(result).toHaveLength(1)
    })

    it('throws on error', async () => {
      query._terminalData = { data: null, error: { code: 'ERR', message: 'Join fail' }, count: 0 }
      await expect(repo.getProductsForPOS('b1')).rejects.toThrow()
    })
  })

  describe('getCategories', () => {
    it('returns all categories ordered by name', async () => {
      const categories = [
        { id: 'c1', name: 'Beverages' },
        { id: 'c2', name: 'Snacks' },
      ]
      query._terminalData = { data: categories, error: null, count: 2 }

      const result = await repo.getCategories()

      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(query.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(result).toHaveLength(2)
    })

    it('returns empty array on no data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getCategories()
      expect(result).toEqual([])
    })
  })

  describe('getByProductAndBranch', () => {
    it('returns inventory row for product+branch combo', async () => {
      const inv: Partial<InventoryRow> = {
        id: 'inv-1', product_id: 'p1', branch_id: 'b1', quantity: 50,
      }
      query._terminalData = { data: inv, error: null, count: 0 }

      const result = await repo.getByProductAndBranch('p1', 'b1')

      expect(mockFrom).toHaveBeenCalledWith('inventory')
      expect(query.eq).toHaveBeenCalledWith('product_id', 'p1')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'b1')
      expect(query.maybeSingle).toHaveBeenCalled()
      expect(result?.id).toBe('inv-1')
    })

    it('returns null when no inventory found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getByProductAndBranch('p1', 'b1')
      expect(result).toBeNull()
    })
  })

  describe('getForProduct', () => {
    it('returns inventory for product across branches', async () => {
      const rows = [
        { id: 'inv-1', product_id: 'p1', branch_id: 'b1', quantity: 10 },
        { id: 'inv-2', product_id: 'p1', branch_id: 'b2', quantity: 20 },
      ]
      query._terminalData = { data: rows, error: null, count: 2 }

      const result = await repo.getForProduct('p1')

      expect(mockFrom).toHaveBeenCalledWith('inventory')
      expect(query.eq).toHaveBeenCalledWith('product_id', 'p1')
      expect(result).toHaveLength(2)
    })
  })

  describe('updateQuantity', () => {
    it('updates inventory quantity for product+branch', async () => {
      const updated: Partial<InventoryRow> = {
        id: 'inv-1', product_id: 'p1', branch_id: 'b1', quantity: 75,
      }
      query._terminalData = { data: updated, error: null, count: 0 }

      const result = await repo.updateQuantity('p1', 'b1', 75)

      expect(mockFrom).toHaveBeenCalledWith('inventory')
      expect(query.update).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 75 }),
      )
      expect(query.eq).toHaveBeenCalledWith('product_id', 'p1')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'b1')
      expect(query.select).toHaveBeenCalled()
      expect(query.single).toHaveBeenCalled()
      expect(result?.quantity).toBe(75)
    })

    it('returns null when inventory not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.updateQuantity('p1', 'b1', 50)
      expect(result).toBeNull()
    })
  })

  describe('getMovements', () => {
    it('returns stock movements for a product+branch', async () => {
      const movements = [
        { id: 'm1', product_id: 'p1', branch_id: 'b1', type: 'sale', quantity: -5 },
      ]
      query._terminalData = { data: movements, error: null, count: 1 }

      const result = await repo.getMovements('p1', 'b1')

      expect(mockFrom).toHaveBeenCalledWith('stock_movements')
      expect(query.eq).toHaveBeenCalledWith('product_id', 'p1')
      expect(query.eq).toHaveBeenCalledWith('branch_id', 'b1')
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(query.limit).toHaveBeenCalledWith(50)
      expect(result).toHaveLength(1)
    })

    it('returns empty array when no movements', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getMovements('p1', 'b1')
      expect(result).toEqual([])
    })

    it('respects custom limit', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getMovements('p1', 'b1', 10)
      expect(query.limit).toHaveBeenCalledWith(10)
    })
  })

  describe('createMovement', () => {
    it('inserts a stock movement record', async () => {
      const movement: Partial<StockMovementRow> = {
        id: 'm1', product_id: 'p1', branch_id: 'b1', type: 'adjustment', quantity: 5,
      }
      query._terminalData = { data: movement, error: null, count: 0 }

      const result = await repo.createMovement({
        productId: 'p1',
        branchId: 'b1',
        type: 'adjustment',
        quantity: 5,
        notes: 'Stock correction',
      })

      expect(mockFrom).toHaveBeenCalledWith('stock_movements')
      expect(query.insert).toHaveBeenCalledWith(
        expect.objectContaining({ product_id: 'p1', quantity: 5 }),
      )
      expect(query.select).toHaveBeenCalled()
      expect(query.single).toHaveBeenCalled()
      expect(result.id).toBe('m1')
    })

    it('throws on insert error', async () => {
      query._terminalData = { data: null, error: { code: 'ERR', message: 'Insert fail' }, count: 0 }
      await expect(repo.createMovement({
        productId: 'p1', branchId: 'b1', type: 'adjustment', quantity: 5,
      })).rejects.toThrow()
    })
  })

  describe('getProductsPaginated', () => {
    it('returns paginated products with filters', async () => {
      const products = [
        { id: 'p1', sku: 'SKU-001', name: 'Widget' },
        { id: 'p2', sku: 'SKU-002', name: 'Gizmo' },
      ]
      query._terminalData = { data: products, error: null, count: 2 }

      const result = await repo.getProductsPaginated({
        status: 'active',
        category_id: 'cat-1',
        page: 1,
        pageSize: 10,
      })

      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(query.eq).toHaveBeenCalledWith('status', 'active')
      expect(query.eq).toHaveBeenCalledWith('category_id', 'cat-1')
      expect(query.range).toHaveBeenCalledWith(0, 9)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(10)
    })

    it('applies search filter via OR', async () => {
      query._terminalData = { data: [], error: null, count: 0 }
      await repo.getProductsPaginated({ search: 'widget' })

      expect(query.or).toHaveBeenCalledWith('name.ilike.%widget%,sku.ilike.%widget%')
    })

    it('returns empty when no products match', async () => {
      query._terminalData = { data: null, error: null, count: 0 }
      const result = await repo.getProductsPaginated({ status: 'discontinued' })
      expect(result.data).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('adjustStock', () => {
    it('updates quantity and creates movement', async () => {
      // Mock: fetch current inventory (single)
      const selectQuery = createMockQuery()
      selectQuery._terminalData = {
        data: { quantity: 100 },
        error: null,
        count: 0,
      }

      // Mock: update inventory
      const updateQuery = createMockQuery()
      updateQuery._terminalData = { data: null, error: null, count: 0 }

      // Mock: insert movement
      const insertQuery = createMockQuery()
      insertQuery._terminalData = { data: null, error: null, count: 0 }

      mockFrom
        .mockReturnValueOnce(selectQuery)  // select('quantity') ... single()
        .mockReturnValueOnce(updateQuery)  // update({quantity}) ... eq('id')
        .mockReturnValueOnce(insertQuery)  // insert({product_id: ...})

      const result = await repo.adjustStock('inv-1', 'p1', 'b1', -5, 'Sold item')

      expect(result.success).toBe(true)

      // Verify the queries were constructed correctly
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'inventory')
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'inventory')
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'stock_movements')

      // Verify update was called with new quantity (100 - 5 = 95)
      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 95 }),
      )
    })

    it('handles negative stock floor (min 0)', async () => {
      const selectQuery = createMockQuery()
      selectQuery._terminalData = { data: { quantity: 3 }, error: null, count: 0 }
      const updateQuery = createMockQuery()
      updateQuery._terminalData = { data: null, error: null, count: 0 }
      const insertQuery = createMockQuery()
      insertQuery._terminalData = { data: null, error: null, count: 0 }

      mockFrom
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(insertQuery)

      const result = await repo.adjustStock('inv-1', 'p1', 'b1', -10, 'Removed 10')

      expect(result.success).toBe(true)
      expect(updateQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 0 }),
      )
    })

    it('returns error when fetch fails', async () => {
      const selectQuery = createMockQuery()
      selectQuery._terminalData = { data: null, error: { code: 'ERR', message: 'Not found' }, count: 0 }
      mockFrom.mockReturnValueOnce(selectQuery)

      const result = await repo.adjustStock('inv-1', 'p1', 'b1', 5, 'Test')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error when update fails', async () => {
      const selectQuery = createMockQuery()
      selectQuery._terminalData = { data: { quantity: 10 }, error: null, count: 0 }
      const updateQuery = createMockQuery()
      updateQuery._terminalData = { data: null, error: { code: 'ERR', message: 'Update fail' }, count: 0 }

      mockFrom
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery)

      const result = await repo.adjustStock('inv-1', 'p1', 'b1', 5, 'Test')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Update fail')
    })
  })

  describe('deleteProduct', () => {
    it('deletes product and inventory when no sales exist', async () => {
      // Mock: sale_items check
      const checkQuery = createMockQuery()
      checkQuery._terminalData = { data: [], error: null, count: 0 }

      // Mock: inventory delete
      const invDeleteQuery = createMockQuery()
      invDeleteQuery._terminalData = { data: null, error: null, count: 0 }

      // Mock: product delete (via base class)
      const productDeleteQuery = createMockQuery()
      productDeleteQuery._terminalData = { data: null, error: null, count: 0 }

      mockFrom
        .mockReturnValueOnce(checkQuery)       // sale_items check
        .mockReturnValueOnce(invDeleteQuery)    // inventory delete
        .mockReturnValueOnce(productDeleteQuery) // product delete (from base class)

      const result = await repo.deleteProduct('p1')

      expect(result.success).toBe(true)
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'sale_items')
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'inventory')
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'products')
      expect(invDeleteQuery.delete).toHaveBeenCalled()
      expect(invDeleteQuery.eq).toHaveBeenCalledWith('product_id', 'p1')
    })

    it('refuses to delete product with existing sales', async () => {
      const checkQuery = createMockQuery()
      checkQuery._terminalData = { data: [{ id: 'si-1' }], error: null, count: 1 }
      mockFrom.mockReturnValueOnce(checkQuery)

      const result = await repo.deleteProduct('p1')
      expect(result.success).toBe(false)
      expect(result.error).toContain('existing sales')
    })
  })

  describe('getForBranch', () => {
    it('returns inventory with product details via full join (Attempt 1)', async () => {
      const rows = [
        {
          id: 'inv-1',
          product_id: 'p1',
          branch_id: 'b1',
          quantity: 10,
          product: { id: 'p1', name: 'Widget', category: { name: 'Gadgets' } },
        },
      ]
      query._terminalData = { data: rows, error: null, count: 1 }

      const result = await repo.getForBranch('b1')

      expect(mockFrom).toHaveBeenCalledWith('inventory')
      expect(result).toHaveLength(1)
      expect(result[0].product?.name).toBe('Widget')
    })

    it('falls back to Attempt 2 when category join fails', async () => {
      const att1Query = createMockQuery()
      att1Query._terminalData = { data: null, error: { code: 'ERR', message: 'Bad relation' }, count: 0 }

      const att2Rows = [
        {
          id: 'inv-1',
          product_id: 'p1',
          branch_id: 'b1',
          quantity: 10,
          product: { id: 'p1', name: 'Widget' },
        },
      ]
      const att2Query = createMockQuery()
      att2Query._terminalData = { data: att2Rows, error: null, count: 1 }

      mockFrom
        .mockReturnValueOnce(att1Query)
        .mockReturnValueOnce(att2Query)

      const result = await repo.getForBranch('b1')

      expect(result).toHaveLength(1)
      expect(result[0].product?.name).toBe('Widget')
    })

    it('falls back to Attempt 3 (separate queries) on full join failure', async () => {
      const att1Query = createMockQuery()
      att1Query._terminalData = { data: null, error: { code: 'ERR', message: 'Bad relation' }, count: 0 }

      const att2Query = createMockQuery()
      att2Query._terminalData = { data: null, error: { code: 'ERR', message: 'No category' }, count: 0 }

      const invRows = [
        { id: 'inv-1', product_id: 'p1', branch_id: 'b1', quantity: 10 },
      ]
      const att3Query = createMockQuery()
      att3Query._terminalData = { data: invRows, error: null, count: 1 }

      const productsQuery = createMockQuery()
      productsQuery._terminalData = {
        data: [{ id: 'p1', name: 'Fallback Widget', selling_price: 100 }],
        error: null,
        count: 1,
      }

      mockFrom
        .mockReturnValueOnce(att1Query)
        .mockReturnValueOnce(att2Query)
        .mockReturnValueOnce(att3Query)         // inventory select
        .mockReturnValueOnce(productsQuery)      // products in query

      const result = await repo.getForBranch('b1')

      expect(result).toHaveLength(1)
      expect(result[0].product?.name).toBe('Fallback Widget')
    })
  })

  describe('base class CRUD integration', () => {
    it('findMany works via base class', async () => {
      const products = [
        { id: 'p1', name: 'Widget' },
        { id: 'p2', name: 'Gizmo' },
      ]
      query._terminalData = { data: products, error: null, count: 2 }

      const result = await repo.findMany()
      expect(result).toHaveLength(2)
    })

    it('count works via base class', async () => {
      query._terminalData = { data: [], error: null, count: 5 }

      const result = await repo.count({ status: 'active' })
      expect(result).toBe(5)
      expect(query.eq).toHaveBeenCalledWith('status', 'active')
    })

    it('exists returns true when count > 0', async () => {
      query._terminalData = { data: [], error: null, count: 1 }

      const result = await repo.exists({ sku: 'SKU-001' })
      expect(result).toBe(true)
    })

    it('exists returns false when count is 0', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      const result = await repo.exists({ sku: 'NONEXISTENT' })
      expect(result).toBe(false)
    })
  })
})
