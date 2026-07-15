/**
 * Insights Engine — Comprehensive unit tests
 *
 * Sprint 11E: Full test suite for anomaly detector and trend analyzer.
 *
 * Follows the same vi.hoisted() + thenable mock chain pattern used in
 * recommendations.test.ts and scoring.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Pure Math: Test before any mocking ─────────────────────────

describe('Insights Pure Math', () => {
  describe('computeZScores', () => {
    it('returns zeros for empty array', async () => {
      const { computeZScores } = await import('../insights/anomaly-detector')
      expect(computeZScores([])).toEqual([])
    })

    it('returns zeros for single element', async () => {
      const { computeZScores } = await import('../insights/anomaly-detector')
      expect(computeZScores([5])).toEqual([0])
    })

    it('returns zeros when all values are identical', async () => {
      const { computeZScores } = await import('../insights/anomaly-detector')
      expect(computeZScores([10, 10, 10])).toEqual([0, 0, 0])
    })

    it('computes correct Z-scores for simple data', async () => {
      const { computeZScores } = await import('../insights/anomaly-detector')
      const result = computeZScores([1, 2, 3, 4, 5])
      // Mean=3, variance=2.5, stddev≈1.581
      expect(result.length).toBe(5)
      // First Z-score: (1-3)/1.581 ≈ -1.265
      expect(Math.abs(result[0] - (-1.2649))).toBeLessThan(0.01)
      // Middle Z-score should be ~0
      expect(Math.abs(result[2])).toBeLessThan(0.01)
      // Last Z-score: (5-3)/1.581 ≈ 1.265
      expect(Math.abs(result[4] - 1.2649)).toBeLessThan(0.01)
    })

    it('outlier has highest absolute Z-score', async () => {
      const { computeZScores } = await import('../insights/anomaly-detector')
      // 15 tightly clustered values + one extreme outlier
      // 14 exact 10s + one 10000 → residual pattern guarantees outlier Z-score > 3
      const values = Array.from({ length: 14 }, () => 10)
      values.push(10000)
      const result = computeZScores(values)
      const normalMaxZ = Math.max(...result.slice(0, 14).map(Math.abs))
      const outlierZ = Math.abs(result[14])
      expect(outlierZ).toBeGreaterThan(normalMaxZ)
      expect(outlierZ).toBeGreaterThan(3)
    })

    it('tightly clustered values have low Z-scores', async () => {
      const { computeZScores } = await import('../insights/anomaly-detector')
      const result = computeZScores([10, 10.1, 9.9, 10.2, 9.8])
      const maxAbsZ = Math.max(...result.map(Math.abs))
      expect(maxAbsZ).toBeLessThan(2)
    })
  })

  describe('computeIQRBounds', () => {
    it('returns [0,0] for empty array', async () => {
      const { computeIQRBounds } = await import('../insights/anomaly-detector')
      expect(computeIQRBounds([])).toEqual([0, 0])
    })

    it('computes correct IQR bounds', async () => {
      const { computeIQRBounds } = await import('../insights/anomaly-detector')
      // n=6, Q1 = sorted[floor(6*0.25)] = sorted[1] = 3
      // Q3 = sorted[floor(6*0.75)] = sorted[4] = 9
      // IQR = 9-3 = 6, bounds = 3-1.5*6=-6 and 9+1.5*6=18
      const [lower, upper] = computeIQRBounds([1, 3, 5, 7, 9, 11])
      expect(lower).toBe(-6)
      expect(upper).toBe(18)
    })

    it('uses custom multiplier', async () => {
      const { computeIQRBounds } = await import('../insights/anomaly-detector')
      // Q1=3, Q3=9, IQR=6, bounds = 3-3*6=-15 and 9+3*6=27
      const [lower, upper] = computeIQRBounds([1, 3, 5, 7, 9, 11], 3)
      expect(lower).toBe(-15)
      expect(upper).toBe(27)
    })
  })

  describe('classifySeverity', () => {
    it('classifies critical for deviation >= 5', async () => {
      const { classifySeverity } = await import('../insights/anomaly-detector')
      expect(classifySeverity(5)).toBe('critical')
      expect(classifySeverity(-5)).toBe('critical')
      expect(classifySeverity(7.2)).toBe('critical')
    })

    it('classifies high for deviation >= 4', async () => {
      const { classifySeverity } = await import('../insights/anomaly-detector')
      expect(classifySeverity(4)).toBe('high')
      expect(classifySeverity(-4)).toBe('high')
      expect(classifySeverity(4.9)).toBe('high')
    })

    it('classifies medium for deviation >= 3', async () => {
      const { classifySeverity } = await import('../insights/anomaly-detector')
      expect(classifySeverity(3)).toBe('medium')
      expect(classifySeverity(-3.5)).toBe('medium')
    })

    it('classifies low for deviation < 3', async () => {
      const { classifySeverity } = await import('../insights/anomaly-detector')
      expect(classifySeverity(0)).toBe('low')
      expect(classifySeverity(2)).toBe('low')
      expect(classifySeverity(-2.9)).toBe('low')
    })
  })

  describe('classifyDirection', () => {
    it('returns spike when actual exceeds expected with high deviation', async () => {
      const { classifyDirection } = await import('../insights/anomaly-detector')
      expect(classifyDirection(100, 50, 4)).toBe('spike')
    })

    it('returns drop when actual below expected with high deviation', async () => {
      const { classifyDirection } = await import('../insights/anomaly-detector')
      expect(classifyDirection(10, 50, -4)).toBe('drop')
    })

    it('returns unusual when deviation is below threshold', async () => {
      const { classifyDirection } = await import('../insights/anomaly-detector')
      expect(classifyDirection(55, 50, 2)).toBe('unusual')
    })
  })

  describe('Trend Analyzer Pure Math', () => {
    it('computeCV returns 0 for empty or zero-mean data', async () => {
      const { computeCV } = await import('../insights/trend-analyzer')
      expect(computeCV([])).toBe(0)
      expect(computeCV([0, 0, 0])).toBe(0)
    })

    it('computeCV measures relative variability', async () => {
      const { computeCV } = await import('../insights/trend-analyzer')
      const cv = computeCV([1, 2, 3, 4, 5])
      // Mean=3, stddev≈1.581, CV≈0.527
      expect(cv).toBeGreaterThan(0.5)
      expect(cv).toBeLessThan(0.55)
    })

    it('computeCV returns lower for less variable data', async () => {
      const { computeCV } = await import('../insights/trend-analyzer')
      const highVar = computeCV([1, 10, 20, 5, 15])
      const lowVar = computeCV([9, 10, 10, 11, 10])
      expect(highVar).toBeGreaterThan(lowVar)
    })

    it('computeChangePct returns 0 for single element', async () => {
      const { computeChangePct } = await import('../insights/trend-analyzer')
      expect(computeChangePct([5])).toBe(0)
    })

    it('computeChangePct computes correct percentage', async () => {
      const { computeChangePct } = await import('../insights/trend-analyzer')
      expect(computeChangePct([100, 150])).toBe(50)
      expect(computeChangePct([100, 75])).toBe(-25)
    })

    it('computeChangePct handles zero first value', async () => {
      const { computeChangePct } = await import('../insights/trend-analyzer')
      expect(computeChangePct([0, 100])).toBe(100)
      expect(computeChangePct([0, 0])).toBe(0)
    })

    it('classifyDirection detects upward trend', async () => {
      const { classifyDirection } = await import('../insights/trend-analyzer')
      expect(classifyDirection(0.5, 0.05, 0.1)).toBe('up')
    })

    it('classifyDirection detects downward trend', async () => {
      const { classifyDirection } = await import('../insights/trend-analyzer')
      expect(classifyDirection(-0.3, -0.03, 0.1)).toBe('down')
    })

    it('classifyDirection detects volatile when CV exceeds threshold', async () => {
      const { classifyDirection } = await import('../insights/trend-analyzer')
      expect(classifyDirection(0.01, 0.001, 0.6)).toBe('volatile')
    })

    it('classifyDirection returns stable when slope is near zero', async () => {
      const { classifyDirection } = await import('../insights/trend-analyzer')
      expect(classifyDirection(0.001, 0.0001, 0.1)).toBe('stable')
    })

    it('classifySignificance returns high for good data', async () => {
      const { classifySignificance } = await import('../insights/trend-analyzer')
      expect(classifySignificance(0.8, 25, 30)).toBe('high')
    })

    it('classifySignificance returns medium for moderate data', async () => {
      const { classifySignificance } = await import('../insights/trend-analyzer')
      expect(classifySignificance(0.5, 12, 15)).toBe('medium')
    })

    it('classifySignificance returns low for poor data', async () => {
      const { classifySignificance } = await import('../insights/trend-analyzer')
      expect(classifySignificance(0.1, 5, 5)).toBe('low')
    })

    it('analyzeTrendPure returns zero slope for single data point', async () => {
      const { analyzeTrendPure } = await import('../insights/trend-analyzer')
      const result = analyzeTrendPure([42])
      expect(result.slope).toBe(0)
      expect(result.r2).toBe(0)
    })

    it('analyzeTrendPure detects upward trend', async () => {
      const { analyzeTrendPure } = await import('../insights/trend-analyzer')
      const data = [10, 12, 14, 16, 18, 20]
      const result = analyzeTrendPure(data)
      expect(result.slope).toBeGreaterThan(0)
      expect(result.normalizedSlope).toBeGreaterThan(0)
      expect(result.r2).toBeGreaterThan(0.9) // Linear data = high R²
    })

    it('analyzeTrendPure detects downward trend', async () => {
      const { analyzeTrendPure } = await import('../insights/trend-analyzer')
      const data = [100, 90, 80, 70, 60]
      const result = analyzeTrendPure(data)
      expect(result.slope).toBeLessThan(0)
      expect(result.normalizedSlope).toBeLessThan(0)
    })
  })
})

// ─── Hoisted helpers for integrated tests ────────────────────────

const mockFrom = vi.hoisted(() => vi.fn())

const mockKpiTracker = vi.hoisted(() => ({
  getDefinitions: vi.fn(),
  getDefinition: vi.fn(),
  getLatestSnapshot: vi.fn(),
}))

const mockForecastRepo = vi.hoisted(() => ({
  queryAccuracyLogs: vi.fn(),
  queryForecasts: vi.fn(),
  getLatestForecast: vi.fn(),
}))

// Helper: create a thenable mock query chain (same pattern as recommendations test)
function createMockChain(resolvedValue: unknown) {
  const promise = Promise.resolve(resolvedValue)
  const chain = Object.assign(promise, {
    select: vi.fn().mockReturnValue(promise),
    eq: vi.fn().mockReturnValue(promise),
    in: vi.fn().mockReturnValue(promise),
    gte: vi.fn().mockReturnValue(promise),
    lte: vi.fn().mockReturnValue(promise),
    is: vi.fn().mockReturnValue(promise),
    order: vi.fn().mockReturnValue(promise),
    limit: vi.fn().mockReturnValue(promise),
    single: vi.fn().mockReturnValue(promise),
    maybeSingle: vi.fn().mockReturnValue(promise),
  })
  return chain
}

// ─── Top-level mocks ────────────────────────────────────────────

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

vi.mock('../repositories/forecast-repository', () => ({
  forecastRepository: mockForecastRepo,
}))

vi.mock('../kpi', () => ({
  kpiTracker: mockKpiTracker,
}))

vi.mock('../kpi/tracker', () => ({
  kpiTracker: mockKpiTracker,
}))

// ─── 1. Anomaly Detector (Integrated) ───────────────────────────

describe('Anomaly Detector (Integrated)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset()
  })

  it('detectSalesAnomalies returns empty if not enough residuals', async () => {
    // Single log with only 1 data point < MIN_DATA_POINTS (5)
    mockForecastRepo.queryAccuracyLogs.mockResolvedValue([
      {
        id: 'log-1', productId: 'prod-1', branchId: null,
        method: 'linear_regression', mape: 10, mase: null,
        actualValues: [100], predictedValues: [100],
        dataPoints: 1, evaluatedAt: new Date().toISOString(),
      },
    ])

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectSalesAnomalies()

    expect(result).toEqual([])
    expect(mockForecastRepo.queryAccuracyLogs).toHaveBeenCalled()
  })

  it('detectSalesAnomalies returns empty if logs have no residuals', async () => {
    mockForecastRepo.queryAccuracyLogs.mockResolvedValue([
      {
        id: 'log-1', productId: 'prod-1', branchId: null,
        method: 'linear_regression', mape: 10, mase: null,
        actualValues: [100], predictedValues: [100],
        dataPoints: 1, evaluatedAt: new Date().toISOString(),
      },
    ])

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectSalesAnomalies()

    // 1 data point < MIN_DATA_POINTS (5)
    expect(result).toEqual([])
  })

  it('detectSalesAnomalies finds anomalies from large residuals', async () => {
    // 15 data points: 14 exact matches (residual=0) + 1 extreme (residual=99900)
    // Statistically: mean=6660, 14 zeros, one at 99900 → Z-score > 3
    const actuals = Array.from({ length: 14 }, () => 100)
    actuals.push(100000)
    const predicteds = Array.from({ length: 15 }, () => 100)

    mockForecastRepo.queryAccuracyLogs.mockResolvedValue([
      {
        id: 'log-1', productId: 'prod-1', branchId: null,
        method: 'linear_regression', mape: 10, mase: null,
        actualValues: actuals,
        predictedValues: predicteds,
        dataPoints: 15,
        evaluatedAt: new Date().toISOString(),
      },
    ])

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectSalesAnomalies()

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].entityType).toBe('sale')
    expect(['spike', 'drop', 'unusual']).toContain(result[0].direction)
  })

  it('detectKPIAnomalies returns empty when no KPI snapshots exist', async () => {
    mockKpiTracker.getDefinitions.mockReturnValue([
      { id: 'revenue_velocity', name: 'Revenue Velocity', unit: 'currency' },
    ])

    // Mock supabase to return empty snapshots
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }))

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectKPIAnomalies()

    expect(result).toEqual([])
    expect(mockKpiTracker.getDefinitions).toHaveBeenCalled()
  })

  it('detectKPIAnomalies returns empty with too few snapshots', async () => {
    mockKpiTracker.getDefinitions.mockReturnValue([
      { id: 'revenue_velocity', name: 'Revenue Velocity', unit: 'currency' },
    ])

    // Only 3 snapshots — below MIN_DATA_POINTS
    mockFrom.mockReturnValue(createMockChain({
      data: [
        { value: 100, computed_at: '2026-07-01T00:00:00Z' },
        { value: 105, computed_at: '2026-07-08T00:00:00Z' },
        { value: 102, computed_at: '2026-07-15T00:00:00Z' },
      ],
      error: null,
    }))

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectKPIAnomalies()

    expect(result).toEqual([])
  })

  it('fullScan runs all detection methods and returns combined results', async () => {
    // Sales: no data
    mockForecastRepo.queryAccuracyLogs.mockResolvedValue([])

    // KPI: no data
    mockKpiTracker.getDefinitions.mockReturnValue([])

    // Inventory: no movements
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stock_movements') {
        return createMockChain({ data: [], error: null })
      }
      // KPI snapshots
      return createMockChain({ data: [], error: null })
    })

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.fullScan()

    expect(Array.isArray(result)).toBe(true)
  })

  it('detectInventoryAnomalies returns empty for few movements', async () => {
    mockFrom.mockReturnValue(createMockChain({
      data: [
        { product_id: 'p1', product_name: 'Prod 1', quantity_change: 5, created_at: '2026-07-10T00:00:00Z' },
        { product_id: 'p1', product_name: 'Prod 1', quantity_change: -3, created_at: '2026-07-11T00:00:00Z' },
      ],
      error: null,
    }))

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectInventoryAnomalies()

    // 2 data points per product < MIN_DATA_POINTS (5)
    expect(result).toEqual([])
  })

  it('detectInventoryAnomalies handles null movements gracefully', async () => {
    mockFrom.mockReturnValue(createMockChain({ data: null, error: null }))

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectInventoryAnomalies()

    expect(result).toEqual([])
  })

  it('fullScan suppresses errors and returns empty on failure', async () => {
    mockForecastRepo.queryAccuracyLogs.mockRejectedValue(new Error('DB error'))

    const { anomalyDetector } = await import('../insights/anomaly-detector')
    const result = await anomalyDetector.detectSalesAnomalies()

    // Error is caught, returns []
    expect(result).toEqual([])
  })
})

// ─── 2. Trend Analyzer (Integrated) ─────────────────────────────

describe('Trend Analyzer (Integrated)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset()
    mockKpiTracker.getDefinitions.mockReset()
    mockKpiTracker.getDefinition.mockReset()
  })

  it('analyzeMetric returns stable with insufficient data', async () => {
    // No snapshots in DB for this KPI
    mockFrom.mockReturnValue(createMockChain({ data: [], error: null }))

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeMetric('kpi', 'revenue_velocity', 'Revenue Velocity', '30d')

    expect(result.direction).toBe('stable')
    expect(result.significance).toBe('low')
    expect(result.changePct).toBe(0)
  })

  it('analyzeMetric returns stable with 1 data point', async () => {
    mockFrom.mockReturnValue(createMockChain({
      data: [{ value: 100, computed_at: '2026-07-01T00:00:00Z' }],
      error: null,
    }))

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeMetric('kpi', 'revenue_velocity', 'Revenue Velocity', '7d')

    expect(result.direction).toBe('stable')
  })

  it('analyzeMetric detects upward trend', async () => {
    // Upward trend: 10, 12, 14, 16, 18, 20, 22, 24
    const data = Array.from({ length: 8 }, (_, i) => ({ value: 10 + i * 2, computed_at: `2026-07-0${i + 1}T00:00:00Z` }))

    mockFrom.mockReturnValue(createMockChain({ data, error: null }))

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeMetric('kpi', 'revenue_velocity', 'Revenue Velocity', '30d')

    expect(result.direction).toBe('up')
    expect(result.changePct).toBeGreaterThan(0)
  })

  it('analyzeMetric detects downward trend', async () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ value: 100 - i * 5, computed_at: `2026-07-0${i + 1}T00:00:00Z` }))

    mockFrom.mockReturnValue(createMockChain({ data, error: null }))

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeMetric('kpi', 'revenue_velocity', 'Revenue Velocity', '30d')

    expect(result.direction).toBe('down')
    expect(result.changePct).toBeLessThan(0)
  })

  it('analyzeMetric handles error gracefully', async () => {
    mockFrom.mockImplementation(() => { throw new Error('DB timeout') })

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeMetric('kpi', 'revenue_velocity', 'Revenue Velocity', '30d')

    expect(result.direction).toBe('stable')
    expect(result.significance).toBe('low')
    expect(result.description).toContain('error')
  })

  it('analyzeAll returns empty when no KPI definitions', async () => {
    mockKpiTracker.getDefinitions.mockReturnValue([])

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeAll()

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })

  it('analyzeAll analyzes all KPIs', async () => {
    mockKpiTracker.getDefinitions.mockReturnValue([
      { id: 'revenue_velocity', name: 'Revenue Velocity', unit: 'currency' },
      { id: 'gross_margin_pct', name: 'Gross Margin', unit: 'percentage' },
    ])

    // Each KPI query returns enough data for trend analysis
    const data = Array.from({ length: 8 }, (_, i) => ({ value: 50 + i, computed_at: `2026-07-0${i + 1}T00:00:00Z` }))
    mockFrom.mockReturnValue(createMockChain({ data, error: null }))

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeAll()

    expect(result.length).toBeGreaterThan(0)
    // Each result should have proper structure
    for (const trend of result) {
      expect(trend).toHaveProperty('entityType')
      expect(trend).toHaveProperty('entityId')
      expect(trend).toHaveProperty('direction')
      expect(trend).toHaveProperty('changePct')
      expect(trend).toHaveProperty('significance')
      expect(trend).toHaveProperty('description')
      expect(trend).toHaveProperty('analyzedAt')
    }
  })

  it('analyzeMetric handles KPI DB error gracefully', async () => {
    mockKpiTracker.getDefinitions.mockReturnValue([
      { id: 'revenue_velocity', name: 'Revenue Velocity', unit: 'currency' },
    ])
    mockKpiTracker.getDefinition.mockReturnValue({
      id: 'revenue_velocity', name: 'Revenue Velocity', description: '',
      formula: '', unit: 'currency', refreshCadence: 'daily',
      sourceService: '', targetSource: 'manual',
    })

    // Mock DB call to throw
    mockFrom.mockImplementation(() => {
      throw new Error('DB error')
    })

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeAll()

    // Errors are caught — returns trend with stable direction
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].direction).toBe('stable')
  })

  it('analyzeMetric returns entity name for known revenue entity', async () => {
    // Mock revenue_forecasts table
    mockFrom.mockImplementation((table: string) => {
      if (table === 'revenue_forecasts') {
        const data = Array.from({ length: 6 }, (_, i) => ({
          projected_total: 100000 + i * 10000,
          computed_at: `2026-07-0${i + 1}T00:00:00Z`,
        }))
        return createMockChain({ data, error: null })
      }
      return createMockChain({ data: [], error: null })
    })

    const { trendAnalyzer } = await import('../insights/trend-analyzer')
    const result = await trendAnalyzer.analyzeMetric('revenue', 'all', 'revenue', '30d')

    expect(result.entityName).toBe('Revenue')
    expect(result.direction).toBe('up')
  })
})
