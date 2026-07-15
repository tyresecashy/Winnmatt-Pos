/**
 * Forecasting Math — Pure statistical forecasting functions.
 *
 * All functions are synchronous pure math — no DB, no I/O, no side effects.
 * Designed to be unit-testable without mocking anything.
 *
 * Methods:
 * - simpleMovingAverage (SMA)
 * - weightedMovingAverage (WMA)
 * - exponentialSmoothing (ES)
 * - linearRegression (LR)
 * - seasonalDecomposition (SD)
 * - holtWinters (HW)
 *
 * Helpers:
 * - computeMAPE — Mean Absolute Percentage Error
 * - computeMASE — Mean Absolute Scaled Error
 * - computeConfidenceIntervals — Upper/lower bounds via residual stddev
 * - autoSelectMethod — Run all methods, pick lowest MAPE
 *
 * @see ../types.ts (ForecastMethod, ForecastConfig)
 */

// ─── Return Types ──────────────────────────────────────────────────

export interface ForecastMathResult {
  forecast: number[]       // Predicted values for future periods
  fitted: number[]         // In-sample predictions
  mape: number
  mase: number | null
  residuals: number[]
  methodLabel: string
}

export interface SeasonalMathResult {
  factors: number[]        // Seasonal multipliers (length = period)
  trend: number[]          // Detrended series
  residual: number[]       // Remainder
  strength: number         // 0–1, how dominant the seasonal component is
  pattern: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'none'
}

export interface HoltWintersResult {
  forecast: number[]
  mape: number
  level: number[]
  trend: number[]
  seasonal: number[]
}

// ─── Helpers ───────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function sum(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0)
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const sqDiffs = arr.map(v => (v - m) ** 2)
  return Math.sqrt(sum(sqDiffs) / (arr.length - 1))
}

/** Round to 4 decimal places for stable test assertions */
function r4(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000
}

// ─── MAPE / MASE ───────────────────────────────────────────────────

/**
 * Mean Absolute Percentage Error.
 * Returns null if actual data has zeros (division by zero).
 */
export function computeMAPE(actual: number[], predicted: number[]): number | null {
  if (actual.length === 0 || predicted.length === 0 || actual.length !== predicted.length) return null
  const n = actual.length
  let sumAPE = 0
  for (let i = 0; i < n; i++) {
    if (actual[i] === 0) return null // Can't compute percentage error with zero actual
    sumAPE += Math.abs((actual[i] - predicted[i]) / actual[i])
  }
  return r4((sumAPE / n) * 100)
}

/**
 * Mean Absolute Scaled Error.
 * Uses naive random walk forecast (prev value) as baseline.
 * Returns null if data is too short.
 */
export function computeMASE(actual: number[], predicted: number[]): number | null {
  if (actual.length < 2 || predicted.length === 0 || actual.length !== predicted.length) return null
  // Naive forecast errors (one-step random walk)
  let naiveSum = 0
  for (let i = 1; i < actual.length; i++) {
    naiveSum += Math.abs(actual[i] - actual[i - 1])
  }
  const meanNaiveError = naiveSum / (actual.length - 1)
  if (meanNaiveError === 0) return null
  // Forecast errors
  let forecastSum = 0
  for (let i = 0; i < actual.length; i++) {
    forecastSum += Math.abs(actual[i] - predicted[i])
  }
  const meanForecastError = forecastSum / actual.length
  return r4(meanForecastError / meanNaiveError)
}

/**
 * Compute confidence intervals from prediction residuals.
 * Returns upper and lower bounds at the specified confidence level.
 */
export function computeConfidenceIntervals(
  forecast: number[],
  residuals: number[],
  confidence: 0.80 | 0.90 | 0.95 = 0.90,
): { upper: number[]; lower: number[] } {
  const residualStd = stddev(residuals)
  const z = confidence === 0.80 ? 1.282 : confidence === 0.90 ? 1.645 : 1.96
  const margin = residualStd * z
  return {
    upper: forecast.map(v => r4(v + margin)),
    lower: forecast.map(v => r4(Math.max(0, v - margin))),
  }
}

// ─── Simple Moving Average (SMA) ───────────────────────────────────

/**
 * SMA: Average of the last `window` observations.
 * Forecast: repeats the last SMA value for each future period.
 */
