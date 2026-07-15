/**
 * Seasonality Detector — Seasonal pattern detection engine.
 *
 * Methods (Sprint 11C):
 * - Seasonal Decomposition (ratio-to-moving-average) via math.seasonalDecomposition
 * - Holt-Winters Triple Exponential Smoothing via math.holtWinters
 * - Automated best-period detection via math.detectBestPeriod
 *
 * @see math.ts (pure math functions)
 * @see ../types.ts (SeasonalPattern)
 */

import type { SeasonalPattern } from '../types'
import { forecastRepository } from '../repositories/forecast-repository'
import { logger } from '@/lib/logger'
import {
  seasonalDecomposition,
  holtWinters,
  detectBestPeriod,
  classifyPattern,
} from './math'

export interface SeasonalityResult {
  productId: string
  pattern: SeasonalPattern
  factors: number[]
  strength: number       // 0–1, how strong the seasonal component is
  period: number         // Detected period length
  confidence: number     // 0–1
}

/**
 * Seasonality Detector — identifies seasonal patterns in time-series data.
 */
export class SeasonalityDetector {
  /**
   * Detect seasonality for a product's sales history.
   *
   * @param productId - Product identifier
   * @param branchId - Optional branch scope
   * @param historicalData - Optional pre-supplied time series (for testing)
   */
  async detectSeasonality(
    productId: string,
    branchId?: string,
    historicalData?: number[],
  ): Promise<SeasonalityResult> {
    // Get data from analytics or use supplied data
    const data = historicalData ?? await this.getProductTimeSeries(productId, branchId)
    const n = data.length

    if (n < 4) {
      return {
        productId,
        pattern: 'none',
        factors: [1],
        strength: 0,
        period: 1,
        confidence: 0,
      }
    }

    // Find best period
    const maxPeriod = Math.min(90, Math.floor(n / 2))
    const bestPeriod = detectBestPeriod(data, maxPeriod)

    // Run seasonal decomposition
    const decomp = seasonalDecomposition(data, bestPeriod)

    // Compute confidence: strength * data_adequacy
    const dataAdequacy = Math.min(1, n / (bestPeriod * 3))
    const confidence = Math.round(decomp.strength * dataAdequacy * 1000) / 1000

    const result: SeasonalityResult = {
      productId,
      pattern: decomp.pattern,
      factors: decomp.factors,
      strength: decomp.strength,
      period: bestPeriod,
      confidence,
    }

    // Persist to DB
    try {
      await forecastRepository.upsertSeasonality(
        productId,
        branchId ?? null,
        result.pattern,
        result.factors,
        result.strength,
        result.period,
        result.confidence,
      )
    } catch (err) {
      logger.warn('[PI] Failed to persist seasonality', { productId, error: err })
    }

    return result
  }

  /**
   * Detect seasonality for all products in a batch.
   */
  async detectAllProducts(branchId?: string, batchSize?: number): Promise<SeasonalityResult[]> {
    void branchId, batchSize
    logger.info('[PI] detectAllProducts called — batch seasonality detection not yet implemented')
    return []
  }

  /**
   * Apply Holt-Winters Triple Exponential Smoothing.
   * Pure math wrapper — delegates to math.holtWinters.
   */
  async holtWinters(
    values: number[],
    alpha: number,
    beta: number,
    gamma: number,
    seasonLength: number,
    forecastPeriods: number,
  ): Promise<number[]> {
    const result = holtWinters(values, alpha, beta, gamma, seasonLength, forecastPeriods)
    return result.forecast
  }

  /**
   * Get cached seasonality for a product.
   */
  async getSeasonality(productId: string, branchId?: string): Promise<SeasonalityResult | null> {
    const cached = await forecastRepository.getSeasonality(productId, branchId ?? undefined)
    if (!cached) return null
    return {
      productId,
      pattern: cached.pattern as SeasonalPattern,
      factors: cached.factors,
      strength: cached.strength,
      period: cached.period,
      confidence: cached.confidence,
    }
  }

  /**
   * Get products with strong seasonality.
   */
  async getSeasonalProducts(minStrength: number = 0.3, limit?: number): Promise<Array<{
    productId: string
    pattern: string
    strength: number
    period: number
  }>> {
    return forecastRepository.querySeasonality(minStrength, limit)
  }

  /**
   * Get product time series from analytics.
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

      const share = (productData as { totalSold: number }).totalSold / totalTransactions
      return trend.map((d: { transactions: number }) => Math.round(d.transactions * share))
    } catch (err) {
      logger.warn('[PI] Failed to get product time series from analytics', { productId, error: err })
      return []
    }
  }
}

export const seasonalityDetector = new SeasonalityDetector()
