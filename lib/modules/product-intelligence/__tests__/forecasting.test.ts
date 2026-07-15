/**
 * Forecasting Engine — Comprehensive unit tests
 *
 * Sprint 11C: Full test suite covering:
 * - All 6 math methods (SMA, WMA, ES, LR, SD, HW)
 * - Auto-select method
 * - MAPE/MASE/confidence interval helpers
 * - Seasonality detection + classification
 * - DemandForecaster orchestrator
 * - RevenueForecaster orchestrator
 * - Edge cases: empty data, single point, flat data, linear data, seasonal data
 *
 * NOTE: vi.mock() calls MUST be at the top level of the module (hoisted).
 * Dynamic mocks within describe blocks are not supported for imported modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Math Functions (pure — no mocks needed) ───────────────────────

import {
  simpleMovingAverage,
  weightedMovingAverage,
  exponentialSmoothing,
  linearRegression,
  seasonalDecomposition,
  seasonalDecompositionThenForecast,
  holtWinters,
  holtWintersThenForecast,
  autoSelectMethod,
  evaluateAllMethods,
  computeMAPE,
  computeMASE,
  computeConfidenceIntervals,
  detectBestPeriod,
  classifyPattern,
} from '../forecasting/math'

// ─── Mocks (at top level — hoisted before any describe block) ──────

// Default mock factory for forecastRepository
const mockForecastRepo = {
  insertForecast: vi.fn().mockResolvedValue(undefined),
  getLatestForecast: vi.fn().mockResolvedValue(null),
  getStaleForecasts: vi.fn().mockResolvedValue([]),
  queryForecasts: vi.fn().mockResolvedValue([]),
  deleteProductForecasts: vi.fn().mockResolvedValue(undefined),
  pruneExpiredForecasts: vi.fn().mockResolvedValue(0),
  insertRevenueForecast: vi.fn().mockResolvedValue(undefined),
  getLatestRevenueForecast: vi.fn().mockResolvedValue(null),
  deleteStaleRevenueForecasts: vi.fn().mockResolvedValue(0),
  upsertSeasonality: vi.fn().mockResolvedValue(undefined),
  getSeasonality: vi.fn().mockResolvedValue(null),
  querySeasonality: vi.fn().mockResolvedValue([]),
  insertAccuracyLog: vi.fn().mockResolvedValue(undefined),
  queryAccuracyLogs: vi.fn().mockResolvedValue([]),
  getMethodAccuracy: vi.fn().mockResolvedValue([]),
}

vi.mock('../repositories/forecast-repository', () => ({
  forecastRepository: mockForecastRepo,
}))

vi.mock('@/lib/realtime/event-bus', () => ({
  publish: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/analytics/sales-analytics', () => ({
  salesAnalyticsService: {
    getSalesTrend: vi.fn().mockResolvedValue([]),
    getProductPerformance: vi.fn().mockResolvedValue([]),
  },
}))

// ─── 1. MAPE / MASE / CI ───────────────────────────────────────────

describe('computeMAPE', () => {
  it('calculates MAPE for matching arrays', () => {
    const actual = [100, 200, 300]
    const predicted = [110, 190, 310]
    const mape = computeMAPE(actual, predicted)
    expect(mape).not.toBeNull()
    // |(100-110)/100| + |(200-190)/200| + |(300-310)/300| = 0.1 + 0.05 + 0.0333 = 0.18333 / 3 * 100 = 6.1111
    expect(mape).toBeCloseTo(6.1111, 1)
  })

  it('returns null for empty arrays', () => {
    expect(computeMAPE([], [])).toBeNull()
  })

  it('returns null for mismatched lengths', () => {
    expect(computeMAPE([1, 2], [1])).toBeNull()
  })

  it('returns null when actual has zeros', () => {
    expect(computeMAPE([0, 2], [1, 2])).toBeNull()
  })

  it('returns 0 for perfect predictions', () => {
    expect(computeMAPE([100, 200], [100, 200])).toBe(0)
  })
})

describe('computeMASE', () => {
  it('calculates MASE for decent predictions', () => {
    const actual = [100, 110, 120, 130, 140]
    const predicted = [102, 112, 118, 132, 138]
    const mase = computeMASE(actual, predicted)
    expect(mase).not.toBeNull()
    expect(mase!).toBeGreaterThan(0)
    expect(mase!).toBeLessThan(2)
  })

  it('returns null for arrays shorter than 2', () => {
    expect(computeMASE([1], [1])).toBeNull()
  })

  it('returns null for empty arrays', () => {
    expect(computeMASE([], [])).toBeNull()
  })

  it('returns 0 for perfect predictions with trend', () => {
    const actual = [100, 110, 120]
    const predicted = [100, 110, 120]
    const mase = computeMASE(actual, predicted)
    expect(mase).toBe(0)
  })
})

describe('computeConfidenceIntervals', () => {
  it('computes symmetric CIs at 90% confidence', () => {
    const forecast = [100, 110, 120]
    const residuals = [5, -3, 4, -2, 1]
    const ci = computeConfidenceIntervals(forecast, residuals, 0.90)
    expect(ci.upper).toHaveLength(3)
    expect(ci.lower).toHaveLength(3)
    ci.upper.forEach((u, i) => expect(u).toBeGreaterThanOrEqual(forecast[i]))
    ci.lower.forEach((l, i) => expect(l).toBeLessThanOrEqual(forecast[i]))
  })

  it('handles zero residuals (perfect fit)', () => {
    const forecast = [100, 200]
    const residuals = [0, 0, 0]
    const ci = computeConfidenceIntervals(forecast, residuals, 0.95)
    expect(ci.upper).toEqual([100, 200])
    expect(ci.lower).toEqual([100, 200])
  })

  it('widens CI with higher confidence level', () => {
    const forecast = [100]
    const residuals = [10, -10, 5, -5]
    const ci80 = computeConfidenceIntervals(forecast, residuals, 0.80)
    const ci95 = computeConfidenceIntervals(forecast, residuals, 0.95)
    const margin80 = ci80.upper[0] - forecast[0]
    const margin95 = ci95.upper[0] - forecast[0]
    expect(margin95).toBeGreaterThan(margin80)
  })
})

// ─── 2. Simple Moving Average ──────────────────────────────────────

describe('simpleMovingAverage', () => {
  it('forecasts using average of last window values', () => {
    const data = [10, 20, 30, 40, 50]
    const result = simpleMovingAverage(data, 3, 3)
    expect(result.forecast).toHaveLength(3)
    // Fitted: [10, 20, mean(10,20,30)=20, mean(20,30,40)=30, mean(30,40,50)=40]
    expect(result.fitted[2]).toBeCloseTo(20, 1)
    expect(result.fitted[3]).toBeCloseTo(30, 1)
    expect(result.fitted[4]).toBeCloseTo(40, 1)
    // Forecast: last SMA value (40) repeated
    expect(result.forecast[0]).toBeCloseTo(40, 1)
    expect(result.forecast[2]).toBeCloseTo(40, 1)
  })

  it('handles window larger than data', () => {
    const data = [10, 20]
    const result = simpleMovingAverage(data, 10, 2)
    expect(result.forecast).toHaveLength(2)
    expect(result.forecast[0]).toBeCloseTo(15, 1)
  })

  it('handles empty data', () => {
    const result = simpleMovingAverage([], 3, 1)
    expect(result.forecast).toHaveLength(1)
    expect(result.forecast[0]).toBe(0)
  })

  it('handles single data point', () => {
    const result = simpleMovingAverage([42], 3, 2)
    expect(result.forecast).toHaveLength(2)
    expect(result.forecast[0]).toBe(42)
    expect(result.forecast[1]).toBe(42)
  })
})

// ─── 3. Weighted Moving Average ────────────────────────────────────

describe('weightedMovingAverage', () => {
  it('forecasts with weighted average giving more weight to recent', () => {
    const data = [10, 20, 30, 40, 50]
    const result = weightedMovingAverage(data, 3, 2)
    expect(result.forecast).toHaveLength(2)
    // Weights: [1, 2, 3], sum=6
    // fitted[4] = (30*1 + 40*2 + 50*3)/6 = (30 + 80 + 150)/6 = 260/6 = 43.33
    expect(result.fitted[4]).toBeCloseTo(43.33, 0)
    // Forecast = last WMA = 43.33
    expect(result.forecast[0]).toBeCloseTo(43.33, 0)
  })
})

// ─── 4. Exponential Smoothing ──────────────────────────────────────

describe('exponentialSmoothing', () => {
  it('smooths with alpha near 1 (nearly follows raw data)', () => {
    // alpha=1 gets clamped to 0.99
    const data = [100, 110, 120]
    const result = exponentialSmoothing(data, 0.99, 2)
    // s[0]=100, s[1]=0.99*110+0.01*100=109.9, s[2]=0.99*120+0.01*109.9=119.899
    expect(result.fitted[0]).toBeCloseTo(100, 0)
    expect(result.fitted[1]).toBeCloseTo(109.9, 1)
    expect(result.fitted[2]).toBeCloseTo(119.9, 1)
    expect(result.forecast[0]).toBeCloseTo(119.9, 1)
  })

  it('smooths with alpha near 0 (nearly constant first value)', () => {
    // alpha=0 gets clamped to 0.01
    const data = [100, 110, 200]
    const result = exponentialSmoothing(data, 0.01, 1)
    // s[0]=100, s[1]=0.01*110+0.99*100=100.1, s[2]=0.01*200+0.99*100.1=101.099
    expect(result.fitted[0]).toBeCloseTo(100, 0)
    expect(result.fitted[1]).toBeCloseTo(100.1, 1)
    expect(result.fitted[2]).toBeCloseTo(101.1, 1)
    expect(result.forecast[0]).toBeCloseTo(101.1, 1)
  })

  it('produces stable MAPE for linear data', () => {
    const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const result = exponentialSmoothing(data, 0.5, 3)
    expect(result.forecast).toHaveLength(3)
    expect(result.mape).toBeLessThan(50)
  })
})

// ─── 5. Linear Regression ──────────────────────────────────────────

describe('linearRegression', () => {
  it('predicts next values for perfect linear data', () => {
    const data = [10, 20, 30, 40, 50]
    const result = linearRegression(data, 3)
    // slope = 10, intercept = 10
    expect(result.forecast[0]).toBeCloseTo(60, 0)
    expect(result.forecast[1]).toBeCloseTo(70, 0)
    expect(result.forecast[2]).toBeCloseTo(80, 0)
  })

  it('handles flat data (zero slope)', () => {
    const data = [50, 50, 50, 50, 50]
    const result = linearRegression(data, 2)
    expect(result.forecast[0]).toBeCloseTo(50, 0)
    expect(result.forecast[1]).toBeCloseTo(50, 0)
  })

  it('handles downward trend', () => {
    const data = [100, 90, 80, 70, 60]
    const result = linearRegression(data, 2)
    expect(result.forecast[0]).toBeLessThan(60)
    expect(result.forecast[1]).toBeLessThan(result.forecast[0])
  })

  it('handles two data points', () => {
    const result = linearRegression([10, 20], 1)
    expect(result.forecast[0]).toBeCloseTo(30, 0)
  })
})

// ─── 6. Seasonal Decomposition ─────────────────────────────────────

describe('seasonalDecomposition', () => {
  it('detects weekly pattern in seasonal data', () => {
    const data: number[] = []
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        data.push(d < 5 ? 10 : 25)
      }
    }
    const result = seasonalDecomposition(data, 7)
    expect(result.factors).toHaveLength(7)
    expect(result.strength).toBeGreaterThan(0.3)
    expect(result.pattern).toBe('weekly')
  })

  it('returns a pattern for random data (no crash)', () => {
    const data = Array.from({ length: 30 }, () => Math.random() * 100)
    const result = seasonalDecomposition(data, 7)
    expect(result.factors).toHaveLength(7)
    expect(result.pattern).toBeDefined()
  })

  it('handles short data gracefully', () => {
    const result = seasonalDecomposition([10, 20, 30], 7)
    expect(result.factors).toHaveLength(2)
    expect(result.strength).toBeGreaterThanOrEqual(0)
  })
})

// ─── 7. Holt-Winters ───────────────────────────────────────────────

describe('holtWinters', () => {
  it('forecasts with seasonal pattern', () => {
    const data: number[] = []
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        data.push(d < 5 ? 10 : 25)
      }
    }
    const result = holtWinters(data, 0.3, 0.1, 0.1, 7, 5)
    expect(result.forecast).toHaveLength(5)
    expect(result.forecast[0]).toBeGreaterThan(0)
    expect(result.seasonal).toHaveLength(7)
  })

  it('handles flat data', () => {
    const data = Array(14).fill(50)
    const result = holtWinters(data, 0.3, 0.1, 0.1, 7, 3)
    expect(result.forecast).toHaveLength(3)
    expect(result.forecast[0]).toBeCloseTo(50, 0)
  })

  it('handles alpha clamping', () => {
    const data = Array.from({ length: 14 }, (_, i) => 10 + i)
    const result = holtWinters(data, 2.0, 0.5, 0.5, 7, 2)
    expect(result.forecast).toHaveLength(2)
  })
})

// ─── 8. Composite Methods ──────────────────────────────────────────

describe('seasonalDecompositionThenForecast', () => {
  it('deseasonalizes and forecasts', () => {
    const data: number[] = []
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        data.push(d < 5 ? 10 : 25)
      }
    }
    const result = seasonalDecompositionThenForecast(data, 7, 7)
    expect(result.forecast).toHaveLength(7)
    // Weekend periods should be higher
    expect(result.forecast[5]).toBeGreaterThan(result.forecast[0])
  })
})

describe('holtWintersThenForecast', () => {
  it('wraps holtWinters into ForecastMathResult', () => {
    const data = Array.from({ length: 14 }, (_, i) => 10 + (i % 7) * 3)
    const result = holtWintersThenForecast(data, 0.3, 0.1, 0.1, 7, 4)
    expect(result.forecast).toHaveLength(4)
    expect(result.fitted).toHaveLength(14)
    expect(result.residuals).toHaveLength(14)
    expect(result.methodLabel).toContain('holt_winters')
  })
})

// ─── 9. Auto-Select Method ─────────────────────────────────────────

describe('autoSelectMethod', () => {
  it('selects linear_regression for linear data', () => {
    const data = Array.from({ length: 30 }, (_, i) => 10 + i * 2)
    const { best, results } = autoSelectMethod(data, 5)
    expect(results.length).toBeGreaterThanOrEqual(4)
    expect(best.method).toBe('linear_regression')
    expect(best.forecast).toHaveLength(5)
  })

  it('handles flat data', () => {
    const data = Array(20).fill(50)
    const { best, results } = autoSelectMethod(data, 3)
    expect(results.length).toBeGreaterThanOrEqual(4)
    expect(best.forecast).toHaveLength(3)
  })

  it('handles very short data (3 points)', () => {
    const data = [10, 20, 30]
    const { best } = autoSelectMethod(data, 2)
    expect(best.forecast).toHaveLength(2)
  })
})

// ─── 10. Evaluate All Methods ──────────────────────────────────────

describe('evaluateAllMethods', () => {
  it('returns all methods sorted by MAPE', () => {
    const data = Array.from({ length: 30 }, (_, i) => 10 + i)
    const results = evaluateAllMethods(data, 5)
    expect(results.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].mape).toBeLessThanOrEqual(results[i].mape + 0.01)
    }
  })

  it('includes seasonal methods when data is long enough', () => {
    const data = Array.from({ length: 60 }, (_, i) => 10 + (i % 7) * 5)
    const results = evaluateAllMethods(data, 7)
    const methods = results.map(r => r.method)
    expect(methods.some(m => m.includes('seasonal'))).toBe(true)
    expect(methods.some(m => m.includes('holt_winters'))).toBe(true)
  })
})

// ─── 11. Helper Functions ──────────────────────────────────────────

describe('detectBestPeriod', () => {
  it('returns 7 for weekly seasonal data', () => {
    const data: number[] = []
    for (let w = 0; w < 8; w++) {
      for (let d = 0; d < 7; d++) {
        data.push(d < 5 ? 10 : 30)
      }
    }
    const period = detectBestPeriod(data, 30)
    expect([7, 14]).toContain(period)
  })

  it('returns default for insufficient data', () => {
    const period = detectBestPeriod([1, 2, 3], 30)
    expect(period).toBeGreaterThan(0)
  })
})

describe('classifyPattern', () => {
  it('classifies high-strength weekly pattern', () => {
    expect(classifyPattern(7, 0.8)).toBe('weekly')
  })

  it('classifies low strength as none', () => {
    expect(classifyPattern(7, 0.1)).toBe('none')
  })

  it('classifies daily pattern', () => {
    expect(classifyPattern(1, 0.5)).toBe('daily')
  })

  it('classifies monthly pattern', () => {
    expect(classifyPattern(30, 0.5)).toBe('monthly')
  })

  it('classifies quarterly pattern', () => {
    expect(classifyPattern(90, 0.5)).toBe('quarterly')
  })
})

// ─── 12. DemandForecaster (mocked repo) ────────────────────────────

describe('DemandForecaster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset getLatestForecast to return null (no cached forecast)
    mockForecastRepo.getLatestForecast.mockResolvedValue(null)
    mockForecastRepo.insertForecast.mockResolvedValue(undefined)
    mockForecastRepo.deleteProductForecasts.mockResolvedValue(undefined)
  })

  it('forecasts with supplied historical data', async () => {
    const { demandForecaster } = await import('../forecasting/demand-forecast')

    const data = Array.from({ length: 30 }, (_, i) => 10 + (i % 7) * 2)
    const result = await demandForecaster.forecastProduct('prod-1', undefined, { periods: 5 }, data)

    expect(result.productId).toBe('prod-1')
    expect(result.forecastValues).toHaveLength(5)
    expect(result.method).toBeDefined()
    expect(result.accuracy).not.toBeNull()
    expect(result.accuracy!.mape).toBeGreaterThanOrEqual(0)
    expect(result.dataPoints).toBe(30)
    expect(result.predictionHorizon).toBe(5)
    expect(mockForecastRepo.insertForecast).toHaveBeenCalledTimes(1)
  })

  it('throws with insufficient data', async () => {
    const { demandForecaster } = await import('../forecasting/demand-forecast')
    await expect(demandForecaster.forecastProduct('prod-1', undefined, undefined, [1]))
      .rejects.toThrow('Insufficient data')
  })

  it('returns cached forecast if fresh', async () => {
    const freshForecast = {
      productId: 'prod-1',
      branchId: null,
      period: 'day' as const,
      forecastValues: [10, 11, 12],
      confidenceInterval: { upper: [12, 13, 14], lower: [8, 9, 10], confidence: 0.90 as const },
      method: 'simple_moving_average' as const,
      accuracy: { mape: 5, mase: 0.5 },
      seasonality: null,
      predictionHorizon: 3,
      dataPoints: 10,
      computedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }
    mockForecastRepo.getLatestForecast.mockResolvedValue(freshForecast)

    const { demandForecaster } = await import('../forecasting/demand-forecast')
    const result = await demandForecaster.getForecastOrCompute('prod-1')
    expect(result.forecastValues).toEqual([10, 11, 12])
  })

  it('invalidates forecasts', async () => {
    mockForecastRepo.deleteProductForecasts.mockResolvedValue(undefined)

    const { demandForecaster } = await import('../forecasting/demand-forecast')
    await demandForecaster.invalidateForecast('prod-1')
    expect(mockForecastRepo.deleteProductForecasts).toHaveBeenCalledWith('prod-1', undefined)
  })
})

// ─── 13. SeasonalityDetector (mocked repo) ─────────────────────────

describe('SeasonalityDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockForecastRepo.upsertSeasonality.mockResolvedValue(undefined)
    mockForecastRepo.getSeasonality.mockResolvedValue(null)
  })

  it('detects seasonality with supplied data', async () => {
    const { seasonalityDetector } = await import('../forecasting/seasonality')

    const data: number[] = []
    for (let w = 0; w < 6; w++) {
      for (let d = 0; d < 7; d++) {
        data.push(d < 5 ? 10 : 30)
      }
    }

    const result = await seasonalityDetector.detectSeasonality('prod-1', undefined, data)
    expect(result.productId).toBe('prod-1')
    expect(result.pattern).toBe('weekly')
    expect(result.strength).toBeGreaterThan(0.2)
    expect(result.period).toBeGreaterThanOrEqual(7)
    expect(result.factors.length).toBeGreaterThan(0)
  })

  it('returns none for flat data', async () => {
    const { seasonalityDetector } = await import('../forecasting/seasonality')
    const data = Array(30).fill(50)
    const result = await seasonalityDetector.detectSeasonality('prod-2', undefined, data)
    expect(result.productId).toBe('prod-2')
    expect(result.strength).toBeGreaterThanOrEqual(0)
  })

  it('returns none for short data (<4 points)', async () => {
    const { seasonalityDetector } = await import('../forecasting/seasonality')
    const result = await seasonalityDetector.detectSeasonality('prod-3', undefined, [10, 20, 30])
    expect(result.pattern).toBe('none')
    expect(result.strength).toBe(0)
    expect(result.confidence).toBe(0)
  })

  it('wraps holtWinters', async () => {
    const { seasonalityDetector } = await import('../forecasting/seasonality')
    const data = Array.from({ length: 14 }, (_, i) => 10 + (i % 7) * 3)
    const forecast = await seasonalityDetector.holtWinters(data, 0.3, 0.1, 0.1, 7, 5)
    expect(forecast).toHaveLength(5)
    expect(forecast.every((v: number) => v > 0)).toBe(true)
  })
})

// ─── 14. RevenueForecaster (mocked repo) ───────────────────────────

describe('RevenueForecaster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockForecastRepo.insertRevenueForecast.mockResolvedValue(undefined)
    mockForecastRepo.getLatestRevenueForecast.mockResolvedValue(null)
    mockForecastRepo.deleteStaleRevenueForecasts.mockResolvedValue(0)
  })

  it('forecasts revenue with supplied data', async () => {
    const { revenueForecaster } = await import('../forecasting/revenue-forecast')

    const revenue = Array.from({ length: 30 }, (_, i) => 1000 + i * 50)
    const result = await revenueForecaster.forecastRevenue(undefined, { periods: 10 }, revenue)

    expect(result.forecastValues).toHaveLength(10)
    expect(result.method).toBeDefined()
    expect(result.projectedTotal).toBeGreaterThan(0)
    expect(result.currentPeriodTotal).toBeGreaterThan(0)
    expect(result.dataPoints).toBe(30)
    expect(result.predictionHorizon).toBe(10)
    expect(mockForecastRepo.insertRevenueForecast).toHaveBeenCalledTimes(1)
  })

  it('throws with insufficient data', async () => {
    const { revenueForecaster } = await import('../forecasting/revenue-forecast')
    await expect(revenueForecaster.forecastRevenue(undefined, undefined, [100]))
      .rejects.toThrow('Insufficient')
  })

  it('returns cached forecast if fresh', async () => {
    const freshForecast = {
      branchId: null,
      period: 'day' as const,
      forecastValues: [5000, 5200, 5400],
      confidenceInterval: { upper: [5500, 5700, 5900], lower: [4500, 4700, 4900], confidence: 0.90 as const },
      method: 'linear_regression' as const,
      accuracy: { mape: 3.5, mase: 0.8 },
      seasonality: null,
      projectedTotal: 15600,
      currentPeriodTotal: 15000,
      growthRate: 4.0,
      predictionHorizon: 3,
      dataPoints: 30,
      computedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    }
    mockForecastRepo.getLatestRevenueForecast.mockResolvedValue(freshForecast)

    const { revenueForecaster } = await import('../forecasting/revenue-forecast')
    const result = await revenueForecaster.getForecastOrCompute()
    expect(result.forecastValues).toEqual([5000, 5200, 5400])
  })
})

// ─── 15. Edge Cases ────────────────────────────────────────────────

describe('Forecasting edge cases', () => {
  it('SMA handles all identical values', () => {
    const data = Array(20).fill(50)
    const result = simpleMovingAverage(data, 5, 3)
    expect(result.forecast).toEqual([50, 50, 50])
    expect(result.mape).toBe(0)
  })

  it('exponential smoothing handles sudden spike', () => {
    const data = [10, 10, 10, 100, 10, 10, 10]
    const result = exponentialSmoothing(data, 0.3, 2)
    expect(result.forecast).toHaveLength(2)
    // Spike is dampened by smoothing
    expect(result.fitted[3]).toBeGreaterThan(10)
  })

  it('linear regression handles negative values', () => {
    const data = [100, 80, 60, 40, 20]
    const result = linearRegression(data, 2)
    expect(result.forecast[0]).toBeLessThan(20)
    expect(result.forecast[1]).toBeLessThan(result.forecast[0])
  })

  it('auto-select works with small datasets', () => {
    const data = [10, 20, 30, 40, 50, 60, 70]
    const { best } = autoSelectMethod(data, 3, { window: 3, alpha: 0.3, beta: 0.1, gamma: 0.1, seasonLength: 3 })
    expect(best.forecast).toHaveLength(3)
  })

  it('seasonal decomposition handles zero values', () => {
    const data = [0, 10, 0, 10, 0, 10, 0, 10, 0, 10, 0, 10, 0, 10]
    const result = seasonalDecomposition(data, 2)
    expect(result.factors).toHaveLength(2)
    expect(result.strength).toBeGreaterThanOrEqual(0)
  })

  it('holt-winters handles increasing trend with seasonality', () => {
    const data: number[] = []
    for (let w = 0; w < 6; w++) {
      for (let d = 0; d < 7; d++) {
        data.push(10 + w * 5 + (d < 5 ? 0 : 15))
      }
    }
    const result = holtWinters(data, 0.3, 0.1, 0.1, 7, 7)
    expect(result.forecast).toHaveLength(7)
    // With upward trend, last forecast should be higher than first
    expect(result.forecast[result.forecast.length - 1]).toBeGreaterThan(result.forecast[0])
  })
})

// ─── 16. No-throw verification (stubs are dead) ────────────────────

describe('Stub replacement verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockForecastRepo.insertForecast.mockResolvedValue(undefined)
    mockForecastRepo.insertRevenueForecast.mockResolvedValue(undefined)
    mockForecastRepo.upsertSeasonality.mockResolvedValue(undefined)
  })

  it('DemandForecaster no longer throws', async () => {
    const { demandForecaster } = await import('../forecasting/demand-forecast')
    const data = Array.from({ length: 10 }, (_, i) => i + 1)
    await expect(demandForecaster.forecastProduct('test-id', undefined, { periods: 3 }, data))
      .resolves.toBeDefined()
  })

  it('RevenueForecaster no longer throws', async () => {
    const { revenueForecaster } = await import('../forecasting/revenue-forecast')
    const data = Array.from({ length: 20 }, (_, i) => 1000 + i * 100)
    await expect(revenueForecaster.forecastRevenue(undefined, { periods: 5 }, data))
      .resolves.toBeDefined()
  })

  it('SeasonalityDetector no longer throws', async () => {
    const { seasonalityDetector } = await import('../forecasting/seasonality')
    const data = Array.from({ length: 28 }, (_, i) => 10 + (i % 7) * 3)
    await expect(seasonalityDetector.detectSeasonality('test-id', undefined, data))
      .resolves.toBeDefined()
  })
})
