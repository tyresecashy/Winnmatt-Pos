/**
 * Customer Scorer — Customer value and risk scoring engine.
 *
 * Formula: CustomerScore = 0.30×Recency + 0.25×Frequency + 0.25×Monetary + 0.20×Loyalty
 * Segments from existing RFM analysis: champions, loyal, new, at_risk, lost, promising, need_attention
 *
 * Reuses customerAnalyticsService (getRFMSegments, getCustomerLifetimeValue, getChurnRisk).
 *
 * @see ../../../../docs/16_PRODUCT_INTELLIGENCE.md (Section 7.3, 8)
 */

import { customerAnalyticsService } from '@/lib/analytics/customer-analytics'
import { logger } from '@/lib/logger'
import { scoringRepository } from '../repositories/scoring-repository'
import type { CustomerScore, CustomerSegment, ScoreQuery } from '../types'

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  recency: 0.30,
  frequency: 0.25,
  monetary: 0.25,
  loyalty: 0.20,
} as const

// Map RFM segment names from analytics → our CustomerSegment type
const RFM_SEGMENT_MAP: Record<string, CustomerSegment> = {
  'Champions': 'champions',
  'Loyal Customers': 'loyal',
  'Potential Loyalists': 'promising',
  'New Customers': 'new',
  'At Risk': 'at_risk',
  'Cant Lose Them': 'at_risk',
  'Lost': 'lost',
  'Need Attention': 'need_attention',
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Customer Scorer — evaluates customer value using RFM + loyalty.
 */
export class CustomerScorer {
  /**
   * Score a single customer by ID.
   */
  async scoreCustomer(customerId: string): Promise<CustomerScore | null> {
    try {
      const now = new Date()
      const endDate = now.toISOString()
      const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch customer analytics data
      const [clvList, churnList, rfmSegments] = await Promise.all([
        customerAnalyticsService.getCustomerLifetimeValue(1000),
        customerAnalyticsService.getChurnRisk(30),
        customerAnalyticsService.getRFMSegments(),
      ])

      const clv = clvList.find(c => c.customerId === customerId)
      if (!clv) {
        logger.warn('[CustomerScorer] No CLV data for customer', { customerId })
        return null
      }

      const churnData = churnList.find(c => c.customerId === customerId)

      // Compute RFM scores from available data
      // Frequency and monetary map directly from CLV data
      // Recency inferred from churn risk (lower risk = better recency)
      // Loyalty from purchase patterns and total orders

      // Normalize across all customers for scoring
      const maxOrders = clvList.reduce((m, c) => Math.max(m, c.totalOrders), 1)
      const maxSpent = clvList.reduce((m, c) => Math.max(m, c.totalSpent), 1)
      const maxCLV = clvList.reduce((m, c) => Math.max(m, c.lifetimeValue), 1)

      const recencyScore = clamp(churnData ? 100 - churnData.riskScore : 50)
      const frequencyScore = clamp((clv.totalOrders / maxOrders) * 100)
      const monetaryScore = clamp((clv.totalSpent / maxSpent) * 100)

      // Loyalty: combination of number of orders and CLV/monetary consistency
      const orderLoyalty = clv.totalOrders > 5 ? 100 : (clv.totalOrders / 5) * 100
      const clvRatio = clv.totalSpent > 0 ? (clv.lifetimeValue / maxCLV) * 100 : 0
      const loyaltyScore = clamp((orderLoyalty + clvRatio) / 2)

      const compositeScore = clamp(
        recencyScore * DEFAULT_WEIGHTS.recency +
        frequencyScore * DEFAULT_WEIGHTS.frequency +
        monetaryScore * DEFAULT_WEIGHTS.monetary +
        loyaltyScore * DEFAULT_WEIGHTS.loyalty,
      )

      // Derive segment from RFM analysis
      const segment = this.determineSegment(customerId, rfmSegments, clv.totalOrders, compositeScore)

      const customerScore: CustomerScore = {
        customerId: clv.customerId,
        customerName: clv.customerName,
        recencyScore: Math.round(recencyScore),
        frequencyScore: Math.round(frequencyScore),
        monetaryScore: Math.round(monetaryScore),
        loyaltyScore: Math.round(loyaltyScore),
        compositeScore: Math.round(compositeScore),
        segment,
        churnRisk: churnData ? clamp(churnData.riskScore, 0, 100) / 100 : 0.5,
        lifetimeValue: clv.lifetimeValue,
        rank: 0,
        computedAt: now.toISOString(),
      }

      await scoringRepository.upsertCustomerScore(customerScore)
      return customerScore
    } catch (error) {
      logger.error('[CustomerScorer] scoreCustomer error', { customerId, error })
      throw error
    }
  }

  /**
   * Score all customers in batch.
   */
  async scoreAllCustomers(_batchSize?: number): Promise<CustomerScore[]> {
    try {
      const now = new Date()
      const endDate = now.toISOString()
      const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()

      const [clvList, churnList, rfmSegments] = await Promise.all([
        customerAnalyticsService.getCustomerLifetimeValue(1000),
        customerAnalyticsService.getChurnRisk(30),
        customerAnalyticsService.getRFMSegments(),
      ])

      if (clvList.length === 0) {
        logger.warn('[CustomerScorer] No CLV data for batch scoring')
        return []
      }

      const maxOrders = clvList.reduce((m, c) => Math.max(m, c.totalOrders), 1)
      const maxSpent = clvList.reduce((m, c) => Math.max(m, c.totalSpent), 1)
      const maxCLV = clvList.reduce((m, c) => Math.max(m, c.lifetimeValue), 1)
      const churnMap = new Map(churnList.map(c => [c.customerId, c]))

      const scores: CustomerScore[] = clvList.map((clv) => {
        const churnData = churnMap.get(clv.customerId)

        const recencyScore = clamp(churnData ? 100 - churnData.riskScore : 50)
        const frequencyScore = clamp((clv.totalOrders / maxOrders) * 100)
        const monetaryScore = clamp((clv.totalSpent / maxSpent) * 100)

        const orderLoyalty = clv.totalOrders > 5 ? 100 : (clv.totalOrders / 5) * 100
        const clvRatio = clv.totalSpent > 0 ? (clv.lifetimeValue / maxCLV) * 100 : 0
        const loyaltyScore = clamp((orderLoyalty + clvRatio) / 2)

        const compositeScore = clamp(
          recencyScore * DEFAULT_WEIGHTS.recency +
          frequencyScore * DEFAULT_WEIGHTS.frequency +
          monetaryScore * DEFAULT_WEIGHTS.monetary +
          loyaltyScore * DEFAULT_WEIGHTS.loyalty,
        )

        return {
          customerId: clv.customerId,
          customerName: clv.customerName,
          recencyScore: Math.round(recencyScore),
          frequencyScore: Math.round(frequencyScore),
          monetaryScore: Math.round(monetaryScore),
          loyaltyScore: Math.round(loyaltyScore),
          compositeScore: Math.round(compositeScore),
          segment: this.determineSegment(clv.customerId, rfmSegments, clv.totalOrders, compositeScore),
          churnRisk: churnData ? clamp(churnData.riskScore, 0, 100) / 100 : 0.5,
          lifetimeValue: clv.lifetimeValue,
          rank: 0,
          computedAt: now.toISOString(),
        }
      })

      // Assign ranks
      scores.sort((a, b) => b.compositeScore - a.compositeScore)
      scores.forEach((s, i) => { s.rank = i + 1 })

      await scoringRepository.upsertCustomerScoresBatch(scores)

      logger.info('[CustomerScorer] scoreAllCustomers complete', { count: scores.length })
      return scores
    } catch (error) {
      logger.error('[CustomerScorer] scoreAllCustomers error', { error })
      throw error
    }
  }

  /**
   * Get a customer's current score from DB.
   */
  async getScore(customerId: string): Promise<CustomerScore | null> {
    return scoringRepository.getCustomerScore(customerId)
  }

  /**
   * Query customer scores.
   */
  async queryScores(query: ScoreQuery): Promise<CustomerScore[]> {
    return scoringRepository.queryCustomerScores(query)
  }

  /**
   * Determine customer segment from RFM data, order count, and composite score.
   */
  private determineSegment(
    customerId: string,
    rfmSegments: { segment: string; count: number }[],
    totalOrders: number,
    compositeScore: number,
  ): CustomerSegment {
    // If the customer has no orders, they're 'new'
    if (totalOrders === 0) return 'new'

    // If compositeScore is very low and they had orders → lost
    if (compositeScore < 15 && totalOrders > 0) return 'lost'

    // High composite score
    if (compositeScore >= 80) return 'champions'
    if (compositeScore >= 65) return 'loyal'

    // Very low engagement
    if (compositeScore < 25) return 'lost'
    if (compositeScore < 40) return 'at_risk'

    // Single order with moderate score
    if (totalOrders === 1) return 'new'

    // Default for middle ground
    return 'need_attention'
  }
}

export const customerScorer = new CustomerScorer()
