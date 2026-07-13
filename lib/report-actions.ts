'use server'

/**
 * Report Builder — Server Actions
 *
 * Wraps the ReportBuilderService for client consumption,
 * mapping data source IDs to real analytics service calls.
 */

import { logger } from '@/lib/logger'
import { reportBuilderService } from '@/lib/analytics/report-builder'
import { salesAnalyticsService } from '@/lib/analytics/sales-analytics'
import { inventoryAnalyticsService } from '@/lib/analytics/inventory-analytics'
import { customerAnalyticsService } from '@/lib/analytics/customer-analytics'
import { workforceAnalyticsService } from '@/lib/analytics/workforce-analytics'
import { financialAnalyticsService } from '@/lib/analytics/financial-analytics'
import type { ReportTemplate, ScheduledReport, ReportWidget } from '@/lib/analytics/report-builder'

/* ─── Templates ─────────────────────────────────── */

export async function getReportTemplates(): Promise<ReportTemplate[]> {
  try {
    return await reportBuilderService.getTemplates()
  } catch (error) {
    logger.error('getReportTemplates failed', error)
    return []
  }
}

export async function getReportTemplate(templateId: string): Promise<ReportTemplate | null> {
  try {
    return await reportBuilderService.getTemplate(templateId)
  } catch (error) {
    logger.error('getReportTemplate failed', { templateId, error })
    return null
  }
}

/* ─── Report Generation ─────────────────────────── */

interface WidgetData {
  widget: ReportWidget
  data: Record<string, unknown> | null
  loading?: boolean
  error?: string
}

interface GeneratedReport {
  template: string
  generatedAt: string
  widgets: WidgetData[]
}

/**
 * Generate report data for a template by mapping data source IDs
 * to real analytics service calls (bypasses the broken execute_sql RPC).
 */
export async function generateReport(
  templateId: string,
  params: { startDate: string; endDate: string },
): Promise<GeneratedReport | null> {
  try {
    const template = await reportBuilderService.getTemplate(templateId)
    if (!template) return null

    const { startDate, endDate } = params
    const widgetData: WidgetData[] = []

    for (const widget of template.widgets) {
      try {
        const data = await fetchWidgetData(widget.dataSource, startDate, endDate)
        widgetData.push({ widget, data })
      } catch (err) {
        widgetData.push({ widget, data: null, error: String(err) })
      }
    }

    return {
      template: template.name,
      generatedAt: new Date().toISOString(),
      widgets: widgetData,
    }
  } catch (error) {
    logger.error('generateReport failed', { templateId, error })
    return null
  }
}

async function fetchWidgetData(
  dataSourceId: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, unknown>> {
  switch (dataSourceId) {
    /* ── Sales ── */
    case 'sales-summary': {
      const [metrics, trend] = await Promise.all([
        salesAnalyticsService.getSalesMetrics(startDate, endDate),
        salesAnalyticsService.getSalesTrend(startDate, endDate),
      ])
      return { metrics, trend }
    }

    case 'top-products': {
      return salesAnalyticsService.getTopSellingProducts(startDate, endDate, 10) as unknown as Record<string, unknown>
    }

    /* ── Inventory ── */
    case 'inventory-status': {
      const metrics = await inventoryAnalyticsService.getInventoryMetrics()
      return { metrics }
    }

    /* ── Customers ── */
    case 'customer-segments': {
      return customerAnalyticsService.getCustomerMetrics(startDate, endDate) as unknown as Record<string, unknown>
    }

    /* ── Workforce ── */
    case 'employee-performance': {
      return workforceAnalyticsService.getWorkforceMetrics(startDate, endDate) as unknown as Record<string, unknown>
    }

    /* ── Financial ── */
    case 'expense-breakdown': {
      return financialAnalyticsService.getFinancialMetrics(startDate, endDate) as unknown as Record<string, unknown>
    }

    default:
      logger.warn('Unknown data source', { dataSourceId })
      return {} as Record<string, unknown>
  }
}

/* ─── Scheduled Reports ─────────────────────────── */

export async function getScheduledReports(): Promise<ScheduledReport[]> {
  try {
    return await reportBuilderService.getScheduledReports()
  } catch (error) {
    logger.error('getScheduledReports failed', error)
    return []
  }
}

export async function createScheduledReport(
  data: Omit<ScheduledReport, 'id' | 'lastRun' | 'nextRun'>,
): Promise<ScheduledReport | null> {
  try {
    return await reportBuilderService.createScheduledReport(data)
  } catch (error) {
    logger.error('createScheduledReport failed', error)
    return null
  }
}

export async function deleteScheduledReport(reportId: string): Promise<boolean> {
  try {
    return await reportBuilderService.deleteScheduledReport(reportId)
  } catch (error) {
    logger.error('deleteScheduledReport failed', { reportId, error })
    return false
  }
}

/* ─── Analytics Overview ────────────────────────── */

export async function getReportAnalytics(): Promise<{
  totalTemplates: number
  scheduledReports: number
  popularTemplates: ReportTemplate[]
}> {
  try {
    const analytics = await reportBuilderService.getReportAnalytics()
    return {
      totalTemplates: analytics.totalTemplates,
      scheduledReports: analytics.scheduledReports,
      popularTemplates: analytics.popularTemplates,
    }
  } catch (error) {
    logger.error('getReportAnalytics failed', error)
    return { totalTemplates: 0, scheduledReports: 0, popularTemplates: [] }
  }
}
