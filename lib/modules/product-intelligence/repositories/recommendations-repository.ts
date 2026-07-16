/**
 * Recommendations Repository — Full Supabase CRUD for recommendations tables.
 *
 * Tables:
 * - product_affinities: Pre-computed lift/confidence/support for product pairs
 * - reorder_suggestions: Per-product reorder recommendations with urgency
 *
 * Sprint 11D: Production implementation.
 * Sprint 11F: Column selection optimization, cache integration, resilient wrappers.
 *
 * @see supabase/migrations/20260715000006_product_recommendations.sql
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type { ProductAffinity, ReorderSuggestion, RecommendationQuery } from '../types'
import { AFFINITY_COLUMNS, REORDER_COLUMNS, chunkedUpsert } from '../db-utils'
import { piCache, affinityKey, reorderKey } from '../cache'
import { PICache } from '../cache'
import { resilientCall } from '../reliability'

// Helper: Product Intelligence tables are not in auto-generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const piDb = supabaseAdmin as any

// ─── Row Mappers ──────────────────────────────────────────────────

interface AffinityRow {
  id: string
  product_a: string
  product_b: string
  lift: number
  confidence: number
  support: number
  occurrences: number
  branch_id: string | null
  computed_at: string
}

interface ReorderRow {
  id: string
  product_id: string
  branch_id: string | null
  current_stock: number
  forecast_daily_demand: number
  demand_stddev: number
  lead_time_days: number
  service_level: number
  safety_stock: number
  reorder_point: number
  economic_order_qty: number
  suggested_order_qty: number
  days_until_stockout: number | null
  urgency: 'immediate' | 'soon' | 'normal' | 'sufficient'
  estimated_cost: number
  preferred_supplier_id: string | null
  computed_at: string
}

function mapAffinityRow(row: AffinityRow): ProductAffinity {
  return {
    productA: row.product_a,
    productB: row.product_b,
    lift: row.lift,
    confidence: row.confidence,
    support: row.support,
    occurrences: row.occurrences,
    computedAt: row.computed_at,
  }
}

function mapReorderRow(row: ReorderRow): ReorderSuggestion {
  return {
    productId: row.product_id,
    productName: '',
    currentStock: row.current_stock,
    forecastDailyDemand: row.forecast_daily_demand,
    demandStdDev: row.demand_stddev,
    leadTimeDays: row.lead_time_days,
    serviceLevel: row.service_level,
    safetyStock: row.safety_stock,
    reorderPoint: row.reorder_point,
    economicOrderQty: row.economic_order_qty,
    suggestedOrderQty: row.suggested_order_qty,
    daysUntilStockout: row.days_until_stockout ?? Infinity,
    urgency: row.urgency,
    estimatedCost: row.estimated_cost,
    preferredSupplierId: row.preferred_supplier_id,
  }
}

// ─── Repository ──────────────────────────────────────────────────

export class RecommendationsRepository {
  // ═══════════════════════════════════════════════════════════════
  // Product Affinities
  // ═══════════════════════════════════════════════════════════════

  async upsertAffinity(affinity: Omit<ProductAffinity, 'computedAt'> & { branchId?: string | null }): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb
        .from('product_affinities')
        .upsert({
          product_a: affinity.productA,
          product_b: affinity.productB,
          lift: affinity.lift,
          confidence: affinity.confidence,
          support: affinity.support,
          occurrences: affinity.occurrences,
          branch_id: affinity.branchId ?? null,
        }, {
          onConflict: 'product_a,product_b,branch_id',
          ignoreDuplicates: false,
        })

      if (error) throw error
      piCache.del(affinityKey(affinity.productA, affinity.branchId ?? undefined))
      return null
    }, { label: 'recommendations.upsertAffinity', timeoutMs: 5000 })
  }

  async insertAffinityBatch(
    affinities: Array<Omit<ProductAffinity, 'computedAt'> & { branchId?: string | null }>,
  ): Promise<void> {
    if (affinities.length === 0) return

    const rows = affinities.map(a => ({
      product_a: a.productA,
      product_b: a.productB,
      lift: a.lift,
      confidence: a.confidence,
      support: a.support,
      occurrences: a.occurrences,
      branch_id: a.branchId ?? null,
    }))

    await chunkedUpsert('product_affinities', rows, {
      onConflict: 'product_a,product_b,branch_id',
      label: 'affinities',
    })

    // Clear affinity cache since batch updated
    piCache.delByPrefix('affinity:')
  }

  async getAffinitiesForProduct(productId: string, branchId?: string, limit = 20): Promise<ProductAffinity[]> {
    const cacheKey = affinityKey(productId, branchId)
    const cached = piCache.get<ProductAffinity[]>(cacheKey, {
      label: 'recommendations.getAffinitiesForProduct',
      ttlSeconds: PICache.TTL.AFFINITIES,
    })
    if (cached) return cached

    const data = await resilientCall(async () => {
      let query = piDb
        .from('product_affinities')
        .select(AFFINITY_COLUMNS)
        .eq('product_a', productId)
        .order('lift', { ascending: false })
        .limit(limit)

      if (branchId) query = query.eq('branch_id', branchId)

      const { data: rows, error } = await query
      if (error) throw error
      return rows
    }, { label: 'recommendations.getAffinitiesForProduct', timeoutMs: 5000 })

    const result = (data as unknown as AffinityRow[] ?? []).map(mapAffinityRow)
    piCache.set(cacheKey, result, { ttlSeconds: PICache.TTL.AFFINITIES })
    return result
  }

  async getAffinitiesForProducts(productIds: string[], branchId?: string, limit = 20): Promise<ProductAffinity[]> {
    // Try cache first per-product; fall through to batch query
    const cachedAll = productIds
      .map(pid => ({ pid, cached: piCache.get<ProductAffinity[]>(affinityKey(pid, branchId)) }))
      .filter((x): x is { pid: string; cached: ProductAffinity[] } => x.cached !== null)

    if (cachedAll.length === productIds.length) {
      // All cached — merge and deduplicate
      const seen = new Set<string>()
      const merged: ProductAffinity[] = []
      for (const { cached } of cachedAll) {
        for (const aff of cached) {
          const key = `${aff.productA}:${aff.productB}`
          if (!seen.has(key)) {
            seen.add(key)
            merged.push(aff)
          }
        }
      }
      return merged.slice(0, limit)
    }

    return (await resilientCall(async () => {
      let query = piDb
        .from('product_affinities')
        .select(AFFINITY_COLUMNS)
        .in('product_a', productIds)
        .order('lift', { ascending: false })
        .limit(limit * productIds.length)

      if (branchId) query = query.eq('branch_id', branchId)

      const { data, error } = await query
      if (error) throw error
      return (data as unknown as AffinityRow[] ?? []).map(mapAffinityRow)
    }, { label: 'recommendations.getAffinitiesForProducts', timeoutMs: 10000 })) ?? []
  }

  async deleteStaleAffinities(beforeDate: string): Promise<number> {
    const count = await resilientCall(async () => {
      const { data, error } = await piDb
        .from('product_affinities')
        .delete()
        .lt('computed_at', beforeDate)
        .select('id')

      if (error) throw error
      return (data ?? []).length
    }, { label: 'recommendations.deleteStaleAffinities', timeoutMs: 15000 }) ?? 0

    if (count > 0) piCache.delByPrefix('affinity:')
    return count
  }

  async clearAffinities(branchId?: string): Promise<void> {
    await resilientCall(async () => {
      let query = piDb.from('product_affinities').delete()
      if (branchId) query = query.eq('branch_id', branchId)

      const { error } = await query
      if (error) throw error
      piCache.delByPrefix('affinity:')
      return null
    }, { label: 'recommendations.clearAffinities', timeoutMs: 30000 })
  }

  // ═══════════════════════════════════════════════════════════════
  // Reorder Suggestions
  // ═══════════════════════════════════════════════════════════════

  async upsertReorderSuggestion(
    suggestion: Omit<ReorderSuggestion, 'productName'> & { branchId?: string | null },
  ): Promise<void> {
    await resilientCall(async () => {
      const { error } = await piDb
        .from('reorder_suggestions')
        .upsert({
          product_id: suggestion.productId,
          branch_id: suggestion.branchId ?? null,
          current_stock: suggestion.currentStock,
          forecast_daily_demand: suggestion.forecastDailyDemand,
          demand_stddev: suggestion.demandStdDev,
          lead_time_days: suggestion.leadTimeDays,
          service_level: suggestion.serviceLevel,
          safety_stock: suggestion.safetyStock,
          reorder_point: suggestion.reorderPoint,
          economic_order_qty: suggestion.economicOrderQty,
          suggested_order_qty: suggestion.suggestedOrderQty,
          days_until_stockout: suggestion.daysUntilStockout === Infinity ? null : suggestion.daysUntilStockout,
          urgency: suggestion.urgency,
          estimated_cost: suggestion.estimatedCost,
          preferred_supplier_id: suggestion.preferredSupplierId ?? null,
        }, {
          onConflict: 'product_id,branch_id',
          ignoreDuplicates: false,
        })

      if (error) throw error
      piCache.del(reorderKey(suggestion.productId, suggestion.branchId ?? undefined))
      return null
    }, { label: 'recommendations.upsertReorderSuggestion', timeoutMs: 5000 })
  }

  async upsertReorderBatch(
    suggestions: Array<Omit<ReorderSuggestion, 'productName'> & { branchId?: string | null }>,
  ): Promise<void> {
    if (suggestions.length === 0) return

    const rows = suggestions.map(s => ({
      product_id: s.productId,
      branch_id: s.branchId ?? null,
      current_stock: s.currentStock,
      forecast_daily_demand: s.forecastDailyDemand,
      demand_stddev: s.demandStdDev,
      lead_time_days: s.leadTimeDays,
      service_level: s.serviceLevel,
      safety_stock: s.safetyStock,
      reorder_point: s.reorderPoint,
      economic_order_qty: s.economicOrderQty,
      suggested_order_qty: s.suggestedOrderQty,
      days_until_stockout: s.daysUntilStockout === Infinity ? null : s.daysUntilStockout,
      urgency: s.urgency,
      estimated_cost: s.estimatedCost,
      preferred_supplier_id: s.preferredSupplierId ?? null,
    }))

    await chunkedUpsert('reorder_suggestions', rows, {
      onConflict: 'product_id,branch_id',
      label: 'reorder_suggestions',
    })

    // Invalidate affected caches
    for (const s of suggestions) {
      piCache.del(reorderKey(s.productId, s.branchId ?? undefined))
    }
  }

  async getReorderSuggestions(query: RecommendationQuery): Promise<ReorderSuggestion[]> {
    return (await resilientCall(async () => {
      let dbQuery = piDb
        .from('reorder_suggestions')
        .select(REORDER_COLUMNS)
        .order('days_until_stockout', { ascending: true, nullsLast: true })

      if (query.productId) dbQuery = dbQuery.eq('product_id', query.productId)
      if (query.branchId) dbQuery = dbQuery.eq('branch_id', query.branchId)
      if (query.urgency) dbQuery = dbQuery.eq('urgency', query.urgency)
      if (query.limit) dbQuery = dbQuery.limit(query.limit)

      const { data, error } = await dbQuery
      if (error) throw error
      return (data as unknown as ReorderRow[] ?? []).map(mapReorderRow)
    }, { label: 'recommendations.getReorderSuggestions', timeoutMs: 10000 })) ?? []
  }

  async deleteResolvedReorderSuggestions(): Promise<number> {
    const count = await resilientCall(async () => {
      const { data, error } = await piDb
        .from('reorder_suggestions')
        .delete()
        .eq('urgency', 'sufficient')
        .select('id')

      if (error) throw error
      return (data ?? []).length
    }, { label: 'recommendations.deleteResolved', timeoutMs: 15000 }) ?? 0

    if (count > 0) piCache.delByPrefix('reorder:')
    return count
  }

  async deleteReorderSuggestion(productId: string, branchId?: string): Promise<void> {
    await resilientCall(async () => {
      let query = piDb.from('reorder_suggestions').delete().eq('product_id', productId)
      if (branchId) query = query.eq('branch_id', branchId)

      const { error } = await query
      if (error) throw error
      piCache.del(reorderKey(productId, branchId))
      return null
    }, { label: 'recommendations.deleteReorderSuggestion', timeoutMs: 5000 })
  }
}

export const recommendationsRepository = new RecommendationsRepository()
