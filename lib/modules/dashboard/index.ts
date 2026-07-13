/**
 * Dashboard Module — Public API
 *
 * Provides dashboard stats, trends, KPIs, and operational insights.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/dashboard-actions.ts and lib/executive-dashboard-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as dash from '@/lib/dashboard-actions'
import * as exec from '@/lib/executive-dashboard-actions'
import type { ExecutiveKPI, BranchPerformance, SalesHourly, TopProduct, AIInsight } from '@/lib/executive-dashboard-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type DashboardStatsResult = Awaited<ReturnType<typeof dash.getTodayDashboardStats>>
type WeeklySalesRow = Awaited<ReturnType<typeof dash.getWeeklySalesTrend>>[number]
type BranchPerfTodayRow = Awaited<ReturnType<typeof dash.getBranchPerformanceToday>>[number]
type TopProductsTodayRow = Awaited<ReturnType<typeof dash.getTopProductsToday>>[number]
type PaymentBreakdownRow = Awaited<ReturnType<typeof dash.getPaymentBreakdownToday>>[number]
type LowStockAlertRow = Awaited<ReturnType<typeof dash.getLowStockAlertsForBranch>>[number]
type RecentTransactionRow = Awaited<ReturnType<typeof dash.getRecentTransactions>>[number]
type SeasonalInsightsResult = Awaited<ReturnType<typeof dash.getSeasonalInsights>>

// ─── Public API - Operational Dashboard ─────────────────────────────────────

export async function getTodayDashboardStats(branchId: string): Promise<DashboardStatsResult> {
  try {
    return await dash.getTodayDashboardStats(branchId)
  } catch (error) {
    logger.error('[Dashboard Module] getTodayDashboardStats failed', error instanceof Error ? error.message : String(error))
    return null as unknown as DashboardStatsResult
  }
}

export async function getWeeklySalesTrend(branchId: string): Promise<WeeklySalesRow[]> {
  try {
    return await dash.getWeeklySalesTrend(branchId)
  } catch (error) {
    logger.error('[Dashboard Module] getWeeklySalesTrend failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getBranchPerformanceToday(startDate?: string, endDate?: string): Promise<BranchPerfTodayRow[]> {
  try {
    return await dash.getBranchPerformanceToday(startDate as unknown as Date | undefined, endDate as unknown as Date | undefined)
  } catch (error) {
    logger.error('[Dashboard Module] getBranchPerformanceToday failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getTopProductsToday(branchId: string, limit?: number): Promise<TopProductsTodayRow[]> {
  try {
    return await dash.getTopProductsToday(branchId, limit)
  } catch (error) {
    logger.error('[Dashboard Module] getTopProductsToday failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getPaymentBreakdownToday(branchId: string): Promise<PaymentBreakdownRow[]> {
  try {
    return await dash.getPaymentBreakdownToday(branchId)
  } catch (error) {
    logger.error('[Dashboard Module] getPaymentBreakdownToday failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getLowStockAlertsForBranch(branchId: string, limit?: number): Promise<LowStockAlertRow[]> {
  try {
    return await dash.getLowStockAlertsForBranch(branchId, limit)
  } catch (error) {
    logger.error('[Dashboard Module] getLowStockAlertsForBranch failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getRecentTransactions(branchId: string, limit?: number): Promise<RecentTransactionRow[]> {
  try {
    return await dash.getRecentTransactions(branchId, limit)
  } catch (error) {
    logger.error('[Dashboard Module] getRecentTransactions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getSeasonalInsights(branchId: string): Promise<SeasonalInsightsResult> {
  try {
    return await dash.getSeasonalInsights(branchId)
  } catch (error) {
    logger.error('[Dashboard Module] getSeasonalInsights failed', error instanceof Error ? error.message : String(error))
    return null as unknown as SeasonalInsightsResult
  }
}

// ─── Public API - Executive Dashboard ───────────────────────────────────────

export async function getExecutiveKPI(branchId?: string): Promise<ExecutiveKPI> {
  try {
    return await exec.getExecutiveKPI(branchId)
  } catch (error) {
    logger.error('[Dashboard Module] getExecutiveKPI failed', error instanceof Error ? error.message : String(error))
    return {
      today_revenue: 0, today_transactions: 0, today_avg_basket: 0,
      today_customers_served: 0, today_refunds: 0, today_discounts: 0,
      today_gross_profit: 0, today_margin_pct: 0,
      stock_value: 0, cash_in_drawers: 0, outstanding_credit: 0,
      pending_pos: 0, transfers_in_transit: 0, employees_clocked_in: 0,
      total_inventory_items: 0, critical_stock_count: 0,
    }
  }
}

export async function getBranchPerformance(): Promise<BranchPerformance[]> {
  try {
    return await exec.getBranchPerformance()
  } catch (error) {
    logger.error('[Dashboard Module] getBranchPerformance failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getHourlySales(branchId?: string): Promise<SalesHourly[]> {
  try {
    return await exec.getHourlySales(branchId)
  } catch (error) {
    logger.error('[Dashboard Module] getHourlySales failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getTopProducts(limit?: number, branchId?: string): Promise<TopProduct[]> {
  try {
    return await exec.getTopProducts(limit, branchId)
  } catch (error) {
    logger.error('[Dashboard Module] getTopProducts failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getAIInsights(): Promise<AIInsight[]> {
  try {
    return await exec.getAIInsights()
  } catch (error) {
    logger.error('[Dashboard Module] getAIInsights failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ─── Type Re-exports ──────────────────────────────────────────────────────────
export type { ExecutiveKPI, BranchPerformance, SalesHourly, TopProduct, AIInsight } from '@/lib/executive-dashboard-actions'