export function simpleMovingAverage(
  data: number[],
  window: number,
  forecastPeriods: number,
): ForecastMathResult {
  const n = data.length
  const effectiveWindow = Math.min(window, Math.max(1, n))
  const fitted: number[] = []
  const residuals: number[] = []

  for (let i = 0; i < n; i++) {
    if (i < effectiveWindow - 1) {
      fitted.push(data[i])
      residuals.push(0)
    } else {
      const slice = data.slice(i - effectiveWindow + 1, i + 1)
      const avg = r4(mean(slice))
      fitted.push(avg)
      residuals.push(r4(data[i] - avg))
    }
  }

  // Last SMA value becomes the forecast
  const lastSMA = fitted[fitted.length - 1] ?? mean(data)
  const forecast: number[] = []
  for (let i = 0; i < forecastPeriods; i++) {
    forecast.push(r4(lastSMA))
  }

  // Fit residuals on overlap
  const overlapLen = Math.min(fitted.length, residuals.length)
  const overlapResiduals = residuals.slice(-overlapLen)
  const mape = computeMAPE(data.slice(-overlapLen), fitted.slice(-overlapLen))
  const mase = computeMASE(data.slice(-overlapLen), fitted.slice(-overlapLen))

  return {
    forecast,
    fitted,
    mape: mape ?? 999,
    mase,
    residuals: overlapResiduals,
    methodLabel: `simple_moving_average(${effectiveWindow})`,
  }
}

// ─── Weighted Moving Average (WMA) ─────────────────────────────────

/**
 * WMA: Weighted average of the last `window` observations.
 * More recent observations get higher weight (linear decay by default).
 */
export function weightedMovingAverage(
  data: number[],
  window: number,
  forecastPeriods: number,
  weights?: number[],
): ForecastMathResult {
  const n = data.length
  const effectiveWindow = Math.min(window, Math.max(1, n))

  // Default linear weights: most recent gets highest
  const w = weights ?? Array.from({ length: effectiveWindow }, (_, i) => i + 1)
  const weightSum = sum(w)

  const fitted: number[] = []
  const residuals: number[] = []

  for (let i = 0; i < n; i++) {
    if (i < effectiveWindow - 1) {
      fitted.push(data[i])
      residuals.push(0)
    } else {
      const slice = data.slice(i - effectiveWindow + 1, i + 1)
      let wAvg = 0
      for (let j = 0; j < effectiveWindow; j++) {
        wAvg += slice[j] * w[j]
      }
      wAvg = r4(wAvg / weightSum)
      fitted.push(wAvg)
      residuals.push(r4(data[i] - wAvg))
    }
  }

  const lastWMA = fitted[fitted.length - 1] ?? mean(data)
  const forecast: number[] = []
  for (let i = 0; i < forecastPeriods; i++) {
    forecast.push(r4(lastWMA))
  }

  const overlapLen = Math.min(fitted.length, residuals.length)
  const mape = computeMAPE(data.slice(-overlapLen), fitted.slice(-overlapLen))
  const mase = computeMASE(data.slice(-overlapLen), fitted.slice(-overlapLen))

  return {
    forecast,
    fitted,
    mape: mape ?? 999,
    mase,
    residuals: residuals.slice(-overlapLen),
    methodLabel: `weighted_moving_average(${effectiveWindow})`,
  }
}

// ─── Exponential Smoothing (ES) ────────────────────────────────────

/**
 * Simple Exponential Smoothing.
 * s[0] = data[0]; s[t] = alpha * data[t] + (1-alpha) * s[t-1]
 * Forecast = last smoothed value repeated.
 */
export function exponentialSmoothing(
  data: number[],
  alpha: number,
  forecastPeriods: number,
): ForecastMathResult {
  const n = data.length
  const effectiveAlpha = Math.max(0.01, Math.min(0.99, alpha))

  const smoothed: number[] = []
  const residuals: number[] = []

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      smoothed.push(data[0])
      residuals.push(0)
    } else {
      const s = r4(effectiveAlpha * data[i] + (1 - effectiveAlpha) * smoothed[i - 1])
      smoothed.push(s)
      residuals.push(r4(data[i] - s))
    }
  }

  const lastS = smoothed[smoothed.length - 1] ?? 0
  const forecast: number[] = []
  for (let i = 0; i < forecastPeriods; i++) {
    forecast.push(r4(lastS))
  }

  // Evaluate on last 20% or at least 3 points
  const evalCount = Math.max(3, Math.floor(n * 0.2))
  const evalData = data.slice(-evalCount)
  const evalSmoothed = smoothed.slice(-evalCount)
  const mape = computeMAPE(evalData, evalSmoothed)
  const mase = computeMASE(evalData, evalSmoothed)

  return {
    forecast,
    fitted: smoothed,
    mape: mape ?? 999,
    mase,
    residuals,
    methodLabel: `exponential_smoothing(${r4(effectiveAlpha)})`,
  }
}

