/**
 * Product Intelligence — TypeScript type definitions
 *
 * All PI-specific types live here. These are intentionally independent
 * from database.types.ts to avoid the TD-001 (as unknown cast) issue.
 *
 * @see lib/modules/product-intelligence/index.ts
 */

// ─── KPI Types ────────────────────────────────────────────────────

export type KPIStatus = 'on_track' | 'at_risk' | 'behind' | 'no_target'

export type KPIId =
  | 'revenue_velocity'
  | 'gross_margin_pct'
  | 'inventory_turnover'
  | 'stockout_rate'
  | 'customer_retention'
  | 'order_accuracy'
  | 'labor_efficiency'
  | 'ai_resolution_rate'

export interface KPIDefinition {
  id: KPIId
  name: string
  description: string
  formula: string
  unit: 'currency' | 'percentage' | 'ratio' | 'count' | 'rate'
  refreshCadence: 'daily' | 'weekly' | 'monthly'
  sourceService: string
  targetSource: 'manual' | 'industry_benchmark' | 'category_specific'
}

export interface KPISnapshot {
  id: string
  kpiId: KPIId
  branchId: string | null
  value: number
  target: number | null
  status: KPIStatus
  computedAt: string
  metadata: Record<string, unknown> | null
}

export interface KPITarget {
  kpiId: KPIId
  branchId: string | null
  targetValue: number
  threshold: {
    /** Below this value → behind */
    critical: number
    /** Below this value → at_risk */
    warning: number
  }
  setBy: string
  setAt: string
  notes?: string
}

export interface KPIStatusChangeEvent {
  kpiId: KPIId
  branchId: string | null
  previousStatus: KPIStatus
  newStatus: KPIStatus
  value: number
  target: number | null
}

export interface KPIThresholdBreachEvent {
  kpiId: KPIId
  branchId: string | null
  value: number
  threshold: number
  direction: 'above' | 'below'
}

// ─── Scoring Types ────────────────────────────────────────────────

export type ScoreCategory = 'star' | 'cash_cow' | 'question_mark' | 'dog' | 'dead'

export type CustomerSegment =
  | 'champions'
  | 'loyal'
  | 'new'
  | 'at_risk'
  | 'lost'
  | 'promising'
  | 'need_attention'

export interface ProductScore {
  productId: string
  productName: string
  productCategory: string
  velocityScore: number       // 0–100
  marginScore: number         // 0–100
  stabilityScore: number      // 0–100
  seasonalityScore: number    // 0–100
  compositeScore: number      // 0–100
  scoreCategory: ScoreCategory
  rank: number                // Within productCategory
  computedAt: string
}

export interface CustomerScore {
  customerId: string
  customerName: string
  recencyScore: number        // 0–100
  frequencyScore: number      // 0–100
  monetaryScore: number       // 0–100
  loyaltyScore: number        // 0–100
  compositeScore: number      // 0–100
  segment: CustomerSegment
  churnRisk: number           // 0–1
  lifetimeValue: number
  rank: number
  computedAt: string
}

export interface SupplierScore {
  supplierId: string
  supplierName: string
  qualityScore: number        // 0–100
  reliabilityScore: number    // 0–100
  priceScore: number          // 0–100
  leadTimeScore: number       // 0–100
  compositeScore: number      // 0–100
  rank: number
  computedAt: string
}

export interface BusinessHealthScore {
  revenueHealth: number       // 0–100
  marginHealth: number        // 0–100
  inventoryHealth: number     // 0–100
  customerHealth: number      // 0–100
  cashHealth: number          // 0–100
  workforceHealth: number     // 0–100
  compositeScore: number      // 0–100 (weighted)
  trend: 'improving' | 'stable' | 'declining'
  computedAt: string
}

// ─── Forecasting Types ────────────────────────────────────────────

export type ForecastPeriod = 'day' | 'week' | 'month'

export type ForecastMethod =
  | 'simple_moving_average'
  | 'weighted_moving_average'
  | 'exponential_smoothing'
  | 'linear_regression'
  | 'seasonal_decomposition'
  | 'holt_winters'

