/**
 * Trend Analyzer — Trend direction analysis engine.
 *
 * Analyzes time-series data to identify upward, downward, or stable trends.
 * Uses linear regression slope and R² significance testing.
 *
 * Consumes:
 * - KPI snapshots (for KPI trends)
 * - Product forecasts (for product sales trends)
 * - Revenue forecasts (for revenue trends)
 *
 * Sprint 11E: Full implementation replacing Sprint 11A stub.
 *
 * @see ../types.ts (TrendAnalysis)
 * @see ../forecasting/math.ts (linearRegression, computeConfidenceIntervals)
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { kpiTracker } from '../kpi'
import { linearRegression } from '../forecasting/math'
import type { TrendAnalysis, KPIId } from '../types'

// ─── Constants ──────────────────────────────────────────────────

/** Minimum data points for trend analysis */
const MIN_DATA_POINTS = 3

/** R² threshold for significance: above this is considered significant */
const R2_SIGNIFICANCE_THRESHOLD = 0.3

/** Coefficient of Variation threshold for 'volatile' classification */
const VOLATILE_CV_THRESHOLD = 0.5

/** Slope threshold (normalized by mean) for considering a trend non-flat */
const SLOPE_SENSITIVITY = 0.01

/** Maximum periods to pull from KPI snapshots */
const MAX_SNAPSHOT_PERIODS = 90

// ─── Pure Math Helpers (testable without mocking) ───────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const sqDiffs = values.map(v => (v - m) ** 2)
  return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / (values.length - 1))
}

/**
 * Compute the coefficient of variation (CV) = stddev / mean.
 * Measures relative variability; high CV indicates volatile data.
 */
export function computeCV(values: number[]): number {
  const m = mean(values)
  if (m === 0) return 0
  return stddev(values) / m
}

/**
 * Classify trend direction from linear regression slope and data variability.
 */
export function classifyDirection(
  slope: number,
  normalizedSlope: number,
  cv: number,
): TrendAnalysis['direction'] {
  if (cv >= VOLATILE_CV_THRESHOLD) return 'volatile'
  if (normalizedSlope > SLOPE_SENSITIVITY) return 'up'
  if (normalizedSlope < -SLOPE_SENSITIVITY) return 'down'
  return 'stable'
}

/**
 * Determine significance based on R² and data quality.
 */
export function classifySignificance(
  r2: number,
  dataPoints: number,
  changePct: number,
): TrendAnalysis['significance'] {
  if (dataPoints >= 20 && r2 >= 0.7 && Math.abs(changePct) >= 20) return 'high'
  if (dataPoints >= 10 && r2 >= R2_SIGNIFICANCE_THRESHOLD && Math.abs(changePct) >= 10) return 'medium'
  return 'low'
}

/**
 * Compute the percentage change between first and last value.
 */
export function computeChangePct(values: number[]): number {
  if (values.length < 2) return 0
  const first = values[0]
  const last = values[values.length - 1]
  if (first === 0) return last === 0 ? 0 : 100
  return ((last - first) / Math.abs(first)) * 100
}

/**
 * Run linear regression on time-series data and extract trend parameters.
 * Returns slope, R², and the fitted regression line.
 */
export function analyzeTrendPure(data: number[]): {
  slope: number
  r2: number
  fitted: number[]
  normalizedSlope: number
} {
  if (data.length < 2) {
    return { slope: 0, r2: 0, fitted: data, normalizedSlope: 0 }
  }

  const result = linearRegression(data, 1)
  const m = mean(data)

  // Extract slope from the regression (fitted[-1] - fitted[-2] for linear)
  const n = result.fitted.length
  const slope = n >= 2 ? result.fitted[n - 1] - result.fitted[n - 2] : 0

  // R²: 1 - SSres / SStot
  const residuals = data.map((v, i) => v - result.fitted[i])
  const ssRes = residuals.reduce((s, r) => s + r * r, 0)
  const ssTot = data.reduce((s, v) => s + (v - m) ** 2, 0)
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0

  return {
    slope,
    r2,
    fitted: result.fitted,
    normalizedSlope: m !== 0 ? slope / Math.abs(m) : slope,
  }
}

