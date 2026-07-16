/**
 * Forecast Repository — Data access layer for forecast tables.
 *
 * Tables: product_forecasts, revenue_forecasts, seasonality_patterns, forecast_accuracy_log
 * Sprint 11C: Full CRUD implementation.
 * Sprint 11F: Column selection optimization, cache integration, resilient wrappers.
 *
 * @see ../../types.ts (ForecastResult, RevenueForecast, ForecastQuery)
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type {
  ForecastQuery,
  ForecastResult,
  RevenueForecast,
  ForecastMethod,
  ForecastAccuracyLog,
} from '../types'
import {
  PRODUCT_FORECAST_COLUMNS,
  REVENUE_FORECAST_COLUMNS,
  SEASONALITY_COLUMNS,
  ACCURACY_LOG_COLUMNS,
} from '../db-utils'
import { piCache, forecastKey, revenueForecastKey, seasonalityKey } from '../cache'
import { PICache } from '../cache'
import { resilientCall } from '../reliability'

// Helper: Product Intelligence tables are not in auto-generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const piDb = supabaseAdmin as any

// ─── Row-to-Type Mappers ───────────────────────────────────────────

interface ProductForecastRow {
  id: string
  product_id: string
  branch_id: string | null
  period: string
  forecast_values: number[]
  confidence_interval: { upper: number[]; lower: number[]; confidence: number }
  method: string
  accuracy: { mape: number; mase: number } | null
  seasonality: { pattern: string; factors: number[] } | null
  prediction_horizon: number
  data_points: number
  computed_at: string
  expires_at: string
}

function rowToForecastResult(row: ProductForecastRow): ForecastResult {
  return {
    productId: row.product_id,
    branchId: row.branch_id,
    period: row.period as ForecastResult['period'],
    forecastValues: row.forecast_values,
    confidenceInterval: {
      upper: row.confidence_interval.upper,
      lower: row.confidence_interval.lower,
      confidence: row.confidence_interval.confidence as 0.80 | 0.90 | 0.95,
    },
    method: row.method as ForecastMethod,
    accuracy: row.accuracy,
    seasonality: row.seasonality
      ? { pattern: row.seasonality.pattern as unknown as NonNullable<ForecastResult['seasonality']>['pattern'], factors: row.seasonality.factors }
      : null,
    predictionHorizon: row.prediction_horizon,
    dataPoints: row.data_points,
    computedAt: row.computed_at,
    expiresAt: row.expires_at,
  }
}

interface RevenueForecastRow {
  id: string
  branch_id: string | null
  period: string
  forecast_values: number[]
  confidence_interval: { upper: number[]; lower: number[]; confidence: number }
  method: string
  accuracy: { mape: number; mase: number } | null
  seasonality: { pattern: string; factors: number[] } | null
  projected_total: number
  current_period_total: number
  growth_rate: number | null
  prediction_horizon: number
  data_points: number
  computed_at: string
  expires_at: string
}

function rowToRevenueForecast(row: RevenueForecastRow): RevenueForecast {
  return {
    branchId: row.branch_id,
    period: row.period as RevenueForecast['period'],
    forecastValues: row.forecast_values,
    confidenceInterval: {
      upper: row.confidence_interval.upper,
      lower: row.confidence_interval.lower,
      confidence: row.confidence_interval.confidence as 0.80 | 0.90 | 0.95,
    },
    method: row.method as ForecastMethod,
    accuracy: row.accuracy,
    seasonality: row.seasonality
      ? { pattern: row.seasonality.pattern as unknown as NonNullable<RevenueForecast['seasonality']>['pattern'], factors: row.seasonality.factors }
      : null,
    projectedTotal: row.projected_total,
    currentPeriodTotal: row.current_period_total,
    growthRate: row.growth_rate,
    predictionHorizon: row.prediction_horizon,
    dataPoints: row.data_points,
    computedAt: row.computed_at,
    expiresAt: row.expires_at,
  }
}

interface SeasonalityRow {
  id: string
  product_id: string
  branch_id: string | null
  pattern: string
  factors: number[]
  strength: number
  period: number
  confidence: number
  detected_at: string
}

interface AccuracyLogRow {
  id: string
  product_id: string | null
  branch_id: string | null
  method: string
  mape: number
  mase: number | null
  actual_values: number[]
  predicted_values: number[]
  data_points: number
  evaluated_at: string
}

function rowToAccuracyLog(row: AccuracyLogRow): ForecastAccuracyLog {
  return {
    id: row.id,
    productId: row.product_id,
    branchId: row.branch_id,
    method: row.method as ForecastMethod,
    mape: row.mape,
    mase: row.mase,
    actualValues: row.actual_values,
    predictedValues: row.predicted_values,
    dataPoints: row.data_points,
    evaluatedAt: row.evaluated_at,
  }
}

// ─── Repository ────────────────────────────────────────────────────

export class ForecastRepository {
  // ── Product Forecasts ──────────────────────────────────────────

  async insertForecast(forecast: ForecastResult): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb.from('product_forecasts').upsert(
        {
          product_id: forecast.productId,
          branch_id: forecast.branchId,
          period: forecast.period,
          forecast_values: forecast.forecastValues,
          confidence_interval: forecast.confidenceInterval,
          method: forecast.method,
          accuracy: forecast.accuracy,
          seasonality: forecast.seasonality,
          prediction_horizon: forecast.predictionHorizon,
          data_points: forecast.dataPoints,
          computed_at: forecast.computedAt,
          expires_at: forecast.expiresAt,
        },
        { onConflict: 'product_id, branch_id, method' },
      )
      if (error) throw new Error(`Failed to insert product forecast: ${error.message}`)
      // Invalidate cache
      piCache.del(forecastKey(forecast.productId, forecast.branchId ?? undefined))
      piCache.invalidateForecasts(forecast.productId)
      return null
    }, { label: 'forecast.insertForecast', timeoutMs: 5000 })
  }

  async getLatestForecast(productId: string, branchId?: string): Promise<ForecastResult | null> {
    // Check cache
    const cacheKey = forecastKey(productId, branchId)
    const cached = piCache.get<ForecastResult>(cacheKey, {
      label: 'forecast.getLatestForecast',
      ttlSeconds: PICache.TTL.FORECAST,
    })
    if (cached) return cached

    const data = await resilientCall(async () => {
      let query = piDb
        .from('product_forecasts')
        .select(PRODUCT_FORECAST_COLUMNS)
        .eq('product_id', productId)
        .order('computed_at', { ascending: false })
        .limit(1)

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data: row, error } = await query.maybeSingle()
      if (error) throw new Error(`Failed to get product forecast: ${error.message}`)
      return row
    }, { label: 'forecast.getLatestForecast', timeoutMs: 5000 })

    if (!data) return null
    const result = rowToForecastResult(data as unknown as ProductForecastRow)
    piCache.set(cacheKey, result, { ttlSeconds: PICache.TTL.FORECAST })
    return result
  }

  async queryForecasts(query: ForecastQuery): Promise<ForecastResult[]> {
    return (await resilientCall(async () => {
      let dbQuery = piDb
        .from('product_forecasts')
        .select(PRODUCT_FORECAST_COLUMNS)
        .order('computed_at', { ascending: false })

      if (query.productId) dbQuery = dbQuery.eq('product_id', query.productId)
      if (query.branchId) dbQuery = dbQuery.eq('branch_id', query.branchId)
      if (query.method) dbQuery = dbQuery.eq('method', query.method)
      if (query.computedBefore) dbQuery = dbQuery.lt('computed_at', query.computedBefore)
      if (query.limit) dbQuery = dbQuery.limit(query.limit)

      const { data, error } = await dbQuery
      if (error) throw new Error(`Failed to query forecasts: ${error.message}`)
      return (data ?? []).map((row: unknown) => rowToForecastResult(row as ProductForecastRow))
    }, { label: 'forecast.queryForecasts', timeoutMs: 10000 })) ?? []
  }

  async getStaleForecasts(hoursBeforeExpiry: number): Promise<ForecastResult[]> {
    return (await resilientCall(async () => {
      const threshold = new Date(Date.now() + hoursBeforeExpiry * 3_600_000).toISOString()
      const { data, error } = await piDb
        .from('product_forecasts')
        .select(PRODUCT_FORECAST_COLUMNS)
        .lt('expires_at', threshold)
        .order('expires_at', { ascending: true })
        .limit(100)

      if (error) throw new Error(`Failed to get stale forecasts: ${error.message}`)
      return (data ?? []).map((row: unknown) => rowToForecastResult(row as ProductForecastRow))
    }, { label: 'forecast.getStaleForecasts', timeoutMs: 10000 })) ?? []
  }

  async deleteProductForecasts(productId: string, branchId?: string): Promise<void> {
    await resilientCall(async () => {
      let query = piDb
        .from('product_forecasts')
        .delete()
        .eq('product_id', productId)

      if (branchId) query = query.eq('branch_id', branchId)

      const { error } = await query
      if (error) throw new Error(`Failed to delete product forecasts: ${error.message}`)
      piCache.invalidateForecasts(productId)
      return null
    }, { label: 'forecast.deleteProductForecasts', timeoutMs: 5000 })
  }

  async pruneExpiredForecasts(): Promise<number> {
    return resilientCall(async () => {
      const { data, error } = await piDb
        .from('product_forecasts')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id')

      if (error) throw new Error(`Failed to prune expired forecasts: ${error.message}`)
      const count = data?.length ?? 0
      if (count > 0) {
        piCache.invalidateForecasts()
        logger.info('[ForecastRepo] pruned expired forecasts', { count })
      }
      return count
    }, { label: 'forecast.pruneExpiredForecasts', timeoutMs: 15000 }) ?? 0
  }

  // ── Revenue Forecasts ──────────────────────────────────────────

  async insertRevenueForecast(forecast: RevenueForecast): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb.from('revenue_forecasts').upsert(
        {
          branch_id: forecast.branchId,
          period: forecast.period,
          forecast_values: forecast.forecastValues,
          confidence_interval: forecast.confidenceInterval,
          method: forecast.method,
          accuracy: forecast.accuracy,
          seasonality: forecast.seasonality,
          projected_total: forecast.projectedTotal,
          current_period_total: forecast.currentPeriodTotal,
          growth_rate: forecast.growthRate,
          prediction_horizon: forecast.predictionHorizon,
          data_points: forecast.dataPoints,
          computed_at: forecast.computedAt,
          expires_at: forecast.expiresAt,
        },
        { onConflict: 'branch_id, method' },
      )
      if (error) throw new Error(`Failed to insert revenue forecast: ${error.message}`)
      piCache.del(revenueForecastKey(forecast.branchId ?? undefined))
      return null
    }, { label: 'forecast.insertRevenueForecast', timeoutMs: 5000 })
  }

  async getLatestRevenueForecast(branchId?: string): Promise<RevenueForecast | null> {
    const cacheKey = revenueForecastKey(branchId)
    const cached = piCache.get<RevenueForecast>(cacheKey, {
      label: 'forecast.getRevenueForecast',
      ttlSeconds: PICache.TTL.REVENUE_FORECAST,
    })
    if (cached) return cached

    const data = await resilientCall(async () => {
      let query = piDb
        .from('revenue_forecasts')
        .select(REVENUE_FORECAST_COLUMNS)
        .order('computed_at', { ascending: false })
        .limit(1)

      if (branchId) query = query.eq('branch_id', branchId)

      const { data: row, error } = await query.maybeSingle()
      if (error) throw new Error(`Failed to get revenue forecast: ${error.message}`)
      return row
    }, { label: 'forecast.getRevenueForecast', timeoutMs: 5000 })

    if (!data) return null
    const result = rowToRevenueForecast(data as unknown as RevenueForecastRow)
    piCache.set(cacheKey, result, { ttlSeconds: PICache.TTL.REVENUE_FORECAST })
    return result
  }

  async deleteStaleRevenueForecasts(): Promise<number> {
    return resilientCall(async () => {
      const { data, error } = await piDb
        .from('revenue_forecasts')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id')

      if (error) throw new Error(`Failed to prune revenue forecasts: ${error.message}`)
      const count = data?.length ?? 0
      if (count > 0) piCache.delByPrefix('revenue-forecast:')
      return count
    }, { label: 'forecast.deleteStaleRevenueForecasts', timeoutMs: 15000 }) ?? 0
  }

  // ── Seasonality Patterns ───────────────────────────────────────

  async upsertSeasonality(
    productId: string,
    branchId: string | null,
    pattern: string,
    factors: number[],
    strength: number,
    period: number,
    confidence: number,
  ): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb.from('seasonality_patterns').upsert(
        { product_id: productId, branch_id: branchId, pattern, factors, strength, period, confidence },
        { onConflict: 'product_id, branch_id' },
      )
      if (error) throw new Error(`Failed to upsert seasonality: ${error.message}`)
      piCache.del(seasonalityKey(productId, branchId ?? undefined))
      return null
    }, { label: 'forecast.upsertSeasonality', timeoutMs: 5000 })
  }

  async getSeasonality(productId: string, branchId?: string): Promise<{
    pattern: string
    factors: number[]
    strength: number
    period: number
    confidence: number
    detectedAt: string
  } | null> {
    const cacheKey = seasonalityKey(productId, branchId)
    const cached = piCache.get<{
      pattern: string; factors: number[]; strength: number;
      period: number; confidence: number; detectedAt: string
    }>(cacheKey, {
      label: 'forecast.getSeasonality',
      ttlSeconds: PICache.TTL.SEASONALITY,
    })
    if (cached) return cached

    const data = await resilientCall(async () => {
      let query = piDb
        .from('seasonality_patterns')
        .select(SEASONALITY_COLUMNS)
        .eq('product_id', productId)

      if (branchId) query = query.eq('branch_id', branchId)

      const { data: row, error } = await query.maybeSingle()
      if (error) throw new Error(`Failed to get seasonality: ${error.message}`)
      return row
    }, { label: 'forecast.getSeasonality', timeoutMs: 5000 })

    if (!data) return null
    const row = data as unknown as SeasonalityRow
    const result = {
      pattern: row.pattern,
      factors: row.factors,
      strength: row.strength,
      period: row.period,
      confidence: row.confidence,
      detectedAt: row.detected_at,
    }
    piCache.set(cacheKey, result, { ttlSeconds: PICache.TTL.SEASONALITY })
    return result
  }

  async querySeasonality(minStrength?: number, limit?: number): Promise<Array<{
    productId: string
    pattern: string
    strength: number
    period: number
  }>> {
    return (await resilientCall(async () => {
      let query = piDb
        .from('seasonality_patterns')
        .select('product_id, pattern, strength, period')
        .order('strength', { ascending: false })

      if (minStrength !== undefined) query = query.gte('strength', minStrength)
      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw new Error(`Failed to query seasonality: ${error.message}`)
      return (data ?? []).map((row: unknown) => {
        const r = row as { product_id: string; pattern: string; strength: number; period: number }
        return { productId: r.product_id, pattern: r.pattern, strength: r.strength, period: r.period }
      })
    }, { label: 'forecast.querySeasonality', timeoutMs: 10000 })) ?? []
  }

  // ── Forecast Accuracy Log ──────────────────────────────────────

  async insertAccuracyLog(log: Omit<ForecastAccuracyLog, 'id' | 'evaluatedAt'>): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb.from('forecast_accuracy_log').insert({
        product_id: log.productId,
        branch_id: log.branchId,
        method: log.method,
        mape: log.mape,
        mase: log.mase,
        actual_values: log.actualValues,
        predicted_values: log.predictedValues,
        data_points: log.dataPoints,
      })
      if (error) throw new Error(`Failed to insert accuracy log: ${error.message}`)
      return null
    }, { label: 'forecast.insertAccuracyLog', timeoutMs: 5000 })
  }

  async queryAccuracyLogs(productId?: string, method?: ForecastMethod, limit?: number): Promise<ForecastAccuracyLog[]> {
    return (await resilientCall(async () => {
      let query = piDb
        .from('forecast_accuracy_log')
        .select(ACCURACY_LOG_COLUMNS)
        .order('evaluated_at', { ascending: false })

      if (productId) query = query.eq('product_id', productId)
      if (method) query = query.eq('method', method)
      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw new Error(`Failed to query accuracy logs: ${error.message}`)
      return (data ?? []).map((row: unknown) => rowToAccuracyLog(row as AccuracyLogRow))
    }, { label: 'forecast.queryAccuracyLogs', timeoutMs: 10000 })) ?? []
  }

  async getMethodAccuracy(productId?: string): Promise<Array<{ method: string; avgMape: number; count: number }>> {
    return (await resilientCall(async () => {
      let query = piDb
        .from('forecast_accuracy_log')
        .select('method, mape')
        .order('evaluated_at', { ascending: false })

      if (productId) query = query.eq('product_id', productId)

      const { data, error } = await query
      if (error) throw new Error(`Failed to get method accuracy: ${error.message}`)
      if (!data || data.length === 0) return []

      const methodMap = new Map<string, { sum: number; count: number }>()
      for (const row of data as Array<{ method: string; mape: number }>) {
        const existing = methodMap.get(row.method) ?? { sum: 0, count: 0 }
        existing.sum += row.mape
        existing.count += 1
        methodMap.set(row.method, existing)
      }

      return Array.from(methodMap.entries())
        .map(([method, stats]) => ({
          method,
          avgMape: Math.round((stats.sum / stats.count) * 100) / 100,
          count: stats.count,
        }))
        .sort((a, b) => a.avgMape - b.avgMape)
    }, { label: 'forecast.getMethodAccuracy', timeoutMs: 10000 })) ?? []
  }
}

export const forecastRepository = new ForecastRepository()
