/**
 * Pending Payment Recovery Tests — Phase D.2
 *
 * Validates:
 *   - getStuckPaymentTransactions builds correct Supabase query chains
 *   - recoverPendingPayments handles all three stuck-txn scenarios
 *
 * All Supabase calls mocked — tests verify business logic only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ══════════════════════════════════════════════════════════════════════════════
// Mock infrastructure (hoisted before all imports)
// ══════════════════════════════════════════════════════════════════════════════

const { mockFrom, mockSupabaseAdmin } = vi.hoisted(() => {
  const _mockFrom = vi.fn()
  return { mockFrom: _mockFrom, mockSupabaseAdmin: { from: _mockFrom } }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: mockSupabaseAdmin,
  getSupabaseAdmin: () => mockSupabaseAdmin,
}))

vi.mock('@/lib/realtime/event-bus', () => ({
  publishEvent: vi.fn(),
  subscribe: vi.fn(),
  shutdownEventBus: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/env', () => ({
  env: {
    TUMA_API_URL: 'https://api.tuma.test',
    TUMA_API_KEY: 'test-key',
    TUMA_BUSINESS_EMAIL: 'test@example.com',
    TUMA_CALLBACK_URL: 'https://example.com/callback',
  },
}))

vi.mock('@/lib/modules/payments/tuma-client', () => ({
  default: {},
  formatPhoneNumber: (p: string) => p,
}))

vi.mock('@/lib/modules/payments/tuma-events', () => ({
  publishPaymentEvent: vi.fn(),
}))

// ══════════════════════════════════════════════════════════════════════════════
// Mock only the 4 action functions recoverPendingPayments calls;
// keep the real implementations of everything else (including
// getStuckPaymentTransactions) via importOriginal.
// ══════════════════════════════════════════════════════════════════════════════

const mockFinalize = vi.fn()
const mockFail = vi.fn()
const mockRestore = vi.fn()

vi.mock('@/lib/modules/payments/tuma-actions', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    finalizePaymentSale: mockFinalize,
    failPaymentSale: mockFail,
    restoreInventoryForFailedPayment: mockRestore,
  }
})

// ══════════════════════════════════════════════════════════════════════════════
// Mock query builder
// ══════════════════════════════════════════════════════════════════════════════

interface MockQuery {
  then: (resolve: (v: unknown) => void) => void
  _terminalData: { data: unknown; error: unknown; count: number }
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
}

function createMockQuery(): MockQuery {
  const _terminalData = { data: null, error: null, count: 0 }
  const methods = [
    'select', 'insert', 'update', 'eq', 'is', 'not', 'in', 'lt',
    'single', 'maybeSingle', 'order', 'limit', 'neq', 'delete', 'range',
    'gte', 'lte', 'ilike', 'gt',
  ] as const
  const query: Record<string, unknown> = {
    then: function (this: Record<string, unknown>, resolve: (v: unknown) => void) {
      return resolve(this._terminalData)
    },
    _terminalData,
  }
  for (const m of methods) { query[m] = vi.fn(() => query) }
  return query as unknown as MockQuery
}

let query: MockQuery

beforeEach(() => {
  vi.clearAllMocks()
  query = createMockQuery()
  mockFrom.mockReturnValue(query)
})

// ══════════════════════════════════════════════════════════════════════════════
// getStuckPaymentTransactions — query chain verification (REAL implementation)
// ══════════════════════════════════════════════════════════════════════════════

describe('getStuckPaymentTransactions', () => {
  it('builds two Supabase query chains with correct filters', async () => {
    const { getStuckPaymentTransactions } = await import(
      '@/lib/modules/payments/tuma-actions'
    )

    query._terminalData = { data: [], error: null, count: 0 }

    await getStuckPaymentTransactions(30)

    // Query 1: pending/processing, no callback, older than cutoff
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'payment_transactions')
    expect(query.select).toHaveBeenCalledWith('*, sale:sales(*)')
    expect(query.in).toHaveBeenCalledWith('status', ['pending', 'processing'])
    expect(query.is).toHaveBeenCalledWith('callback_received_at', null)
    expect(query.lt).toHaveBeenCalled()
    expect(query.order).toHaveBeenCalledWith('initiated_at', { ascending: false })

    // Query 2: callback received but sale never finalized
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'payment_transactions')
    expect(query.not).toHaveBeenCalledWith('callback_received_at', 'is', null)
    expect(query.is).toHaveBeenCalledWith('sale_finalized_at', null)
  })

  it('returns empty array when no stuck transactions', async () => {
    const { getStuckPaymentTransactions } = await import(
      '@/lib/modules/payments/tuma-actions'
    )

    query._terminalData = { data: [], error: null, count: 0 }

    const result = await getStuckPaymentTransactions(30)
    expect(result.success).toBe(true)
    expect(result.transactions).toEqual([])
  })

  it('combines results from both queries', async () => {
    const { getStuckPaymentTransactions } = await import(
      '@/lib/modules/payments/tuma-actions'
    )

    const txn1 = {
      id: 'txn-1', sale_id: 'sale-1',
      provider: 'tuma', status: 'pending',
      callback_received_at: null, sale_finalized_at: null, failure_reason: null,
      initiated_at: new Date(Date.now() - 3600000).toISOString(),
      amount: 1000, currency: 'KES', phone_number: '0712345678',
      merchant_request_id: null, checkout_request_id: null,
      mpesa_receipt_number: null, callback_payload: null,
      result_code: null, result_desc: null, description: null,
      idempotency_key: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      sale: { payment_status: 'pending' },
    }

    // Both queries use the same mock, returns [txn1] for each
    query._terminalData = { data: [txn1], error: null, count: 1 }

    const result = await getStuckPaymentTransactions(30)
    expect(result.success).toBe(true)
    // Two queries return the same txn, but dedup reduces to 1
    expect(result.transactions).toHaveLength(1)
  })

  it('returns success=false on DB error', async () => {
    const { getStuckPaymentTransactions } = await import(
      '@/lib/modules/payments/tuma-actions'
    )

    query._terminalData = { data: null, error: new Error('DB failure'), count: 0 }

    const result = await getStuckPaymentTransactions(30)
    expect(result.success).toBe(false)
    expect(result.transactions).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// recoverPendingPayments — scenario handling
// ══════════════════════════════════════════════════════════════════════════════
//
// These tests control recoverPendingPayments behavior by setting up the
// mocked action functions (mockFinalize, mockFail, mockRestore) and the
// real getStuckPaymentTransactions (which reads from mock Supabase).
//
// To control the data returned by getStuckPaymentTransactions, we set up
// mockFrom's returned query results to match the two query chains.
// ══════════════════════════════════════════════════════════════════════════════

function makeStuckTxn(overrides: Record<string, unknown>) {
  return {
    id: 'txn-1', sale_id: 'sale-1',
    provider: 'tuma', status: 'pending',
    callback_received_at: null, sale_finalized_at: null, failure_reason: null,
    initiated_at: new Date(Date.now() - 3600000).toISOString(),
    amount: 1000, currency: 'KES', phone_number: '0712345678',
    merchant_request_id: null, checkout_request_id: null,
    mpesa_receipt_number: null, callback_payload: null,
    result_code: null, result_desc: null, description: null,
    idempotency_key: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    sale: { payment_status: 'pending' },
    ...overrides,
  }
}

describe('recoverPendingPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    query = createMockQuery()
    mockFrom.mockReturnValue(query)
  })

  it('skips transactions whose sale is already completed or failed', async () => {
    query._terminalData = {
      data: [
        makeStuckTxn({ id: 'txn-1', sale_id: 'sale-1', sale: { payment_status: 'completed' } }),
        makeStuckTxn({ id: 'txn-2', sale_id: 'sale-2', sale: { payment_status: 'failed' } }),
      ],
      error: null, count: 2,
    }

    const { recoverPendingPayments } = await import(
      '@/lib/modules/payments/tuma-service'
    )
    const result = await recoverPendingPayments()
    expect(result.recovered).toBe(0)
    expect(result.details).toHaveLength(2)
    expect(result.details[0].action).toBe('skipped_already_processed')
    expect(result.details[1].action).toBe('skipped_already_processed')
    expect(mockFinalize).not.toHaveBeenCalled()
    expect(mockFail).not.toHaveBeenCalled()
    expect(mockRestore).not.toHaveBeenCalled()
  })

  it('recovers Scenario A: callback received, completed, sale not finalized', async () => {
    query._terminalData = {
      data: [
        makeStuckTxn({
          status: 'completed',
          callback_received_at: new Date().toISOString(),
          initiated_at: new Date(Date.now() - 120000).toISOString(),
        }),
      ],
      error: null, count: 1,
    }
    mockFinalize.mockResolvedValue({ success: true })

    const { recoverPendingPayments } = await import(
      '@/lib/modules/payments/tuma-service'
    )
    const result = await recoverPendingPayments()
    expect(result.recovered).toBe(1)
    expect(result.details[0].action).toBe('finalized')
    expect(mockFinalize).toHaveBeenCalledWith('sale-1')
  })

  it('recovers Scenario B: callback received, failed, sale not failed', async () => {
    query._terminalData = {
      data: [
        makeStuckTxn({
          status: 'failed',
          callback_received_at: new Date().toISOString(),
          failure_reason: 'Insufficient balance',
          initiated_at: new Date(Date.now() - 120000).toISOString(),
        }),
      ],
      error: null, count: 1,
    }
    mockRestore.mockResolvedValue({ success: true })
    mockFail.mockResolvedValue({ success: true })

    const { recoverPendingPayments } = await import(
      '@/lib/modules/payments/tuma-service'
    )
    const result = await recoverPendingPayments()
    expect(result.recovered).toBe(1)
    expect(result.details[0].action).toBe('failed_with_restore')
    expect(mockRestore).toHaveBeenCalledWith('sale-1')
    expect(mockFail).toHaveBeenCalledWith('sale-1', 'Insufficient balance')
  })

  it('recovers Scenario C: no callback, pending beyond max age (timeout)', async () => {
    // getStuckPaymentTransactions returns the txn in BOTH query chains;
    // each call to .then() resolves with _terminalData.
    // Two queries → 2 identical entries in the combined result.
    // recoverPendingPayments processes both — second is skipped via
    // skips_already_processed because sale is now 'failed' after first.
    // We accept this behavior; what matters is the first one triggers
    // the recovery actions.
    query._terminalData = {
      data: [
        makeStuckTxn({
          status: 'pending',
          callback_received_at: null,
          initiated_at: new Date(Date.now() - 3600000).toISOString(),
        }),
      ],
      error: null, count: 1,
    }
    mockRestore.mockResolvedValue({ success: true })
    mockFail.mockResolvedValue({ success: true })

    const { recoverPendingPayments } = await import(
      '@/lib/modules/payments/tuma-service'
    )
    const result = await recoverPendingPayments()
    expect(result.recovered).toBe(1)
    expect(mockRestore).toHaveBeenCalledWith('sale-1')
    expect(mockFail).toHaveBeenCalledWith('sale-1', 'Payment timed out (recovered)')
  })

  it('skips orphan transactions (no sale_id)', async () => {
    query._terminalData = {
      data: [
        makeStuckTxn({
          sale_id: null,
          status: 'completed',
          callback_received_at: new Date().toISOString(),
          initiated_at: new Date(Date.now() - 120000).toISOString(),
          sale: null,
        }),
      ],
      error: null, count: 1,
    }

    const { recoverPendingPayments } = await import(
      '@/lib/modules/payments/tuma-service'
    )
    const result = await recoverPendingPayments()
    expect(result.recovered).toBe(0)
    expect(mockFinalize).not.toHaveBeenCalled()
    expect(mockFail).not.toHaveBeenCalled()
    expect(mockRestore).not.toHaveBeenCalled()
  })

  it('collects errors without crashing when a single txn fails', async () => {
    query._terminalData = {
      data: [
        makeStuckTxn({
          status: 'pending',
          callback_received_at: null,
          initiated_at: new Date(Date.now() - 3600000).toISOString(),
        }),
      ],
      error: null, count: 1,
    }
    mockRestore.mockResolvedValue({ success: true })
    mockFail.mockRejectedValue(new Error('DB connection lost'))

    const { recoverPendingPayments } = await import(
      '@/lib/modules/payments/tuma-service'
    )
    const result = await recoverPendingPayments()
    expect(result.recovered).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('DB connection lost')
  })

  it('returns success=false when getStuckPaymentTransactions fails', async () => {
    query._terminalData = { data: null, error: new Error('DB failure'), count: 0 }

    const { recoverPendingPayments } = await import(
      '@/lib/modules/payments/tuma-service'
    )
    const result = await recoverPendingPayments()
    // When getStuckPaymentTransactions throws, it catches the error and
    // returns { success: false, error: '...', transactions: [] }
    // recoverPendingPayments then sees success:false, error defined
    expect(result.success).toBe(false)
    expect(result.recovered).toBe(0)
  })
})
