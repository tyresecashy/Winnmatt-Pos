/**
 * Database Utilities — Query optimization helpers for Product Intelligence.
 *
 * Provides:
 * - Column selection builders (replace `select('*')` with explicit columns)
 * - Batch operation helpers (chunked inserts/upserts)
 * - N+1 query elimination (batch fetching)
 * - Query profiling wrappers
 *
 * Sprint 11F — Production Hardening.
 *
 * Design:
 * - All helpers are optional — existing code continues to work unchanged
 * - Explicit column selection reduces payload size 3-5x vs `select('*')`
 * - Chunked batch operations prevent request timeouts on large datasets
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { timed } from './instrumentation'
import { resilientCall } from './reliability'

// ─── Constants ──────────────────────────────────────────────────

/** Default batch size for chunked operations */
export const DEFAULT_BATCH_SIZE = 50

/** Maximum batch size for Supabase upsert */
export const MAX_BATCH_SIZE = 500

// ─── Column Selectors ────────────────────────────────────────────

/**
 * Pre-defined column sets for PI tables.
 * Using explicit columns instead of `select('*')`:
 * - Reduces network payload 3-5x
 * - Makes query intent explicit
 * - Prevents accidental data leakage
 */

export const PRODUCT_SCORE_COLUMNS = `
  product_id,
  product_name,
  product_category,
  velocity_score,
  margin_score,
  stability_score,
  seasonality_score,
  composite_score,
  score_category,
  rank,
  computed_at
` as const

export const CUSTOMER_SCORE_COLUMNS = `
  customer_id,
  customer_name,
  recency_score,
  frequency_score,
  monetary_score,
  loyalty_score,
  composite_score,
  segment,
  churn_risk,
  lifetime_value,
  rank,
  computed_at
` as const

export const SUPPLIER_SCORE_COLUMNS = `
  supplier_id,
  supplier_name,
  quality_score,
  reliability_score,
  price_score,
  lead_time_score,
  composite_score,
  rank,
  computed_at
` as const

export const BUSINESS_HEALTH_COLUMNS = `
  branch_id,
  revenue_health,
  margin_health,
  inventory_health,
  customer_health,
  cash_health,
  workforce_health,
  composite_score,
  trend,
  computed_at
` as const

export const PRODUCT_FORECAST_COLUMNS = `
  id,
  product_id,
  branch_id,
  period,
  forecast_values,
  confidence_interval,
  method,
  accuracy,
  seasonality,
  prediction_horizon,
  data_points,
  computed_at,
  expires_at
` as const

export const REVENUE_FORECAST_COLUMNS = `
  id,
  branch_id,
  period,
  forecast_values,
  confidence_interval,
  method,
  accuracy,
  seasonality,
  projected_total,
  current_period_total,
  growth_rate,
  prediction_horizon,
  data_points,
  computed_at,
  expires_at
` as const

export const SEASONALITY_COLUMNS = `
  id,
  product_id,
  branch_id,
  pattern,
  factors,
  strength,
  period,
  confidence,
  detected_at
` as const

export const ACCURACY_LOG_COLUMNS = `
  id,
  product_id,
  branch_id,
  method,
  mape,
  mase,
  actual_values,
  predicted_values,
  data_points,
  evaluated_at
` as const

export const AFFINITY_COLUMNS = `
  id,
  product_a,
  product_b,
  lift,
  confidence,
  support,
  occurrences,
  branch_id,
  computed_at
` as const

export const REORDER_COLUMNS = `
  id,
  product_id,
  branch_id,
  current_stock,
  forecast_daily_demand,
  demand_stddev,
  lead_time_days,
  service_level,
  safety_stock,
  reorder_point,
  economic_order_qty,
  suggested_order_qty,
  days_until_stockout,
  urgency,
  estimated_cost,
  preferred_supplier_id,
  computed_at
` as const

// ─── Batch Operations ───────────────────────────────────────────

