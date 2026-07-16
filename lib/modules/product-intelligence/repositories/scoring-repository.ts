/**
 * Scoring Repository — Data access layer for product/customer/supplier/business_health scores.
 *
 * Sprint 11B: Full Supabase implementation.
 * Sprint 11F: Column selection optimization, chunked batch upserts,
 *             cache integration, resilient query wrappers.
 *
 * Tables: product_intelligence_scores, customer_intelligence_scores,
 *         supplier_intelligence_scores, business_health_scores
 *
 * @see lib/modules/product-intelligence/scoring/
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type {
  ProductScore,
  CustomerScore,
  SupplierScore,
  BusinessHealthScore,
  ScoreQuery,
} from '../types'
import {
  PRODUCT_SCORE_COLUMNS,
  CUSTOMER_SCORE_COLUMNS,
  SUPPLIER_SCORE_COLUMNS,
  BUSINESS_HEALTH_COLUMNS,
  chunkedUpsert,
} from '../db-utils'
import { piCache, scoreKey } from '../cache'
import { PICache } from '../cache'
import { resilientCall } from '../reliability'
import { timed } from '../instrumentation'

// Helper: Product Intelligence tables are not in auto-generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const piDb = supabaseAdmin as any

// ─── Row Types (DB → PI type mappers) ──────────────────────────

interface ProductScoreRow {
  product_id: string
  product_name: string
  product_category: string
  velocity_score: number
  margin_score: number
  stability_score: number
  seasonality_score: number
  composite_score: number
  score_category: string
  rank: number
  computed_at: string
}

interface CustomerScoreRow {
  customer_id: string
  customer_name: string
  recency_score: number
  frequency_score: number
  monetary_score: number
  loyalty_score: number
  composite_score: number
  segment: string
  churn_risk: number
  lifetime_value: number
  rank: number
  computed_at: string
}

interface SupplierScoreRow {
  supplier_id: string
  supplier_name: string
  quality_score: number
  reliability_score: number
  price_score: number
  lead_time_score: number
  composite_score: number
  rank: number
  computed_at: string
}

interface BusinessHealthRow {
  branch_id: string | null
  revenue_health: number
  margin_health: number
  inventory_health: number
  customer_health: number
  cash_health: number
  workforce_health: number
  composite_score: number
  trend: string
  computed_at: string
}

// ─── Mappers ────────────────────────────────────────────────────

function rowToProductScore(row: ProductScoreRow): ProductScore {
  return {
    productId: row.product_id,
    productName: row.product_name,
    productCategory: row.product_category,
    velocityScore: row.velocity_score,
    marginScore: row.margin_score,
    stabilityScore: row.stability_score,
    seasonalityScore: row.seasonality_score,
    compositeScore: row.composite_score,
    scoreCategory: row.score_category as ProductScore['scoreCategory'],
    rank: row.rank,
    computedAt: row.computed_at,
  }
}

function rowToCustomerScore(row: CustomerScoreRow): CustomerScore {
  return {
    customerId: row.customer_id,
    customerName: row.customer_name,
    recencyScore: row.recency_score,
    frequencyScore: row.frequency_score,
    monetaryScore: row.monetary_score,
    loyaltyScore: row.loyalty_score,
    compositeScore: row.composite_score,
    segment: row.segment as CustomerScore['segment'],
    churnRisk: row.churn_risk,
    lifetimeValue: row.lifetime_value,
    rank: row.rank,
    computedAt: row.computed_at,
  }
}

function rowToSupplierScore(row: SupplierScoreRow): SupplierScore {
  return {
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    qualityScore: row.quality_score,
    reliabilityScore: row.reliability_score,
    priceScore: row.price_score,
    leadTimeScore: row.lead_time_score,
    compositeScore: row.composite_score,
    rank: row.rank,
    computedAt: row.computed_at,
  }
}

function rowToBusinessHealth(row: BusinessHealthRow): BusinessHealthScore {
  return {
    revenueHealth: row.revenue_health,
    marginHealth: row.margin_health,
    inventoryHealth: row.inventory_health,
    customerHealth: row.customer_health,
    cashHealth: row.cash_health,
    workforceHealth: row.workforce_health,
    compositeScore: row.composite_score,
    trend: row.trend as BusinessHealthScore['trend'],
    computedAt: row.computed_at,
  }
}

/**
 * Scoring Repository handles CRUD for all scoring tables.
 *
 * Performance features (Sprint 11F):
 * - Explicit column selection (reduces payload 3-5x)
 * - In-memory caching with TTL-based invalidation
 * - Chunked batch upserts for large datasets
 * - Resilient wrappers with retry + timeout
 */
