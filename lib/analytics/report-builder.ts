import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const supabase = supabaseAdmin

export interface ReportWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'list';
  title: string;
  dataSource: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  widgets: ReportWidget[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isPublic: boolean;
  tags: string[];
}

export interface ScheduledReport {
  id: string;
  templateId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  lastRun: string;
  nextRun: string;
  isActive: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'sql' | 'api' | 'aggregation';
  query: string;
  parameters: string[];
  cacheDuration: number;
}

export interface ReportResult {
  template: string;
  generatedAt: string;
  widgets: (ReportWidget & { data: unknown[]; config: Record<string, unknown> })[];
}

export class ReportBuilderService {
  private templates: Map<string, ReportTemplate> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();
  private dataSources: Map<string, DataSource> = new Map();

  constructor() {
    this.initializeDefaultDataSources();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultDataSources() {
    const dataSources: DataSource[] = [
      {
        id: 'sales-summary',
        name: 'Sales Summary',
        type: 'aggregation',
        query: 'SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as transactions FROM sales WHERE payment_status = $1 AND created_at BETWEEN $2 AND $3 GROUP BY DATE(created_at)',
        parameters: ['completed', 'startDate', 'endDate'],
        cacheDuration: 300,
      },
      {
        id: 'inventory-status',
        name: 'Inventory Status',
        type: 'sql',
        query: 'SELECT p.id, p.name, p.category_id, inv.quantity as current_stock, p.reorder_level, p.purchase_price FROM products p LEFT JOIN inventory inv ON inv.product_id = p.id WHERE COALESCE(inv.quantity, 0) <= p.reorder_level',
        parameters: [],
        cacheDuration: 600,
      },
      {
        id: 'customer-segments',
        name: 'Customer Segments',
        type: 'aggregation',
        query: 'SELECT customer_id, COUNT(*) as orders, SUM(total_amount) as total_spent FROM sales WHERE payment_status = $1 GROUP BY customer_id',
        parameters: ['completed'],
        cacheDuration: 900,
      },
      {
        id: 'employee-performance',
        name: 'Employee Performance',
        type: 'sql',
        query: 'SELECT ep.id, ep.staff_number, ep.position, u.full_name, COUNT(t.id) as tasks_assigned, SUM(CASE WHEN t.status = $1 THEN 1 ELSE 0 END) as tasks_completed FROM employee_profiles ep LEFT JOIN users u ON u.id = ep.user_id LEFT JOIN tasks t ON t.assigned_to = ep.id GROUP BY ep.id, ep.staff_number, ep.position, u.full_name',
        parameters: ['completed'],
        cacheDuration: 600,
      },
      {
        id: 'expense-breakdown',
        name: 'Expense Breakdown',
        type: 'sql',
        query: 'SELECT c.name as category, SUM(e.amount) as total FROM expenses e JOIN expense_categories c ON e.category_id = c.id WHERE e.status = $1 AND e.created_at BETWEEN $2 AND $3 GROUP BY c.name',
        parameters: ['approved', 'startDate', 'endDate'],
        cacheDuration: 300,
      },
    ];

    dataSources.forEach((ds) => this.dataSources.set(ds.id, ds));
  }

  private initializeDefaultTemplates() {
    const templates: ReportTemplate[] = [
      {
        id: 'daily-sales',
        name: 'Daily Sales Report',
        description: 'Summary of daily sales performance',
        widgets: [
          {
            id: 'w1',
            type: 'metric',
            title: 'Total Revenue',
            dataSource: 'sales-summary',
            config: { aggregation: 'sum', field: 'revenue', format: 'currency' },
            position: { x: 0, y: 0, w: 2, h: 1 },
          },
          {
            id: 'w2',
            type: 'metric',
            title: 'Total Transactions',
            dataSource: 'sales-summary',
            config: { aggregation: 'count', field: 'transactions', format: 'number' },
            position: { x: 2, y: 0, w: 2, h: 1 },
          },
          {
            id: 'w3',
            type: 'chart',
            title: 'Revenue Trend',
            dataSource: 'sales-summary',
            config: { chartType: 'line', xAxis: 'date', yAxis: 'revenue' },
            position: { x: 0, y: 1, w: 4, h: 2 },
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        isPublic: true,
        tags: ['sales', 'daily'],
      },
      {
        id: 'inventory-alerts',
        name: 'Inventory Alerts',
        description: 'Products requiring restocking',
        widgets: [
          {
            id: 'w1',
            type: 'metric',
            title: 'Low Stock Items',
            dataSource: 'inventory-status',
            config: { aggregation: 'count', format: 'number' },
            position: { x: 0, y: 0, w: 2, h: 1 },
          },
          {
            id: 'w2',
            type: 'table',
            title: 'Products Below Reorder Level',
            dataSource: 'inventory-status',
            config: { columns: ['name', 'category', 'current_stock', 'reorder_level'] },
            position: { x: 0, y: 1, w: 4, h: 2 },
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        isPublic: true,
        tags: ['inventory', 'alerts'],
      },
    ];

    templates.forEach((t) => this.templates.set(t.id, t));
  }

  async getTemplates(): Promise<ReportTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getTemplate(templateId: string): Promise<ReportTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async createTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReportTemplate> {
    const newTemplate: ReportTemplate = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(templateId: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate | null> {
    const existing = this.templates.get(templateId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.templates.set(templateId, updated);
    return updated;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    return this.templates.delete(templateId);
  }

  async getScheduledReports(): Promise<ScheduledReport[]> {
    return Array.from(this.scheduledReports.values());
  }

  async createScheduledReport(report: Omit<ScheduledReport, 'id' | 'lastRun' | 'nextRun'>): Promise<ScheduledReport> {
    const newReport: ScheduledReport = {
      ...report,
      id: Date.now().toString(),
      lastRun: '',
      nextRun: this.calculateNextRun(report.frequency),
    };
    this.scheduledReports.set(newReport.id, newReport);
    return newReport;
  }

  async updateScheduledReport(reportId: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport | null> {
    const existing = this.scheduledReports.get(reportId);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    this.scheduledReports.set(reportId, updated);
    return updated;
  }

  async deleteScheduledReport(reportId: string): Promise<boolean> {
    return this.scheduledReports.delete(reportId);
  }

  async getDataSources(): Promise<DataSource[]> {
    return Array.from(this.dataSources.values());
  }

  async executeQuery(dataSourceId: string, parameters: unknown[]): Promise<Record<string, unknown>[]> {
    const dataSource = this.dataSources.get(dataSourceId);
    if (!dataSource) return [];

    try {
      // Use typed, safe query execution instead of raw SQL
      // Maps data source IDs to safe query builder calls
      return await this.executeSafeQuery(dataSource, parameters);
    } catch (error) {
      logger.error('Query execution failed:', { dataSourceId, error });
      return [];
    }
  }

  /** Execute a data source query using the safe Supabase Query Builder */
  private async executeSafeQuery(
    dataSource: DataSource,
    parameters: unknown[]
  ): Promise<Record<string, unknown>[]> {
    switch (dataSource.id) {
      case 'sales-summary': {
        const startDate = String(parameters[1] ?? '1970-01-01');
        const endDate = String(parameters[2] ?? '2099-12-31');
        const { data } = await supabase
          .from('sales')
          .select('created_at, total_amount, id')
          .eq('payment_status', String(parameters[0] ?? 'completed'))
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: true });
        return (data || []).reduce<Record<string, unknown>[]>((acc, row) => {
          const date = row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : 'unknown';
          const existing = acc.find((r) => r.date === date);
          if (existing) {
            existing.revenue = (existing.revenue as number) + Number(row.total_amount ?? 0);
            existing.transactions = (existing.transactions as number) + 1;
          } else {
            acc.push({
              date,
              revenue: Number(row.total_amount ?? 0),
              transactions: 1,
            });
          }
          return acc;
        }, []);
      }

      case 'inventory-status': {
        const { data } = await supabase
          .from('products')
          .select(`
            id, name, category_id,
            inventory!inner(quantity),
            reorder_level, purchase_price
          `)
          .not('inventory.quantity', 'is', null);
        type InventoryRow = { id: string; name: string; category_id: string | null; inventory: Array<{ quantity: number }>; reorder_level: number; purchase_price: number };
        return (data || [])
          .filter((row: InventoryRow) => {
            const qty = row.inventory?.[0]?.quantity ?? 0;
            return qty <= (row.reorder_level ?? 0);
          })
          .map((row: InventoryRow) => ({
            id: row.id,
            name: row.name,
            category_id: row.category_id,
            current_stock: row.inventory?.[0]?.quantity ?? 0,
            reorder_level: row.reorder_level,
            purchase_price: row.purchase_price,
          }));
      }

      case 'customer-segments': {
        const { data } = await supabase
          .from('sales')
          .select('customer_id, total_amount')
          .eq('payment_status', String(parameters[0] ?? 'completed'));
        const grouped: Record<string, { orders: number; total_spent: number }> = {};
        for (const row of data || []) {
          if (!row.customer_id) continue;
          if (!grouped[row.customer_id]) {
            grouped[row.customer_id] = { orders: 0, total_spent: 0 };
          }
          grouped[row.customer_id].orders += 1;
          grouped[row.customer_id].total_spent += Number(row.total_amount ?? 0);
        }
        return Object.entries(grouped).map(([customer_id, stats]) => ({
          customer_id,
          orders: stats.orders,
          total_spent: stats.total_spent,
        }));
      }

      case 'employee-performance': {
        const { data } = await supabase
          .from('employee_profiles')
          .select(`
            id, staff_number, position,
            users!inner(full_name),
            tasks(id, status)
          `);
        return (data || []).map((row: Record<string, unknown> & { id?: string; staff_number?: string; position?: string; users?: { full_name?: string }; tasks?: Array<{ status?: string }> }) => {
          const tasks = row.tasks || [];
          return {
            id: row.id,
            staff_number: row.staff_number,
            position: row.position,
            full_name: row.users?.full_name ?? '',
            tasks_assigned: tasks.length,
            tasks_completed: tasks.filter((t: { status?: string }) => t.status === String(parameters[0] ?? 'completed')).length,
          };
        });
      }

      case 'expense-breakdown': {
        const { data } = await supabase
          .from('expenses')
          .select('amount, category_id, expense_categories(name)')
          .eq('status', String(parameters[0] ?? 'approved'));
        const rows = (data || []) as unknown as Array<Record<string, unknown>>;
        const grouped: Record<string, number> = {};
        for (const row of rows) {
          const cat = (row.expense_categories as Record<string, unknown> | undefined)?.name as string ?? 'Unknown';
          grouped[cat] = (grouped[cat] ?? 0) + Number(row.amount ?? 0);
        }
        return Object.entries(grouped).map(([category, total]) => ({
          category,
          total,
        }));
      }

      default:
        logger.warn('Unknown data source for safe query', { id: dataSource.id });
        return [];
    }
  }

  async generateReport(templateId: string, parameters: Record<string, unknown> = {}): Promise<ReportResult | null> {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const reportData: ReportResult = {
      template: template.name,
      generatedAt: new Date().toISOString(),
      widgets: [],
    };

    for (const widget of template.widgets) {
      const dataSource = this.dataSources.get(widget.dataSource);
      if (!dataSource) continue;

      const params = dataSource.parameters.map((param) => {
        if (param === 'startDate') return String(parameters.startDate || new Date().toISOString());
        if (param === 'endDate') return String(parameters.endDate || new Date().toISOString());
        return String(parameters[param] || '');
      });

      const data = await this.executeQuery(widget.dataSource, params);
      
      reportData.widgets.push({
        ...widget,
        data,
        config: widget.config as Record<string, unknown>,
      });
    }

    return reportData;
  }

  async exportReport(reportData: ReportResult, format: 'pdf' | 'excel' | 'csv'): Promise<string> {
    // In production, this would generate the actual file
    // For now, return a mock URL
    return `https://reports.winnmatt.com/${reportData.template}.${format}`;
  }

  private calculateNextRun(frequency: string): string {
    const now = new Date();
    
    if (frequency === 'daily') {
      now.setDate(now.getDate() + 1);
      now.setHours(6, 0, 0, 0);
    } else if (frequency === 'weekly') {
      now.setDate(now.getDate() + (7 - now.getDay()));
      now.setHours(6, 0, 0, 0);
    } else {
      now.setMonth(now.getMonth() + 1, 1);
      now.setHours(6, 0, 0, 0);
    }

    return now.toISOString();
  }

  async getReportAnalytics(): Promise<{
    totalTemplates: number;
    scheduledReports: number;
    popularTemplates: ReportTemplate[];
    recentReports: { template: string; generatedAt: string }[];
  }> {
    return {
      totalTemplates: this.templates.size,
      scheduledReports: this.scheduledReports.size,
      popularTemplates: Array.from(this.templates.values()).slice(0, 5),
      recentReports: [],
    };
  }
}

export const reportBuilderService = new ReportBuilderService();
