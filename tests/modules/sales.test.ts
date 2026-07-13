import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock lib/sales-actions ─────────────────────────────────────────────────
const mockCreateSaleWithContext = vi.fn()
const mockVoidSale = vi.fn()
const mockReturnSale = vi.fn()
const mockGetSaleById = vi.fn()
const mockGetSales = vi.fn()

vi.mock('@/lib/sales-actions', () => ({
  createSaleWithContext: (...args: unknown[]) => mockCreateSaleWithContext(...args),
  voidSale: (...args: unknown[]) => mockVoidSale(...args),
  returnSale: (...args: unknown[]) => mockReturnSale(...args),
  getSaleById: (...args: unknown[]) => mockGetSaleById(...args),
  getSales: (...args: unknown[]) => mockGetSales(...args),
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { createSaleTransaction, voidSale, processReturn, getSale, getSales } from '@/lib/modules/sales'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── createSaleTransaction ──────────────────────────────────────────────────

describe('createSaleTransaction', () => {
  const validInput = {
    branch_id: 'branch-1',
    cashier_id: 'cashier-1',
    shift_id: 'shift-1',
    customer_id: 'cust-1',
    items: [
      { product_id: 'prod-1', quantity: 2, unit_price: 1000, discount_percent: 10 },
    ],
    payment_method: 'cash',
    notes: 'Test sale',
  }

  it('delegates to createSaleWithContext and maps result', async () => {
    mockCreateSaleWithContext.mockResolvedValue({
      success: true,
      sale: { id: 'sale-1' },
      receiptNumber: 'RCP-001',
    })

    const result = await createSaleTransaction(validInput)

    expect(mockCreateSaleWithContext).toHaveBeenCalledOnce()
    expect(mockCreateSaleWithContext).toHaveBeenCalledWith(
      { branchId: 'branch-1', cashierId: 'cashier-1', shiftId: 'shift-1' },
      [{ productId: 'prod-1', quantity: 2, unitPrice: 1000, discountPercent: 10 }],
      'cash',
      'cust-1',
      0,
      'Test sale',
      'completed',
      undefined,
    )
    expect(result).toEqual({ success: true, sale_id: 'sale-1', receipt_number: 'RCP-001' })
  })

  it('returns error when createSaleWithContext fails', async () => {
    mockCreateSaleWithContext.mockResolvedValue({
      success: false,
      error: 'Insufficient stock',
    })

    const result = await createSaleTransaction(validInput)

    expect(result).toEqual({ success: false, error: 'Insufficient stock' })
  })

  it('handles null customer_id and missing shift_id', async () => {
    mockCreateSaleWithContext.mockResolvedValue({ success: true, sale: { id: 'sale-2' }, receiptNumber: 'RCP-002' })

    const result = await createSaleTransaction({
      branch_id: 'branch-1',
      cashier_id: 'cashier-1',
      items: [{ product_id: 'prod-1', quantity: 1, unit_price: 500 }],
      payment_method: 'card',
    })

    expect(result.success).toBe(true)
    expect(result.sale_id).toBe('sale-2')
  })

  it('catches exceptions and returns error shape', async () => {
    mockCreateSaleWithContext.mockRejectedValue(new Error('Unexpected error'))

    const result = await createSaleTransaction(validInput)

    expect(result).toEqual({ success: false, error: 'Operation failed. Please try again.' })
  })
})

// ─── voidSale ───────────────────────────────────────────────────────────────

describe('voidSale', () => {
  it('fetches sale for branchId then delegates', async () => {
    mockGetSaleById.mockResolvedValue({ id: 'sale-1', branch_id: 'branch-1' })
    mockVoidSale.mockResolvedValue({ success: true, message: 'Voided', saleId: 'sale-1' })

    const result = await voidSale('sale-1', 'Customer request', 'user-1')

    expect(mockGetSaleById).toHaveBeenCalledWith('sale-1')
    expect(mockVoidSale).toHaveBeenCalledWith('sale-1', 'branch-1', 'Customer request', 'user-1')
    expect(result).toEqual({ success: true, message: 'Voided', saleId: 'sale-1' })
  })

  it('returns error when sale not found', async () => {
    mockGetSaleById.mockResolvedValue(null)

    const result = await voidSale('nonexistent', 'reason', 'user-1')
    expect(result).toEqual({ success: false, error: 'Sale not found' })
  })

  it('catches exceptions', async () => {
    mockGetSaleById.mockRejectedValue(new Error('DB error'))

    const result = await voidSale('sale-1', 'reason', 'user-1')
    expect(result).toEqual({ success: false, error: 'Operation failed. Please try again.' })
  })
})

// ─── processReturn ──────────────────────────────────────────────────────────

describe('processReturn', () => {
  it('fetches sale then delegates to returnSale', async () => {
    mockGetSaleById.mockResolvedValue({ id: 'sale-1', branch_id: 'branch-1' })
    mockReturnSale.mockResolvedValue({ success: true, message: 'Returned', saleId: 'sale-1' })

    const result = await processReturn('sale-1', [{ sale_item_id: 'item-1', quantity: 1 }], 'Damaged', 'user-1')

    expect(mockGetSaleById).toHaveBeenCalledWith('sale-1')
    expect(mockReturnSale).toHaveBeenCalledWith('sale-1', 'branch-1', 'Damaged', 'user-1', {
      itemId: 'item-1',
      quantity: 1,
      isFullReturn: false,
    })
    expect(result).toEqual({ success: true, refund_amount: undefined })
  })

  it('returns error when sale not found', async () => {
    mockGetSaleById.mockResolvedValue(null)
    const result = await processReturn('nonexistent', [], 'reason', 'user-1')
    expect(result).toEqual({ success: false, error: 'Sale not found' })
  })
})

// ─── getSale ────────────────────────────────────────────────────────────────

describe('getSale', () => {
  it('delegates to getSaleById and returns typed result', async () => {
    mockGetSaleById.mockResolvedValue({ id: 'sale-1', branch_id: 'branch-1', items: [] })

    const result = await getSale('sale-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('sale-1')
    expect(result!.branch_id).toBe('branch-1')
  })

  it('returns null when sale not found', async () => {
    mockGetSaleById.mockResolvedValue(null)
    const result = await getSale('nonexistent')
    expect(result).toBeNull()
  })
})

// ─── getSales ───────────────────────────────────────────────────────────────

describe('getSales', () => {
  it('delegates to getSales and wraps result', async () => {
    mockGetSales.mockResolvedValue([{ id: 'sale-1' }, { id: 'sale-2' }])

    const result = await getSales({ branch_id: 'branch-1', limit: 10 })

    expect(mockGetSales).toHaveBeenCalledWith('branch-1', 10)
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('returns empty on null result', async () => {
    mockGetSales.mockResolvedValue(null)
    const result = await getSales({})
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
  })
})
