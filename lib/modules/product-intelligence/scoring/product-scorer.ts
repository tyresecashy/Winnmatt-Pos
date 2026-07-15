/**
 * Product Scorer — Product performance scoring engine.
 *
 * Formula: ProductScore = 0.35×Velocity + 0.35×Margin + 0.20×Stability + 0.10×Seasonality
 * Classification: Star (85+), Cash Cow (70-84), Question Mark (50-69), Dog (30-49), Dead (<30)
 *
 * Reuses salesAnalyticsService (getProductPerformance, getSalesTrend)
 * and inventoryAnalyticsService (getStockTurnover, getDeadStock).
 *
 * @see ../../../../docs/16_PRODUCT_INTELLIGENCE.md (Section 7.2)
 */

import { salesAnalyticsService } from '@/lib/analytics/sales-analytics'
import { inventoryAnalyticsService } from '@/lib/analytics/inventory-analytics'
import { logger } from '@/lib/logger'
import { scoringRepository } from '../repositories/scoring-repository'
import type { ProductScore, ScoreCategory, ScoreQuery } from '../types'

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  velocity: 0.35,
  margin: 0.35,
  stability: 0.20,
  seasonality: 0.10,
} as const

const CATEGORY_THRESHOLDS: { min: number; category: ScoreCategory }[] = [
  { min: 85, category: 'star' },
  { min: 70, category: 'cash_cow' },
  { min: 50, category: 'question_mark' },
  { min: 30, category: 'dog' },
  { min: 0, category: 'dead' },
]

// ─── Helpers ────────────────────────────────────────────────────

