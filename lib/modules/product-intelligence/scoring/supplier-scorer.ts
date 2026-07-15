/**
 * Supplier Scorer — Supplier quality and reliability scoring engine.
 *
 * Formula: SupplierScore = 0.25×Quality + 0.30×Reliability + 0.20×Price + 0.25×LeadTime
 *
 * Reuses inventoryAnalyticsService.getSupplierPerformance() for on-time delivery,
 * lead time, order volume, and value data.
 *
 * @see ../../../../docs/16_PRODUCT_INTELLIGENCE.md (Section 7.4)
 */

import { inventoryAnalyticsService } from '@/lib/analytics/inventory-analytics'
import { logger } from '@/lib/logger'
import { scoringRepository } from '../repositories/scoring-repository'
import type { SupplierScore, ScoreQuery } from '../types'

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  quality: 0.25,
  reliability: 0.30,
  price: 0.20,
  leadTime: 0.25,
} as const

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Supplier Scorer — evaluates supplier performance on quality, reliability, pricing, and lead time.
 */
export class SupplierScorer {
  /**
   * Score a single supplier by ID.
   */
  async scoreSupplier(supplierId: string): Promise<SupplierScore | null> {
    try {
      const now = new Date()
      const endDate = now.toISOString()
      const startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()

      const suppliers = await inventoryAnalyticsService.getSupplierPerformance(startDate, endDate)
      const perf = suppliers.find(s => s.supplierId === supplierId)

      if (!perf) {
        logger.warn('[SupplierScorer] No performance data for supplier', { supplierId })
        return null
      }

      const score = this.computeScore(perf, suppliers, now)
      await scoringRepository.upsertSupplierScore(score)
      return score
    } catch (error) {
      logger.error('[SupplierScorer] scoreSupplier error', { supplierId, error })
      throw error
    }
  }

  /**
   * Score all suppliers in batch.
   */
  async scoreAllSuppliers(_batchSize?: number): Promise<SupplierScore[]> {
    try {
      const now = new Date()
      const endDate = now.toISOString()
      const startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()

      const suppliers = await inventoryAnalyticsService.getSupplierPerformance(startDate, endDate)

      if (suppliers.length === 0) {
        logger.warn('[SupplierScorer] No supplier performance data')
        return []
      }

      const scores: SupplierScore[] = suppliers.map(perf => this.computeScore(perf, suppliers, now))

      // Assign ranks
      scores.sort((a, b) => b.compositeScore - a.compositeScore)
      scores.forEach((s, i) => { s.rank = i + 1 })

      await scoringRepository.upsertSupplierScoresBatch(scores)

      logger.info('[SupplierScorer] scoreAllSuppliers complete', { count: scores.length })
      return scores
    } catch (error) {
      logger.error('[SupplierScorer] scoreAllSuppliers error', { error })
      throw error
    }
  }

  /**
   * Get a supplier's current score from DB.
   */
  async getScore(supplierId: string): Promise<SupplierScore | null> {
    return scoringRepository.getSupplierScore(supplierId)
  }

  /**
   * Query supplier scores.
   */
  async queryScores(query: ScoreQuery): Promise<SupplierScore[]> {
    return scoringRepository.querySupplierScores(query)
  }

  /**
   * Compute a single SupplierScore from analytics data.
   */
  private computeScore(
    perf: { supplierId: string; supplierName: string; totalOrders: number; onTimeDelivery: number; qualityScore: number; averageLeadTime: number; totalValue: number },
    allSuppliers: typeof perf[],
    now: Date,
  ): SupplierScore {
    // Quality score: use analytics qualityScore if available, otherwise derive from onTimeDelivery
    // The analytics service currently returns qualityScore=0 (hardcoded), so we compute our own
    const qualityScore = perf.qualityScore > 0
      ? clamp(perf.qualityScore)
      : this.computeQualityFromData(perf)

    // Reliability: on-time delivery rate + order volume confidence
    const maxOrders = allSuppliers.reduce((m, s) => Math.max(m, s.totalOrders), 1)
    const orderVolumeFactor = (perf.totalOrders / maxOrders) * 20 // up to 20 bonus points
    const reliabilityScore = clamp(perf.onTimeDelivery * 0.8 + orderVolumeFactor)

    // Price: competitive pricing proxy using total value / order as average order size
    // Higher order value doesn't mean better pricing. We use inverse: among suppliers with
    // similar onTimeDelivery, lower average order value suggests better pricing.
    const maxAvgValue = allSuppliers.reduce((m, s) => {
      const avg = s.totalOrders > 0 ? s.totalValue / s.totalOrders : 0
      return Math.max(m, avg)
    }, 1)
    const avgOrderValue = perf.totalOrders > 0 ? perf.totalValue / perf.totalOrders : 0
    // Lower average order value = better price score (inverse relationship)
    const priceScore = clamp(100 - (avgOrderValue / maxAvgValue) * 100)

    // Lead time: shorter is better (0 days = perfect, >30 days = poor)
    const leadTimeScore = perf.averageLeadTime <= 0
      ? 100
      : clamp(100 - perf.averageLeadTime * 3.33) // 0 days → 100, 30 days → 0

    const compositeScore = clamp(
      qualityScore * DEFAULT_WEIGHTS.quality +
      reliabilityScore * DEFAULT_WEIGHTS.reliability +
      priceScore * DEFAULT_WEIGHTS.price +
      leadTimeScore * DEFAULT_WEIGHTS.leadTime,
    )

    return {
      supplierId: perf.supplierId,
      supplierName: perf.supplierName,
      qualityScore: Math.round(qualityScore),
      reliabilityScore: Math.round(reliabilityScore),
      priceScore: Math.round(priceScore),
      leadTimeScore: Math.round(leadTimeScore),
      compositeScore: Math.round(compositeScore),
      rank: 0,
      computedAt: now.toISOString(),
    }
  }

  /**
   * Compute quality score from available performance data.
   */
  private computeQualityFromData(perf: { totalOrders: number; onTimeDelivery: number; averageLeadTime: number }): number {
    if (perf.totalOrders === 0) return 50 // neutral for no data

    // Quality = on-time delivery rate penalized by lead time variance
    const baseQuality = perf.onTimeDelivery

    // Penalty for long lead times (over 10 days starts penalizing)
    const leadTimePenalty = perf.averageLeadTime > 10
      ? Math.min(30, (perf.averageLeadTime - 10) * 2)
      : 0

    return clamp(baseQuality - leadTimePenalty)
  }
}

export const supplierScorer = new SupplierScorer()