export class ScoringRepository {
  // ─── Product Scores ───────────────────────────────────────────

  async upsertProductScore(score: ProductScore): Promise<void> {
    await resilientCall(
      async () => {
        const { error } = await piDb
          .from('product_intelligence_scores')
          .upsert(
            {
              product_id: score.productId,
              product_name: score.productName,
              product_category: score.productCategory,
              velocity_score: score.velocityScore,
              margin_score: score.marginScore,
              stability_score: score.stabilityScore,
              seasonality_score: score.seasonalityScore,
              composite_score: score.compositeScore,
              score_category: score.scoreCategory,
              rank: score.rank,
              computed_at: score.computedAt,
            },
            { onConflict: 'product_id' },
          )
        if (error) throw error
        // Invalidate cache
        piCache.del(scoreKey('product', score.productId))
        return null
      },
      { label: 'scoring.upsertProductScore', timeoutMs: 5000 },
    )
  }

  async getProductScore(productId: string): Promise<ProductScore | null> {
    // Check cache first
    const cached = piCache.get<ProductScore>(
      scoreKey('product', productId),
      { label: 'scoring.getProductScore', ttlSeconds: PICache.TTL.PRODUCT_SCORE },
    )
    if (cached) return cached

    const data = await resilientCall(
      async () => {
        const { data: row, error } = await piDb
          .from('product_intelligence_scores')
          .select(PRODUCT_SCORE_COLUMNS)
          .eq('product_id', productId)
          .maybeSingle()
        if (error) throw error
        return row
      },
      { label: 'scoring.getProductScore', timeoutMs: 5000 },
    )

    if (!data) return null
    const score = rowToProductScore(data as unknown as ProductScoreRow)
    // Cache for next read
    piCache.set(scoreKey('product', productId), score, { ttlSeconds: PICache.TTL.PRODUCT_SCORE })
    return score
  }

  async queryProductScores(query: ScoreQuery): Promise<ProductScore[]> {
    return (await resilientCall(
      async () => {
        let q = piDb
          .from('product_intelligence_scores')
          .select(PRODUCT_SCORE_COLUMNS)
          .order('composite_score', { ascending: false })

        if (query.minScore !== undefined) q = q.gte('composite_score', query.minScore)
        if (query.maxScore !== undefined) q = q.lte('composite_score', query.maxScore)
        if (query.category) q = q.eq('score_category', query.category)
        if (query.limit !== undefined) q = q.limit(query.limit)
        if (query.offset !== undefined) q = q.range(query.offset, query.offset + (query.limit || 20) - 1)

        const { data, error } = await q
        if (error) throw error
        return ((data as unknown) as ProductScoreRow[] || []).map(rowToProductScore)
      },
      { label: 'scoring.queryProductScores', timeoutMs: 10000 },
    )) ?? []
  }

  async upsertProductScoresBatch(scores: ProductScore[]): Promise<void> {
    const rows = scores.map(s => ({
      product_id: s.productId,
      product_name: s.productName,
      product_category: s.productCategory,
      velocity_score: s.velocityScore,
      margin_score: s.marginScore,
      stability_score: s.stabilityScore,
      seasonality_score: s.seasonalityScore,
      composite_score: s.compositeScore,
      score_category: s.scoreCategory,
      rank: s.rank,
      computed_at: s.computedAt,
    }))

    await chunkedUpsert('product_intelligence_scores', rows, {
      onConflict: 'product_id',
      label: 'product_scores',
    })

    // Invalidate all product score caches
    for (const s of scores) {
      piCache.del(scoreKey('product', s.productId))
    }
  }

  async countProductScores(category?: string): Promise<number> {
    return (await resilientCall(
      async () => {
        let q = piDb
          .from('product_intelligence_scores')
          .select('id', { count: 'exact', head: true })

        if (category) q = q.eq('score_category', category)

        const { count, error } = await q
        if (error) throw error
        return count ?? 0
      },
      { label: 'scoring.countProductScores', timeoutMs: 5000 },
    )) ?? 0
  }

  // ─── Customer Scores ──────────────────────────────────────────