// ─── Linear Regression (LR) ────────────────────────────────────────

/**
 * Linear Regression: y = slope * x + intercept.
 * Uses time index (0..n-1) as predictor.
 */
export function linearRegression(
  data: number[],
  forecastPeriods: number,
): ForecastMathResult {
  const n = data.length
  const x = Array.from({ length: n }, (_, i) => i)
  const y = data

  const sumX = sum(x)
  const sumY = sum(y)
  const sumXY = sum(x.map((xi, i) => xi * y[i]))
  const sumX2 = sum(x.map(xi => xi * xi))

  const slope = n * sumXY - sumX * sumY !== 0
    ? r4((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX))
    : 0
  const intercept = r4((sumY - slope * sumX) / n)

  const fitted: number[] = x.map(xi => r4(slope * xi + intercept))
  const residuals: number[] = y.map((yi, i) => r4(yi - fitted[i]))

  const forecast: number[] = []
  for (let i = 1; i <= forecastPeriods; i++) {
    forecast.push(r4(slope * (n - 1 + i) + intercept))
  }

  // R² for goodness of fit
  const yMean = mean(y)
  const ssRes = sum(residuals.map(r => r * r))
  const ssTot = sum(y.map(yi => (yi - yMean) ** 2))
  const r2 = ssTot !== 0 ? r4(1 - ssRes / ssTot) : 0

  const mape = computeMAPE(y, fitted)
  const mase = computeMASE(y, fitted)

  return {
    forecast,
    fitted,
    mape: mape ?? 999,
    mase,
    residuals,
    methodLabel: `linear_regression(r²=${r2})`,
  }
}

// ─── Seasonal Decomposition ────────────────────────────────────────

/**
 * Detect period for seasonal decomposition by trying common periods.
 * Returns the period with the highest seasonal strength.
 */
export function detectBestPeriod(data: number[], maxPeriod: number = 90): number {
  const candidates = [7, 12, 24, 28, 30, 90].filter(p => p <= maxPeriod && p < data.length / 2)
  if (candidates.length === 0) return 7

  let bestPeriod = 7
  let bestStrength = -1

  for (const period of candidates) {
    const result = seasonalDecomposition(data, period)
    if (result.strength > bestStrength) {
      bestStrength = result.strength
      bestPeriod = period
    }
  }

  return bestPeriod
}

/**
 * Classify a seasonal pattern based on period and strength.
 */
export function classifyPattern(period: number, strength: number): 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'none' {
  if (strength < 0.15) return 'none'
  if (period <= 1) return 'daily'
  if (period <= 7) return 'weekly'
  if (period <= 31) return 'monthly'
  if (period <= 92) return 'quarterly'
  return 'none'
}

/**
 * Seasonal Decomposition using ratio-to-moving-average (multiplicative).
 * - Computes trend via centered moving average
 * - Extracts seasonal factors by averaging detrended values at each phase
 * - Computes strength = 1 - var(residual) / var(detrended)
 */
export function seasonalDecomposition(
  data: number[],
  period: number,
): SeasonalMathResult {
  const n = data.length
  const effectivePeriod = Math.min(period, Math.max(2, Math.floor(n / 2)))

  // Step 1: Trend via centered moving average
  const trend: number[] = []
  for (let i = 0; i < n; i++) {
    const half = Math.floor(effectivePeriod / 2)
    const start = Math.max(0, i - half)
    const end = Math.min(n - 1, i + half)
    const slice = data.slice(start, end + 1)
    trend.push(r4(mean(slice)))
  }

  // Step 2: Detrended = data / trend (multiplicative), handle zero/negative
  const detrended: number[] = []
  for (let i = 0; i < n; i++) {
    if (trend[i] <= 0) {
      detrended.push(1)
    } else {
      detrended.push(r4(data[i] / trend[i]))
    }
  }

  // Step 3: Seasonal factors — average detrended at each phase
  const factors: number[] = []
  for (let p = 0; p < effectivePeriod; p++) {
    const values: number[] = []
    for (let i = p; i < n; i += effectivePeriod) {
      values.push(detrended[i])
    }
    const avg = values.length > 0 ? mean(values) : 1
    factors.push(r4(avg))
  }

  // Normalize factors to sum to period (multiplicative)
  const factorSum = sum(factors)
  if (factorSum > 0) {
    const scale = effectivePeriod / factorSum
    for (let i = 0; i < factors.length; i++) {
      factors[i] = r4(factors[i] * scale)
    }
  }

  // Step 4: Residuals
  const residual: number[] = []
  for (let i = 0; i < n; i++) {
    const sf = factors[i % effectivePeriod]
    if (sf === 0) {
      residual.push(0)
    } else {
      residual.push(r4(detrended[i] / sf))
    }
  }

  // Step 5: Strength of seasonality
  const varResidual = stddev(residual) ** 2
  const varDetrended = stddev(detrended) ** 2
  const strength = varDetrended > 0
    ? r4(Math.max(0, Math.min(1, 1 - varResidual / varDetrended)))
    : 0

  return {
    factors,
    trend,
    residual,
    strength,
    pattern: classifyPattern(effectivePeriod, strength),
  }
}

