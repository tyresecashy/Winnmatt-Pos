import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock lib/customers-actions and lib/loyalty-actions ────────────────────
const mockGetCustomerById = vi.fn()
const mockGetCustomers = vi.fn()
const mockAwardLoyaltyPoints = vi.fn()
const mockRedeemLoyaltyPoints = vi.fn()

vi.mock('@/lib/customers-actions', () => ({
  getCustomerById: (...args: unknown[]) => mockGetCustomerById(...args),
  getCustomers: (...args: unknown[]) => mockGetCustomers(...args),
}))

vi.mock('@/lib/loyalty-actions', () => ({
  awardLoyaltyPoints: (...args: unknown[]) => mockAwardLoyaltyPoints(...args),
  redeemLoyaltyPoints: (...args: unknown[]) => mockRedeemLoyaltyPoints(...args),
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
    from: vi.fn(() => queryBuilder({ data: null, error: null })),
  },
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { getCustomer, getCustomers, awardLoyaltyPoints, redeemLoyaltyPoints, getLoyaltyBalance } from '@/lib/modules/customers'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getCustomer ────────────────────────────────────────────────────────────

describe('getCustomer', () => {
  it('delegates to getCustomerById', async () => {
    mockGetCustomerById.mockResolvedValue({ id: 'cust-1', name: 'John Doe' })

    const result = await getCustomer('cust-1')
    expect(mockGetCustomerById).toHaveBeenCalledWith('cust-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('cust-1')
  })

  it('returns null when not found', async () => {
    mockGetCustomerById.mockResolvedValue(null)
    const result = await getCustomer('nonexistent')
    expect(result).toBeNull()
  })
})

// ─── getCustomers ───────────────────────────────────────────────────────────

describe('getCustomers', () => {
  it('passes limit and applies search filter', async () => {
    mockGetCustomers.mockResolvedValue([
      { id: 'cust-1', name: 'Alice', phone: '0711111111', email: 'alice@test.com', type: 'regular' },
      { id: 'cust-2', name: 'Bob', phone: '0722222222', email: 'bob@test.com', type: 'regular' },
    ])

    const result = await getCustomers({ limit: 10, search: 'alice' })
    expect(mockGetCustomers).toHaveBeenCalledWith(10)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('cust-1')
  })

  it('applies type filter', async () => {
    mockGetCustomers.mockResolvedValue([
      { id: 'cust-1', name: 'Alice', type: 'regular' },
      { id: 'cust-2', name: 'Biz Ltd', type: 'business' },
    ])

    const result = await getCustomers({ type: 'business' })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('cust-2')
  })
})

// ─── awardLoyaltyPoints ─────────────────────────────────────────────────────

describe('awardLoyaltyPoints', () => {
  it('delegates to real awardLoyaltyPoints', async () => {
    mockAwardLoyaltyPoints.mockResolvedValue({ pointsAwarded: 50, newBalance: 150 })

    const result = await awardLoyaltyPoints('cust-1', 100, 'sale-1', 'branch-1')

    expect(mockAwardLoyaltyPoints).toHaveBeenCalledWith('cust-1', 'sale-1', 100, 0, 'branch-1', 'module')
    expect(result).toEqual({ success: true, new_balance: 150 })
  })

  it('returns error when null returned', async () => {
    mockAwardLoyaltyPoints.mockResolvedValue(null)
    const result = await awardLoyaltyPoints('cust-1', 100, 'sale-1', 'branch-1')
    expect(result).toEqual({ success: false, error: 'Failed to award points' })
  })
})

// ─── redeemLoyaltyPoints ────────────────────────────────────────────────────

describe('redeemLoyaltyPoints', () => {
  it('delegates to real redeemLoyaltyPoints', async () => {
    mockRedeemLoyaltyPoints.mockResolvedValue({ pointsRedeemed: 25, newBalance: 75 })

    const result = await redeemLoyaltyPoints('cust-1', 25, 'branch-1')

    expect(mockRedeemLoyaltyPoints).toHaveBeenCalledWith('cust-1', '', 25, 0, 'branch-1', 'module')
    expect(result).toEqual({ success: true, new_balance: 75 })
  })
})

// ─── getLoyaltyBalance (uses supabase directly) ─────────────────────────────

describe('getLoyaltyBalance', () => {
  it('queries customers and loyalty_transactions', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    // First call: customers table
    mockFrom.mockReturnValueOnce(queryBuilder({
      data: { loyalty_points: 200, tier: 'gold' },
      error: null,
    }))
    // Second call: loyalty_transactions table
    mockFrom.mockReturnValueOnce(queryBuilder({
      data: [{ points_delta: 100 }, { points_delta: 100 }],
      error: null,
    }))

    const result = await getLoyaltyBalance('cust-1')
    expect(result).toEqual({ points: 200, tier: 'gold', lifetime_points: 200 })
  })

  it('returns defaults when customer not found', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>

    mockFrom.mockReturnValue(queryBuilder({ data: null, error: { message: 'Not found' } }))

    const result = await getLoyaltyBalance('nonexistent')
    expect(result).toEqual({ points: 0, tier: 'bronze', lifetime_points: 0 })
  })
})
