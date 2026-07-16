/**
 * Demand Forecast — Product-level demand prediction engine.
 *
 * Methods (Sprint 11C):
 * - Simple Moving Average    (math.simpleMovingAverage)
 * - Weighted Moving Average  (math.weightedMovingAverage)
 * - Exponential Smoothing    (math.exponentialSmoothing)
 * - Linear Regression        (math.linearRegression)
 * - Seasonal Decomposition   (math.seasonalDecompositionThenForecast)
 * - Holt-Winters             (math.holtWintersThenForecast)
 *
 * Architecture:
 * - Core math is pure/stateless in math.ts
 * - This class orchestrates: fetch data → run math → pick best → persist
 * - Event-driven invalidation (no synchronous recompute on POS events)
 *
 * @see ../types.ts (ForecastResult, ForecastConfig, ForecastMethod)
 * @see math.ts (pure forecasting functions)
 */

import type { ForecastResult, ForecastConfig, ForecastQuery, ForecastMethod, ForecastPeriod } from '../types'
import { forecastRepository } from '../repositories/forecast-repository'
import { publish } from '@/lib/realtime/event-bus'
import { logger } from '@/lib/logger'
import { createForecastUpdatedEvent } from '../events'
import {
  simpleMovingAverage,
  weightedMovingAverage,
  exponentialSmoothing,
  linearRegression,
  seasonalDecompositionThenForecast,
  holtWintersThenForecast,
  autoSelectMethod,
  computeConfidenceIntervals,
  computeMAPE,
  computeMASE,
  detectBestPeriod,
  type ForecastMathResult,
} from './math'

const DEFAULT_CONFIG: ForecastConfig = {
  periods: 7,
  seasonalityPeriod: 7,
  alpha: 0.3,
  beta: 0.1,
  gamma: 0.1,
}

const FORECAST_TTL_HOURS = 24

/**
 * Demand Forecaster — predicts future product demand using statistical methods.
 */