// ─── Trend Analyzer ─────────────────────────────────────────────

export class TrendAnalyzer {
  /**
   * Analyze trend for a specific metric entity.
   *
   * @param entityType — type of entity (product, customer, kpi, revenue)
   * @param entityId — entity identifier
   * @param metric — metric name being analyzed
   * @param period — analysis window (7d, 30d, 90d)
   */
  async analyzeMetric(
    entityType: TrendAnalysis['entityType'],
    entityId: string,
    metric: string,
    period: TrendAnalysis['period'] = '30d',
  ): Promise<TrendAnalysis> {
    try {
      const values = await this.fetchTimeSeries(entityType, entityId, metric, period)

      if (values.length < MIN_DATA_POINTS) {
        return {
          entityType,
          entityId,
          entityName: entityId,
          metric,
          direction: 'stable',
          changePct: 0,
          period,
          significance: 'low',
          description: `Not enough data points (${values.length}) for trend analysis. Minimum ${MIN_DATA_POINTS} required.`,
          analyzedAt: new Date().toISOString(),
        }
      }

      const { slope, r2, normalizedSlope } = analyzeTrendPure(values)
      const cv = computeCV(values)
      const changePct = computeChangePct(values)
      const direction = classifyDirection(slope, normalizedSlope, cv)
      const significance = classifySignificance(r2, values.length, changePct)

      const entityName = await this.resolveEntityName(entityType, entityId)

      const directionLabel = direction === 'up' ? 'upward' : direction === 'down' ? 'downward' : direction
      const significanceLabel = significance === 'high' ? 'strong' : significance === 'medium' ? 'moderate' : 'weak'

      return {
        entityType,
        entityId,
        entityName,
        metric,
        direction,
        changePct: Math.round(changePct * 100) / 100,
        period,
        significance,
        description: [
          `${entityName} ${metric} shows a ${significanceLabel} ${directionLabel} trend`,
          `(${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% over ${period}, R²=${r2.toFixed(2)})`,
        ].join(' '),
        analyzedAt: new Date().toISOString(),
      }
    } catch (error) {
      logger.error('[TrendAnalyzer] analyzeMetric failed', { entityType, entityId, metric, error })
      return {
        entityType,
        entityId,
        entityName: entityId,
        metric,
        direction: 'stable',
        changePct: 0,
        period,
        significance: 'low',
        description: 'Trend analysis error — unable to compute trend.',
        analyzedAt: new Date().toISOString(),
      }
    }
  }

