export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'approve' | 'reject' | 'export' | 'import' | 'permission_change';

export interface AuditRecord {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  branch_id?: string;
  branch_name?: string;
  module: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  before_state?: any;
  after_state?: any;
  reason?: string;
  approval_chain?: ApprovalStep[];
  digital_signature?: string;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, any>;
}

export interface ApprovalStep {
  approver_id: string;
  approver_name: string;
  approved_at: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
}

export interface AuditFilter {
  user_id?: string;
  branch_id?: string;
  module?: string;
  action?: AuditAction;
  entity_type?: string;
  entity_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface AuditStats {
  total_records: number;
  by_module: Record<string, number>;
  by_action: Record<AuditAction, number>;
  by_user: { user_id: string; user_name: string; count: number }[];
  by_branch: { branch_id: string; branch_name: string; count: number }[];
}

export class AuditExplorerService {
  private records: AuditRecord[] = [];

  async recordAudit(audit: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<AuditRecord> {
    const record: AuditRecord = {
      ...audit,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.records.push(record);

    // Keep only last 100000 records in memory
    if (this.records.length > 100000) {
      this.records.shift();
    }

    return record;
  }

  async getAuditRecords(filter: AuditFilter = {}, limit: number = 100, offset: number = 0): Promise<AuditRecord[]> {
    let filtered = [...this.records];

    if (filter.user_id) {
      filtered = filtered.filter(r => r.user_id === filter.user_id);
    }
    if (filter.branch_id) {
      filtered = filtered.filter(r => r.branch_id === filter.branch_id);
    }
    if (filter.module) {
      filtered = filtered.filter(r => r.module === filter.module);
    }
    if (filter.action) {
      filtered = filtered.filter(r => r.action === filter.action);
    }
    if (filter.entity_type) {
      filtered = filtered.filter(r => r.entity_type === filter.entity_type);
    }
    if (filter.entity_id) {
      filtered = filtered.filter(r => r.entity_id === filter.entity_id);
    }
    if (filter.start_date) {
      const start = new Date(filter.start_date);
      filtered = filtered.filter(r => new Date(r.timestamp) >= start);
    }
    if (filter.end_date) {
      const end = new Date(filter.end_date);
      filtered = filtered.filter(r => new Date(r.timestamp) <= end);
    }
    if (filter.search) {
      const search = filter.search.toLowerCase();
      filtered = filtered.filter(r => 
        r.entity_name?.toLowerCase().includes(search) ||
        r.user_name.toLowerCase().includes(search) ||
        r.reason?.toLowerCase().includes(search)
      );
    }

    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);
  }

  async getAuditRecord(recordId: string): Promise<AuditRecord | null> {
    return this.records.find(r => r.id === recordId) || null;
  }

  async getAuditStats(filter: AuditFilter = {}): Promise<AuditStats> {
    let filtered = [...this.records];

    if (filter.user_id) {
      filtered = filtered.filter(r => r.user_id === filter.user_id);
    }
    if (filter.branch_id) {
      filtered = filtered.filter(r => r.branch_id === filter.branch_id);
    }
    if (filter.start_date) {
      const start = new Date(filter.start_date);
      filtered = filtered.filter(r => new Date(r.timestamp) >= start);
    }
    if (filter.end_date) {
      const end = new Date(filter.end_date);
      filtered = filtered.filter(r => new Date(r.timestamp) <= end);
    }

    const byModule: Record<string, number> = {};
    const byAction: Record<AuditAction, number> = {
      create: 0, read: 0, update: 0, delete: 0,
      login: 0, logout: 0, approve: 0, reject: 0,
      export: 0, import: 0, permission_change: 0,
    };
    const userCounts: Record<string, { user_id: string; user_name: string; count: number }> = {};
    const branchCounts: Record<string, { branch_id: string; branch_name: string; count: number }> = {};

    filtered.forEach(record => {
      byModule[record.module] = (byModule[record.module] || 0) + 1;
      byAction[record.action]++;

      if (!userCounts[record.user_id]) {
        userCounts[record.user_id] = { user_id: record.user_id, user_name: record.user_name, count: 0 };
      }
      userCounts[record.user_id].count++;

      if (record.branch_id) {
        if (!branchCounts[record.branch_id]) {
          branchCounts[record.branch_id] = { branch_id: record.branch_id, branch_name: record.branch_name || '', count: 0 };
        }
        branchCounts[record.branch_id].count++;
      }
    });

    return {
      total_records: filtered.length,
      by_module: byModule,
      by_action: byAction,
      by_user: Object.values(userCounts).sort((a, b) => b.count - a.count).slice(0, 10),
      by_branch: Object.values(branchCounts).sort((a, b) => b.count - a.count).slice(0, 10),
    };
  }

  async getEntityHistory(entityType: string, entityId: string): Promise<AuditRecord[]> {
    return this.records
      .filter(r => r.entity_type === entityType && r.entity_id === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getUserActivity(userId: string, days: number = 30): Promise<AuditRecord[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.records
      .filter(r => r.user_id === userId && new Date(r.timestamp) >= startDate)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getRecentActivity(limit: number = 50): Promise<AuditRecord[]> {
    return this.records
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async searchAudit(query: string, limit: number = 100): Promise<AuditRecord[]> {
    const lowerQuery = query.toLowerCase();
    return this.records
      .filter(r => 
        r.entity_name?.toLowerCase().includes(lowerQuery) ||
        r.user_name.toLowerCase().includes(lowerQuery) ||
        r.reason?.toLowerCase().includes(lowerQuery) ||
        r.module.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit);
  }

  async exportAudit(filter: AuditFilter = {}, format: 'csv' | 'json' = 'json'): Promise<string> {
    const records = await this.getAuditRecords(filter, 10000);

    if (format === 'json') {
      return JSON.stringify(records, null, 2);
    }

    // CSV format
    const headers = ['Timestamp', 'User', 'Branch', 'Module', 'Action', 'Entity Type', 'Entity ID', 'Entity Name', 'Reason'];
    const rows = records.map(r => [
      r.timestamp,
      r.user_name,
      r.branch_name || '',
      r.module,
      r.action,
      r.entity_type,
      r.entity_id,
      r.entity_name || '',
      r.reason || '',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  async generateAuditReport(filter: AuditFilter = {}): Promise<any> {
    const stats = await this.getAuditStats(filter);
    const recentActivity = await this.getRecentActivity(20);

    return {
      summary: stats,
      recent_activity: recentActivity,
      generated_at: new Date().toISOString(),
    };
  }

  async verifyIntegrity(recordId: string): Promise<boolean> {
    // In production, this would verify digital signature
    const record = this.records.find(r => r.id === recordId);
    return !!record;
  }

  async addApprovalStep(recordId: string, step: Omit<ApprovalStep, 'approved_at'>): Promise<boolean> {
    const record = this.records.find(r => r.id === recordId);
    if (!record) return false;

    if (!record.approval_chain) {
      record.approval_chain = [];
    }

    record.approval_chain.push({
      ...step,
      approved_at: new Date().toISOString(),
    });

    return true;
  }
}

export const auditExplorerService = new AuditExplorerService();
