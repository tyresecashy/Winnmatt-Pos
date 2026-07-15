/**
 * Product Intelligence — Module Adapter
 *
 * Public API surface for the Product Intelligence module.
 * All cross-module consumers should only import from this file.
 *
 * Sprint 11A: Module structure, types, and skeleton services.
 * Business logic implemented in Sprints 11B–11F.
 *
 * @see D-16 (docs/16_PRODUCT_INTELLIGENCE.md)
 */

// ─── Core Types ─────────────────────────────────────────────────
export type {
  // KPI
  KPIId,
  KPIStatus,
  KPIDefinition,
  KPISnapshot,
  KPITarget,
  KPIStatusChangeEvent,
  KPIThresholdBreachEvent,
  KPIQuery,

  // Scoring
  ScoreCategory,
  CustomerSegment,
  ProductScore,
  CustomerScore,
  SupplierScore,
  BusinessHealthScore,
  ScoreQuery,

  // Forecasting
  ForecastPeriod,
  ForecastMethod,
  SeasonalPattern,
  ForecastConfig,
  ForecastResult,
  RevenueForecast,
  ForecastQuery,

  // Recommendations
  CrossSellRecommendation,
  ReorderSuggestion,
  PriceSignal,
  ProductAffinity,
  RecommendationQuery,

  // Insights
  Anomaly,
  TrendAnalysis,

  // Lead Times
  ProductSupplierLeadTime,

  // Events
  PIEventType,
  PIEventPayload,

  // Config
  ProductIntelligenceConfig,
} from './types'

export { DEFAULT_PI_CONFIG, PI_EVENT_TYPES } from './types'

// ─── KPI Tracker ────────────────────────────────────────────────
export { kpiTracker, KPITracker, KPI_DEFINITIONS } from './kpi'
export { kpiTargetManager, KPITargetManager } from './kpi'

// ─── Repositories ───────────────────────────────────────────────
export { kpiRepository } from './repositories'
export { forecastRepository } from './repositories'
export { scoringRepository } from './repositories'
export { recommendationsRepository } from './repositories'

// ─── Scoring (Sprint 11B) ───────────────────────────────────────
export { productScorer, ProductScorer } from './scoring'
export { customerScorer, CustomerScorer } from './scoring'
export { supplierScorer, SupplierScorer } from './scoring'
export { businessHealthScorer, BusinessHealthScorer } from './scoring'

// ─── Forecasting (Sprint 11C) ───────────────────────────────────
export { demandForecaster, DemandForecaster } from './forecasting'
export { revenueForecaster, RevenueForecaster } from './forecasting'
export { seasonalityDetector, SeasonalityDetector } from './forecasting'

// ─── Recommendations (Sprint 11D) ───────────────────────────────
export { crossSellEngine, CrossSellEngine } from './recommendations'
export { reorderEngine, ReorderEngine } from './recommendations'
export { pricingEngine, PricingEngine } from './recommendations'

// ─── Insights (Sprint 11E) ──────────────────────────────────────
export { anomalyDetector, AnomalyDetector } from './insights'
export { trendAnalyzer, TrendAnalyzer } from './insights'

// ─── Infrastructure (Sprint 11F) ────────────────────────────────
export { piCache, PICache } from './cache'
export {
  scoreKey, forecastKey, revenueForecastKey, seasonalityKey,
  affinityKey, reorderKey, kpiKey, healthKey, anomalyKey, trendKey,
} from './cache'
export { resilientCall, withRetry, withTimeout, CircuitBreaker } from './reliability'
export { timed, timedSync, generatePerformanceReport, resetMetrics } from './instrumentation'
export type { TimerResult, Histogram, CacheMetrics, PerformanceReport } from './instrumentation'
export {
  assessConfidence, canUseZScore, canUseRegression, canUseSeasonalDecomposition,
  canUseAffinityMining, canUseRFM, isColdStart, selectForecastMethod,
  getFallbackStrategy, confidenceWeight,
} from './cold-start'
export type { ConfidenceAssessment, ConfidenceLevel, FallbackStrategy } from './cold-start'
export {
  chunkedUpsert, batchFetchProductScores, batchFetchForecasts,
  executeQuery, PRODUCT_SCORE_COLUMNS, CUSTOMER_SCORE_COLUMNS,
  SUPPLIER_SCORE_COLUMNS, BUSINESS_HEALTH_COLUMNS,
} from './db-utils'

// ─── Events ─────────────────────────────────────────────────────
export {
  createKPIStatusChangeEvent,
  createKPIThresholdBreachEvent,
  createScoringCompletedEvent,
  createForecastUpdatedEvent,
  createRecommendationGeneratedEvent,
  createReorderAlertEvent,
  createAnomalyDetectedEvent,
  PI_EVENT_NAMES,
} from './events'

export { registerSubscriptions, registerScheduledTasks } from './events/subscriptions'
