import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockProfile = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'admin',
  branch_id: 'branch-1',
}

const mockAuthenticateServerAction = vi.fn()
mockAuthenticateServerAction.mockResolvedValue({
  success: true,
  profile: mockProfile,
})

vi.mock('@/lib/auth-helpers', () => ({
  authenticateServerAction: () => mockAuthenticateServerAction(),
}))

type QueryResult = { data: unknown; error: unknown }
type QueryBuilder = Record<string, (...args: unknown[]) => QueryBuilder | QueryResult>

function queryBuilder(finalResult: QueryResult): QueryBuilder {
  const handler: QueryBuilder = new Proxy({} as QueryBuilder, {
    get(_target, prop: string) {
      if (prop === 'then') {
        const p = Promise.resolve(finalResult)
        return p.then.bind(p)
      }
      return (..._args: unknown[]) => handler
    },
  })
  return handler
}

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => queryBuilder({ data: [], error: null })),
  },
}))

import { getPurchaseOrders, getPurchaseOrder } from '@/lib/purchase-order-actions'

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthenticateServerAction.mockResolvedValue({
    success: true,
    profile: mockProfile,
  })
})

describe('getPurchaseOrders', () => {
  it('returns purchase orders successfully', async () => {
    const mockOrders = [
      { id: 'po-1', po_number: 'PO-001', branch_id: 'branch-1', status: 'draft' },
      { id: 'po-2', po_number: 'PO-002', branch_id: 'branch-1', status: 'approved' },
    ]

    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue(queryBuilder({ data: mockOrders, error: null }))

    const orders = await getPurchaseOrders('branch-1')

    expect(mockAuthenticateServerAction).toHaveBeenCalledOnce()
    expect(mockFrom).toHaveBeenCalledWith('purchase_orders')
    expect(orders).toEqual(mockOrders)
    expect(orders).toHaveLength(2)
  })

  it('filters by status when provided', async () => {
    const mockOrders = [
      { id: 'po-1', po_number: 'PO-001', branch_id: 'branch-1', status: 'draft' },
    ]

    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue(queryBuilder({ data: mockOrders, error: null }))

    const orders = await getPurchaseOrders('branch-1', 'draft')

    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe('draft')
  })

  it('throws on error', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue(queryBuilder({ data: null, error: { message: 'DB error' } }))

    await expect(getPurchaseOrders('branch-1')).rejects.toThrow('Operation failed')
  })

  it('returns empty array when no data', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue(queryBuilder({ data: null, error: null }))

    const orders = await getPurchaseOrders('branch-1')
    expect(orders).toEqual([])
  })
})

describe('getPurchaseOrder', () => {
  const mockPO = {
    id: 'po-1',
    po_number: 'PO-001',
    items: [
      { id: 'item-1', product_name: 'Item A', quantity: 5, unit_price: 100, line_total: 500 },
    ],
  }

  it('returns a single purchase order with items', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue(queryBuilder({ data: mockPO, error: null }))

    const po = await getPurchaseOrder('po-1')

    expect(po).not.toBeNull()
    expect(po!.id).toBe('po-1')
    expect(po!.items).toHaveLength(1)
  })

  it('returns null when order not found', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue(queryBuilder({ data: null, error: null }))

    const po = await getPurchaseOrder('nonexistent')
    expect(po).toBeNull()
  })

  it('throws on error', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>
    mockFrom.mockReturnValue(queryBuilder({ data: null, error: { message: 'Not found' } }))

    await expect(getPurchaseOrder('bad-id')).rejects.toThrow('Operation failed')
  })
})
