import { supabaseAdmin } from '@/lib/supabase-server'

const supabase = supabaseAdmin

export interface ReportWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'list';
  title: string;
  dataSource: string;
  config: any;
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
  parameters: any[];
  cacheDuration: number;
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

  async executeQuery(dataSourceId: string, parameters: any[]): Promise<any[]> {
    const dataSource = this.dataSources.get(dataSourceId);
    if (!dataSource) return [];

    try {
      let query = dataSource.query;
      
      // Replace parameters
      parameters.forEach((param, index) => {
        query = query.replace(`$${index + 1}`, `'${param}'`);
      });

      const { data, error } = await supabase.rpc('execute_sql', { query });
      
      if (error) {
        console.error('Query execution error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Query execution failed:', error);
      return [];
    }
  }

  async generateReport(templateId: string, parameters: any = {}): Promise<any> {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const reportData: any = {
      template: template.name,
      generatedAt: new Date().toISOString(),
      widgets: [],
    };

    for (const widget of template.widgets) {
      const dataSource = this.dataSources.get(widget.dataSource);
      if (!dataSource) continue;

      const params = dataSource.parameters.map((param) => {
        if (param === 'startDate') return parameters.startDate || new Date().toISOString();
        if (param === 'endDate') return parameters.endDate || new Date().toISOString();
        return parameters[param] || '';
      });

      const data = await this.executeQuery(widget.dataSource, params);
      
      reportData.widgets.push({
        ...widget,
        data,
      });
    }

    return reportData;
  }

  async exportReport(reportData: any, format: 'pdf' | 'excel' | 'csv'): Promise<string> {
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

  async getReportAnalytics(): Promise<any> {
    return {
      totalTemplates: this.templates.size,
      scheduledReports: this.scheduledReports.size,
      popularTemplates: Array.from(this.templates.values()).slice(0, 5),
      recentExports: [],
    };
  }
}

export const reportBuilderService = new ReportBuilderService();