// ─── Holt-Winters (Triple Exponential Smoothing) ───────────────────

/**
 * Holt-Winters Triple Exponential Smoothing (multiplicative seasonality).
 *
 * Formulas:
 *   level[t]     = alpha * (data[t] / seasonal[t-seasonLength]) + (1-alpha) * (level[t-1] + trend[t-1])
 *   trend[t]     = beta * (level[t] - level[t-1]) + (1-beta) * trend[t-1]
 *   seasonal[t]  = gamma * (data[t] / level[t]) + (1-gamma) * seasonal[t-seasonLength]
 *   forecast[t+1]= (level[t] + trend[t]) * seasonal[t+1-seasonLength]
 */
export function holtWinters(
  data: number[],
  alpha: number,
  beta: number,
  gamma: number,
  seasonLength: number,
  forecastPeriods: number,
): HoltWintersResult {
  const n = data.length
  const effectiveAlpha = Math.max(0.01, Math.min(0.99, alpha))
  const effectiveBeta = Math.max(0.01, Math.min(0.99, beta))
  const effectiveGamma = Math.max(0.01, Math.min(0.99, gamma))
  const effectiveSL = Math.max(2, Math.min(seasonLength, Math.floor(n / 2)))

  // Initialize seasonal factors from first full cycle
  const seasonal: number[] = Array(effectiveSL).fill(1)
  const initialCycle = data.slice(0, effectiveSL)
  const cycleMean = mean(initialCycle)
  if (cycleMean > 0) {
    for (let i = 0; i < effectiveSL && i < initialCycle.length; i++) {
      seasonal[i] = r4(initialCycle[i] / cycleMean)
    }
  }

  const level: number[] = []
  const trend: number[] = []

  // Initialize level and trend
  level.push(data[0])
  trend.push(0)

  // Compute fitted values and update components
  for (let t = 1; t < n; t++) {
    const sIdx = (t - effectiveSL + effectiveSL) % effectiveSL // Handle first cycle
    const sVal = seasonal[sIdx] || 1

    const newLevel = r4(effectiveAlpha * (data[t] / sVal) + (1 - effectiveAlpha) * (level[t - 1] + trend[t - 1]))
    level.push(newLevel)

    const newTrend = r4(effectiveBeta * (newLevel - level[t - 1]) + (1 - effectiveBeta) * trend[t - 1])
    trend.push(newTrend)

    // Update seasonal factor for this position
    const seasonalIdx = t % effectiveSL
    seasonal[seasonalIdx] = r4(effectiveGamma * (data[t] / newLevel) + (1 - effectiveGamma) * seasonal[seasonalIdx])
  }

  // Generate forecast
  const lastLevel = level[level.length - 1]
  const lastTrend = trend[trend.length - 1]
  const forecast: number[] = []

  for (let i = 1; i <= forecastPeriods; i++) {
    const sIdx = (n - 1 + i) % effectiveSL
    const sVal = seasonal[sIdx] || 1
    const f = r4((lastLevel + i * lastTrend) * sVal)
    forecast.push(Math.max(0, f))
  }

  // Compute MAPE on fit
  // Fitted values: (level[t-1] + trend[t-1]) * seasonal[t % seasonLength]
  const fitted: number[] = [data[0]]
  for (let t = 1; t < n; t++) {
    const sIdx = t % effectiveSL
    const ff = r4((level[t - 1] + trend[t - 1]) * (seasonal[sIdx] || 1))
    fitted.push(ff)
  }

  const mape = computeMAPE(data, fitted) ?? 999

  return {
    forecast,
    mape,
    level,
    trend,
    seasonal,
  }
}