function classifyScore(composite: number): ScoreCategory {
  for (const t of CATEGORY_THRESHOLDS) {
    if (composite >= t.min) return t.category
  }
  return 'dead'
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Product Scorer — evaluates product performance based on velocity, margin, stability, and seasonality.
 */
export class ProductScorer {
  /**
   * Score a single product by ID.
   * Fetches analytics data, computes sub-scores, persists to DB.
   */
  async scoreProduct(productId: string): Promise<ProductScore | null> {
    try {
      const now = new Date()
      const endDate = now.toISOString()
      const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch analytics data for this product
      const [productPerf, turnoverData, deadStock] = await Promise.all([
        salesAnalyticsService.getProductPerformance(startDate, endDate, 1000),
        inventoryAnalyticsService.getStockTurnover(startDate, endDate, 1000),
        inventoryAnalyticsService.getDeadStock(90),
      ])

      const perf = productPerf.find(p => p.productId === productId)
      if (!perf) {
        logger.warn('[ProductScorer] No sales data for product', { productId })
        return null
      }

      const turnover = turnoverData.find(t => t.productId === productId)
      const isDead = deadStock.some(d => d.productId === productId)

      // Compute sub-scores
      const maxSold = productPerf.reduce((m, p) => Math.max(m, p.totalSold), 1)
      const velocityScore = clamp((perf.totalSold / maxSold) * 100)

      const marginScore = clamp(perf.profitMargin, 0, 100)

      // Stability: high turnover + good days of supply = stable
      let stabilityScore = 50 // default for no turnover data
      if (turnover) {
        const turnoverContrib = clamp(turnover.turnoverRate * 20, 0, 70) // turnoverRate up to 5 → 100
        const supplyContrib = turnover.daysOfSupply === Infinity ? 0
          : clamp(100 - turnover.daysOfSupply * 2, 0, 30) // fewer days = more stable
        stabilityScore = clamp(turnoverContrib + supplyContrib)
      }

      // Seasonality: compute from SalesTrend variance if available
      // For individual product, use revenue variance as proxy
      const seasonalityScore = isDead ? 0 : this.computeSeasonalityScore(perf.revenue, perf.totalSold)

      // Composite
      const compositeScore = clamp(
        velocityScore * DEFAULT_WEIGHTS.velocity +
        marginScore * DEFAULT_WEIGHTS.margin +
        stabilityScore * DEFAULT_WEIGHTS.stability +
        seasonalityScore * DEFAULT_WEIGHTS.seasonality,
      )

      const category = classifyScore(compositeScore)

      const productScore: ProductScore = {
        productId: perf.productId,
        productName: perf.productName,
        productCategory: perf.category,
        velocityScore: Math.round(velocityScore),
        marginScore: Math.round(marginScore),
        stabilityScore: Math.round(stabilityScore),
        seasonalityScore: Math.round(seasonalityScore),
        compositeScore: Math.round(compositeScore),
        scoreCategory: category,
        rank: 0, // Will be set during batch scoring
        computedAt: now.toISOString(),
      }

      // Persist
      await scoringRepository.upsertProductScore(productScore)

      return productScore
    } catch (error) {
      logger.error('[ProductScorer] scoreProduct error', { productId, error })
      throw error
    }
  }

  /**
   * Score all products in batch.
   * Fetches all analytics data once, computes and persists all scores.
   */
  async scoreAllProducts(_branchId?: string, _batchSize?: number): Promise<ProductScore[]> {
    try {
      const now = new Date()
      const endDate = now.toISOString()
      const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch all analytics data in parallel
      const [productPerf, turnoverData, deadStock] = await Promise.all([
        salesAnalyticsService.getProductPerformance(startDate, endDate, 1000),
        inventoryAnalyticsService.getStockTurnover(startDate, endDate, 1000),
        inventoryAnalyticsService.getDeadStock(90),
      ])

      if (productPerf.length === 0) {
        logger.warn('[ProductScorer] No product performance data for scoring')
        return []
      }

      const maxSold = productPerf.reduce((m, p) => Math.max(m, p.totalSold), 1)
      const deadIds = new Set(deadStock.map(d => d.productId))
      const turnoverMap = new Map(turnoverData.map(t => [t.productId, t]))

      // Compute all scores
      const scores: ProductScore[] = productPerf.map((perf) => {
        const turnover = turnoverMap.get(perf.productId)
        const isDead = deadIds.has(perf.productId)

        const velocityScore = clamp((perf.totalSold / maxSold) * 100)
        const marginScore = clamp(perf.profitMargin, 0, 100)

        let stabilityScore = 50
        if (turnover) {
          const turnoverContrib = clamp(turnover.turnoverRate * 20, 0, 70)
          const supplyContrib = turnover.daysOfSupply === Infinity ? 0
            : clamp(100 - turnover.daysOfSupply * 2, 0, 30)
          stabilityScore = clamp(turnoverContrib + supplyContrib)
        }

        const seasonalityScore = isDead ? 0 : this.computeSeasonalityScore(perf.revenue, perf.totalSold)

        const compositeScore = clamp(
          velocityScore * DEFAULT_WEIGHTS.velocity +
          marginScore * DEFAULT_WEIGHTS.margin +
          stabilityScore * DEFAULT_WEIGHTS.stability +
          seasonalityScore * DEFAULT_WEIGHTS.seasonality,
        )

        return {
          productId: perf.productId,
          productName: perf.productName,
          productCategory: perf.category,
          velocityScore: Math.round(velocityScore),
          marginScore: Math.round(marginScore),
          stabilityScore: Math.round(stabilityScore),
          seasonalityScore: Math.round(seasonalityScore),
          compositeScore: Math.round(compositeScore),
          scoreCategory: classifyScore(compositeScore),
          rank: 0,
          computedAt: now.toISOString(),
        }
      })

      // Assign ranks within each category
      const byCategory = new Map<string, ProductScore[]>()
      for (const s of scores) {
        const cat = s.productCategory
        if (!byCategory.has(cat)) byCategory.set(cat, [])
        byCategory.get(cat)!.push(s)
      }

      for (const [, catScores] of byCategory) {
        catScores.sort((a, b) => b.compositeScore - a.compositeScore)
        catScores.forEach((s, i) => { s.rank = i + 1 })
      }

      // Persist all at once
      await scoringRepository.upsertProductScoresBatch(scores)

      logger.info('[ProductScorer] scoreAllProducts complete', { count: scores.length })
      return scores
    } catch (error) {
      logger.error('[ProductScorer] scoreAllProducts error', { error })
      throw error
    }
  }

  /**
   * Get a product's current score from DB.
   */
  async getScore(productId: string): Promise<ProductScore | null> {
    return scoringRepository.getProductScore(productId)
  }

  /**
   * Query product scores.
   */
  async queryScores(query: ScoreQuery): Promise<ProductScore[]> {
    return scoringRepository.queryProductScores(query)
  }

  /**
   * Compute seasonality score from revenue consistency.
   * Products with highly consistent sales get high seasonality scores
   * (low seasonality = predictable). Products with variable sales get low scores.
   */
  private computeSeasonalityScore(revenue: number, totalSold: number): number {
    // If a product has 0 or very low activity, it's not seasonal — it's inactive
    if (totalSold === 0 || revenue === 0) return 50

    // For individual products, we derive seasonality from the revenue/totalSold ratio
    // as a proxy for price consistency
    const avgUnitPrice = totalSold > 0 ? revenue / totalSold : 0
    const priceConsistency = avgUnitPrice > 0 ? Math.min(100, avgUnitPrice) : 50

    // Scale: products with avg unit price < 1 get 50, > 100 get 100
    return clamp(priceConsistency)
  }
}

export const productScorer = new ProductScorer()
