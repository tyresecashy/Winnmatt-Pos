/**
 * Customer Repository Tests
 *
 * Tests for CustomerRepository enterprise core data access layer.
 * All Supabase calls are mocked to test only business logic
 * (query construction, error handling, data shaping).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase client (hoisted) ─────────────────────────────────────────

const { mockFrom, mockRpc, mockSupabaseAdmin } = vi.hoisted(() => {
  const _mockFrom = vi.fn()
  const _mockRpc = vi.fn()
  return { mockFrom: _mockFrom, mockRpc: _mockRpc, mockSupabaseAdmin: { from: _mockFrom, rpc: _mockRpc } }
})

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
}))

vi.mock('@/lib/modules/core/identity-context', () => ({
  getCurrentUserId: () => 'test-user',
  getCurrentBranchId: () => 'test-branch',
  getCurrentRole: () => 'admin',
  getCurrentDeviceId: () => 'test-device',
}))

vi.mock('@/lib/modules/core/correlation-id', () => ({
  getCorrelationId: () => 'test-correlation-id',
  generateCorrelationId: () => 'test-correlation-id-new',
}))

vi.mock('@/lib/modules/core/business-clock', () => ({
  now: () => new Date('2026-07-14T05:00:00Z'),
}))

vi.mock('@/lib/modules/core/lock-manager', () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  withLock: vi.fn(),
}))

vi.mock('@/lib/modules/core/audit-engine', () => ({
  recordAudit: vi.fn(),
  createDiff: vi.fn(() => []),
}))

vi.mock('@/lib/modules/core/idempotency-manager', () => ({
  isIdempotent: vi.fn(() => false),
}))

import { CustomerRepository, customerRepo, type CustomerRow } from '@/lib/modules/customers/repository'

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
  in: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
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
    'ilike', 'in', 'or', 'not',
    'order', 'limit', 'range',
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

let repo: CustomerRepository
let query: MockQuery

beforeEach(() => {
  vi.resetAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
  mockRpc.mockReturnValue(query)
  repo = new CustomerRepository()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CustomerRepository', () => {
  describe('constructor', () => {
    it('initializes with customers table and enterprise options', () => {
      expect(repo).toBeInstanceOf(CustomerRepository)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('exports a singleton instance', () => {
      expect(customerRepo).toBeInstanceOf(CustomerRepository)
    })
  })

  describe('findById (inherited)', () => {
    it('returns customer when found', async () => {
      const customer: Partial<CustomerRow> = {
        id: 'cust-1',
        name: 'Alice',
        phone: '0711111111',
        type: 'retail',
      }
      query._terminalData = { data: customer, error: null, count: 0 }

      const result = await repo.findById('cust-1')

      expect(mockFrom).toHaveBeenCalledWith('customers')
      expect(query.select).toHaveBeenCalledWith('*')
      expect(query.eq).toHaveBeenCalledWith('id', 'cust-1')
      expect(query.maybeSingle).toHaveBeenCalled()
      expect(result).toEqual(customer)
    })

    it('returns null when not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on database error', async () => {
      query._terminalData = {
        data: null, error: { code: 'PGRST116', message: 'Not found' }, count: 0,
      }

      await expect(repo.findById('bad-id')).rejects.toThrow()
    })
  })

  describe('getCustomerWithDetails', () => {
    it('returns customer with purchase stats from RPC', async () => {
      const customerData = {
        id: 'cust-1',
        name: 'Alice',
        phone: '0711111111',
        type: 'retail',
        loyalty_points: 100,
        tier: 'gold',
      }
      // from('customers')
      query._terminalData = { data: customerData, error: null, count: 0 }

      // rpc('get_customer_stats') — mockRpc returns same query, set its _terminalData
      const rpcQuery = createMockQuery()
      rpcQuery._terminalData = {
        data: [{ total_purchases: 5000, purchase_count: 3, last_visit: '2026-07-01' }],
        error: null,
        count: 0,
      }
      mockRpc.mockReturnValue(rpcQuery)

      const result = await repo.getCustomerWithDetails('cust-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('cust-1')
      expect(result!.total_purchases).toBe(5000)
      expect(result!.purchase_count).toBe(3)
      expect(result!.last_visit).toBe('2026-07-01')
      expect(mockRpc).toHaveBeenCalledWith('get_customer_stats', { p_customer_id: 'cust-1' })
    })

    it('returns customer with zero stats when RPC returns no data', async () => {
      const customerData = { id: 'cust-1', name: 'Bob' }
      query._terminalData = { data: customerData, error: null, count: 0 }

      const rpcQuery = createMockQuery()
      rpcQuery._terminalData = { data: null, error: null, count: 0 }
      mockRpc.mockReturnValue(rpcQuery)

      const result = await repo.getCustomerWithDetails('cust-1')

      expect(result).not.toBeNull()
      expect(result!.total_purchases).toBe(0)
      expect(result!.purchase_count).toBe(0)
      expect(result!.last_visit).toBeNull()
    })

    it('returns customer with zero stats when RPC throws', async () => {
      const customerData = { id: 'cust-1', name: 'Charlie' }
      query._terminalData = { data: customerData, error: null, count: 0 }

      // Simulate RPC throwing
      mockRpc.mockImplementation(() => { throw new Error('RPC unavailable') })

      const result = await repo.getCustomerWithDetails('cust-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('cust-1')
      expect(result!.total_purchases).toBe(0)
      expect(result!.purchase_count).toBe(0)
    })

    it('returns null when customer not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getCustomerWithDetails('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getCustomers', () => {
    it('returns all customers ordered by created_at desc', async () => {
      const data = [
        { id: 'cust-1', name: 'Alice', type: 'retail' },
        { id: 'cust-2', name: 'Bob', type: 'wholesale' },
      ]
      query._terminalData = { data, error: null, count: 2 }

      const result = await repo.getCustomers()

      expect(mockFrom).toHaveBeenCalledWith('customers')
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toHaveLength(2)
    })

    it('filters by type', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getCustomers({ type: 'wholesale' })

      expect(query.eq).toHaveBeenCalledWith('type', 'wholesale')
    })

    it('filters by tier', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getCustomers({ tier: 'gold' })

      expect(query.eq).toHaveBeenCalledWith('tier', 'gold')
    })

    it('applies search filter with OR across name/phone/email', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getCustomers({ search: 'alice' })

      expect(query.or).toHaveBeenCalledWith(
        'name.ilike.%alice%,phone.ilike.%alice%,email.ilike.%alice%',
      )
    })

    it('applies limit and offset', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getCustomers({ limit: 20, offset: 40 })

      expect(query.limit).toHaveBeenCalledWith(20)
      expect(query.range).toHaveBeenCalledWith(40, 59)
    })

    it('returns empty array when no data', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getCustomers()
      expect(result).toEqual([])
    })
  })

  describe('getCustomersPaginated', () => {
    it('returns paginated results with count', async () => {
      const data = [
        { id: 'cust-1', name: 'Alice', type: 'retail' },
        { id: 'cust-2', name: 'Bob', type: 'wholesale' },
      ]
      query._terminalData = { data, error: null, count: 10 }

      const result = await repo.getCustomersPaginated({ page: 1, pageSize: 10 })

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(10)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(10)
      expect(query.range).toHaveBeenCalledWith(0, 9)
    })

    it('applies type and tier filters', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getCustomersPaginated({ type: 'business', tier: 'platinum' })

      expect(query.eq).toHaveBeenCalledWith('type', 'business')
      expect(query.eq).toHaveBeenCalledWith('tier', 'platinum')
    })

    it('applies search in pagination query', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.getCustomersPaginated({ search: 'test' })

      expect(query.or).toHaveBeenCalled()
    })
  })

  describe('searchCustomers', () => {
    it('returns customers matching query on name/phone/email', async () => {
      const data = [
        { id: 'cust-1', name: 'Alice', phone: '0711111111' },
      ]
      query._terminalData = { data, error: null, count: 1 }

      const result = await repo.searchCustomers('alice')

      expect(query.or).toHaveBeenCalled()
      expect(query.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(query.limit).toHaveBeenCalledWith(20)
      expect(result).toHaveLength(1)
    })

    it('returns empty array for empty query', async () => {
      const result = await repo.searchCustomers('')
      expect(result).toEqual([])
    })

    it('returns empty array for whitespace-only query', async () => {
      const result = await repo.searchCustomers('   ')
      expect(result).toEqual([])
    })

    it('normalizes whitespace in search query', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      await repo.searchCustomers('  john   doe  ')

      expect(query.or).toHaveBeenCalledWith(
        expect.stringContaining('john doe'),
      )
    })
  })

  describe('getCustomersByType', () => {
    it('returns customers filtered by type', async () => {
      const data = [
        { id: 'cust-1', name: 'Biz Ltd', type: 'business' },
      ]
      query._terminalData = { data, error: null, count: 1 }

      const result = await repo.getCustomersByType('business')

      expect(query.eq).toHaveBeenCalledWith('type', 'business')
      expect(query.order).toHaveBeenCalledWith('name')
      expect(result).toHaveLength(1)
    })

    it('returns empty array when no customers of type', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      const result = await repo.getCustomersByType('wholesale')
      expect(result).toEqual([])
    })
  })

  describe('getCustomersWithStats', () => {
    it('returns customers with aggregated sales stats', async () => {
      const customers = [
        { id: 'cust-1', name: 'Alice', type: 'retail', loyalty_points: 100, tier: 'gold' },
        { id: 'cust-2', name: 'Bob', type: 'wholesale', loyalty_points: 50, tier: 'silver' },
      ]
      const sales = [
        { customer_id: 'cust-1', total_amount: 1000 },
        { customer_id: 'cust-1', total_amount: 2000 },
        { customer_id: 'cust-2', total_amount: 3000 },
      ]

      // First: from('customers')
      query._terminalData = { data: customers, error: null, count: 2 }

      // Second: from('sales')
      const salesQuery = createMockQuery()
      salesQuery._terminalData = { data: sales, error: null, count: 3 }
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(salesQuery)

      const result = await repo.getCustomersWithStats()

      expect(result).toHaveLength(2)
      expect(result[0].total_purchases).toBe(3000)
      expect(result[0].purchase_count).toBe(2)
      expect(result[1].total_purchases).toBe(3000)
      expect(result[1].purchase_count).toBe(1)
    })

    it('returns customers with zero stats when sales query fails', async () => {
      const customers = [
        { id: 'cust-1', name: 'Alice', type: 'retail' },
      ]
      query._terminalData = { data: customers, error: null, count: 1 }

      const salesQuery = createMockQuery()
      salesQuery._terminalData = { data: null, error: { message: 'Sales table unavailable' }, count: 0 }
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(salesQuery)

      const result = await repo.getCustomersWithStats()

      expect(result).toHaveLength(1)
      expect(result[0].total_purchases).toBe(0)
      expect(result[0].purchase_count).toBe(0)
    })

    it('returns empty array when no customers', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      const result = await repo.getCustomersWithStats()
      expect(result).toEqual([])
    })
  })

  describe('getCustomerPurchases', () => {
    it('returns purchases with calculated item_count', async () => {
      const data = [
        {
          id: 'sale-1',
          receipt_number: 'RCP-001',
          total_amount: 1000,
          created_at: '2026-07-01T10:00:00Z',
          sale_items: [{ quantity: 2 }, { quantity: 3 }],
        },
      ]
      query._terminalData = { data, error: null, count: 1 }

      const result = await repo.getCustomerPurchases('cust-1', 5)

      expect(mockFrom).toHaveBeenCalledWith('sales')
      expect(query.eq).toHaveBeenCalledWith('customer_id', 'cust-1')
      expect(query.limit).toHaveBeenCalledWith(5)
      expect(result).toHaveLength(1)
      expect(result[0].item_count).toBe(5)
    })

    it('returns empty array when no purchases', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.getCustomerPurchases('cust-1')
      expect(result).toEqual([])
    })

    it('handles missing sale_items gracefully', async () => {
      const data = [
        {
          id: 'sale-1',
          receipt_number: 'RCP-001',
          total_amount: 1000,
          created_at: '2026-07-01T10:00:00Z',
          sale_items: null,
        },
      ]
      query._terminalData = { data, error: null, count: 1 }

      const result = await repo.getCustomerPurchases('cust-1')

      expect(result[0].item_count).toBe(0)
    })
  })

  describe('getCustomerStats', () => {
    it('returns counts by customer type', async () => {
      const data = [
        { type: 'retail' },
        { type: 'retail' },
        { type: 'wholesale' },
        { type: 'business' },
        { type: 'retail' },
      ]
      query._terminalData = { data, error: null, count: 5 }

      const result = await repo.getCustomerStats()

      expect(mockFrom).toHaveBeenCalledWith('customers')
      expect(query.select).toHaveBeenCalledWith('type')
      expect(result).toEqual({
        total: 5,
        retail: 3,
        wholesale: 1,
        business: 1,
      })
    })

    it('returns zeros when no customers', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      const result = await repo.getCustomerStats()
      expect(result).toEqual({ total: 0, retail: 0, wholesale: 0, business: 0 })
    })
  })

  describe('getLoyaltyBalance', () => {
    it('returns loyalty balance with lifetime points', async () => {
      // First: from('customers')
      query._terminalData = {
        data: { loyalty_points: 200, tier: 'gold' },
        error: null,
        count: 0,
      }

      // Second: from('loyalty_transactions')
      const txQuery = createMockQuery()
      txQuery._terminalData = {
        data: [{ points_delta: 100 }, { points_delta: 100 }],
        error: null,
        count: 2,
      }
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(txQuery)

      const result = await repo.getLoyaltyBalance('cust-1')

      expect(result).toEqual({ points: 200, tier: 'gold', lifetime_points: 200 })
    })

    it('returns defaults when customer not found', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const txQuery = createMockQuery()
      txQuery._terminalData = { data: [], error: null, count: 0 }
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(txQuery)

      const result = await repo.getLoyaltyBalance('nonexistent')

      expect(result).toEqual({ points: 0, tier: 'bronze', lifetime_points: 0 })
    })
  })

  describe('getTopCustomers', () => {
    it('returns top customers by total purchase amount', async () => {
      const sales = [
        { customer_id: 'cust-1', total_amount: 5000, created_at: '2026-07-01' },
        { customer_id: 'cust-2', total_amount: 3000, created_at: '2026-07-02' },
        { customer_id: 'cust-3', total_amount: 1000, created_at: '2026-07-03' },
      ]
      const custData = [
        { id: 'cust-1', name: 'Alice', phone: '0711111111', email: 'alice@test.com', type: 'retail' },
        { id: 'cust-2', name: 'Bob', phone: '0722222222', email: 'bob@test.com', type: 'wholesale' },
      ]

      // First: from('sales') — mockReturnValueOnce so first from() returns query with sales data
      query._terminalData = { data: sales, error: null, count: 3 }

      // Second: from('customers') — separate query for customer details lookup
      const custQuery = createMockQuery()
      custQuery._terminalData = { data: custData, error: null, count: 2 }

      // Sequence: first mockReturnValueOnce(query) for from('sales'), then mockReturnValueOnce(custQuery) for from('customers')
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(custQuery)

      const result = await repo.getTopCustomers(2)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Alice')
      expect(result[0].total_purchases).toBe(5000)
      expect(result[1].name).toBe('Bob')
      expect(result[1].total_purchases).toBe(3000)
      expect(custQuery.in).toHaveBeenCalledWith('id', ['cust-1', 'cust-2'])
    })

    it('returns empty array when no sales data', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      const result = await repo.getTopCustomers(5)
      expect(result).toEqual([])
    })
  })

  describe('getRecentCustomers', () => {
    it('returns most recently created customers', async () => {
      const data = [
        { id: 'cust-2', name: 'Bob', created_at: '2026-07-02' },
        { id: 'cust-1', name: 'Alice', created_at: '2026-07-01' },
      ]
      query._terminalData = { data, error: null, count: 2 }

      const result = await repo.getRecentCustomers(10)

      expect(mockFrom).toHaveBeenCalledWith('customers')
      expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(query.limit).toHaveBeenCalledWith(10)
      expect(result).toHaveLength(2)
    })

    it('returns empty array when no customers', async () => {
      query._terminalData = { data: [], error: null, count: 0 }

      const result = await repo.getRecentCustomers(5)
      expect(result).toEqual([])
    })
  })

  describe('exists (inherited)', () => {
    it('returns true when records match', async () => {
      query._terminalData = { data: null, error: null, count: 1 }

      const result = await repo.exists({ phone: '0711111111' })
      expect(result).toBe(true)
    })

    it('returns false when no records match', async () => {
      query._terminalData = { data: null, error: null, count: 0 }

      const result = await repo.exists({ phone: '0000000000' })
      expect(result).toBe(false)
    })
  })

  describe('createCustomer', () => {
    it('inserts a new customer with enterprise wiring', async () => {
      const newCustomer = {
        id: 'cust-new',
        name: 'New Customer',
        type: 'retail',
        phone: '0799999999',
        email: 'new@test.com',
      }

      // insert() calls from('customers').insert(…).select().single()
      // Set query._terminalData for the select().single() result
      query._terminalData = { data: newCustomer, error: null, count: 0 }

      const result = await repo.createCustomer({
        name: 'New Customer',
        type: 'retail',
        phone: '0799999999',
        email: 'new@test.com',
      } as Partial<CustomerRow>)

      expect(mockFrom).toHaveBeenCalledWith('customers')
      expect(query.insert).toHaveBeenCalled()
      expect(query.select).toHaveBeenCalled()
      expect(query.single).toHaveBeenCalled()
      expect(result.id).toBe('cust-new')
      expect(result.name).toBe('New Customer')
    })
  })

  describe('updateCustomer', () => {
    it('updates a customer with enterprise wiring', async () => {
      const oldData = { id: 'cust-1', name: 'Old Name', type: 'retail' }
      const updatedData = { id: 'cust-1', name: 'Updated Name', type: 'retail' }

      // findById (called inside update() for audit): from('customers') → select → eq → maybeSingle
      query._terminalData = { data: oldData, error: null, count: 0 }

      // update() then does from('customers').update(…).eq('id', id).select().single()
      const updateQuery = createMockQuery()
      updateQuery._terminalData = { data: updatedData, error: null, count: 0 }

      // Sequence: first from() for findById → query (with oldData), second from() → updateQuery (for the update)
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(updateQuery)

      const result = await repo.updateCustomer('cust-1', { name: 'Updated Name' } as Partial<CustomerRow>)

      expect(updateQuery.update).toHaveBeenCalled()
      expect(result.name).toBe('Updated Name')
    })
  })

  describe('deleteCustomer', () => {
    it('deletes a customer with enterprise wiring', async () => {
      const oldData = { id: 'cust-1', name: 'To Delete', type: 'retail' }

      // findById (called inside delete() for audit): from('customers') → select → eq → maybeSingle
      query._terminalData = { data: oldData, error: null, count: 0 }

      // delete() then does from('customers').delete().eq('id', id)
      const deleteQuery = createMockQuery()
      deleteQuery._terminalData = { data: null, error: null, count: 0 }

      // Sequence: first from() for findById → query (with oldData), second from() → deleteQuery
      mockFrom.mockReturnValueOnce(query).mockReturnValueOnce(deleteQuery)

      await repo.deleteCustomer('cust-1')

      expect(deleteQuery.delete).toHaveBeenCalled()
      expect(deleteQuery.eq).toHaveBeenCalledWith('id', 'cust-1')
    })
  })

  // ─── Error Paths ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws on getCustomers database error', async () => {
      query._terminalData = {
        data: null, error: { code: 'PGRST301', message: 'Connection error' }, count: 0,
      }

      await expect(repo.getCustomers()).rejects.toThrow(/customers/)
    })

    it('throws on searchCustomers database error', async () => {
      query._terminalData = {
        data: null, error: { code: 'PGRST301', message: 'Search failed' }, count: 0,
      }

      await expect(repo.searchCustomers('test')).rejects.toThrow()
    })

    it('throws on getCustomerStats database error', async () => {
      query._terminalData = {
        data: null, error: { code: 'PGRST301', message: 'Stats failed' }, count: 0,
      }

      await expect(repo.getCustomerStats()).rejects.toThrow()
    })

    it('throws on getCustomerPurchases database error', async () => {
      query._terminalData = {
        data: null, error: { code: 'PGRST301', message: 'Sales query failed' }, count: 0,
      }

      await expect(repo.getCustomerPurchases('cust-1')).rejects.toThrow()
    })

    it('throws on getTopCustomers database error', async () => {
      query._terminalData = {
        data: null, error: { code: 'PGRST301', message: 'Sales table error' }, count: 0,
      }

      await expect(repo.getTopCustomers(5)).rejects.toThrow()
    })

    it('throws on getRecentCustomers database error', async () => {
      query._terminalData = {
        data: null, error: { code: 'PGRST301', message: 'Fetch failed' }, count: 0,
      }

      await expect(repo.getRecentCustomers(5)).rejects.toThrow()
    })
  })
})