export type SeasonalPattern = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'none'

export interface ForecastConfig {
  method?: ForecastMethod      // Optional — 'auto' selection when omitted
  periods: number              // How many periods to forecast
  seasonalityPeriod?: number   // For seasonal methods (e.g., 7 for weekly)
  alpha?: number               // Exponential smoothing factor
  beta?: number                // Trend smoothing factor (Holt-Winters)
  gamma?: number               // Seasonal smoothing factor (Holt-Winters)
}

export interface ForecastResult {
  productId: string
  branchId: string | null
  period: ForecastPeriod
  forecastValues: number[]
  confidenceInterval: {
    upper: number[]
    lower: number[]
    confidence: 0.80 | 0.90 | 0.95
  }
  method: ForecastMethod
  accuracy: {
    mape: number               // Mean Absolute Percentage Error
    mase: number               // Mean Absolute Scaled Error
  } | null
  seasonality: {
    pattern: SeasonalPattern
    factors: number[]          // Seasonal multipliers
  } | null
  predictionHorizon: number    // Number of periods predicted
  dataPoints: number           // Number of data points used
  computedAt: string
  expiresAt: string
}

export interface RevenueForecast {
  branchId: string | null
  period: ForecastPeriod
  forecastValues: number[]
  confidenceInterval: {
    upper: number[]
    lower: number[]
    confidence: 0.80 | 0.90 | 0.95
  }
  method: ForecastMethod
  accuracy: { mape: number; mase: number } | null
  seasonality: { pattern: SeasonalPattern; factors: number[] } | null
  projectedTotal: number
  currentPeriodTotal: number
  growthRate: number | null
  predictionHorizon: number    // Number of periods predicted
  dataPoints: number           // Number of data points used
  computedAt: string
  expiresAt: string
}

export interface ForecastAccuracyLog {
  id: string
  productId: string | null
  branchId: string | null
  method: ForecastMethod
  mape: number
  mase: number | null
  actualValues: number[]
  predictedValues: number[]
  dataPoints: number
  evaluatedAt: string
}

// ─── Recommendation Types ─────────────────────────────────────────

export interface CrossSellRecommendation {
  productId: string
  productName: string
  score: number                // Affinity / lift score
  confidence: number           // 0–1
  reason: string               // e.g., "Often bought together with..."
  imageUrl?: string
  price: number
}

export interface ReorderSuggestion {
  productId: string
  productName: string
  currentStock: number
  forecastDailyDemand: number
  demandStdDev: number
  leadTimeDays: number
  serviceLevel: number
  safetyStock: number
  reorderPoint: number
  economicOrderQty: number
  suggestedOrderQty: number
  daysUntilStockout: number
  urgency: 'immediate' | 'soon' | 'normal' | 'sufficient'
  estimatedCost: number
  preferredSupplierId: string | null
}

export interface PriceSignal {
  productId: string
  productName: string
  currentPrice: number
  suggestedPrice: number | null
  signal: 'raise' | 'lower' | 'hold' | 'promote'
  confidence: number           // 0–1
  reason: string
  elasticity: number | null    // Price elasticity estimate
}

export interface ProductAffinity {
  productA: string
  productB: string
  lift: number                 // P(B|A) / P(B)
  confidence: number           // P(A ∩ B)
  support: number              // P(A ∩ B) as fraction of all transactions
  occurrences: number          // Raw count of co-occurrences
  computedAt: string
}

// ─── Insight Types ────────────────────────────────────────────────

export interface Anomaly {
  entityType: 'product' | 'customer' | 'sale' | 'inventory' | 'kpi'
  entityId: string
  entityName: string
  metric: string
  expectedValue: number
  actualValue: number
  deviation: number            // Standard deviations from mean
  direction: 'spike' | 'drop' | 'unusual'
  severity: 'critical' | 'high' | 'medium' | 'low'
  detectedAt: string
  details: string
}

