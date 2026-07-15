/**
 * Scoring Engine — Unit tests
 *
 * Sprint 11B: Full scoring logic tests with mocked analytics services.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productScorer, customerScorer, supplierScorer, businessHealthScorer } from '../scoring'
import { scoringRepository } from '../repositories/scoring-repository'

// ─── Mock Analytics Services ──────────────────────────────────

vi.mock('@/lib/analytics/sales-analytics', () => ({
  salesAnalyticsService: {
    getProductPerformance: vi.fn(),
    getSalesTrend: vi.fn(),
    getSalesMetrics: vi.fn(),
    getSlowMovingProducts: vi.fn(),
  },
}))

vi.mock('@/lib/analytics/inventory-analytics', () => ({
  inventoryAnalyticsService: {
    getStockTurnover: vi.fn(),
    getDeadStock: vi.fn(),
    getInventoryMetrics: vi.fn(),
    getSupplierPerformance: vi.fn(),
  },
}))

vi.mock('@/lib/analytics/customer-analytics', () => ({
  customerAnalyticsService: {
    getCustomerMetrics: vi.fn(),
    getRFMSegments: vi.fn(),
    getCustomerLifetimeValue: vi.fn(),
    getChurnRisk: vi.fn(),
    getPurchasePatterns: vi.fn(),
  },
}))

vi.mock('@/lib/analytics/financial-analytics', () => ({
  financialAnalyticsService: {
    getFinancialMetrics: vi.fn(),
    getMarginAnalysis: vi.fn(),
  },
}))

vi.mock('@/lib/analytics/workforce-analytics', () => ({
  workforceAnalyticsService: {
    getWorkforceMetrics: vi.fn(),
  },
}))

// ─── Mock Repository ──────────────────────────────────────────

vi.mock('../repositories/scoring-repository', () => ({
  scoringRepository: {
    upsertProductScore: vi.fn(),
    getProductScore: vi.fn(),
    queryProductScores: vi.fn(),
    upsertProductScoresBatch: vi.fn(),
    upsertCustomerScore: vi.fn(),
    getCustomerScore: vi.fn(),
    queryCustomerScores: vi.fn(),
    upsertCustomerScoresBatch: vi.fn(),
    upsertSupplierScore: vi.fn(),
    getSupplierScore: vi.fn(),
    querySupplierScores: vi.fn(),
    upsertSupplierScoresBatch: vi.fn(),
    upsertBusinessHealthScore: vi.fn(),
    getLatestBusinessHealthScore: vi.fn(),
  },
}))

// ─── Import mocks for type access ─────────────────────────────

import { salesAnalyticsService } from '@/lib/analytics/sales-analytics'
import { inventoryAnalyticsService } from '@/lib/analytics/inventory-analytics'
import { customerAnalyticsService } from '@/lib/analytics/customer-analytics'
import { financialAnalyticsService } from '@/lib/analytics/financial-analytics'
import { workforceAnalyticsService } from '@/lib/analytics/workforce-analytics'

beforeEach(() => {
  vi.clearAllMocks()
})

// ══════════════════════════════════════════════════════════════════
// Product Scorer
// ══════════════════════════════════════════════════════════════════

describe('Product Scorer', () => {
  const mockProductPerformance = [
    {
      productId: 'prod-1',
      productName: 'Premium Coffee Beans',
      category: 'Beverages',
      totalSold: 500,
      revenue: 750000,
      profit: 300000,
      profitMargin: 40,
    },
    {
      productId: 'prod-2',
      productName: 'Standard Tea Bags',
      category: 'Beverages',
      totalSold: 200,
      revenue: 100000,
      profit: 40000,
      profitMargin: 40,
    },
    {
      productId: 'prod-3',
      productName: 'Expired Snacks',
      category: 'Snacks',
      totalSold: 5,
      revenue: 2500,
      profit: 500,
      profitMargin: 20,
    },
  ]

  const mockTurnover = [
    { productId: 'prod-1', productName: 'Premium Coffee Beans', category: 'Beverages', currentStock: 50, totalSold: 500, turnoverRate: 2.5, daysOfSupply: 20 },
    { productId: 'prod-2', productName: 'Standard Tea Bags', category: 'Beverages', currentStock: 30, totalSold: 200, turnoverRate: 1.5, daysOfSupply: 15 },
    { productId: 'prod-3', productName: 'Expired Snacks', category: 'Snacks', currentStock: 100, totalSold: 5, turnoverRate: 0.05, daysOfSupply: 200 },
  ]

  const mockDeadStock = [
    { productId: 'prod-3', productName: 'Expired Snacks', category: 'Snacks', currentStock: 100, lastSoldAt: '2026-01-01', daysSinceLastSale: 195, valueAtRisk: 50000 },
  ]

  it('scores a product with full data', async () => {
    vi.mocked(salesAnalyticsService.getProductPerformance).mockResolvedValue(mockProductPerformance)
    vi.mocked(inventoryAnalyticsService.getStockTurnover).mockResolvedValue(mockTurnover)
    vi.mocked(inventoryAnalyticsService.getDeadStock).mockResolvedValue([])
    vi.mocked(scoringRepository.upsertProductScore).mockResolvedValue(undefined)

    const result = await productScorer.scoreProduct('prod-1')

    expect(result).not.toBeNull()
    expect(result!.productId).toBe('prod-1')
    expect(result!.productName).toBe('Premium Coffee Beans')
    expect(result!.velocityScore).toBeGreaterThanOrEqual(0)
    expect(result!.marginScore).toBe(40) // 40% profit margin
    expect(result!.compositeScore).toBeGreaterThan(0)
    expect(['star', 'cash_cow']).toContain(result!.scoreCategory) // Top performer
    expect(result!.computedAt).toBeDefined()
    expect(scoringRepository.upsertProductScore).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'prod-1',
    }))
  })

  it('scores a product with dead stock as dead or low category', async () => {
    vi.mocked(salesAnalyticsService.getProductPerformance).mockResolvedValue(mockProductPerformance)
    vi.mocked(inventoryAnalyticsService.getStockTurnover).mockResolvedValue(mockTurnover)
    vi.mocked(inventoryAnalyticsService.getDeadStock).mockResolvedValue(mockDeadStock)
    vi.mocked(scoringRepository.upsertProductScore).mockResolvedValue(undefined)

    const result = await productScorer.scoreProduct('prod-3')

    expect(result).not.toBeNull()
    expect(result!.productId).toBe('prod-3')
    // Dead products should have very low scores
    expect(result!.compositeScore).toBeLessThan(30)
    expect(result!.scoreCategory).toBe('dead')
  })

  it('returns null for product with no sales data', async () => {
    vi.mocked(salesAnalyticsService.getProductPerformance).mockResolvedValue(mockProductPerformance)
    vi.mocked(inventoryAnalyticsService.getStockTurnover).mockResolvedValue(mockTurnover)
    vi.mocked(inventoryAnalyticsService.getDeadStock).mockResolvedValue([])

    const result = await productScorer.scoreProduct('nonexistent')
    expect(result).toBeNull()
  })

  it('scores all products in batch', async () => {
    vi.mocked(salesAnalyticsService.getProductPerformance).mockResolvedValue(mockProductPerformance)
    vi.mocked(inventoryAnalyticsService.getStockTurnover).mockResolvedValue(mockTurnover)
    vi.mocked(inventoryAnalyticsService.getDeadStock).mockResolvedValue(mockDeadStock)
    vi.mocked(scoringRepository.upsertProductScoresBatch).mockResolvedValue(undefined)

    const results = await productScorer.scoreAllProducts()

    expect(results).toHaveLength(3)
    expect(['star', 'cash_cow']).toContain(results[0].scoreCategory) // Best product
    expect(results[2].scoreCategory).toBe('dead') // Worst product
    expect(results[0].rank).toBe(1) // Top in category
    expect(scoringRepository.upsertProductScoresBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ productId: 'prod-1' }),
        expect.objectContaining({ productId: 'prod-2' }),
        expect.objectContaining({ productId: 'prod-3' }),
      ]),
    )
  })

  it('classifies score categories correctly', async () => {
    // Test the classification indirectly through composite score computation
    vi.mocked(salesAnalyticsService.getProductPerformance).mockResolvedValue(mockProductPerformance)
    vi.mocked(inventoryAnalyticsService.getStockTurnover).mockResolvedValue(mockTurnover)
    vi.mocked(inventoryAnalyticsService.getDeadStock).mockResolvedValue([])
    vi.mocked(scoringRepository.upsertProductScoresBatch).mockResolvedValue(undefined)

    const results = await productScorer.scoreAllProducts()

    // Top product should be star or cash_cow
    expect(['star', 'cash_cow']).toContain(results[0].scoreCategory)
    // Worst product should be dead or dog
    expect(['dead', 'dog']).toContain(results[results.length - 1].scoreCategory)
  })

  it('gets a product score from repository', async () => {
    const mockStoredScore = {
      productId: 'prod-1',
      productName: 'Coffee',
      productCategory: 'Beverages',
      velocityScore: 90,
      marginScore: 80,
      stabilityScore: 70,
      seasonalityScore: 60,
      compositeScore: 80,
      scoreCategory: 'cash_cow' as const,
      rank: 1,
      computedAt: new Date().toISOString(),
    }
    vi.mocked(scoringRepository.getProductScore).mockResolvedValue(mockStoredScore)

    const result = await productScorer.getScore('prod-1')
    expect(result).toEqual(mockStoredScore)
  })
})

// ══════════════════════════════════════════════════════════════════
// Customer Scorer
// ══════════════════════════════════════════════════════════════════

describe('Customer Scorer', () => {
  const mockCLV = [
    { customerId: 'cust-1', customerName: 'John Kamau', email: 'john@example.com', totalOrders: 15, totalSpent: 150000, averageOrderValue: 10000, firstOrderDate: '2025-01-01', lastOrderDate: '2026-07-01', lifetimeValue: 30000, predictedNextOrderDays: 7 },
    { customerId: 'cust-2', customerName: 'Mary Wanjiku', email: 'mary@example.com', totalOrders: 3, totalSpent: 15000, averageOrderValue: 5000, firstOrderDate: '2026-03-01', lastOrderDate: '2026-05-01', lifetimeValue: 6000, predictedNextOrderDays: 45 },
    { customerId: 'cust-3', customerName: 'Peter Otieno', email: 'peter@example.com', totalOrders: 1, totalSpent: 2000, averageOrderValue: 2000, firstOrderDate: '2026-01-15', lastOrderDate: '2026-01-15', lifetimeValue: 1000, predictedNextOrderDays: 90 },
  ]

  const mockChurn = [
    { customerId: 'cust-1', customerName: 'John Kamau', email: 'john@example.com', lastOrderDate: '2026-07-01', daysSinceLastOrder: 14, previousOrders: 15, totalSpent: 150000, riskScore: 10 },
    { customerId: 'cust-2', customerName: 'Mary Wanjiku', email: 'mary@example.com', lastOrderDate: '2026-05-01', daysSinceLastOrder: 75, previousOrders: 3, totalSpent: 15000, riskScore: 55 },
    { customerId: 'cust-3', customerName: 'Peter Otieno', email: 'peter@example.com', lastOrderDate: '2026-01-15', daysSinceLastOrder: 181, previousOrders: 1, totalSpent: 2000, riskScore: 90 },
  ]

  const mockRFMSegments = [
    { segment: 'Champions', count: 1, percentage: 33.3, averageRevenue: 150000, description: 'Recent buyers with high frequency and spending' },
    { segment: 'Need Attention', count: 1, percentage: 33.3, averageRevenue: 15000, description: 'Customers with average metrics' },
    { segment: 'Lost', count: 1, percentage: 33.3, averageRevenue: 2000, description: 'Customers who haven\'t purchased in a long time' },
  ]

  it('scores a champion customer correctly', async () => {
    vi.mocked(customerAnalyticsService.getCustomerLifetimeValue).mockResolvedValue(mockCLV)
    vi.mocked(customerAnalyticsService.getChurnRisk).mockResolvedValue(mockChurn)
    vi.mocked(customerAnalyticsService.getRFMSegments).mockResolvedValue(mockRFMSegments)
    vi.mocked(scoringRepository.upsertCustomerScore).mockResolvedValue(undefined)

    const result = await customerScorer.scoreCustomer('cust-1')

    expect(result).not.toBeNull()
    expect(result!.customerId).toBe('cust-1')
    expect(result!.customerName).toBe('John Kamau')
    expect(result!.compositeScore).toBeGreaterThanOrEqual(70)
    expect(result!.recencyScore).toBeGreaterThanOrEqual(80)
    expect(result!.frequencyScore).toBeGreaterThanOrEqual(80)
    expect(result!.segment).toBe('champions')
    expect(result!.churnRisk).toBeLessThanOrEqual(0.2)
    expect(result!.lifetimeValue).toBe(30000)
    expect(scoringRepository.upsertCustomerScore).toHaveBeenCalled()
  })

  it('scores a lost/at-risk customer correctly', async () => {
    vi.mocked(customerAnalyticsService.getCustomerLifetimeValue).mockResolvedValue(mockCLV)
    vi.mocked(customerAnalyticsService.getChurnRisk).mockResolvedValue(mockChurn)
    vi.mocked(customerAnalyticsService.getRFMSegments).mockResolvedValue(mockRFMSegments)
    vi.mocked(scoringRepository.upsertCustomerScore).mockResolvedValue(undefined)

    const result = await customerScorer.scoreCustomer('cust-3')

    expect(result).not.toBeNull()
    expect(result!.customerId).toBe('cust-3')
    expect(result!.compositeScore).toBeLessThan(30)
    expect(result!.segment).toBe('lost')
    expect(result!.churnRisk).toBeGreaterThan(0.5)
  })

  it('scores all customers in batch', async () => {
    vi.mocked(customerAnalyticsService.getCustomerLifetimeValue).mockResolvedValue(mockCLV)
    vi.mocked(customerAnalyticsService.getChurnRisk).mockResolvedValue(mockChurn)
    vi.mocked(customerAnalyticsService.getRFMSegments).mockResolvedValue(mockRFMSegments)
    vi.mocked(scoringRepository.upsertCustomerScoresBatch).mockResolvedValue(undefined)

    const results = await customerScorer.scoreAllCustomers()

    expect(results).toHaveLength(3)
    expect(results[0].compositeScore).toBeGreaterThan(results[1].compositeScore)
    expect(results[0].rank).toBe(1)
    expect(results[2].rank).toBe(3)
    expect(scoringRepository.upsertCustomerScoresBatch).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// Supplier Scorer
// ══════════════════════════════════════════════════════════════════

describe('Supplier Scorer', () => {
  const mockSuppliers = [
    { supplierId: 'supp-1', supplierName: 'Quality Distributors Ltd', totalOrders: 50, onTimeDelivery: 95, qualityScore: 0, averageLeadTime: 2, totalValue: 5000000 },
    { supplierId: 'supp-2', supplierName: 'Budget Supplies Co', totalOrders: 10, onTimeDelivery: 70, qualityScore: 0, averageLeadTime: 8, totalValue: 800000 },
    { supplierId: 'supp-3', supplierName: 'Slow Logistics Inc', totalOrders: 5, onTimeDelivery: 40, qualityScore: 0, averageLeadTime: 20, totalValue: 300000 },
  ]

  it('scores a high-performing supplier correctly', async () => {
    vi.mocked(inventoryAnalyticsService.getSupplierPerformance).mockResolvedValue(mockSuppliers)
    vi.mocked(scoringRepository.upsertSupplierScore).mockResolvedValue(undefined)

    const result = await supplierScorer.scoreSupplier('supp-1')

    expect(result).not.toBeNull()
    expect(result!.supplierId).toBe('supp-1')
    expect(result!.supplierName).toBe('Quality Distributors Ltd')
    expect(result!.compositeScore).toBeGreaterThanOrEqual(70)
    expect(result!.reliabilityScore).toBeGreaterThanOrEqual(75)
    expect(result!.leadTimeScore).toBeGreaterThanOrEqual(90) // 2 days lead time → near perfect
    expect(scoringRepository.upsertSupplierScore).toHaveBeenCalled()
  })

  it('scores a low-performing supplier correctly', async () => {
    vi.mocked(inventoryAnalyticsService.getSupplierPerformance).mockResolvedValue(mockSuppliers)
    vi.mocked(scoringRepository.upsertSupplierScore).mockResolvedValue(undefined)

    const result = await supplierScorer.scoreSupplier('supp-3')

    expect(result).not.toBeNull()
    expect(result!.supplierId).toBe('supp-3')
    expect(result!.compositeScore).toBeLessThan(50)
    expect(result!.reliabilityScore).toBeLessThan(40)
  })

  it('scores all suppliers in batch', async () => {
    vi.mocked(inventoryAnalyticsService.getSupplierPerformance).mockResolvedValue(mockSuppliers)
    vi.mocked(scoringRepository.upsertSupplierScoresBatch).mockResolvedValue(undefined)

    const results = await supplierScorer.scoreAllSuppliers()

    expect(results).toHaveLength(3)
    expect(results[0].supplierId).toBe('supp-1') // Best: Quality Distributors
    expect(results[2].supplierId).toBe('supp-3') // Worst: Slow Logistics
    expect(results[0].rank).toBe(1)
    expect(results[2].rank).toBe(3)
    expect(scoringRepository.upsertSupplierScoresBatch).toHaveBeenCalled()
  })

  it('returns null for nonexistent supplier', async () => {
    vi.mocked(inventoryAnalyticsService.getSupplierPerformance).mockResolvedValue(mockSuppliers)

    const result = await supplierScorer.scoreSupplier('nonexistent')
    expect(result).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════
// Business Health Scorer
// ══════════════════════════════════════════════════════════════════

describe('Business Health Scorer', () => {
  const mockSalesMetrics = {
    totalRevenue: 5000000,
    totalTransactions: 500,
    averageOrderValue: 10000,
    revenueGrowth: 15,
    transactionGrowth: 10,
  }

  const mockFinancialMetrics = {
    totalRevenue: 5000000,
    totalExpenses: 3500000,
    netProfit: 1500000,
    profitMargin: 30,
    revenueGrowth: 15,
    expenseGrowth: 5,
  }

  const mockInventoryMetrics = {
    totalProducts: 1000,
    totalStockValue: 20000000,
    lowStockItems: 50,
    outOfStockItems: 20,
    overstockItems: 100,
  }

  const mockCustomerMetrics = {
    totalCustomers: 500,
    newCustomers: 50,
    activeCustomers: 300,
    averageOrderValue: 10000,
    customerRetentionRate: 60,
  }

  const mockWorkforceMetrics = {
    totalWorkers: 20,
    activeWorkers: 18,
    averageTaskCompletionRate: 85,
    averageEfficiencyScore: 75,
    totalHoursWorked: 2880,
    laborCost: 576000,
  }

  it('computes a healthy business score', async () => {
    vi.mocked(salesAnalyticsService.getSalesMetrics).mockResolvedValue(mockSalesMetrics)
    vi.mocked(financialAnalyticsService.getFinancialMetrics).mockResolvedValue(mockFinancialMetrics)
    vi.mocked(inventoryAnalyticsService.getInventoryMetrics).mockResolvedValue(mockInventoryMetrics)
    vi.mocked(customerAnalyticsService.getCustomerMetrics).mockResolvedValue(mockCustomerMetrics)
    vi.mocked(workforceAnalyticsService.getWorkforceMetrics).mockResolvedValue(mockWorkforceMetrics)
    vi.mocked(scoringRepository.getLatestBusinessHealthScore).mockResolvedValue(null)
    vi.mocked(scoringRepository.upsertBusinessHealthScore).mockResolvedValue(undefined)

    const result = await businessHealthScorer.computeHealthScore()

    expect(result.compositeScore).toBeGreaterThanOrEqual(60)
    expect(result.revenueHealth).toBeGreaterThan(50) // 15% revenue growth
    expect(result.marginHealth).toBeGreaterThanOrEqual(50) // 30% profit margin
    expect(result.trend).toBe('stable') // First computation → stable
    expect(result.computedAt).toBeDefined()
    expect(scoringRepository.upsertBusinessHealthScore).toHaveBeenCalled()
  })

  it('detects declining trend when previous score is higher', async () => {
    vi.mocked(salesAnalyticsService.getSalesMetrics).mockResolvedValue(mockSalesMetrics)
    vi.mocked(financialAnalyticsService.getFinancialMetrics).mockResolvedValue(mockFinancialMetrics)
    vi.mocked(inventoryAnalyticsService.getInventoryMetrics).mockResolvedValue(mockInventoryMetrics)
    vi.mocked(customerAnalyticsService.getCustomerMetrics).mockResolvedValue(mockCustomerMetrics)
    vi.mocked(workforceAnalyticsService.getWorkforceMetrics).mockResolvedValue(mockWorkforceMetrics)

    // Previous score was simulated as higher than current by mocking a high previous score
    const mockPrevScore = {
      revenueHealth: 95,
      marginHealth: 95,
      inventoryHealth: 95,
      customerHealth: 95,
      cashHealth: 95,
      workforceHealth: 95,
      compositeScore: 95,
      trend: 'improving' as const,
      computedAt: new Date(Date.now() - 86400000).toISOString(),
    }
    vi.mocked(scoringRepository.getLatestBusinessHealthScore).mockResolvedValue(mockPrevScore)
    vi.mocked(scoringRepository.upsertBusinessHealthScore).mockResolvedValue(undefined)

    const result = await businessHealthScorer.computeHealthScore()

    // The current score is lower than 95
    expect(result.compositeScore).toBeLessThan(95)
    // Trend should be 'declining' if drop >= 2 points
    if (95 - result.compositeScore >= 2) {
      expect(result.trend).toBe('declining')
    } else {
      expect(result.trend).toBe('stable')
    }
  })

  it('computes with poor metrics for a low health score', async () => {
    const poorSales = { ...mockSalesMetrics, revenueGrowth: -20 }
    const poorFinancial = { ...mockFinancialMetrics, profitMargin: 2, netProfit: 50000 }
    const poorInventory = { ...mockInventoryMetrics, outOfStockItems: 200, lowStockItems: 300 }
    const poorCustomer = { ...mockCustomerMetrics, customerRetentionRate: 20, activeCustomers: 50 }
    const poorWorkforce = { ...mockWorkforceMetrics, activeWorkers: 5, averageEfficiencyScore: 30 }

    vi.mocked(salesAnalyticsService.getSalesMetrics).mockResolvedValue(poorSales)
    vi.mocked(financialAnalyticsService.getFinancialMetrics).mockResolvedValue(poorFinancial)
    vi.mocked(inventoryAnalyticsService.getInventoryMetrics).mockResolvedValue(poorInventory)
    vi.mocked(customerAnalyticsService.getCustomerMetrics).mockResolvedValue(poorCustomer)
    vi.mocked(workforceAnalyticsService.getWorkforceMetrics).mockResolvedValue(poorWorkforce)
    vi.mocked(scoringRepository.getLatestBusinessHealthScore).mockResolvedValue(null)
    vi.mocked(scoringRepository.upsertBusinessHealthScore).mockResolvedValue(undefined)

    const result = await businessHealthScorer.computeHealthScore()

    expect(result.compositeScore).toBeLessThan(50)
    expect(result.revenueHealth).toBeLessThan(50) // Negative growth
    expect(result.customerHealth).toBeLessThan(50)
  })

  it('gets the latest health score from DB', async () => {
    const mockScore = {
      revenueHealth: 75,
      marginHealth: 80,
      inventoryHealth: 70,
      customerHealth: 65,
      cashHealth: 85,
      workforceHealth: 90,
      compositeScore: 78,
      trend: 'stable' as const,
      computedAt: new Date().toISOString(),
    }
    vi.mocked(scoringRepository.getLatestBusinessHealthScore).mockResolvedValue(mockScore)

    const result = await businessHealthScorer.getLatestScore()
    expect(result).toEqual(mockScore)
  })
})

// ══════════════════════════════════════════════════════════════════
// Edge Cases
// ══════════════════════════════════════════════════════════════════

describe('Scoring Edge Cases', () => {
  it('product scorer handles empty product data gracefully', async () => {
    vi.mocked(salesAnalyticsService.getProductPerformance).mockResolvedValue([])
    vi.mocked(inventoryAnalyticsService.getStockTurnover).mockResolvedValue([])
    vi.mocked(inventoryAnalyticsService.getDeadStock).mockResolvedValue([])

    const results = await productScorer.scoreAllProducts()
    expect(results).toEqual([])
  })

  it('customer scorer handles empty CLV data gracefully', async () => {
    vi.mocked(customerAnalyticsService.getCustomerLifetimeValue).mockResolvedValue([])
    vi.mocked(customerAnalyticsService.getChurnRisk).mockResolvedValue([])
    vi.mocked(customerAnalyticsService.getRFMSegments).mockResolvedValue([])

    const results = await customerScorer.scoreAllCustomers()
    expect(results).toEqual([])
  })

  it('supplier scorer handles empty supplier data gracefully', async () => {
    vi.mocked(inventoryAnalyticsService.getSupplierPerformance).mockResolvedValue([])

    const results = await supplierScorer.scoreAllSuppliers()
    expect(results).toEqual([])
  })

  it('queryScores delegates to repository', async () => {
    const mockScores = [
      { productId: 'prod-1', productName: 'Coffee', productCategory: 'Beverages', velocityScore: 90, marginScore: 80, stabilityScore: 70, seasonalityScore: 60, compositeScore: 80, scoreCategory: 'star' as const, rank: 1, computedAt: new Date().toISOString() },
    ]
    vi.mocked(scoringRepository.queryProductScores).mockResolvedValue(mockScores)
    vi.mocked(scoringRepository.queryCustomerScores).mockResolvedValue([])
    vi.mocked(scoringRepository.querySupplierScores).mockResolvedValue([])

    const productResults = await productScorer.queryScores({ type: 'product', limit: 5 })
    expect(productResults).toEqual(mockScores)

    const customerResults = await customerScorer.queryScores({ type: 'customer', limit: 5 })
    expect(customerResults).toEqual([])

    const supplierResults = await supplierScorer.queryScores({ type: 'supplier', limit: 5 })
    expect(supplierResults).toEqual([])
  })
})
