/**
 * Business Health Scorer — Overall business health composite score.
 *
 * Formula: BusinessHealth = 0.20×Revenue + 0.20×Margin + 0.15×Inventory
 *                         + 0.15×Customer + 0.15×Cash + 0.15×Workforce
 *
 * Trend: compares current composite to the previous snapshot.
 *
 * Reuses salesAnalyticsService (getSalesMetrics),
 * financialAnalyticsService (getFinancialMetrics),
 * inventoryAnalyticsService (getInventoryMetrics),
 * customerAnalyticsService (getCustomerMetrics),
 * workforceAnalyticsService (getWorkforceMetrics).
 *
 * @see ../../../../docs/16_PRODUCT_INTELLIGENCE.md (Section 7.1)
 */

import { salesAnalyticsService } from '@/lib/analytics/sales-analytics'
import { financialAnalyticsService } from '@/lib/analytics/financial-analytics'
import { inventoryAnalyticsService } from '@/lib/analytics/inventory-analytics'
import { customerAnalyticsService } from '@/lib/analytics/customer-analytics'
import { workforceAnalyticsService } from '@/lib/analytics/workforce-analytics'
import { logger } from '@/lib/logger'
import { scoringRepository } from '../repositories/scoring-repository'
import type { BusinessHealthScore } from '../types'

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  revenue: 0.20,
  margin: 0.20,
  inventory: 0.15,
  customer: 0.15,
  cash: 0.15,
  workforce: 0.15,
} as const

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Business Health Scorer — computes the composite business health score
 * from 6 dimensions and determines the trend direction.
 */
export class BusinessHealthScorer {
  /**
   * Compute the overall business health score.
   */
  async computeHealthScore(branchId?: string): Promise<BusinessHealthScore> {
    try {
      const now = new Date()
      const endDate = now.toISOString()
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch all analytics data in parallel
      const [salesMetrics, financialMetrics, inventoryMetrics, customerMetrics, workforceMetrics] =
        await Promise.all([
          salesAnalyticsService.getSalesMetrics(startDate, endDate),
          financialAnalyticsService.getFinancialMetrics(startDate, endDate),
          inventoryAnalyticsService.getInventoryMetrics(),
          customerAnalyticsService.getCustomerMetrics(startDate, endDate),
          workforceAnalyticsService.getWorkforceMetrics(startDate, endDate),
        ])

      // ─── Revenue Health ─────────────────────────────────────
      // Based on revenue growth rate + transaction volume health
      let revenueHealth = 50
      if (salesMetrics.revenueGrowth !== undefined) {
        // revenueGrowth can be negative; map -100%+ → 0, 0% → 50, 100%+ → 100
        revenueHealth = clamp(50 + salesMetrics.revenueGrowth * 0.5)
      }

      // ─── Margin Health ──────────────────────────────────────
      // Based on profit margin
      let marginHealth = 50
      if (financialMetrics.profitMargin !== undefined) {
        // profitMargin is a %; 0% → 0, 20% → 100 (linear)
        marginHealth = clamp(financialMetrics.profitMargin * 5)
      }

      // ─── Inventory Health ───────────────────────────────────
      // Based on stockout rate + low stock items relative to total
      let inventoryHealth = 75 // start healthy
      if (inventoryMetrics.totalProducts > 0) {
        const stockoutRatio = inventoryMetrics.outOfStockItems / inventoryMetrics.totalProducts
        const lowStockRatio = inventoryMetrics.lowStockItems / inventoryMetrics.totalProducts
        const penalty = (stockoutRatio * 60) + (lowStockRatio * 30)
        inventoryHealth = clamp(100 - penalty)
      }

      // ─── Customer Health ────────────────────────────────────
      // Based on retention rate + active-to-total ratio
      let customerHealth = 50
      if (customerMetrics.customerRetentionRate !== undefined && customerMetrics.totalCustomers > 0) {
        const retentionScore = clamp(customerMetrics.customerRetentionRate)
        const activeRatio = customerMetrics.activeCustomers / customerMetrics.totalCustomers
        const activeScore = clamp(activeRatio * 100)
        customerHealth = clamp(retentionScore * 0.6 + activeScore * 0.4)
      }

      // ─── Cash Health ────────────────────────────────────────
      // Based on net profit margin as proxy (positive = healthy cash position)
      let cashHealth = 50
      if (financialMetrics.netProfit !== undefined && financialMetrics.totalRevenue > 0) {
        const netMargin = (financialMetrics.netProfit / financialMetrics.totalRevenue) * 100
        cashHealth = clamp(50 + netMargin * 5) // 0% → 50, 10% → 100, -10% → 0
      }

      // ─── Workforce Health ───────────────────────────────────
      // Based on efficiency + active workers ratio
      let workforceHealth = 50
      if (workforceMetrics.totalWorkers > 0) {
        const activeRatio = workforceMetrics.activeWorkers / workforceMetrics.totalWorkers
        const efficiencyScore = workforceMetrics.averageEfficiencyScore
        workforceHealth = clamp(
          (activeRatio * 100) * 0.4 + efficiencyScore * 0.6,
        )
      }

      // ─── Composite (weighted) ───────────────────────────────
      const compositeScore = clamp(
        revenueHealth * DEFAULT_WEIGHTS.revenue +
        marginHealth * DEFAULT_WEIGHTS.margin +
        inventoryHealth * DEFAULT_WEIGHTS.inventory +
        customerHealth * DEFAULT_WEIGHTS.customer +
        cashHealth * DEFAULT_WEIGHTS.cash +
        workforceHealth * DEFAULT_WEIGHTS.workforce,
      )

      // ─── Trend ──────────────────────────────────────────────
      const previousScore = await this.getLatestScore(branchId)
      let trend: BusinessHealthScore['trend'] = 'stable'
      if (previousScore) {
        const diff = compositeScore - previousScore.compositeScore
        if (diff >= 2) trend = 'improving'
        else if (diff <= -2) trend = 'declining'
      }

      const healthScore: BusinessHealthScore = {
        revenueHealth: Math.round(revenueHealth),
        marginHealth: Math.round(marginHealth),
        inventoryHealth: Math.round(inventoryHealth),
        customerHealth: Math.round(customerHealth),
        cashHealth: Math.round(cashHealth),
        workforceHealth: Math.round(workforceHealth),
        compositeScore: Math.round(compositeScore),
        trend,
        computedAt: now.toISOString(),
      }

      await scoringRepository.upsertBusinessHealthScore(healthScore, branchId)

      logger.info('[BusinessHealthScorer] computeHealthScore complete', {
        branchId,
        composite: healthScore.compositeScore,
        trend: healthScore.trend,
      })

      return healthScore
    } catch (error) {
      logger.error('[BusinessHealthScorer] computeHealthScore error', { branchId, error })
      throw error
    }
  }

  /**
   * Get the latest computed health score from DB.
   */
  async getLatestScore(branchId?: string): Promise<BusinessHealthScore | null> {
    try {
      return scoringRepository.getLatestBusinessHealthScore(branchId)
    } catch (error) {
      logger.error('[BusinessHealthScorer] getLatestScore error', { branchId, error })
      return null
    }
  }
}

export const businessHealthScorer = new BusinessHealthScorer()
