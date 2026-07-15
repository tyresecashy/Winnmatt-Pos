/**
 * Recommendation Engine — Comprehensive unit tests
 *
 * Sprint 11D: Full test suite for cross-sell, reorder, and pricing engines.
 *
 * NOTE: All vi.mock() calls MUST be at the top level (hoisted).
 * vi.hoisted() is used for variables that factory functions need.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted helpers (available inside vi.mock factories) ──────────

const mockFrom = vi.hoisted(() => vi.fn())

const mockRepo = vi.hoisted(() => ({
  getAffinitiesForProducts: vi.fn(),
  getAffinitiesForProduct: vi.fn(),
  clearAffinities: vi.fn().mockResolvedValue(undefined),
  insertAffinityBatch: vi.fn().mockResolvedValue(undefined),
  getReorderSuggestions: vi.fn(),
  upsertReorderSuggestion: vi.fn().mockResolvedValue(undefined),
  upsertReorderBatch: vi.fn().mockResolvedValue(undefined),
  deleteReorderSuggestion: vi.fn().mockResolvedValue(undefined),
}))

// ─── Helper: create a thenable mock query chain ────────────────────
// The chain is a Promise that resolves to resolvedValue, but also has
// all query builder methods (select, eq, etc.) that return the chain.

function createMockChain(resolvedValue: unknown) {
  const promise = Promise.resolve(resolvedValue)
  const chain = Object.assign(promise, {
    select: vi.fn().mockReturnValue(promise),
    eq: vi.fn().mockReturnValue(promise),
    in: vi.fn().mockReturnValue(promise),
    gte: vi.fn().mockReturnValue(promise),
    lte: vi.fn().mockReturnValue(promise),
    order: vi.fn().mockReturnValue(promise),
    limit: vi.fn().mockReturnValue(promise),
    single: vi.fn().mockReturnValue(promise),
    upsert: vi.fn().mockResolvedValue(resolvedValue as never),
  })
  return chain
}

// ─── Mocks (at top level — hoisted before describe blocks) ─────────

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/realtime/event-bus', () => ({
  publish: vi.fn(),
  subscribe: vi.fn(),
  subscribeAll: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../repositories/recommendations-repository', () => ({
  recommendationsRepository: mockRepo,
}))

// ─── 1. Cross-Sell Engine ──────────────────────────────────────────

describe('Cross-Sell Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset()
  })

  it('returns empty array for empty cart', async () => {
    const { crossSellEngine } = await import('../recommendations/cross-sell')
    const result = await crossSellEngine.getRecommendations([], 5)
    expect(result).toEqual([])
  })

  it('returns empty array when no affinities found', async () => {
    mockRepo.getAffinitiesForProducts.mockResolvedValue([])

    const { crossSellEngine } = await import('../recommendations/cross-sell')
    const result = await crossSellEngine.getRecommendations(['prod-1', 'prod-2'], 5)
    expect(result).toEqual([])
  })

  it('handles rebuild with insufficient sales', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }))

    const { crossSellEngine } = await import('../recommendations/cross-sell')
    const result = await crossSellEngine.rebuildAffinityMatrix()
    expect(result.pairsCount).toBe(0)
  })

  it('returns recommendations when affinities found', async () => {
    mockRepo.getAffinitiesForProducts.mockResolvedValue([
      { productA: 'cart-1', productB: 'rec-1', lift: 3.0, confidence: 0.8, support: 0.3, occurrences: 10, computedAt: new Date().toISOString() },
      { productA: 'cart-2', productB: 'rec-1', lift: 2.0, confidence: 0.6, support: 0.2, occurrences: 8, computedAt: new Date().toISOString() },
    ])

    mockFrom.mockReturnValue(createMockChain({
      data: [{ id: 'rec-1', name: 'Rec Product', selling_price: 2500 }],
      error: null,
    }))

    const { crossSellEngine } = await import('../recommendations/cross-sell')
    const result = await crossSellEngine.getRecommendations(['cart-1', 'cart-2'], 5)

    expect(result.length).toBe(1)
    expect(result[0].productId).toBe('rec-1')
    expect(result[0].productName).toBe('Rec Product')
    expect(result[0].price).toBe(2500)
    expect(result[0].confidence).toBeGreaterThan(0)
    expect(result[0].score).toBeGreaterThan(0)
  })

  it('stub replacement: no longer throws', async () => {
    mockRepo.getAffinitiesForProducts.mockResolvedValue([])

    const { crossSellEngine } = await import('../recommendations/cross-sell')
    const result = await crossSellEngine.getRecommendations(['test-id'])
    expect(Array.isArray(result)).toBe(true)
  })

  it('handles large cart gracefully', async () => {
    mockRepo.getAffinitiesForProducts.mockResolvedValue([])

    const { crossSellEngine } = await import('../recommendations/cross-sell')
    const manyItems = Array.from({ length: 100 }, (_, i) => `prod-${i}`)
    const result = await crossSellEngine.getRecommendations(manyItems, 5)
    expect(Array.isArray(result)).toBe(true)
  })

  it('rebuilds affinity matrix from multi-product sales', async () => {
    mockFrom
      .mockReturnValueOnce(createMockChain({
        data: [{ id: 's1', branch_id: 'b1' }, { id: 's2', branch_id: 'b1' }, { id: 's3', branch_id: 'b1' }],
        error: null,
      }))
      .mockReturnValueOnce(createMockChain({
        data: [
          { sale_id: 's1', product_id: 'p1' }, { sale_id: 's1', product_id: 'p2' }, { sale_id: 's1', product_id: 'p3' },
          { sale_id: 's2', product_id: 'p1' }, { sale_id: 's2', product_id: 'p2' },
          { sale_id: 's3', product_id: 'p1' }, { sale_id: 's3', product_id: 'p3' },
        ],
        error: null,
      }))

    const { crossSellEngine } = await import('../recommendations/cross-sell')
    const result = await crossSellEngine.rebuildAffinityMatrix('b1')
    // 3 sales, 3 products → pairs: (p1,p2), (p1,p3), (p2,p3) = 3
    expect(result.pairsCount).toBe(3)
  })
})

// ─── 2. Reorder Engine ─────────────────────────────────────────────

describe('Reorder Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset()
  })

  it('evaluates product with sufficient stock', async () => {
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: { quantity: 500 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: { name: 'Test Product', purchase_price: 100, avg_daily_sales: 10 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ error: null }))

    const { reorderEngine } = await import('../recommendations/reorder')
    const result = await reorderEngine.evaluateProduct('prod-1', 'branch-1')

    expect(result.productId).toBe('prod-1')
    expect(result.currentStock).toBe(500)
    expect(result.forecastDailyDemand).toBe(10)
    expect(result.urgency).toBe('sufficient')
    expect(result.daysUntilStockout).toBe(50)
    expect(result.economicOrderQty).toBeGreaterThan(0)
    expect(result.safetyStock).toBeGreaterThanOrEqual(0)
    expect(result.reorderPoint).toBeGreaterThan(0)
  })

  it('classifies as immediate when stock is zero', async () => {
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: { quantity: 0 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: { name: 'Low Stock', purchase_price: 200, avg_daily_sales: 5 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ error: null }))

    const { reorderEngine } = await import('../recommendations/reorder')
    const result = await reorderEngine.evaluateProduct('prod-low')
    expect(result.urgency).toBe('immediate')
    expect(result.currentStock).toBe(0)
  })

  it('classifies as soon when stock well below reorder point but above 50%', async () => {
    // ROP = demand × leadTime = 10 × 7 = 70
    // stock=100: 100 > 35 (50% ROP) ✓, daysToStockout=10 > 7 (leadTime) ✓, 10 < 14 (2×leadTime) → 'soon'
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: { quantity: 100 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: { name: 'Soon Product', purchase_price: 150, avg_daily_sales: 10 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ error: null }))

    const { reorderEngine } = await import('../recommendations/reorder')
    const result = await reorderEngine.evaluateProduct('prod-soon')
    expect(result.urgency).toBe('soon')
  })

  it('computes EOQ from demand and costs', async () => {
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: { quantity: 200 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: { name: 'EOQ Product', purchase_price: 100, avg_daily_sales: 10 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ error: null }))

    // √(2 * 3650 * 50 / 20) ≈ 135
    const expected = Math.round(Math.sqrt((2 * 3650 * 50) / (100 * 0.20)))

    const { reorderEngine } = await import('../recommendations/reorder')
    const result = await reorderEngine.evaluateProduct('prod-eoq')
    expect(result.economicOrderQty).toBeCloseTo(expected, -1)
    expect(result.economicOrderQty).toBeGreaterThan(0)
  })

  it('handles batch evaluation with no inventory', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }))

    const { reorderEngine } = await import('../recommendations/reorder')
    const result = await reorderEngine.evaluateAllProducts('branch-1')
    expect(result).toEqual([])
  })

  it('handles zero demand forecast', async () => {
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: { quantity: 100 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: { name: 'Zero Demand', purchase_price: 50, avg_daily_sales: 0 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ error: null }))

    const { reorderEngine } = await import('../recommendations/reorder')
    const result = await reorderEngine.evaluateProduct('no-demand')

    expect(result.forecastDailyDemand).toBe(0)
    expect(result.daysUntilStockout).toBe(Infinity)
    expect(result.economicOrderQty).toBe(0)
    expect(result.urgency).toBe('sufficient')
  })

  it('stub replacement: no longer throws', async () => {
    mockFrom
      .mockReturnValueOnce(createMockChain({ data: { quantity: 100 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: { name: 'Stub Test', purchase_price: 50, avg_daily_sales: 5 }, error: null }))
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(createMockChain({ error: null }))

    const { reorderEngine } = await import('../recommendations/reorder')
    await expect(reorderEngine.evaluateProduct('test-id')).resolves.toBeDefined()
  })
})

// ─── 3. Pricing Engine (pure logic tests — avoid DB mocking) ───────

describe('Pricing Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset()
  })

  it('returns hold for unknown product (no product data)', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }))

    const { pricingEngine } = await import('../recommendations/pricing')
    const result = await pricingEngine.getPriceSignal('unknown-id')
    expect(result.productId).toBe('unknown-id')
    expect(result.signal).toBe('hold')
    expect(result.confidence).toBe(0)
  })

  it('getAllPriceSignals returns empty for no products', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }))

    const { pricingEngine } = await import('../recommendations/pricing')
    const result = await pricingEngine.getAllPriceSignals('branch-1', 500)
    expect(result).toEqual([])
  })

  it('stub replacement: no longer throws', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }))

    const { pricingEngine } = await import('../recommendations/pricing')
    const result = await pricingEngine.getPriceSignal('test-id')
    expect(result.signal).toBe('hold')
    expect(result.productId).toBe('test-id')
  })
})