// ─── Auto-Select Method ────────────────────────────────────────────

export interface MethodResult {
  method: string
  mape: number
  mase: number | null
  forecast: number[]
  residuals: number[]
}

/**
 * Run all applicable forecasting methods on data and return results sorted by MAPE.
 * Uses last 20% (min 3, max 20) of data points as holdout for method selection.
 * Then re-runs chosen method on full data for final forecast.
 */
export function autoSelectMethod(
  data: number[],
  forecastPeriods: number,
  options?: {
    window?: number
    alpha?: number
    beta?: number
    gamma?: number
    seasonLength?: number
  },
): { best: MethodResult; results: MethodResult[] } {
  const n = data.length
  const window = options?.window ?? Math.min(7, Math.max(3, Math.floor(n / 4)))
  const alpha = options?.alpha ?? 0.3
  const beta = options?.beta ?? 0.1
  const gamma = options?.gamma ?? 0.1
  const seasonLength = options?.seasonLength ?? detectBestPeriod(data)

  // Use last 20% (min 3, max 20) as holdout for evaluation
  const holdoutSize = Math.min(20, Math.max(3, Math.floor(n * 0.2)))
  const trainSize = n - holdoutSize

  const trainData = trainSize > 1 ? data.slice(0, trainSize) : data
  const holdoutData = trainSize > 1 ? data.slice(trainSize) : data.slice(-Math.min(3, data.length))

  const results: MethodResult[] = []

  const tryMethod = (
    fn: (d: number[], fp: number) => ForecastMathResult,
    label: string,
  ): void => {
    try {
      const result = fn(trainData, Math.min(forecastPeriods, holdoutData.length || 1))
      // Evaluate against holdout
      const evalLen = Math.min(result.forecast.length, holdoutData.length)
      if (evalLen > 0) {
        const mape = computeMAPE(holdoutData.slice(0, evalLen), result.forecast.slice(0, evalLen))
        results.push({
          method: label,
          mape: mape ?? 999,
          mase: null,
          forecast: result.forecast,
          residuals: result.residuals,
        })
      } else {
        results.push({
          method: label,
          mape: result.mape,
          mase: result.mase,
          forecast: result.forecast,
          residuals: result.residuals,
        })
      }
    } catch {
      results.push({ method: label, mape: 999, mase: null, forecast: [], residuals: [] })
    }
  }

  tryMethod(
    (d, fp) => simpleMovingAverage(d, window, fp),
    'simple_moving_average',
  )
  tryMethod(
    (d, fp) => weightedMovingAverage(d, window, fp),
    'weighted_moving_average',
  )
  tryMethod(
    (d, fp) => exponentialSmoothing(d, alpha, fp),
    'exponential_smoothing',
  )
  tryMethod(
    (d, fp) => linearRegression(d, fp),
    'linear_regression',
  )
  if (n >= seasonLength * 2) {
    tryMethod(
      (d, fp) => seasonalDecompositionThenForecast(d, seasonLength, fp),
      'seasonal_decomposition',
    )
  }
  if (n >= seasonLength * 2) {
    tryMethod(
      (d, fp) => holtWintersThenForecast(d, alpha, beta, gamma, seasonLength, fp),
      'holt_winters',
    )
  }

  // Sort by MAPE ascending
  results.sort((a, b) => a.mape - b.mape)

  // Get best method, re-run on full data
  const bestMethod = results[0]?.method ?? 'simple_moving_average'
  let bestForecast: ForecastMathResult

  switch (bestMethod) {
    case 'simple_moving_average':
      bestForecast = simpleMovingAverage(data, window, forecastPeriods)
      break
    case 'weighted_moving_average':
      bestForecast = weightedMovingAverage(data, window, forecastPeriods)
      break
    case 'exponential_smoothing':
      bestForecast = exponentialSmoothing(data, alpha, forecastPeriods)
      break
    case 'linear_regression':
      bestForecast = linearRegression(data, forecastPeriods)
      break
    case 'seasonal_decomposition':
      bestForecast = seasonalDecompositionThenForecast(data, seasonLength, forecastPeriods)
      break
    case 'holt_winters':
      bestForecast = holtWintersThenForecast(data, alpha, beta, gamma, seasonLength, forecastPeriods)
      break
    default:
      bestForecast = simpleMovingAverage(data, window, forecastPeriods)
  }

  return {
    best: {
      method: bestMethod,
      mape: bestForecast.mape,
      mase: bestForecast.mase,
      forecast: bestForecast.forecast,
      residuals: bestForecast.residuals,
    },
    results,
  }
}

