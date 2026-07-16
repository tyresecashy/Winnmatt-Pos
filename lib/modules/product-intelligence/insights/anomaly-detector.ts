/**
 * Anomaly Detector — Statistical anomaly detection engine.
 *
 * Detects unusual patterns in sales, inventory, and KPI data using
 * Z-score and IQR-based methods.
 *
 * Dependencies:
 * - forecastRepository (accuracy logs: actual vs predicted)
 * - kpiTracker (KPI snapshots for baseline comparison)
 * - salesAnalyticsService (sales trend data)
 *
 * Sprint 11E: Full implementation replacing Sprint 11A stub.
 *
 * @see ../types.ts (Anomaly)
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { forecastRepository } from '../repositories/forecast-repository'
import { kpiTracker } from '../kpi'
import { createAnomalyDetectedEvent } from '../events'
import type { Anomaly, KPIId } from '../types'

// PI tables not in auto-generated Supabase types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const piDb = supabaseAdmin as any

// ─── Constants ──────────────────────────────────────────────────

/** Z-score threshold for flagging an anomaly */
const ZSCORE_THRESHOLD = 3

/** IQR multiplier for outlier detection */
const IQR_MULTIPLIER = 1.5

/** Minimum data points needed for statistical methods */
const MIN_DATA_POINTS = 5

/** How many days back to look for recent anomalies */
const RECENT_DAYS = 30

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
 * Compute Z-scores for each value in the array.
 * Returns array of z-score deviations.
 */
export function computeZScores(values: number[]): number[] {
  const m = mean(values)
  const sd = stddev(values)
  if (sd === 0) return values.map(() => 0)
  return values.map(v => (v - m) / sd)
}

/**
 * Compute IQR bounds.
 * Returns [lowerBound, upperBound].
 */
