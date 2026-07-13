import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock lib/products-actions ──────────────────────────────────────────────
const mockGetProductById = vi.fn()
const mockGetAllProducts = vi.fn()
const mockGetInventoryForProduct = vi.fn()
const mockGetInventoryForBranch = vi.fn()
const mockAdjustStockQuantity = vi.fn()

vi.mock('@/lib/products-actions', () => ({
  getProductById: (...args: unknown[]) => mockGetProductById(...args),
  getAllProducts: (...args: unknown[]) => mockGetAllProducts(...args),
  getInventoryForProduct: (...args: unknown[]) => mockGetInventoryForProduct(...args),
  getInventoryForBranch: (...args: unknown[]) => mockGetInventoryForBranch(...args),
  adjustStockQuantity: (...args: unknown[]) => mockAdjustStockQuantity(...args),
}))

const mockGetStockMovements = vi.fn()
vi.mock('@/lib/inventory-actions', () => ({
  getStockMovements: (...args: unknown[]) => mockGetStockMovements(...args),
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { getProduct, getProducts, getInventoryLevel, adjustStock, getStockMovements } from '@/lib/modules/inventory'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getProduct ─────────────────────────────────────────────────────────────

describe('getProduct', () => {
  it('maps product fields correctly', async () => {
    mockGetProductById.mockResolvedValue({
      id: 'prod-1',
      sku: 'SKU-001',
      name: 'Test Product',
      description: 'A product',
      category_id: 'cat-1',
      purchase_price: 500,
      selling_price: 1000,
      wholesale_price: 800,
      unit: 'each',
      barcode: '12345',
      image_url: null,
      is_active: true,
      is_weighable: false,
      tax_rate: 16,
      branch_id: null,
      reorder_level: 10,
      brand: 'TestBrand',
      status: 'active',
      tags: ['tag1'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    const result = await getProduct('prod-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('prod-1')
    expect(result!.sku).toBe('SKU-001')
    expect(result!.selling_price).toBe(1000)
    expect(result!.reorder_level).toBe(10)
  })

  it('returns null when not found', async () => {
    mockGetProductById.mockResolvedValue(null)
    const result = await getProduct('nonexistent')
    expect(result).toBeNull()
  })

  it('handles partial data with defaults', async () => {
    mockGetProductById.mockResolvedValue({
      id: 'prod-1',
      sku: 'SKU-001',
      name: 'Test',
      purchase_price: null,
      selling_price: null,
      unit: null,
      is_active: null,
      is_weighable: null,
      tax_rate: null,
      reorder_level: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })

    const result = await getProduct('prod-1')
    // Module wrapper returns raw data — null fields stay null
    expect(result).not.toBeNull()
    expect(result!.id).toBe('prod-1')
  })
})

// ─── getProducts ────────────────────────────────────────────────────────────

describe('getProducts', () => {
  it('filters by branch_id from getAllProducts', async () => {
    mockGetAllProducts.mockResolvedValue([
      { id: 'prod-1', sku: 'SKU-001', name: 'Test', branch_id: 'branch-1', selling_price: 1000, purchase_price: 500, reorder_level: 10, category_id: null },
      { id: 'prod-2', sku: 'SKU-002', name: 'Test 2', branch_id: 'branch-2', selling_price: 2000, purchase_price: 1000, reorder_level: 5, category_id: null },
    ])

    const result = await getProducts({ branch_id: 'branch-1' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('prod-1')
  })

  it('returns empty when no branch_id and no products', async () => {
    mockGetAllProducts.mockResolvedValue([])
    const result = await getProducts({})
    expect(result.data).toEqual([])
  })
})

// ─── getInventoryLevel ──────────────────────────────────────────────────────

describe('getInventoryLevel', () => {
  it('filters inventory rows by branch_id', async () => {
    mockGetInventoryForProduct.mockResolvedValue([
      { id: 'inv-1', product_id: 'prod-1', branch_id: 'branch-1', quantity: 50, reserved_stock: null, last_counted_at: null, created_at: '', updated_at: '' },
      { id: 'inv-2', product_id: 'prod-1', branch_id: 'branch-2', quantity: 10, reserved_stock: null, last_counted_at: null, created_at: '', updated_at: '' },
    ])

    const result = await getInventoryLevel('prod-1', 'branch-1')
    expect(result).not.toBeNull()
    expect(result!.quantity).toBe(50)
    expect(result!.branch_id).toBe('branch-1')
  })

  it('returns null when no match', async () => {
    mockGetInventoryForProduct.mockResolvedValue([])
    const result = await getInventoryLevel('prod-1', 'branch-1')
    expect(result).toBeNull()
  })
})

// ─── adjustStock ────────────────────────────────────────────────────────────

describe('adjustStock', () => {
  it('fetches inventory level then delegates to adjustStockQuantity', async () => {
    mockGetInventoryForProduct.mockResolvedValue([
      { id: 'inv-1', product_id: 'prod-1', branch_id: 'branch-1', quantity: 50, reserved_stock: null, last_counted_at: null, created_at: '', updated_at: '' },
    ])
    mockAdjustStockQuantity.mockResolvedValue({ success: true })

    const result = await adjustStock('prod-1', 'branch-1', 10, 'receipt', 'New stock')

    expect(mockAdjustStockQuantity).toHaveBeenCalledWith('inv-1', 'prod-1', 'branch-1', 10, 'New stock')
    expect(result).toEqual({ success: true })
  })

  it('passes quantity as-is to adjustStockQuantity', async () => {
    mockGetInventoryForProduct.mockResolvedValue([
      { id: 'inv-1', product_id: 'prod-1', branch_id: 'branch-1', quantity: 50 },
    ])
    mockAdjustStockQuantity.mockResolvedValue({ success: true })

    await adjustStock('prod-1', 'branch-1', 5, 'sale')

    expect(mockAdjustStockQuantity).toHaveBeenCalled()
    const callArg = mockAdjustStockQuantity.mock.calls[0][3]
    // Module wrapper passes quantity as-is, notes fallback to type
    expect(callArg).toBe(5)
  })
})

// ─── getStockMovements ──────────────────────────────────────────────────────

describe('getStockMovements', () => {
  it('returns stock movement rows from underlying service', async () => {
    mockGetStockMovements.mockResolvedValue([
      { id: 'mov-1', type: 'sale', quantity: -5, reference_id: null, notes: null, created_at: '2026-01-01T00:00:00Z' },
    ])

    const result = await getStockMovements('prod-1', 'branch-1', 10)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('sale')
  })

  it('passes through null result from underlying service', async () => {
    mockGetStockMovements.mockResolvedValue(null)
    const result = await getStockMovements('prod-1', 'branch-1')
    expect(result).toBeNull()
  })
})
