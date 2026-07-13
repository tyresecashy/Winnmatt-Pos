/**
 * Reports Module — Public API
 *
 * Provides report generation, analytics, profit analysis, and invoice matching.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/report-actions.ts, lib/reports-actions.ts,
 * lib/profit-actions.ts, and lib/invoice-matching-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as reportActions from '@/lib/report-actions'
import * as reportsActions from '@/lib/reports-actions'
import * as profitActions from '@/lib/profit-actions'
import * as matchingActions from '@/lib/invoice-matching-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type ReportTemplateRow = Awaited<ReturnType<typeof reportActions.getReportTemplates>>[number]
type GeneratedReportResult = Awaited<ReturnType<typeof reportActions.generateReport>>
type ScheduledReportRow = Awaited<ReturnType<typeof reportActions.getScheduledReports>>[number]
type ReportAnalyticsResult = Awaited<ReturnType<typeof reportActions.getReportAnalytics>>

type MatchByStatusRow = Awaited<ReturnType<typeof matchingActions.getMatchesByStatus>>[number]
type MatchingStatsResult = Awaited<ReturnType<typeof matchingActions.getInvoiceMatchingStats>>

// ─── Public API - Report Templates ──────────────────────────────────────────

export async function getReportTemplates(): Promise<ReportTemplateRow[]> {
  try {
    return await reportActions.getReportTemplates()
  } catch (error) {
    logger.error('[Reports Module] getReportTemplates failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getReportTemplate(id: string): Promise<ReportTemplateRow | null> {
  try {
    return await reportActions.getReportTemplate(id)
  } catch (error) {
    logger.error('[Reports Module] getReportTemplate failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function generateReport(templateId: string, params: Record<string, unknown>): Promise<GeneratedReportResult> {
  try {
    return await reportActions.generateReport(templateId, params as { startDate: string; endDate: string })
  } catch (error) {
    logger.error('[Reports Module] generateReport failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function getScheduledReports(): Promise<ScheduledReportRow[]> {
  try {
    return await reportActions.getScheduledReports()
  } catch (error) {
    logger.error('[Reports Module] getScheduledReports failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createScheduledReport(templateId: string, params: Record<string, unknown>, schedule: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await (reportActions.createScheduledReport as unknown as (data: Record<string, unknown>) => Promise<ScheduledReportRow | null>)({ templateId, params, schedule })
    if (!result) return { success: false, error: 'Failed to create scheduled report' }
    return { success: true, id: (result as unknown as Record<string, unknown>).id as string | undefined }
  } catch (error) {
    logger.error('[Reports Module] createScheduledReport failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function deleteScheduledReport(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await reportActions.deleteScheduledReport(id)
    return { success: result as unknown as boolean }
  } catch (error) {
    logger.error('[Reports Module] deleteScheduledReport failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getReportAnalytics(): Promise<ReportAnalyticsResult> {
  try {
    return await reportActions.getReportAnalytics()
  } catch (error) {
    logger.error('[Reports Module] getReportAnalytics failed', error instanceof Error ? error.message : String(error))
    return { totalTemplates: 0, scheduledReports: 0, popularTemplates: [] } as unknown as ReportAnalyticsResult
  }
}

// ─── Public API - Invoice Matching ──────────────────────────────────────────

export async function getMatchesByStatus(status: string): Promise<MatchByStatusRow[]> {
  try {
    return await matchingActions.getMatchesByStatus(status)
  } catch (error) {
    logger.error('[Reports Module] getMatchesByStatus failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getInvoiceMatchingStats(): Promise<MatchingStatsResult> {
  try {
    return await matchingActions.getInvoiceMatchingStats()
  } catch (error) {
    logger.error('[Reports Module] getInvoiceMatchingStats failed', error instanceof Error ? error.message : String(error))
    return null as unknown as MatchingStatsResult
  }
}

export async function runInvoiceMatching(invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await matchingActions.runInvoiceMatching(invoiceId)
  } catch (error) {
    logger.error('[Reports Module] runInvoiceMatching failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
