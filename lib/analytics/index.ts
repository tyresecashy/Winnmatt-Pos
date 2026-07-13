import { salesAnalyticsService } from './sales-analytics';
import { inventoryAnalyticsService } from './inventory-analytics';
import { customerAnalyticsService } from './customer-analytics';
import { workforceAnalyticsService } from './workforce-analytics';
import { financialAnalyticsService } from './financial-analytics';
import { reportBuilderService } from './report-builder';

export {
  salesAnalyticsService,
  inventoryAnalyticsService,
  customerAnalyticsService,
  workforceAnalyticsService,
  financialAnalyticsService,
  reportBuilderService,
};

// Re-export types
export type { SalesMetrics, ProductPerformance, PeakHours, CategoryBreakdown, PaymentMethodDistribution, SalesTrend } from './sales-analytics';
export type { InventoryMetrics, StockTurnover, ShrinkageReport, ReorderPrediction, DeadStockItem, SupplierPerformance } from './inventory-analytics';
export type { CustomerMetrics, RFMSegment, CustomerLifetimeValue, PurchasePattern, ChurnRisk } from './customer-analytics';
export type { WorkforceMetrics, TaskEfficiency, AttendancePattern, LaborCostAnalysis, TaskDurationAnalysis } from './workforce-analytics';
export type { FinancialMetrics, PLTrend, CashFlowForecast, ExpenseBreakdown, MarginAnalysis } from './financial-analytics';
export type { ReportWidget, ReportTemplate, ScheduledReport, DataSource, ReportResult } from './report-builder';

export class AnalyticsService {
  async getDashboardMetrics(startDate: string, endDate: string) {
    const [
      salesMetrics,
      inventoryMetrics,
      customerMetrics,
      workforceMetrics,
      financialMetrics,
    ] = await Promise.all([
      salesAnalyticsService.getSalesMetrics(startDate, endDate),
      inventoryAnalyticsService.getInventoryMetrics(),
      customerAnalyticsService.getCustomerMetrics(startDate, endDate),
      workforceAnalyticsService.getWorkforceMetrics(startDate, endDate),
      financialAnalyticsService.getFinancialMetrics(startDate, endDate),
    ]);

    return {
      sales: salesMetrics,
      inventory: inventoryMetrics,
      customer: customerMetrics,
      workforce: workforceMetrics,
      financial: financialMetrics,
    };
  }

  async getRealTimeMetrics() {
    // Get today's metrics
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const [
      todaySales,
      todayTransactions,
      lowStockCount,
      activeWorkers,
    ] = await Promise.all([
      this.getTodaySales(today, tomorrowStr),
      this.getTodayTransactions(today, tomorrowStr),
      this.getLowStockCount(),
      this.getActiveWorkers(),
    ]);

    return {
      todaySales,
      todayTransactions,
      lowStockCount,
      activeWorkers,
      lastUpdated: new Date().toISOString(),
    };
  }

  private async getTodaySales(startDate: string, endDate: string): Promise<number> {
    const metrics = await salesAnalyticsService.getSalesMetrics(startDate, endDate);
    return metrics.totalRevenue;
  }

  private async getTodayTransactions(startDate: string, endDate: string): Promise<number> {
    const metrics = await salesAnalyticsService.getSalesMetrics(startDate, endDate);
    return metrics.totalTransactions;
  }

  private async getLowStockCount(): Promise<number> {
    const metrics = await inventoryAnalyticsService.getInventoryMetrics();
    return metrics.lowStockItems;
  }

  private async getActiveWorkers(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const metrics = await workforceAnalyticsService.getWorkforceMetrics(today, tomorrow.toISOString());
    return metrics.activeWorkers;
  }

  async generateCustomReport(config: { templateId: string; parameters: Record<string, unknown> }) {
    return reportBuilderService.generateReport(config.templateId, config.parameters);
  }

  async exportReport(reportData: unknown, format: 'pdf' | 'excel' | 'csv') {
    return reportBuilderService.exportReport(reportData as Parameters<typeof reportBuilderService.exportReport>[0], format);
  }
}

export const analyticsService = new AnalyticsService();
