/**
 * Cross-Sell Engine — Market basket / co-occurrence recommendation engine.
 *
 * Pre-computes product affinity matrix (lift, confidence, support) from
 * sale_items history, then reads from the cached matrix at POS time.
 *
 * Lift formula: P(A∩B) / (P(A) × P(B))
 * Confidence: P(A∩B) / P(A)
 * Support: P(A∩B) as fraction of all transactions
 *
 * Revenue impact estimate: probability × price of recommended item
 *
 * Sprint 11D: Full implementation replacing Sprint 11A stub.
 *
 * @see ../../../../docs/16_PRODUCT_INTELLIGENCE.md (Section 3.2, 9.3)
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { recommendationsRepository } from '../repositories/recommendations-repository'
import type { CrossSellRecommendation, ProductAffinity } from '../types'
import { createRecommendationGeneratedEvent } from '../events'
import { publish } from '@/lib/realtime/event-bus'

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_LIFT_THRESHOLD = 1.5   // Only suggest products with lift > this
const DEFAULT_MIN_OCCURRENCES = 2     // Must co-occur at least this many times
const DEFAULT_MAX_RECOMMENDATIONS = 10
const DEFAULT_CART_SIZE = 50          // Max cart items to process

// ─── Cross-Sell Engine ──────────────────────────────────────────

export class CrossSellEngine {
  /**
   * Get cross-sell recommendations for a set of cart items.
   * Reads from pre-computed affinity matrix, filters by relevance,
   * and returns top suggestions with confidence and revenue estimates.
   */
  async getRecommendations(
    cartProductIds: string[],
    limit = DEFAULT_MAX_RECOMMENDATIONS,
    branchId?: string,
  ): Promise<CrossSellRecommendation[]> {
    if (cartProductIds.length === 0) return []

    const productsToCheck = cartProductIds.slice(0, DEFAULT_CART_SIZE)

    try {
      // Read affinities from pre-computed matrix
      const affinities = await recommendationsRepository.getAffinitiesForProducts(
        productsToCheck,
        branchId,
        limit * 3,
      )

      if (affinities.length === 0) return []

      // Aggregate scores across all cart items for each recommended product
      const aggregated = new Map<string, {
        totalLift: number
        maxConfidence: number
        maxSupport: number
        occurrences: number
        sources: Set<string>
      }>()

      for (const aff of affinities) {
        // Filter out products already in cart
        if (cartProductIds.includes(aff.productB)) continue

        // Skip low-lift / low-occurrence pairs
        if (aff.lift < DEFAULT_LIFT_THRESHOLD) continue
        if (aff.occurrences < DEFAULT_MIN_OCCURRENCES) continue

        const existing = aggregated.get(aff.productB)
        if (existing) {
          existing.totalLift += aff.lift
          existing.maxConfidence = Math.max(existing.maxConfidence, aff.confidence)
          existing.maxSupport = Math.max(existing.maxSupport, aff.support)
          existing.occurrences += aff.occurrences
          existing.sources.add(aff.productA)
        } else {
          aggregated.set(aff.productB, {
            totalLift: aff.lift,
            maxConfidence: aff.confidence,
            maxSupport: aff.support,
            occurrences: aff.occurrences,
            sources: new Set([aff.productA]),
          })
        }
      }

      if (aggregated.size === 0) return []

      // Compute composite score: avgLift × confidence boost
      const scored = Array.from(aggregated.entries()).map(([productId, agg]) => {
        const avgLift = agg.totalLift / agg.sources.size
        const confidenceBoost = 1 + (agg.maxConfidence - 0.5) // Center around 1
        const score = Math.min(100, Math.round(avgLift * confidenceBoost * 20))
        const confidence = Math.min(1, Math.round(agg.maxConfidence * 100) / 100)
        return { productId, score, confidence, occurrences: agg.occurrences }
      })

      // Sort by composite score, take top N
      const topN = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      // Fetch product details for the top suggestions
      const recommendations = await this.enrichWithProductDetails(topN, cartProductIds)

      return recommendations
    } catch (error) {
      logger.error('[CrossSellEngine] getRecommendations failed', { error })
      return []
    }
  }

  /**
   * Rebuild the product affinity matrix from transaction history.
   *
   * Scans sale_items to compute pairwise lift, confidence, and support.
   * Purges old affinities and inserts new ones in batch.
   */
  async rebuildAffinityMatrix(branchId?: string, dateRangeDays = 90): Promise<{ pairsCount: number }> {
    try {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - dateRangeDays * 24 * 60 * 60 * 1000)

      // Fetch sale_ids in range (optionally filtered by branch)
      let saleQuery = supabaseAdmin
        .from('sales')
        .select('id, branch_id')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (branchId) {
        saleQuery = saleQuery.eq('branch_id', branchId)
      }

      const { data: salesData, error: salesError } = await saleQuery
      if (salesError) {
        logger.error('[CrossSellEngine] Failed to fetch sales for affinity rebuild', { error: salesError })
        throw salesError
      }

      const saleIds = (salesData ?? []).map(s => s.id)
      if (saleIds.length < 2) {
        logger.warn('[CrossSellEngine] Not enough sales to build affinity matrix', { saleCount: saleIds.length })
        return { pairsCount: 0 }
      }

      // Fetch all sale_items for those sales
      const { data: itemsData, error: itemsError } = await supabaseAdmin
        .from('sale_items')
        .select('sale_id, product_id')
        .in('sale_id', saleIds)

      if (itemsError) {
        logger.error('[CrossSellEngine] Failed to fetch sale_items for affinity rebuild', { error: itemsError })
        throw itemsError
      }

      // Build product sets per sale
      const saleProducts = new Map<string, Set<string>>()
      for (const item of itemsData ?? []) {
        if (!saleProducts.has(item.sale_id)) {
          saleProducts.set(item.sale_id, new Set())
        }
        saleProducts.get(item.sale_id)!.add(item.product_id)
      }

      // Only consider sales with at least 2 distinct products
      const validSales = Array.from(saleProducts.entries()).filter(([, products]) => products.size >= 2)
      const totalTransactions = validSales.length

      if (totalTransactions < 2) {
        logger.warn('[CrossSellEngine] Not enough multi-product sales for affinity matrix', { count: totalTransactions })
        return { pairsCount: 0 }
      }

      // Count individual product frequencies
      const productFreq = new Map<string, number>()
      for (const [, products] of validSales) {
        for (const pid of products) {
          productFreq.set(pid, (productFreq.get(pid) ?? 0) + 1)
        }
      }

      // Compute co-occurrence matrix
      const coOccurrence = new Map<string, Map<string, number>>()

      for (const [, products] of validSales) {
        const sorted = Array.from(products).sort()
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length; j++) {
            const a = sorted[i]
            const b = sorted[j]
            if (!coOccurrence.has(a)) coOccurrence.set(a, new Map())
            if (!coOccurrence.has(b)) coOccurrence.set(b, new Map())
            coOccurrence.get(a)!.set(b, (coOccurrence.get(a)!.get(b) ?? 0) + 1)
            coOccurrence.get(b)!.set(a, (coOccurrence.get(b)!.get(a) ?? 0) + 1)
          }
        }
      }

      // Build affinity pairs with lift, confidence, support
      const affinities: Array<{
        productA: string
        productB: string
        lift: number
        confidence: number
        support: number
        occurrences: number
        branchId: string | null
      }> = []

      for (const [productA, related] of coOccurrence) {
        const freqA = productFreq.get(productA) ?? 0
        for (const [productB, occurrences] of related) {
          // Only emit each pair once (A < B lexicographically)
          if (productA >= productB) continue

          const freqB = productFreq.get(productB) ?? 0
          const support = occurrences / totalTransactions
          const confidenceAB = occurrences / freqA
          const confidenceBA = occurrences / freqB

          // Lift: P(A∩B) / (P(A) × P(B))
          const pA = freqA / totalTransactions
          const pB = freqB / totalTransactions
          const lift = (pA > 0 && pB > 0) ? (support / (pA * pB)) : 0

          // Take max confidence direction
          const confidence = Math.max(confidenceAB, confidenceBA)

          affinities.push({
            productA,
            productB,
            lift,
            confidence: Math.min(1, confidence),
            support,
            occurrences,
            branchId: branchId ?? null,
          })
        }
      }

      if (affinities.length === 0) {
        return { pairsCount: 0 }
      }

      // Clear old affinities and insert new batch
      await recommendationsRepository.clearAffinities(branchId)
      await recommendationsRepository.insertAffinityBatch(affinities)

      logger.info('[CrossSellEngine] Affinity matrix rebuilt', {
        pairsCount: affinities.length,
        transactions: totalTransactions,
        products: productFreq.size,
        branchId,
      })

      // Publish event
      publish(createRecommendationGeneratedEvent('cross-sell', 'batch', branchId ?? null))

      return { pairsCount: affinities.length }
    } catch (error) {
      logger.error('[CrossSellEngine] rebuildAffinityMatrix failed', { error })
      throw error
    }
  }

  /**
   * Get affinities for a specific product (raw data).
   */
  async getAffinitiesForProduct(productId: string, branchId?: string) {
    return recommendationsRepository.getAffinitiesForProduct(productId, branchId)
  }

  // ─── Private Helpers ──────────────────────────────────────────

  private async enrichWithProductDetails(
    scored: Array<{ productId: string; score: number; confidence: number; occurrences: number }>,
    cartProductIds: string[],
  ): Promise<CrossSellRecommendation[]> {
    const productIds = scored.map(s => s.productId)

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name, selling_price')
      .in('id', productIds)

    const productMap = new Map((products ?? []).map(p => [p.id, p]))

    return scored.map(s => {
      const product = productMap.get(s.productId)
      const price = product?.selling_price ?? 0
      const reason = this.buildReason(s.productId, cartProductIds, s.occurrences)

      return {
        productId: s.productId,
        productName: product?.name ?? 'Unknown',
        score: s.score,
        confidence: s.confidence,
        reason,
        price,
      }
    })
  }

  private buildReason(productId: string, cartProductIds: string[], occurrences: number): string {
    if (occurrences >= 50) return 'Very frequently bought together with items in your cart'
    if (occurrences >= 20) return 'Frequently bought together with items in your cart'
    if (occurrences >= 5) return 'Often bought together with items in your cart'
    return 'Customers who bought similar items also bought this'
  }
}

export const crossSellEngine = new CrossSellEngine()
