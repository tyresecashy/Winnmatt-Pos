/**
 * Revenue Forecast — Revenue trend projection engine.
 *
 * Uses the same statistical methods as demand forecasting, but applied to
 * revenue time series rather than unit sales. Sources data from
 * salesAnalyticsService.getSalesTrend() (daily revenue) or
 * financialAnalyticsService.getPLTrend() (periodic P&L data).
 *
 * Sprint 11C: Full implementation with auto method selection.
 *
 * @see math.ts (pure forecasting functions)
 * @see ../types.ts (RevenueForecast, ForecastConfig)
 */

import type { RevenueForecast, ForecastConfig, ForecastMethod, ForecastPeriod } from '../types'
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
  detectBestPeriod,
  type ForecastMathResult,
} from './math'

const DEFAULT_CONFIG: ForecastConfig = {
  periods: 30,
  seasonalityPeriod: 7,
  alpha: 0.3,
  beta: 0.1,
  gamma: 0.1,
}

const FORECAST_TTL_HOURS = 24

/**
 * Revenue Forecaster — predicts future revenue using statistical methods.
 */
export class RevenueForecaster {
  /**
   * Forecast revenue for a branch.
   *
   * @param branchId - Optional branch scope
   * @param config - Optional forecasting configuration
   * @param historicalData - Optional pre-supplied revenue time series (for testing)
   */
  async forecastRevenue(
    branchId?: string,
    config?: Partial<ForecastConfig>,
    historicalData?: number[],
  ): Promise<RevenueForecast> {
    const cfg = { ...DEFAULT_CONFIG, ...config } as ForecastConfig
    const method = cfg.method

    // Step 1: Get historical revenue data
    const data = historicalData ?? await this.getRevenueTimeSeries(branchId)
    const n = data.length

    if (n < 2) {
      throw new Error(`Insufficient revenue data: need at least 2 data points, got ${n}`)
    }

    const forecastPeriods = cfg.periods
    const now = new Date()
    const expiresAt = new Date(now.getTime() + FORECAST_TTL_HOURS * 3_600_000)

    // Step 2: Detect best period for seasonal methods
    const bestPeriod = detectBestPeriod(data, Math.floor(n / 2))
    const effectiveSeasonLength = cfg.seasonalityPeriod ?? bestPeriod

    // Step 3: Compute forecast
    let mathResult: ForecastMathResult
    let selectedMethod: ForecastMethod

    if (method) {
      mathResult = this.runMethod(method, data, forecastPeriods, {
        window: DEFAULT_CONFIG.periods,
        alpha: cfg.alpha ?? DEFAULT_CONFIG.alpha!,
        beta: cfg.beta ?? DEFAULT_CONFIG.beta!,
        gamma: cfg.gamma ?? DEFAULT_CONFIG.gamma!,
        seasonLength: effectiveSeasonLength,
      })
      selectedMethod = method
    } else {
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

    // Step 5: Seasonality info if applicable
    let seasonality: RevenueForecast['seasonality'] = null
    if (selectedMethod === 'seasonal_decomposition' || selectedMethod === 'holt_winters') {
      const decomp = (await import('./math')).seasonalDecomposition(data, effectiveSeasonLength)
      seasonality = {
        pattern: decomp.pattern,
        factors: decomp.factors,
      }
    }

    // Step 6: Compute derived metrics
    const projectedTotal = Math.round(mathResult.forecast.reduce((s, v) => s + v, 0))
    const currentPeriodTotal = Math.round(data.slice(-forecastPeriods).reduce((s, v) => s + v, 0))
    const growthRate = currentPeriodTotal > 0
      ? Math.round(((projectedTotal - currentPeriodTotal) / currentPeriodTotal) * 10000) / 100
      : null

    // Step 7: Infer period
    const period: ForecastPeriod = n > 60 ? 'day' : n > 12 ? 'week' : 'month'

    const result: RevenueForecast = {
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
      projectedTotal,
      currentPeriodTotal,
      growthRate,
      predictionHorizon: forecastPeriods,
      dataPoints: n,
      computedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    // Step 8: Persist
    await forecastRepository.insertRevenueForecast(result)

    // Step 9: Emit event
    publish(createForecastUpdatedEvent('__revenue__', branchId ?? null, selectedMethod, result.accuracy?.mape ?? null))

    return result
  }

  /**
   * Get the latest revenue forecast.
   */
  async getLatestForecast(branchId?: string): Promise<RevenueForecast | null> {
    return forecastRepository.getLatestRevenueForecast(branchId)
  }

  /**
   * Get cached forecast or recompute if stale.
   */
  async getForecastOrCompute(branchId?: string, config?: Partial<ForecastConfig>): Promise<RevenueForecast> {
    const cached = await forecastRepository.getLatestRevenueForecast(branchId)
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached
    }
    return this.forecastRevenue(branchId, config)
  }

  /**
   * Recompute stale revenue forecasts.
   */
  async recomputeStaleForecasts(): Promise<number> {
    try {
      await forecastRepository.deleteStaleRevenueForecasts()
      await this.forecastRevenue()
      return 1
    } catch (err) {
      logger.error('[PI] Failed to recompute revenue forecast', { error: err })
      return 0
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────

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
   * Get revenue time series from analytics services.
   */
  private async getRevenueTimeSeries(branchId?: string): Promise<number[]> {
    try {
      if (branchId) void branchId
      // Prefer daily revenue data from sales analytics
      const { salesAnalyticsService } = await import('@/lib/analytics/sales-analytics')
      const endDate = new Date().toISOString()
      const startDate = new Date(Date.now() - 90 * 86_400_000).toISOString()

      const trend = await salesAnalyticsService.getSalesTrend(startDate, endDate)
      if (trend && trend.length > 0) {
        return (trend as Array<{ revenue: number }>).map(d => d.revenue)
      }
      return []
    } catch (err) {
      logger.warn('[PI] Failed to get revenue time series', { error: err })
      return []
    }
  }
}

export const revenueForecaster = new RevenueForecaster()