  /**
   * Analyze all tracked metrics for trends.
   * Runs trend analysis on all KPI definitions + latest product/revenue forecasts.
   */
  async analyzeAll(branchId?: string): Promise<TrendAnalysis[]> {
    try {
      const results: TrendAnalysis[] = []

      // 1. KPI trends — analyze each KPI
      const definitions = kpiTracker.getDefinitions()
      const kpiTrends = await Promise.allSettled(
        definitions.map(def =>
          this.analyzeKPI(def.id, branchId),
        ),
      )

      for (const result of kpiTrends) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value)
        }
      }

      // 2. Revenue trend
      try {
        const revenueTrend = await this.analyzeRevenue(branchId)
        if (revenueTrend) results.push(revenueTrend)
      } catch (revErr) {
        logger.warn('[TrendAnalyzer] Revenue trend analysis failed', { error: revErr })
      }

      return results
    } catch (error) {
      logger.error('[TrendAnalyzer] analyzeAll failed', { error })
      return []
    }
  }

  // ─── Private: Domain-specific analyzers ───────────────────────

  /**
   * Analyze a specific KPI's trend over the 30d period.
   */
  private async analyzeKPI(kpiId: KPIId, branchId?: string): Promise<TrendAnalysis | null> {
    const def = kpiTracker.getDefinition(kpiId)
    if (!def) return null

    const trend = await this.analyzeMetric('kpi', kpiId, def.name, '30d')

    // Override entityName with proper KPI name
    return {
      ...trend,
      entityName: def.name,
      entityId: kpiId,
    }
  }

  /**
   * Analyze revenue trend from revenue forecasts.
   */
  private async analyzeRevenue(branchId?: string): Promise<TrendAnalysis | null> {
    const values = await this.fetchRevenueTimeSeries(branchId)
    if (values.length < MIN_DATA_POINTS) return null

    const { slope, r2, normalizedSlope } = analyzeTrendPure(values)
    const cv = computeCV(values)
    const changePct = computeChangePct(values)
    const direction = classifyDirection(slope, normalizedSlope, cv)
    const significance = classifySignificance(r2, values.length, changePct)

    const directionLabel = direction === 'up' ? 'upward' : direction === 'down' ? 'downward' : direction
    const significanceLabel = significance === 'high' ? 'strong' : significance === 'medium' ? 'moderate' : 'weak'

    return {
      entityType: 'revenue',
      entityId: branchId ?? 'all',
      entityName: 'Revenue',
      metric: 'revenue',
      direction,
      changePct: Math.round(changePct * 100) / 100,
      period: '30d',
      significance,
      description: [
        `Revenue shows a ${significanceLabel} ${directionLabel} trend`,
        `(${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% over 30d, R²=${r2.toFixed(2)})`,
      ].join(' '),
      analyzedAt: new Date().toISOString(),
    }
  }

  // ─── Private: Data fetching ───────────────────────────────────

  /**
   * Fetch time-series values for a given entity type and metric.
   */
  private async fetchTimeSeries(
    entityType: TrendAnalysis['entityType'],
    entityId: string,
    metric: string,
    period: TrendAnalysis['period'],
  ): Promise<number[]> {
    const daysMap: Record<TrendAnalysis['period'], number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    }
    const days = daysMap[period] ?? 30
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    switch (entityType) {
      case 'kpi':
        return this.fetchKPITimeSeries(entityId as KPIId, since)
      case 'revenue':
        return this.fetchRevenueTimeSeries(undefined, since)
      default:
        // For product/customer trends, fall back to KPI or empty
        logger.debug('[TrendAnalyzer] Unsupported entity type for direct time-series fetch', { entityType })
        return []
    }
  }

  /**
   * Fetch KPI snapshot values over time.
   */
  private async fetchKPITimeSeries(kpiId: KPIId, since: string): Promise<number[]> {
    const { data } = await supabaseAdmin
      .from('kpi_snapshots')
      .select('value')
      .eq('kpi_id', kpiId)
      .gte('computed_at', since)
      .order('computed_at', { ascending: true })
      .limit(MAX_SNAPSHOT_PERIODS)

    if (!data || data.length === 0) return []
    return (data as Array<{ value: number }>).map(r => r.value)
  }

  /**
   * Fetch revenue time-series from revenue_forecasts table.
   */
  private async fetchRevenueTimeSeries(
    branchId?: string,
    since?: string,
  ): Promise<number[]> {
    let query = supabaseAdmin
      .from('revenue_forecasts')
      .select('projected_total, computed_at')
      .order('computed_at', { ascending: true })
      .limit(MAX_SNAPSHOT_PERIODS)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }
    if (since) {
      query = query.gte('computed_at', since)
    }

    const { data } = await query
    if (!data || data.length === 0) return []
    return (data as Array<{ projected_total: number }>).map(r => r.projected_total)
  }

  /**
   * Resolve entity name from entity type and ID.
   */
  private async resolveEntityName(
    entityType: TrendAnalysis['entityType'],
    entityId: string,
  ): Promise<string> {
    try {
      switch (entityType) {
        case 'kpi': {
          const def = kpiTracker.getDefinition(entityId as KPIId)
          return def?.name ?? entityId
        }
        case 'revenue':
          return 'Revenue'
        case 'product': {
          const { data } = await supabaseAdmin
            .from('products')
            .select('name')
            .eq('id', entityId)
            .single()
          return (data as { name: string } | null)?.name ?? entityId
        }
        default:
          return entityId
      }
    } catch {
      return entityId
    }
  }
}

export const trendAnalyzer = new TrendAnalyzer()