/**
 * Execute a batch upsert in chunks to avoid Supabase payload limits.
 * For datasets larger than MAX_BATCH_SIZE rows.
 */
export async function chunkedUpsert<T>(
  tableName: string,
  rows: T[],
  options?: {
    onConflict?: string
    chunkSize?: number
    label?: string
  },
): Promise<void> {
  if (rows.length === 0) return

  const chunkSize = Math.min(
    options?.chunkSize ?? DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
  )
  const label = options?.label ?? tableName

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await timed(`db.batch.${label}`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin as any)
        .from(tableName)
        .upsert(chunk, options?.onConflict ? { onConflict: options.onConflict } : undefined)

      if (error) {
        logger.error(`[ChunkedUpsert] ${label} chunk ${Math.floor(i / chunkSize) + 1} failed`, { error })
        throw error
      }
    }, { chunkIndex: Math.floor(i / chunkSize) + 1, totalChunks: Math.ceil(rows.length / chunkSize) })
  }

  logger.debug(`[ChunkedUpsert] ${label}: ${rows.length} rows in ${Math.ceil(rows.length / chunkSize)} chunks`)
}

/**
 * Execute a batch delete in chunks.
 */
export async function chunkedDelete(
  tableName: string,
  ids: string[],
  label?: string,
): Promise<number> {
  if (ids.length === 0) return 0

  const chunkSize = DEFAULT_BATCH_SIZE
  const name = label ?? tableName
  let totalDeleted = 0

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from(tableName)
      .delete()
      .in('id', chunk)
      .select('id')

    if (error) {
      logger.error(`[ChunkedDelete] ${name} chunk ${Math.floor(i / chunkSize) + 1} failed`, { error })
      throw error
    }
    totalDeleted += (data ?? []).length
  }

  return totalDeleted
}

// ─── N+1 Prevention ─────────────────────────────────────────────

/**
 * Batch-fetch scores for multiple products in a single query.
 * Instead of N individual `getProductScore()` calls.
 */
export async function batchFetchProductScores(productIds: string[]): Promise<Map<string, unknown>> {
  if (productIds.length === 0) return new Map()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('product_intelligence_scores')
    .select(PRODUCT_SCORE_COLUMNS)
    .in('product_id', productIds)

  if (error) {
    logger.error('[BatchFetch] batchFetchProductScores failed', { error })
    throw error
  }

  const map = new Map<string, unknown>()
  for (const row of data ?? []) {
    map.set((row as { product_id: string }).product_id, row)
  }
  return map
}

/**
 * Batch-fetch forecasts for multiple products.
 */
export async function batchFetchForecasts(productIds: string[]): Promise<Map<string, unknown[]>> {
  if (productIds.length === 0) return new Map()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('product_forecasts')
    .select(PRODUCT_FORECAST_COLUMNS)
    .in('product_id', productIds)
    .order('computed_at', { ascending: false })

  if (error) {
    logger.error('[BatchFetch] batchFetchForecasts failed', { error })
    throw error
  }

  const map = new Map<string, unknown[]>()
  for (const row of data ?? []) {
    const pid = (row as { product_id: string }).product_id
    const existing = map.get(pid) ?? []
    existing.push(row)
    map.set(pid, existing)
  }
  return map
}

// ─── Resilient Query Wrapper ────────────────────────────────────

/**
 * Execute a Supabase query with retry + timeout + profiling.
 * The standard wrapper for all PI database reads.
 */
export async function executeQuery<T>(
  buildQuery: () => Promise<{ data: T | null; error: unknown }>,
  options?: {
    label?: string
    timeoutMs?: number
  },
): Promise<T> {
  const label = options?.label ?? 'db.query'
  const timeoutMs = options?.timeoutMs ?? 15000

  const result = await resilientCall(
    async () => {
      const { data, error } = await buildQuery()
      if (error) throw error
      return data
    },
    { label, timeoutMs },
  )

  return result as T
}