export class DemandForecaster {
  /**
   * Forecast demand for a product.
   *
   * @param productId - Product identifier
   * @param branchId - Optional branch scope
   * @param config - Optional forecasting configuration
   * @param historicalData - Optional pre-supplied time series (for testing)
   */
  async forecastProduct(
    productId: string,
    branchId?: string,
    config?: Partial<ForecastConfig>,
    historicalData?: number[],
  ): Promise<ForecastResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config } as ForecastConfig
    const method = cfg.method

    // Step 1: Get or use historical data
    const data = historicalData ?? await this.getProductTimeSeries(productId, branchId)
    const n = data.length

    if (n < 2) {
      throw new Error(`Insufficient data for product ${productId}: need at least 2 data points, got ${n}`)
    }

    const forecastPeriods = cfg.periods
    const now = new Date()
    const expiresAt = new Date(now.getTime() + FORECAST_TTL_HOURS * 3_600_000)

    // Step 2: Detect seasonality if needed for method selection
    const bestPeriod = detectBestPeriod(data, Math.floor(n / 2))
    const effectiveSeasonLength = cfg.seasonalityPeriod ?? bestPeriod

    // Step 3: Compute forecast
    let mathResult: ForecastMathResult
    let selectedMethod: ForecastMethod

    if (method) {
      // Use specified method
      mathResult = this.runMethod(method, data, forecastPeriods, {
        window: DEFAULT_CONFIG.periods,
        alpha: cfg.alpha ?? DEFAULT_CONFIG.alpha!,
        beta: cfg.beta ?? DEFAULT_CONFIG.beta!,
        gamma: cfg.gamma ?? DEFAULT_CONFIG.gamma!,
        seasonLength: effectiveSeasonLength,
      })
      selectedMethod = method
    } else {
      // Auto-select best method
      const { best } = autoSelectMethod(data, forecastPeriods, {
        window: DEFAULT_CONFIG.periods,
        alpha: cfg.alpha ?? DEFAULT_CONFIG.alpha!,
        beta: cfg.beta ?? DEFAULT_CONFIG.beta!,
        gamma: cfg.gamma ?? DEFAULT_CONFIG.gamma!,
        seasonLength: effectiveSeasonLength,
      })
      selectedMethod = best.method as ForecastMethod
      mathResult = this.runMethod(selectedMethod, data, forecastPeriods, {
        window: DEFAULT_CONFIG.periods,
        alpha: cfg.alpha ?? DEFAULT_CONFIG.alpha!,
        beta: cfg.beta ?? DEFAULT_CONFIG.beta!,
        gamma: cfg.gamma ?? DEFAULT_CONFIG.gamma!,
        seasonLength: effectiveSeasonLength,
      })
    }

    // Step 4: Build confidence intervals at 90%
    const ci = computeConfidenceIntervals(mathResult.forecast, mathResult.residuals, 0.90)

    // Step 5: Build seasonality info if applicable
    let seasonality: ForecastResult['seasonality'] = null
    if (selectedMethod === 'seasonal_decomposition' || selectedMethod === 'holt_winters') {
      const decomp = await import('./math').then(m =>
        m.seasonalDecomposition(data, effectiveSeasonLength),
      )
      seasonality = {
        pattern: decomp.pattern,
        factors: decomp.factors,
      }
    }

    // Step 6: Determine period from data granularity
    // If we have data, infer period from length. Default to 'day'.
    const period: ForecastPeriod = n > 60 ? 'day' : n > 12 ? 'week' : 'month'

    // Step 7: Build result
    const result: ForecastResult = {
      productId,
      branchId: branchId ?? null,
      period,
      forecastValues: mathResult.forecast,
      confidenceInterval: {
        upper: ci.upper,
        lower: ci.lower,
        confidence: 0.90,
      },
      method: selectedMethod,
      accuracy: {
        mape: mathResult.mape,
        mase: mathResult.mase ?? 0,
      },
      seasonality,
      predictionHorizon: forecastPeriods,
      dataPoints: n,
      computedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    // Step 8: Persist
    await forecastRepository.insertForecast(result)

    // Step 9: Emit event
    publish(createForecastUpdatedEvent(productId, branchId ?? null, selectedMethod, result.accuracy?.mape ?? null))

    return result
  }

  /**
   * Forecast demand for all products in batch.
   */
  async forecastAllProducts(branchId?: string, batchSize?: number): Promise<ForecastResult[]> {
    void branchId, batchSize
    // For MVP: individual products are forecast on-demand via AI tools.
    // Batch forecasting requires a list of all products, which is outside PI scope.
    // Returns empty — callers should use forecastProduct individually.
    logger.info('[PI] forecastAllProducts called — batch forecasting not yet implemented')
    return []
  }

  /**
   * Recompute stale forecasts.
   */
  async recomputeStaleForecasts(branchId?: string): Promise<number> {
    const stale = await forecastRepository.getStaleForecasts(1) // 1 hour before expiry
    let count = 0
    for (const forecast of stale) {
      try {
        await this.forecastProduct(forecast.productId, forecast.branchId ?? branchId)
        count++
      } catch (err) {
        logger.error('[PI] Failed to recompute stale forecast', {
          productId: forecast.productId,
          error: err,
        })
      }
    }
    return count
  }

  /**
   * Get the latest forecast for a product (from DB).
   */
  async getForecast(productId: string, branchId?: string): Promise<ForecastResult | null> {
    return forecastRepository.getLatestForecast(productId, branchId)
  }

  /**
   * Get forecast with auto-recompute if stale.
   */
  async getForecastOrCompute(productId: string, branchId?: string, config?: Partial<ForecastConfig>): Promise<ForecastResult> {
    const cached = await forecastRepository.getLatestForecast(productId, branchId)
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached
    }
    return this.forecastProduct(productId, branchId, config)
  }

  /**
   * Query forecasts.
   */
  async queryForecasts(query: ForecastQuery): Promise<ForecastResult[]> {
    return forecastRepository.queryForecasts(query)
  }

  /**
   * Get products with stale forecasts that need recomputation.
   */
  async getStaleForecasts(): Promise<ForecastResult[]> {
    return forecastRepository.getStaleForecasts(6) // 6 hours before expiry
  }

  /**
   * Invalidate forecast for a product (e.g., after stock change).
   */
  async invalidateForecast(productId: string, branchId?: string): Promise<void> {
    await forecastRepository.deleteProductForecasts(productId, branchId)
    logger.debug('[PI] Invalidated forecast', { productId, branchId })
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  /**
   * Run a specific forecasting method with parameters.
   */
  private runMethod(
    method: ForecastMethod,
    data: number[],
    forecastPeriods: number,
    params: { window: number; alpha: number; beta: number; gamma: number; seasonLength: number },
  ): ForecastMathResult {
    switch (method) {
      case 'simple_moving_average':
        return simpleMovingAverage(data, params.window, forecastPeriods)
      case 'weighted_moving_average':
        return weightedMovingAverage(data, params.window, forecastPeriods)
      case 'exponential_smoothing':
        return exponentialSmoothing(data, params.alpha, forecastPeriods)
      case 'linear_regression':
        return linearRegression(data, forecastPeriods)
      case 'seasonal_decomposition':
        return seasonalDecompositionThenForecast(data, params.seasonLength, forecastPeriods)
      case 'holt_winters':
        return holtWintersThenForecast(data, params.alpha, params.beta, params.gamma, params.seasonLength, forecastPeriods)
      default:
        return simpleMovingAverage(data, params.window, forecastPeriods)
    }
  }

  /**
   * Get product time series from analytics services.
   * Uses getSalesTrend for daily pattern and getProductPerformance for product share.
   */
  private async getProductTimeSeries(productId: string, branchId?: string): Promise<number[]> {
    try {
      const { salesAnalyticsService } = await import('@/lib/analytics/sales-analytics')
      const endDate = new Date().toISOString()
      const startDate = new Date(Date.now() - 90 * 86_400_000).toISOString()

      const [trend, perf] = await Promise.all([
        salesAnalyticsService.getSalesTrend(startDate, endDate),
        salesAnalyticsService.getProductPerformance(startDate, endDate, 10000),
      ])

      if (!trend || trend.length === 0) return []

      const productData = perf?.find((p: { productId: string }) => p.productId === productId)
      if (!productData) return []

      const totalTransactions = trend.reduce((sum: number, d: { transactions: number }) => sum + d.transactions, 0)
      if (totalTransactions === 0) return []

      // Estimate daily product sales proportional to daily transaction share
      const share = (productData as { totalSold: number }).totalSold / totalTransactions
      return trend.map((d: { transactions: number }) => Math.round(d.transactions * share))
    } catch (err) {
      logger.warn('[PI] Failed to get product time series from analytics', { productId, error: err })
      return []
    }
  }
}

export const demandForecaster = new DemandForecaster()
