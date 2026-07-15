/**
 * Purchases Module Facade — Unit Tests
 *
 * Tests that read operations correctly route through PurchaseRepository
 * and write/stat operations still delegate to action files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock PurchaseRepository (reads) ────────────────────────────────────────
const mockGetPurchaseOrders = vi.fn()
const mockGetPurchaseOrderById = vi.fn()

vi.mock('@/lib/modules/purchases/repository', () => ({
  purchaseRepo: {
    getPurchaseOrders: (...args: unknown[]) => mockGetPurchaseOrders(...args),
    getPurchaseOrderById: (...args: unknown[]) => mockGetPurchaseOrderById(...args),
  },
}))

// ─── Mock lib/purchase-actions (writes + stats) ─────────────────────────────
vi.mock('@/lib/purchase-actions', () => ({
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrderStatus: vi.fn(),
  cancelPurchaseOrder: vi.fn(),
  receivePurchaseOrder: vi.fn(),
  getPurchaseStats: vi.fn(),
}))

// ─── Import facade AFTER mocks ──────────────────────────────────────────────
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  getPurchaseStats,
} from '@/lib/modules/purchases'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getPurchaseOrders (reads via repository) ───────────────────────────────

describe('getPurchaseOrders', () => {
  it('delegates to repository getPurchaseOrders', async () => {
    const orders = [
      { id: 'po-1', supplier_id: 'sup-1', status: 'draft', total_amount: 50000 },
      { id: 'po-2', supplier_id: 'sup-2', status: 'pending', total_amount: 75000 },
    ]
    mockGetPurchaseOrders.mockResolvedValue(orders)

    const result = await getPurchaseOrders('branch-1', 10)
    expect(mockGetPurchaseOrders).toHaveBeenCalledWith('branch-1', 10)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('po-1')
  })

  it('uses default arguments', async () => {
    mockGetPurchaseOrders.mockResolvedValue([])

    await getPurchaseOrders('branch-1')
    expect(mockGetPurchaseOrders).toHaveBeenCalledWith('branch-1', undefined)
  })

  it('returns empty array on repository error', async () => {
    mockGetPurchaseOrders.mockRejectedValue(new Error('DB error'))

    const result = await getPurchaseOrders('branch-1')
    expect(result).toEqual([])
  })
})

// ─── getPurchaseOrderById (reads via repository) ────────────────────────────

describe('getPurchaseOrderById', () => {
  it('delegates to repository getPurchaseOrderById', async () => {
    mockGetPurchaseOrderById.mockResolvedValue({ id: 'po-1', status: 'draft', total_amount: 50000 })

    const result = await getPurchaseOrderById('po-1')
    expect(mockGetPurchaseOrderById).toHaveBeenCalledWith('po-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('po-1')
  })

  it('returns null when not found', async () => {
    mockGetPurchaseOrderById.mockResolvedValue(null)

    const result = await getPurchaseOrderById('nonexistent')
    expect(result).toBeNull()
  })

  it('returns null on repository error', async () => {
    mockGetPurchaseOrderById.mockRejectedValue(new Error('DB error'))

    const result = await getPurchaseOrderById('fail-id')
    expect(result).toBeNull()
  })
})

// ─── createPurchaseOrder (write — delegates to action file) ─────────────────

describe('createPurchaseOrder', () => {
  it('delegates to action file createPurchaseOrder', async () => {
    const { createPurchaseOrder: createAction } = await import('@/lib/purchase-actions')
    vi.mocked(createAction).mockResolvedValue({ success: true, purchase_order: { id: 'po-new' } } as any)

    const input = {
      supplier_id: 'sup-1',
      branch_id: 'branch-1',
      items: [{ product_id: 'prod-1', quantity: 10, unit_price: 1000 }],
      expected_delivery: '2026-08-01',
    }
    const result = await createPurchaseOrder(input) as any
    expect(createAction).toHaveBeenCalledWith(input)
    expect(result.success).toBe(true)
    expect(result.purchase_order?.id).toBe('po-new')
  })

  it('returns error on action exception', async () => {
    const { createPurchaseOrder: createAction } = await import('@/lib/purchase-actions')
    vi.mocked(createAction).mockRejectedValue(new Error('Validation error'))

    const result = await createPurchaseOrder({
      supplier_id: 'sup-1',
      branch_id: 'branch-1',
      items: [],
      expected_delivery: '2026-08-01',
    })
    expect(result).toEqual({ success: false, error: 'Operation failed. Please try again.' })
  })
})

// ─── updatePurchaseOrderStatus (write — delegates to action file) ───────────

describe('updatePurchaseOrderStatus', () => {
  it('delegates to action file updatePurchaseOrderStatus', async () => {
    const { updatePurchaseOrderStatus: updateAction } = await import('@/lib/purchase-actions')
    vi.mocked(updateAction).mockResolvedValue({ success: true, purchase_order: { id: 'po-1', status: 'received' } } as any)

    const result = await updatePurchaseOrderStatus('po-1', 'received') as any
    expect(updateAction).toHaveBeenCalledWith('po-1', 'received')
    expect(result.success).toBe(true)
    expect(result.purchase_order?.status).toBe('received')
  })

  it('returns error on action exception', async () => {
    const { updatePurchaseOrderStatus: updateAction } = await import('@/lib/purchase-actions')
    vi.mocked(updateAction).mockRejectedValue(new Error('Update failed'))

    const result = await updatePurchaseOrderStatus('po-1', 'cancelled')
    expect(result).toEqual({ success: false, error: 'Operation failed. Please try again.' })
  })
})

// ─── cancelPurchaseOrder (write — delegates to action file) ─────────────────

describe('cancelPurchaseOrder', () => {
  it('delegates to action file cancelPurchaseOrder', async () => {
    const { cancelPurchaseOrder: cancelAction } = await import('@/lib/purchase-actions')
    vi.mocked(cancelAction).mockResolvedValue({ success: true, message: 'Purchase order cancelled' })

    const result = await cancelPurchaseOrder('po-1', 'No longer needed')
    expect(cancelAction).toHaveBeenCalledWith('po-1', 'No longer needed')
    expect(result.success).toBe(true)
  })

  it('works without a reason', async () => {
    const { cancelPurchaseOrder: cancelAction } = await import('@/lib/purchase-actions')
    vi.mocked(cancelAction).mockResolvedValue({ success: true, message: 'Cancelled' })

    await cancelPurchaseOrder('po-1')
    expect(cancelAction).toHaveBeenCalledWith('po-1', undefined)
  })
})

// ─── receivePurchaseOrder (write — delegates to action file) ────────────────

describe('receivePurchaseOrder', () => {
  it('delegates to action file receivePurchaseOrder', async () => {
    const { receivePurchaseOrder: receiveAction } = await import('@/lib/purchase-actions')
    vi.mocked(receiveAction).mockResolvedValue({ success: true, message: 'Goods received' })

    const result = await receivePurchaseOrder('po-1')
    expect(receiveAction).toHaveBeenCalledWith('po-1', undefined)
    expect(result.success).toBe(true)
  })

  it('passes partial flag', async () => {
    const { receivePurchaseOrder: receiveAction } = await import('@/lib/purchase-actions')
    vi.mocked(receiveAction).mockResolvedValue({ success: true, message: 'Received' })

    await receivePurchaseOrder('po-1', true)
    expect(receiveAction).toHaveBeenCalledWith('po-1', true)
  })
})

// ─── getPurchaseStats (computed — delegates to action file) ─────────────────

describe('getPurchaseStats', () => {
  it('delegates to action file getPurchaseStats', async () => {
    const { getPurchaseStats: statsAction } = await import('@/lib/purchase-actions')
    const stats = { total_orders: 25, total_spent: 1500000, draft: 5, pending: 10, approved: 3, received: 5, cancelled: 2 }
    vi.mocked(statsAction).mockResolvedValue(stats)

    const result = await getPurchaseStats('branch-1')
    expect(statsAction).toHaveBeenCalledWith('branch-1')
    expect(result).toEqual(stats)
  })

  it('returns fallback stats on action exception', async () => {
    const { getPurchaseStats: statsAction } = await import('@/lib/purchase-actions')
    vi.mocked(statsAction).mockRejectedValue(new Error('Stats error'))

    const result = await getPurchaseStats('branch-1')
    expect(result).toEqual({ total_orders: 0, total_spent: 0, draft: 0, pending: 0, approved: 0, received: 0, cancelled: 0 })
  })
})
