/**
 * KPI Tracker — Tracks, computes, and persists KPI snapshots.
 *
 * Sprint 11A: Infrastructure only — no computation logic.
 * Business logic implemented in Sprint 11B+.
 *
 * Responsibilities (future):
 * 1. Compute each KPI on its refresh cadence using analytics services
 * 2. Store snapshots in kpi_snapshots table
 * 3. Compare against targets and determine status
 * 4. Emit events on status changes
 */

import type {
  KPIDefinition,
  KPIId,
  KPISnapshot,
  KPIStatus,
  KPITarget,
  KPIQuery,
} from '../types'
import { kpiRepository } from '../repositories/kpi-repository'

/**
 * All 8 KPI definitions with formulas and refresh cadences.
 * These are the canonical KPI catalog for the Product Intelligence system.
 */
export const KPI_DEFINITIONS: Record<KPIId, KPIDefinition> = {
  revenue_velocity: {
    id: 'revenue_velocity',
    name: 'Revenue Velocity',
    description: 'Daily revenue run rate',
    formula: '∑(daily_revenue) / days',
    unit: 'currency',
    refreshCadence: 'daily',
    sourceService: 'salesAnalyticsService.getSalesMetrics()',
    targetSource: 'manual',
  },
  gross_margin_pct: {
    id: 'gross_margin_pct',
    name: 'Gross Margin %',
    description: 'Profit margin on goods sold',
    formula: '(revenue - cogs) / revenue * 100',
    unit: 'percentage',
    refreshCadence: 'daily',
    sourceService: 'financialAnalyticsService.getFinancialMetrics()',
    targetSource: 'industry_benchmark',
  },
  inventory_turnover: {
    id: 'inventory_turnover',
    name: 'Inventory Turnover',
    description: 'How quickly inventory sells',
    formula: 'cogs / average_inventory_value',
    unit: 'ratio',
    refreshCadence: 'weekly',
    sourceService: 'inventoryAnalyticsService.getStockTurnover()',
    targetSource: 'category_specific',
  },
  stockout_rate: {
    id: 'stockout_rate',
    name: 'Stockout Rate',
    description: 'Frequency of out-of-stock events',
    formula: 'out_of_stock_days / total_days',
    unit: 'percentage',
    refreshCadence: 'daily',
    sourceService: 'inventoryAnalyticsService.getInventoryMetrics()',
    targetSource: 'manual',
  },
  customer_retention: {
    id: 'customer_retention',
    name: 'Customer Retention',
    description: 'Repeat customer rate',
    formula: 'repeat_customers / total_customers',
    unit: 'percentage',
    refreshCadence: 'monthly',
    sourceService: 'customerAnalyticsService.getCustomerMetrics()',
    targetSource: 'manual',
  },
  order_accuracy: {
    id: 'order_accuracy',
    name: 'Order Accuracy',
    description: 'Orders processed without returns',
    formula: '(1 - returns_value / revenue) * 100',
    unit: 'percentage',
    refreshCadence: 'daily',
    sourceService: 'salesAnalyticsService.getSalesMetrics()',
    targetSource: 'manual',
  },
  labor_efficiency: {
    id: 'labor_efficiency',
    name: 'Labor Efficiency',
    description: 'Revenue generated per labor hour',
    formula: 'revenue_per_labor_hour',
    unit: 'currency',
    refreshCadence: 'weekly',
    sourceService: 'workforceAnalyticsService.getLaborCostAnalysis()',
    targetSource: 'manual',
  },
  ai_resolution_rate: {
    id: 'ai_resolution_rate',
    name: 'AI Resolution Rate',
    description: 'Successful AI tool executions rate',
    formula: 'successful_tools / total_queries',
    unit: 'percentage',
    refreshCadence: 'weekly',
    sourceService: 'ai_analytics (future)',
    targetSource: 'manual',
  },
}

/**
 * KPI Tracker — handles snapshot creation and status computation.
 *
 * Sprint 11A: Only catalog and data access wiring.
 * Full computation (reconcileAll, computeSnapshots) implemented in Sprint 11B.
 */
export class KPITracker {
  /**
   * Compute a KPI value using its source analytics service.
   * NOTE: Stub — actual computation implemented in Sprint 11B.
   */
  async computeKPI(kpiId: KPIId, branchId?: string): Promise<number> {
    void kpiId, branchId
    // TODO(Sprint 11B): Delegate to the appropriate analytics service
    throw new Error('KPI computation not yet implemented (Sprint 11B)')
  }

  /**
   * Determine KPI status by comparing value against target thresholds.
   */
  determineStatus(value: number, target: number | null): KPIStatus {
    if (target === null || target === 0) return 'no_target'

    // Default thresholds: symmetric absolute deviation from target
    // within 10% → on_track, within 20% → at_risk, else → behind
    const deviation = Math.abs(value - target) / target
    if (deviation <= 0.1) return 'on_track'
    if (deviation <= 0.2) return 'at_risk'
    return 'behind'
  }

  /**
   * Create and store a KPI snapshot (one KPI at a time).
   */
  async recordSnapshot(
    kpiId: KPIId,
    branchId: string | null,
    value: number,
    target: number | null,
    metadata?: Record<string, unknown>,
  ): Promise<KPISnapshot> {
    const status = this.determineStatus(value, target)
    return kpiRepository.insertSnapshot({ kpiId, branchId, value, target, status, metadata })
  }

  /**
   * Get the latest snapshot for a KPI.
   */
  getLatestSnapshot(kpiId: KPIId, branchId?: string): Promise<KPISnapshot | null> {
    return kpiRepository.getLatestSnapshot(kpiId, branchId ?? null)
  }

  /**
   * Get snapshot history for a KPI with optional filtering.
   */
  getSnapshotHistory(query: KPIQuery): Promise<KPISnapshot[]> {
    return kpiRepository.querySnapshots(query)
  }

  /**
   * Get all KPI definitions.
   */
  getDefinitions(): KPIDefinition[] {
    return Object.values(KPI_DEFINITIONS)
  }

  /**
   * Get a single KPI definition.
   */
  getDefinition(kpiId: KPIId): KPIDefinition | undefined {
    return KPI_DEFINITIONS[kpiId]
  }
}

export const kpiTracker = new KPITracker()