  async upsertCustomerScore(score: CustomerScore): Promise<void> {
    await resilientCall(
      async () => {
        const { error } = await piDb
          .from('customer_intelligence_scores')
          .upsert(
            {
              customer_id: score.customerId,
              customer_name: score.customerName,
              recency_score: score.recencyScore,
              frequency_score: score.frequencyScore,
              monetary_score: score.monetaryScore,
              loyalty_score: score.loyaltyScore,
              composite_score: score.compositeScore,
              segment: score.segment,
              churn_risk: score.churnRisk,
              lifetime_value: score.lifetimeValue,
              rank: score.rank,
              computed_at: score.computedAt,
            },
            { onConflict: 'customer_id' },
          )
        if (error) throw error
        piCache.del(scoreKey('customer', score.customerId))
        return null
      },
      { label: 'scoring.upsertCustomerScore', timeoutMs: 5000 },
    )
  }

  async getCustomerScore(customerId: string): Promise<CustomerScore | null> {
    const cached = piCache.get<CustomerScore>(
      scoreKey('customer', customerId),
      { label: 'scoring.getCustomerScore', ttlSeconds: PICache.TTL.CUSTOMER_SCORE },
    )
    if (cached) return cached

    const data = await resilientCall(
      async () => {
        const { data: row, error } = await piDb
          .from('customer_intelligence_scores')
          .select(CUSTOMER_SCORE_COLUMNS)
          .eq('customer_id', customerId)
          .maybeSingle()
        if (error) throw error
        return row
      },
      { label: 'scoring.getCustomerScore', timeoutMs: 5000 },
    )

    if (!data) return null
    const score = rowToCustomerScore(data as unknown as CustomerScoreRow)
    piCache.set(scoreKey('customer', customerId), score, { ttlSeconds: PICache.TTL.CUSTOMER_SCORE })
    return score
  }

  async queryCustomerScores(query: ScoreQuery): Promise<CustomerScore[]> {
    return (await resilientCall(
      async () => {
        let q = piDb
          .from('customer_intelligence_scores')
          .select(CUSTOMER_SCORE_COLUMNS)
          .order('composite_score', { ascending: false })

        if (query.minScore !== undefined) q = q.gte('composite_score', query.minScore)
        if (query.maxScore !== undefined) q = q.lte('composite_score', query.maxScore)
        if (query.category) q = q.eq('segment', query.category)
        if (query.limit !== undefined) q = q.limit(query.limit)
        if (query.offset !== undefined) q = q.range(query.offset, query.offset + (query.limit || 20) - 1)

        const { data, error } = await q
        if (error) throw error
        return ((data as unknown) as CustomerScoreRow[] || []).map(rowToCustomerScore)
      },
      { label: 'scoring.queryCustomerScores', timeoutMs: 10000 },
    )) ?? []
  }

  async upsertCustomerScoresBatch(scores: CustomerScore[]): Promise<void> {
    const rows = scores.map(s => ({
      customer_id: s.customerId,
      customer_name: s.customerName,
      recency_score: s.recencyScore,
      frequency_score: s.frequencyScore,
      monetary_score: s.monetaryScore,
      loyalty_score: s.loyaltyScore,
      composite_score: s.compositeScore,
      segment: s.segment,
      churn_risk: s.churnRisk,
      lifetime_value: s.lifetimeValue,
      rank: s.rank,
      computed_at: s.computedAt,
    }))

    await chunkedUpsert('customer_intelligence_scores', rows, {
      onConflict: 'customer_id',
      label: 'customer_scores',
    })

    for (const s of scores) {
      piCache.del(scoreKey('customer', s.customerId))
    }
  }

  // ─── Supplier Scores ──────────────────────────────────────────

  async upsertSupplierScore(score: SupplierScore): Promise<void> {
    await resilientCall(
      async () => {
        const { error } = await piDb
          .from('supplier_intelligence_scores')
          .upsert(
            {
              supplier_id: score.supplierId,
              supplier_name: score.supplierName,
              quality_score: score.qualityScore,
              reliability_score: score.reliabilityScore,
              price_score: score.priceScore,
              lead_time_score: score.leadTimeScore,
              composite_score: score.compositeScore,
              rank: score.rank,
              computed_at: score.computedAt,
            },
            { onConflict: 'supplier_id' },
          )
        if (error) throw error
        piCache.del(scoreKey('supplier', score.supplierId))
        return null
      },
      { label: 'scoring.upsertSupplierScore', timeoutMs: 5000 },
    )
  }

