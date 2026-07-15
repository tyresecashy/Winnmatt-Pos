/**
 * Cold-Start Handling — Graceful degradation for insufficient historical data.
 *
 * The Product Intelligence system requires sufficient transaction history
 * to produce meaningful results. This module provides:
 * - Data sufficiency checks (does the dataset have enough points?)
 * - Confidence degradation signals (how reliable is this result?)
 * - Fallback algorithms (simpler methods when data is scarce)
 * - Bootstrap guidance (what to recommend until data accumulates)
 *
 * Sprint 11F — Production Hardening.
 *
 * Design:
 * - Pure functions — no side effects, testable
 * - Conservative defaults: prefer "not enough data" over bad results
 * - Return confidence alongside every result so callers can degrade UX
 */

// ─── Thresholds ──────────────────────────────────────────────────

export const THRESHOLDS = {
  /** Minimum data points for any statistical analysis */
  MIN_DATA_POINTS: 5,
  /** Minimum data points for Z-score based anomaly detection */
  MIN_ZSCORE_POINTS: 15,
  /** Minimum data points for seasonal decomposition (at least one full seasonal cycle) */
  MIN_SEASONAL_POINTS: 12,
  /** Minimum data points for Holt-Winters forecasting (needs more data for triple smoothing) */
  MIN_HOLT_WINTERS_POINTS: 30,
  /** Minimum data points for linear regression */
  MIN_REGRESSION_POINTS: 10,
  /** Minimum data points for product affinity mining */
  MIN_AFFINITY_TRANSACTIONS: 50,
  /** Minimum data points for RFM customer scoring */
  MIN_RFM_TRANSACTIONS: 20,
  /** Minimum data points for reliable MAPE evaluation */
  MIN_MAPE_EVALUATION_POINTS: 10,
  /** Days of history considered "cold start" for a new product */
  COLD_START_DAYS: 30,
  /** Days of history considered "cold start" for a new branch */
  BRANCH_COLD_START_DAYS: 60,
} as const

// ─── Confidence Levels ──────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient'

export interface ConfidenceAssessment {
  level: ConfidenceLevel
  dataPoints: number
  requiredPoints: number
  /** Human-readable message about confidence */
  message: string
}

// ─── Assessment Functions ────────────────────────────────────────

/**
 * Assess confidence based on available data points vs threshold.
 */
export function assessConfidence(
  dataPoints: number,
  requiredPoints: number,
  label: string,
): ConfidenceAssessment {
  if (dataPoints <= 0) {
    return {
      level: 'insufficient',
      dataPoints,
      requiredPoints,
      message: `No data available for ${label}`,
    }
  }
  if (dataPoints < THRESHOLDS.MIN_DATA_POINTS) {
    return {
      level: 'insufficient',
      dataPoints,
      requiredPoints,
      message: `Insufficient data for ${label}: ${dataPoints} points (need ${requiredPoints})`,
    }
  }
  if (dataPoints < requiredPoints * 0.5) {
    return {
      level: 'low',
      dataPoints,
      requiredPoints,
      message: `Low confidence for ${label}: ${dataPoints}/${requiredPoints} points — consider simpler method`,
    }
  }
  if (dataPoints < requiredPoints) {
    return {
      level: 'medium',
      dataPoints,
      requiredPoints,
      message: `Moderate confidence for ${label}: ${dataPoints}/${requiredPoints} points`,
    }
  }
  return {
    level: 'high',
    dataPoints,
    requiredPoints,
    message: `High confidence for ${label}: ${dataPoints} points (exceeds ${requiredPoints} threshold)`,
  }
}

/**
 * Check if a dataset has enough data for Z-score anomaly detection.
 * Z-scores require ≥15 points to avoid masking (single extreme inflates stddev).
 */
export function canUseZScore(dataPoints: number): ConfidenceAssessment {
  return assessConfidence(dataPoints, THRESHOLDS.MIN_ZSCORE_POINTS, 'Z-score anomaly detection')
}

/**
 * Check if a dataset has enough data for seasonal decomposition.
 */
export function canUseSeasonalDecomposition(dataPoints: number): ConfidenceAssessment {
  return assessConfidence(dataPoints, THRESHOLDS.MIN_SEASONAL_POINTS, 'seasonal decomposition')
}

/**
 * Check if a dataset has enough data for linear regression.
 */
export function canUseRegression(dataPoints: number): ConfidenceAssessment {
  return assessConfidence(dataPoints, THRESHOLDS.MIN_REGRESSION_POINTS, 'linear regression')
}

/**
 * Check if a dataset has enough data for product affinity mining.
 */