export interface TrendAnalysis {
  entityType: 'product' | 'customer' | 'kpi' | 'revenue'
  entityId: string
  entityName: string
  metric: string
  direction: 'up' | 'down' | 'stable' | 'volatile'
  changePct: number
  period: '7d' | '30d' | '90d'
  significance: 'high' | 'medium' | 'low'
  description: string
  analyzedAt: string
}

// ─── Product-Supplier Lead Time ───────────────────────────────────

export interface ProductSupplierLeadTime {
  productId: string
  supplierId: string
  leadTimeDays: number
  leadTimeStdDev: number | null
  lastOrderDate: string | null
  sampleSize: number
}

// ─── Repository Query Types ───────────────────────────────────────

export interface KPIQuery {
  kpiIds?: KPIId[]
  branchId?: string
  startDate?: string
  endDate?: string
  status?: KPIStatus
  limit?: number
  offset?: number
}

export interface ForecastQuery {
  productId?: string
  branchId?: string
  method?: ForecastMethod
  computedBefore?: string
  limit?: number
}

export interface ScoreQuery {
  type: 'product' | 'customer' | 'supplier'
  branchId?: string
  minScore?: number
  maxScore?: number
  category?: ScoreCategory | CustomerSegment
  limit?: number
  offset?: number
}

export interface RecommendationQuery {
  productId?: string
  branchId?: string
  urgency?: 'immediate' | 'soon' | 'normal' | 'sufficient'
  limit?: number
}

// ─── Event Types ──────────────────────────────────────────────────

export type PIEventType =
  | 'kpi.status_changed'
  | 'kpi.threshold_breached'
  | 'scoring.completed'
  | 'forecast.updated'
  | 'reorder.alert'
  | 'recommendation.generated'
  | 'anomaly.detected'

export const PI_EVENT_TYPES = {
  KPI_STATUS_CHANGED: 'kpi.status_changed' as PIEventType,
  KPI_THRESHOLD_BREACHED: 'kpi.threshold_breached' as PIEventType,
  SCORING_COMPLETED: 'scoring.completed' as PIEventType,
  FORECAST_UPDATED: 'forecast.updated' as PIEventType,
  REORDER_ALERT: 'reorder.alert' as PIEventType,
  RECOMMENDATION_GENERATED: 'recommendation.generated' as PIEventType,
  ANOMALY_DETECTED: 'anomaly.detected' as PIEventType,
} as const

export type PIEventPayload =
  | { eventType: 'kpi.status_changed'; data: KPIStatusChangeEvent }
  | { eventType: 'kpi.threshold_breached'; data: KPIThresholdBreachEvent }
  | { eventType: 'scoring.completed'; data: { scoreType: 'product' | 'customer' | 'supplier'; count: number; timestamp: string } }
  | { eventType: 'forecast.updated'; data: { productId: string; branchId: string | null; method: ForecastMethod; mape: number | null } }
  | { eventType: 'reorder.alert'; data: { productId: string; branchId: string | null; urgency: ReorderSuggestion['urgency']; currentStock: number; reorderPoint: number } }
  | { eventType: 'recommendation.generated'; data: { recommendationType: 'cross-sell' | 'reorder' | 'pricing'; productId: string; branchId: string | null; timestamp: string } }
  | { eventType: 'anomaly.detected'; data: Anomaly }

// ─── Module Config ────────────────────────────────────────────────

export interface ProductIntelligenceConfig {
  /** Maximum products to score per batch */
  maxBatchSize: number
  /** Default lead time for products without supplier data */
  defaultLeadTimeDays: number
  /** Default service level for reorder calculations */
  defaultServiceLevel: number
  /** Retention period for KPI snapshots (days) */
  kpiRetentionDays: number
  /** Whether Redis caching is enabled for scores */
  cacheEnabled: boolean
  /** Cold-start period: products/customers with less data fall back */
  coldStartDays: number
}

export const DEFAULT_PI_CONFIG: ProductIntelligenceConfig = {
  maxBatchSize: 500,
  defaultLeadTimeDays: 7,
  defaultServiceLevel: 0.95,
  kpiRetentionDays: 90,
  cacheEnabled: false,
  coldStartDays: 30,
}