  async getSupplierScore(supplierId: string): Promise<SupplierScore | null> {
    const cached = piCache.get<SupplierScore>(
      scoreKey('supplier', supplierId),
      { label: 'scoring.getSupplierScore', ttlSeconds: PICache.TTL.SUPPLIER_SCORE },
    )
    if (cached) return cached

    const data = await resilientCall(
      async () => {
        const { data: row, error } = await piDb
          .from('supplier_intelligence_scores')
          .select(SUPPLIER_SCORE_COLUMNS)
          .eq('supplier_id', supplierId)
          .maybeSingle()
        if (error) throw error
        return row
      },
      { label: 'scoring.getSupplierScore', timeoutMs: 5000 },
    )

    if (!data) return null
    const score = rowToSupplierScore(data as unknown as SupplierScoreRow)
    piCache.set(scoreKey('supplier', supplierId), score, { ttlSeconds: PICache.TTL.SUPPLIER_SCORE })
    return score
  }

  async querySupplierScores(query: ScoreQuery): Promise<SupplierScore[]> {
    return (await resilientCall(
      async () => {
        let q = piDb
          .from('supplier_intelligence_scores')
          .select(SUPPLIER_SCORE_COLUMNS)
          .order('composite_score', { ascending: false })

        if (query.minScore !== undefined) q = q.gte('composite_score', query.minScore)
        if (query.maxScore !== undefined) q = q.lte('composite_score', query.maxScore)
        if (query.limit !== undefined) q = q.limit(query.limit)
        if (query.offset !== undefined) q = q.range(query.offset, query.offset + (query.limit || 20) - 1)

        const { data, error } = await q
        if (error) throw error
        return ((data as unknown) as SupplierScoreRow[] || []).map(rowToSupplierScore)
      },
      { label: 'scoring.querySupplierScores', timeoutMs: 10000 },
    )) ?? []
  }

  async upsertSupplierScoresBatch(scores: SupplierScore[]): Promise<void> {
    const rows = scores.map(s => ({
      supplier_id: s.supplierId,
      supplier_name: s.supplierName,
      quality_score: s.qualityScore,
      reliability_score: s.reliabilityScore,
      price_score: s.priceScore,
      lead_time_score: s.leadTimeScore,
      composite_score: s.compositeScore,
      rank: s.rank,
      computed_at: s.computedAt,
    }))

    await chunkedUpsert('supplier_intelligence_scores', rows, {
      onConflict: 'supplier_id',
      label: 'supplier_scores',
    })

    for (const s of scores) {
      piCache.del(scoreKey('supplier', s.supplierId))
    }
  }

  // ─── Business Health Scores ───────────────────────────────────

  async upsertBusinessHealthScore(score: BusinessHealthScore, branchId?: string): Promise<void> {
    await resilientCall(
      async () => {
        const { error } = await piDb
          .from('business_health_scores')
          .insert({
            branch_id: branchId ?? null,
            revenue_health: score.revenueHealth,
            margin_health: score.marginHealth,
            inventory_health: score.inventoryHealth,
            customer_health: score.customerHealth,
            cash_health: score.cashHealth,
            workforce_health: score.workforceHealth,
            composite_score: score.compositeScore,
            trend: score.trend,
            computed_at: score.computedAt,
          })
        if (error) throw error
        piCache.invalidateBusinessHealth(branchId)
        return null
      },
      { label: 'scoring.upsertBusinessHealth', timeoutMs: 5000 },
    )
  }

  async getLatestBusinessHealthScore(branchId?: string): Promise<BusinessHealthScore | null> {
    const cacheKey = `health:${branchId ?? 'all'}`
    const cached = piCache.get<BusinessHealthScore>(
      cacheKey,
      { label: 'scoring.getBusinessHealth', ttlSeconds: PICache.TTL.BUSINESS_HEALTH },
    )
    if (cached) return cached

    const data = await resilientCall(
      async () => {
        let q = piDb
          .from('business_health_scores')
          .select(BUSINESS_HEALTH_COLUMNS)
          .order('computed_at', { ascending: false })
          .limit(1)

        if (branchId) q = q.eq('branch_id', branchId)
        else q = q.is('branch_id', null)

        const { data: rows, error } = await q
        if (error) throw error
        return rows && rows.length > 0 ? rows[0] : null
      },
      { label: 'scoring.getBusinessHealth', timeoutMs: 5000 },
    )

    if (!data) return null
    const score = rowToBusinessHealth(data as unknown as BusinessHealthRow)
    piCache.set(cacheKey, score, { ttlSeconds: PICache.TTL.BUSINESS_HEALTH })
    return score
  }
}

export const scoringRepository = new ScoringRepository()