export function canUseAffinityMining(transactionCount: number): ConfidenceAssessment {
  return assessConfidence(transactionCount, THRESHOLDS.MIN_AFFINITY_TRANSACTIONS, 'affinity mining')
}

/**
 * Check if a dataset has enough data for RFM scoring.
 */
export function canUseRFM(transactionCount: number): ConfidenceAssessment {
  return assessConfidence(transactionCount, THRESHOLDS.MIN_RFM_TRANSACTIONS, 'RFM scoring')
}

/**
 * Check if a product is in cold-start period.
 */
export function isColdStart(daysSinceCreation: number, label: string): ConfidenceAssessment {
  const required = THRESHOLDS.COLD_START_DAYS
  const dataPoints = daysSinceCreation
  return assessConfidence(dataPoints, required, label)
}

/**
 * Check if a branch is in cold-start period.
 */
export function isBranchColdStart(daysSinceCreation: number): ConfidenceAssessment {
  return assessConfidence(daysSinceCreation, THRESHOLDS.BRANCH_COLD_START_DAYS, 'branch cold start')
}

// ─── Fallback Recommendations ────────────────────────────────────

export interface FallbackStrategy {
  method: string
  description: string
  confidence: ConfidenceLevel
  /** The simpler method to use when the main method is unavailable */
  fallbackTo: string
}

/**
 * Get fallback strategy when the preferred method has insufficient data.
 */
export function getFallbackStrategy(preferredMethod: string): FallbackStrategy | null {
  const fallbacks: Record<string, FallbackStrategy> = {
    'holt-winters': {
      method: 'Holt-Winters',
      description: 'Requires 24+ data points for reliable triple exponential smoothing',
      confidence: 'medium',
      fallbackTo: 'exponential-smoothing',
    },
    'exponential-smoothing': {
      method: 'Exponential Smoothing',
      description: 'Works with 5+ data points, no seasonality support',
      confidence: 'low',
      fallbackTo: 'sma',
    },
    'seasonal-decomposition': {
      method: 'Seasonal Decomposition',
      description: 'Requires 30+ data points for reliable seasonal factor extraction',
      confidence: 'medium',
      fallbackTo: 'linear-regression',
    },
    'linear-regression': {
      method: 'Linear Regression',
      description: 'Works with 10+ data points for trend detection',
      confidence: 'low',
      fallbackTo: 'sma',
    },
    'zscore-anomaly': {
      method: 'Z-score Anomaly Detection',
      description: 'Requires 15+ data points to avoid stddev masking',
      confidence: 'low',
      fallbackTo: 'iqr',
    },
    'rfm-scoring': {
      method: 'RFM Customer Scoring',
      description: 'Requires 20+ transactions per customer for meaningful segments',
      confidence: 'low',
      fallbackTo: 'recency-only',
    },
    'affinity-mining': {
      method: 'Product Affinity Mining',
      description: 'Requires 50+ transactions for reliable lift/confidence metrics',
      confidence: 'low',
      fallbackTo: 'popularity-based',
    },
  }

  return fallbacks[preferredMethod] ?? null
}

/**
 * Get a confidence value (0–1) based on data points vs threshold.
 * Use to degrade weights in scoring formulas.
 */
export function confidenceWeight(dataPoints: number, requiredPoints: number): number {
  if (dataPoints <= 0) return 0
  if (dataPoints >= requiredPoints) return 1
  // Linear ramp from 0 to 1
  return Math.round((dataPoints / requiredPoints) * 100) / 100
}

/**
 * Determine if we should use a simpler forecasting method based on data volume.
 */
export function selectForecastMethod(
  dataPoints: number,
  hasSeasonality: boolean,
): { method: string; confidence: ConfidenceLevel } {
  // Holt-Winters (best, needs most data)
  if (hasSeasonality && dataPoints >= THRESHOLDS.MIN_HOLT_WINTERS_POINTS) {
    return { method: 'holt-winters', confidence: 'high' }
  }
  // Seasonal Decomposition (good, moderate data)
  if (hasSeasonality && dataPoints >= THRESHOLDS.MIN_SEASONAL_POINTS) {
    return { method: 'seasonal-decomposition', confidence: 'medium' }
  }
  // Linear Regression (basic, less data)
  if (dataPoints >= THRESHOLDS.MIN_REGRESSION_POINTS) {
    return { method: 'linear-regression', confidence: 'medium' }
  }
  // Exponential Smoothing (minimal data)
  if (dataPoints >= THRESHOLDS.MIN_DATA_POINTS) {
    return { method: 'exponential-smoothing', confidence: 'low' }
  }
  // Simple Moving Average (tiny data)
  if (dataPoints >= 3) {
    return { method: 'sma', confidence: 'low' }
  }
  // Nothing useful
  return { method: 'none', confidence: 'insufficient' }
}
