/**
 * Product Intelligence — Server Actions
 *
 * Wraps PI modules in server actions so client pages can invoke
 * anomaly detection, trend analysis, etc. without bundling server-only
 * dependencies (e.g. ioredis → event bus → _redis.ts).
 *
 * @see app/(dashboard)/intelligence/page.tsx
 */

'use server'

import { anomalyDetector } from '@/lib/modules/product-intelligence/insights/anomaly-detector'
import { trendAnalyzer } from '@/lib/modules/product-intelligence/insights/trend-analyzer'

/**
 * Run a full intelligence scan — anomaly detection + trend analysis.
 * Returns serializable data suitable for the intelligence dashboard.
 */
export async function runIntelligenceScan(branchId?: string) {
  const [anomalies, trends] = await Promise.all([
    anomalyDetector.fullScan(branchId),
    trendAnalyzer.analyzeAll(branchId),
  ])
  return { anomalies, trends }
}

/**
 * Run anomaly detection only.
 */
export async function runAnomalyDetection(branchId?: string) {
  return anomalyDetector.fullScan(branchId)
}

/**
 * Run trend analysis only.
 */
export async function runTrendAnalysis(branchId?: string) {
  return trendAnalyzer.analyzeAll(branchId)
}