// ─── Composite Methods ─────────────────────────────────────────────

/**
 * Seasonal Decomposition then forecast: extract seasonal pattern,
 * deseasonalize, forecast with LR, re-seasonalize.
 */
export function seasonalDecompositionThenForecast(
  data: number[],
  period: number,
  forecastPeriods: number,
): ForecastMathResult {
  const decomp = seasonalDecomposition(data, period)
  const n = data.length

  // Deseasonalize
  const deseasonalized: number[] = data.map((v, i) => {
    const sf = decomp.factors[i % period]
    return sf > 0 ? r4(v / sf) : v
  })

  // Forecast deseasonalized data with LR
  const lrResult = linearRegression(deseasonalized, forecastPeriods)

  // Re-seasonalize
  const forecast = lrResult.forecast.map((v, i) => {
    const sf = decomp.factors[(n + i) % period]
    return r4(v * sf)
  })

  // Fitted values (in-sample with seasonality)
  const fitted = lrResult.fitted.map((v, i) => {
    const sf = decomp.factors[i % period]
    return r4(v * sf)
  })

  const residuals = data.map((v, i) => r4(v - fitted[i]))
  const mape = computeMAPE(data, fitted)
  const mase = computeMASE(data, fitted)

  return {
    forecast,
    fitted,
    mape: mape ?? 999,
    mase,
    residuals,
    methodLabel: `seasonal_decomposition(period=${period})`,
  }
}

/**
 * Holt-Winters then return ForecastMathResult.
 */
export function holtWintersThenForecast(
  data: number[],
  alpha: number,
  beta: number,
  gamma: number,
  seasonLength: number,
  forecastPeriods: number,
): ForecastMathResult {
  const hw = holtWinters(data, alpha, beta, gamma, seasonLength, forecastPeriods)
  const n = data.length

  // Build fitted values
  const fitted: number[] = [data[0]]
  for (let t = 1; t < n; t++) {
    const sIdx = t % seasonLength
    fitted.push(r4((hw.level[t - 1] + hw.trend[t - 1]) * (hw.seasonal[sIdx] || 1)))
  }

  const residuals = data.map((v, i) => r4(v - fitted[i]))
  const mase = computeMASE(data, fitted)

  return {
    forecast: hw.forecast,
    fitted,
    mape: hw.mape,
    mase,
    residuals,
    methodLabel: `holt_winters(α=${alpha},β=${beta},γ=${gamma},sl=${seasonLength})`,
  }
}

/**
 * Run all methods on data, return results sorted by MAPE.
 * Unlike autoSelectMethod, this runs all methods on full data (no holdout split).
 */
export function evaluateAllMethods(
  data: number[],
  forecastPeriods: number,
  options?: {
    window?: number
    alpha?: number
    beta?: number
    gamma?: number
    seasonLength?: number
  },
): MethodResult[] {
  const n = data.length
  const window = options?.window ?? Math.min(7, Math.max(3, Math.floor(n / 4)))
  const alpha = options?.alpha ?? 0.3
  const beta = options?.beta ?? 0.1
  const gamma = options?.gamma ?? 0.1
  const seasonLength = options?.seasonLength ?? detectBestPeriod(data, Math.floor(n / 2))

  const results: MethodResult[] = []

  const addResult = (result: ForecastMathResult): void => {
    results.push({
      method: result.methodLabel,
      mape: result.mape,
      mase: result.mase,
      forecast: result.forecast,
      residuals: result.residuals,
    })
  }

  addResult(simpleMovingAverage(data, window, forecastPeriods))
  addResult(weightedMovingAverage(data, window, forecastPeriods))
  addResult(exponentialSmoothing(data, alpha, forecastPeriods))
  addResult(linearRegression(data, forecastPeriods))

  if (n >= seasonLength * 2) {
    addResult(seasonalDecompositionThenForecast(data, seasonLength, forecastPeriods))
    addResult(holtWintersThenForecast(data, alpha, beta, gamma, seasonLength, forecastPeriods))
  }

  results.sort((a, b) => a.mape - b.mape)
  return results
}
