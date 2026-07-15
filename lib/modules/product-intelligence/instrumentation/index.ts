/**
 * Performance Instrumentation — Timers, metrics, and measurement utilities.
 *
 * Provides lightweight timing decorators and metric accumulators for
 * measuring query latency, forecast duration, recommendation duration,
 * and cache hit ratio across the Product Intelligence subsystem.
 *
 * Sprint 11F — Production Hardening.
 *
 * Design:
 * - No external dependencies — pure math + Date.now()
 * - Afterthought-safe: wraps existing functions without modifying them
 * - Aggregated histograms with mean/p50/p95/p99/max
 * - Cache hit ratio tracking
 */

import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────

export interface TimerResult {
  label: string
  durationMs: number
  success: boolean
  metadata?: Record<string, unknown>
}

export interface Histogram {
  label: string
  count: number
  sum: number
  mean: number
  p50: number
  p95: number
  p99: number
  min: number
  max: number
}

export interface CacheMetrics {
  label: string
  hits: number
  misses: number
  hitRatio: number
}

export interface PerformanceReport {
  histograms: Histogram[]
  cacheMetrics: CacheMetrics[]
  totalOperations: number
  totalDurationMs: number
  since: string
}

// ─── Histogram Accumulator ─────────────────────────────────────

class HistogramAccumulator {
  private readonly buckets = new Map<string, number[]>()

  /** Record a duration for a labelled operation. */
  record(label: string, durationMs: number): void {
    const existing = this.buckets.get(label)
    if (existing) {
      existing.push(durationMs)
    } else {
      this.buckets.set(label, [durationMs])
    }
  }

  /** Compute histogram stats for a label. */
  getHistogram(label: string): Histogram | null {
    const values = this.buckets.get(label)
    if (!values || values.length === 0) return null

    const sorted = [...values].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      label,
      count,
      sum,
      mean: Math.round((sum / count) * 100) / 100,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      min: sorted[0],
      max: sorted[count - 1],
    }
  }

  /** Get all histograms. */
  getAllHistograms(): Histogram[] {
    const labels = [...this.buckets.keys()]
    return labels
      .map(l => this.getHistogram(l))
      .filter((h): h is Histogram => h !== null)
  }

  /** Reset all values. */
  reset(): void {
    this.buckets.clear()
  }
}

// ─── Cache Metrics Accumulator ─────────────────────────────────

class CacheMetricsAccumulator {
  private readonly stores = new Map<string, { hits: number; misses: number }>()

  /** Record a cache hit. */
  recordHit(label: string): void {
    this.getStore(label).hits++
  }

  /** Record a cache miss. */
  recordMiss(label: string): void {
    this.getStore(label).misses++
  }

  /** Get metrics for a label. */
  getMetrics(label: string): CacheMetrics | null {
    const s = this.stores.get(label)
    if (!s) return null
    const total = s.hits + s.misses
    return {
      label,
      hits: s.hits,
      misses: s.misses,
      hitRatio: total > 0 ? Math.round((s.hits / total) * 10000) / 100 : 0,
    }
  }

  /** Get all cache metrics. */
  getAllMetrics(): CacheMetrics[] {
    const labels = [...this.stores.keys()]
    return labels
      .map(l => this.getMetrics(l))
      .filter((m): m is CacheMetrics => m !== null)
  }

  /** Reset all metrics. */
  reset(): void {
    this.stores.clear()
  }

  private getStore(label: string): { hits: number; misses: number } {
    let s = this.stores.get(label)
    if (!s) {
      s = { hits: 0, misses: 0 }
      this.stores.set(label, s)
    }
    return s
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil(p * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}

// ─── Singleton Instances ─────────────────────────────────────────

export const histograms = new HistogramAccumulator()
export const cacheMetrics = new CacheMetricsAccumulator()

// ─── Timer Decorator ─────────────────────────────────────────────

/**
 * Measure the duration of an async operation and record it in the histogram.
 * Returns the original result; does NOT alter behavior.
 *
 * @example
 * const result = await timed('scoring.query', () => scoringRepository.queryProductScores(q))
 */
export async function timed<T>(label: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    histograms.record(label, duration)
    logger.debug(`[Timed] ${label}`, { durationMs: duration, ...metadata })
    return result
  } catch (error) {
    const duration = Date.now() - start
    histograms.record(label, duration)
    logger.warn(`[Timed] ${label} FAILED`, { durationMs: duration, error, ...metadata })
    throw error
  }
}

/**
 * Measure a synchronous operation.
 */
export function timedSync<T>(label: string, fn: () => T): T {
  const start = Date.now()
  try {
    const result = fn()
    const duration = Date.now() - start
    histograms.record(label, duration)
    return result
  } catch (error) {
    const duration = Date.now() - start
    histograms.record(label, duration)
    throw error
  }
}

// ─── Report Generator ────────────────────────────────────────────

/**
 * Generate a performance report snapshot.
 */
export function generatePerformanceReport(): PerformanceReport {
  const allHists = histograms.getAllHistograms()
  const totalOps = allHists.reduce((sum, h) => sum + h.count, 0)
  const totalDur = allHists.reduce((sum, h) => sum + h.sum, 0)

  return {
    histograms: allHists,
    cacheMetrics: cacheMetrics.getAllMetrics(),
    totalOperations: totalOps,
    totalDurationMs: Math.round(totalDur * 100) / 100,
    since: new Date().toISOString(),
  }
}

/**
 * Reset all accumulated metrics.
 */
export function resetMetrics(): void {
  histograms.reset()
  cacheMetrics.reset()
}