export function computeIQRBounds(values: number[], multiplier = IQR_MULTIPLIER): [number, number] {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return [0, 0]

  const q1 = sorted[Math.floor(n * 0.25)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1
  return [q1 - multiplier * iqr, q3 + multiplier * iqr]
}

/**
 * Classify deviation severity based on z-score magnitude.
 */
export function classifySeverity(deviation: number): Anomaly['severity'] {
  const absDev = Math.abs(deviation)
  if (absDev >= 5) return 'critical'
  if (absDev >= 4) return 'high'
  if (absDev >= 3) return 'medium'
  return 'low'
}

/**
 * Classify direction of anomaly based on actual vs expected.
 */
export function classifyDirection(
  actual: number,
  expected: number,
  deviation: number,
): Anomaly['direction'] {
  if (Math.abs(deviation) < ZSCORE_THRESHOLD) return 'unusual'
  return actual > expected ? 'spike' : 'drop'
}

// ─── Anomaly Detector ───────────────────────────────────────────

export class AnomalyDetector {
  /**
   * Detect anomalies in recent sales data by comparing actual vs forecast residuals.
   * Uses forecast accuracy log (actual vs predicted) to find large deviations.
   */
  async detectSalesAnomalies(branchId?: string): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = []

      // Fetch recent forecast accuracy logs
      const accuracyLogs = await forecastRepository.queryAccuracyLogs(undefined, undefined, 200)

      // Compute total residuals across all log entries
      const residuals: number[] = []
      for (const log of accuracyLogs) {
        for (let i = 0; i < log.actualValues.length && i < log.predictedValues.length; i++) {
          residuals.push(log.actualValues[i] - log.predictedValues[i])
        }
      }

      if (residuals.length < MIN_DATA_POINTS) {
        logger.debug('[AnomalyDetector] Not enough residual data points for sales anomaly detection', {
          logs: accuracyLogs.length,
          residuals: residuals.length,
        })
        return []
      }

      // Compute Z-scores for residuals
      const residualZScores = computeZScores(residuals)

      // Find anomalies where residual Z-score exceeds threshold
      let residualIdx = 0
      for (const log of accuracyLogs) {
        for (let i = 0; i < log.actualValues.length && i < log.predictedValues.length; i++) {
          const z = residualZScores[residualIdx]
          if (Math.abs(z) >= ZSCORE_THRESHOLD) {
            const actual = log.actualValues[i]
            const expected = log.predictedValues[i]
            anomalies.push({
              entityType: 'sale',
              entityId: log.productId ?? 'unknown',
              entityName: `Product ${log.productId?.slice(0, 8) ?? 'Unknown'}`,
              metric: `${log.method}_forecast_residual`,
              expectedValue: expected,
              actualValue: actual,
              deviation: z,
              direction: classifyDirection(actual, expected, z),
              severity: classifySeverity(z),
              detectedAt: new Date().toISOString(),
              details: `Sales ${actual > expected ? 'exceeded' : 'fell short of'} forecast by ${Math.abs(actual - expected).toFixed(1)} units (${z.toFixed(2)}σ deviation)`,
            })
          }
          residualIdx++
        }
      }

      return anomalies
    } catch (error) {
      logger.error('[AnomalyDetector] detectSalesAnomalies failed', { error })
      return []
    }
  }

  /**
   * Detect anomalies in KPI snapshots.
   * Compares latest KPI values against historical mean and stddev.
   */
  async detectKPIAnomalies(branchId?: string): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = []

      // Get all KPI definitions
      const definitions = kpiTracker.getDefinitions()

      for (const def of definitions) {
        try {
          // Fetch recent snapshots for this KPI
          const snapshots = await this.getRecentKPISnapshots(def.id, branchId, 30)

          if (snapshots.length < MIN_DATA_POINTS) continue

          const values = snapshots.map(s => s.value)
          const latestValue = values[values.length - 1]
          const zScores = computeZScores(values)
          const latestZ = zScores[zScores.length - 1]

          if (Math.abs(latestZ) >= ZSCORE_THRESHOLD) {
            const historicalMean = mean(values)
            anomalies.push({
              entityType: 'kpi',
              entityId: def.id,
              entityName: def.name,
              metric: def.id,
              expectedValue: Math.round(historicalMean * 100) / 100,
              actualValue: latestValue,
              deviation: latestZ,
              direction: classifyDirection(latestValue, historicalMean, latestZ),
              severity: classifySeverity(latestZ),
              detectedAt: new Date().toISOString(),
              details: `${def.name} is at ${latestValue}${def.unit === 'currency' ? ' KES' : def.unit === 'percentage' ? '%' : ''} vs historical mean of ${Math.round(historicalMean * 100) / 100} (${latestZ.toFixed(2)}σ deviation)`,
            })
          }
        } catch (innerErr) {
          logger.warn('[AnomalyDetector] Failed to check KPI anomaly', { kpiId: def.id, error: innerErr })
        }
      }

      return anomalies
    } catch (error) {
      logger.error('[AnomalyDetector] detectKPIAnomalies failed', { error })
      return []
    }
  }

  /**
   * Detect inventory anomalies — unusually high/low stock levels or rapid changes.
   */
  async detectInventoryAnomalies(branchId?: string): Promise<Anomaly[]> {
    try {
      const anomalies: Anomaly[] = []

      // Query recent stock movements for unusually large changes
      const thirtyDaysAgo = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString()

      const { data: movements } = await piDb
        .from('stock_movements')
        .select('product_id, product_name, quantity_change, created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(500)

      if (!movements || movements.length < MIN_DATA_POINTS) return []

      // Group by product and detect large movements
      const productChanges = new Map<string, number[]>()
      const productNames = new Map<string, string>()

      for (const m of movements) {
        const pid = m.product_id
        if (!pid) continue
        const existing = productChanges.get(pid) ?? []
        existing.push(m.quantity_change ?? 0)
        productChanges.set(pid, existing)
        if (m.product_name) productNames.set(pid, m.product_name)
      }

      for (const [productId, changes] of productChanges) {
        if (changes.length < MIN_DATA_POINTS) continue

        const zScores = computeZScores(changes)
        const maxAbsZ = Math.max(...zScores.map(Math.abs))

        if (maxAbsZ >= ZSCORE_THRESHOLD) {
          const maxIdx = zScores.findIndex(z => Math.abs(z) === maxAbsZ)
          const change = changes[maxIdx]
          const productName = productNames.get(productId) ?? `Product ${productId.slice(0, 8)}`

          anomalies.push({
            entityType: 'inventory',
            entityId: productId,
            entityName: productName,
            metric: 'stock_movement',
            expectedValue: 0,
            actualValue: change,
            deviation: maxAbsZ,
            direction: change > 0 ? 'spike' : 'drop',
            severity: classifySeverity(maxAbsZ),
            detectedAt: new Date().toISOString(),
            details: `Unusual stock movement for ${productName}: ${change > 0 ? '+' : ''}${change} units (${maxAbsZ.toFixed(2)}σ deviation from mean)`,
          })
        }
      }

      return anomalies
    } catch (error) {
      logger.error('[AnomalyDetector] detectInventoryAnomalies failed', { error })
      return []
    }
  }

  /**
   * Full anomaly scan across all data domains.
   * Runs sales, KPI, and inventory anomaly detection in parallel.
   */
  async fullScan(branchId?: string): Promise<Anomaly[]> {
    try {
      logger.info('[AnomalyDetector] Starting full anomaly scan', { branchId })

      const [salesAnomalies, kpiAnomalies, inventoryAnomalies] = await Promise.all([
        this.detectSalesAnomalies(branchId),
        this.detectKPIAnomalies(branchId),
        this.detectInventoryAnomalies(branchId),
      ])

      const allAnomalies = [...salesAnomalies, ...kpiAnomalies, ...inventoryAnomalies]

      // Publish events for each anomaly (dynamic import avoids bundling ioredis on client)
      const { publish } = await import('@/lib/realtime/event-bus')
      for (const anomaly of allAnomalies) {
        try {
          publish(createAnomalyDetectedEvent(anomaly))
        } catch (pubErr) {
          logger.warn('[AnomalyDetector] Failed to publish anomaly event', { error: pubErr })
        }
      }

      logger.info('[AnomalyDetector] Full scan complete', { count: allAnomalies.length })
      return allAnomalies
    } catch (error) {
      logger.error('[AnomalyDetector] fullScan failed', { error })
      return []
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Fetch recent KPI snapshots for a specific KPI and branch.
   */
  private async getRecentKPISnapshots(
    kpiId: KPIId,
    branchId?: string,
    limit = 30,
  ): Promise<Array<{ value: number; computedAt: string }>> {
    let query = piDb
      .from('kpi_snapshots')
      .select('value, computed_at')
      .eq('kpi_id', kpiId)
      .order('computed_at', { ascending: true })
      .limit(limit)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    } else {
      query = query.is('branch_id', null)
    }

    const { data, error } = await query
    if (error) {
      logger.warn('[AnomalyDetector] Failed to fetch KPI snapshots', { kpiId, error })
      return []
    }

    return ((data ?? []) as Array<{ value: number; computed_at: string }>).map(r => ({
      value: r.value,
      computedAt: r.computed_at,
    }))
  }
}

export const anomalyDetector = new AnomalyDetector()
