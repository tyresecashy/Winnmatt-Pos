export interface DataAsset {
  id: string;
  name: string;
  type: 'database' | 'file' | 'backup' | 'log' | 'config';
  owner: string;
  retention_policy: RetentionPolicy;
  encryption: EncryptionPolicy;
  backup_policy: BackupPolicy;
  access_rules: AccessRule[];
  archive_rules: ArchiveRule;
  deletion_rules: DeletionRule;
  version_history: boolean;
  legal_hold: boolean;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  last_reviewed: string;
  created_at: string;
}

export interface RetentionPolicy {
  retention_days: number;
  auto_delete: boolean;
  archive_after_days?: number;
}

export interface EncryptionPolicy {
  at_rest: boolean;
  in_transit: boolean;
  algorithm?: string;
  key_management?: string;
}

export interface BackupPolicy {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retention_count: number;
  cross_region: boolean;
  encrypted: boolean;
}

export interface AccessRule {
  role: string;
  permissions: ('read' | 'write' | 'delete' | 'export')[];
  conditions?: string;
}

export interface ArchiveRule {
  archive_after_days: number;
  compress: boolean;
  storage_tier: 'standard' | 'infrequent' | 'archive';
}

export interface DeletionRule {
  soft_delete: boolean;
  soft_delete_days: number;
  require_approval: boolean;
  approval_roles: string[];
}

export class DataGovernanceService {
  private assets: Map<string, DataAsset> = new Map();

  constructor() {
    this.initializeDataAssets();
  }

  private initializeDataAssets() {
    const defaultAssets: Omit<DataAsset, 'id' | 'created_at' | 'last_reviewed'>[] = [
      {
        name: 'Products Database',
        type: 'database',
        owner: 'inventory_team',
        retention_policy: { retention_days: 3650, auto_delete: false },
        encryption: { at_rest: true, in_transit: true, algorithm: 'AES-256' },
        backup_policy: { frequency: 'daily', retention_count: 30, cross_region: true, encrypted: true },
        access_rules: [
          { role: 'admin', permissions: ['read', 'write', 'delete', 'export'] },
          { role: 'manager', permissions: ['read', 'write'] },
          { role: 'cashier', permissions: ['read'] },
        ],
        archive_rules: { archive_after_days: 365, compress: true, storage_tier: 'infrequent' },
        deletion_rules: { soft_delete: true, soft_delete_days: 30, require_approval: true, approval_roles: ['admin'] },
        version_history: true,
        legal_hold: false,
        classification: 'confidential',
      },
      {
        name: 'Customer Data',
        type: 'database',
        owner: 'customer_team',
        retention_policy: { retention_days: 2555, auto_delete: false },
        encryption: { at_rest: true, in_transit: true, algorithm: 'AES-256' },
        backup_policy: { frequency: 'daily', retention_count: 90, cross_region: true, encrypted: true },
        access_rules: [
          { role: 'admin', permissions: ['read', 'write', 'delete', 'export'] },
          { role: 'manager', permissions: ['read', 'write'] },
          { role: 'cashier', permissions: ['read'] },
        ],
        archive_rules: { archive_after_days: 730, compress: true, storage_tier: 'archive' },
        deletion_rules: { soft_delete: true, soft_delete_days: 90, require_approval: true, approval_roles: ['admin', 'legal'] },
        version_history: true,
        legal_hold: false,
        classification: 'restricted',
      },
      {
        name: 'Sales Transactions',
        type: 'database',
        owner: 'finance_team',
        retention_policy: { retention_days: 2555, auto_delete: false },
        encryption: { at_rest: true, in_transit: true, algorithm: 'AES-256' },
        backup_policy: { frequency: 'hourly', retention_count: 168, cross_region: true, encrypted: true },
        access_rules: [
          { role: 'admin', permissions: ['read', 'export'] },
          { role: 'finance', permissions: ['read', 'export'] },
          { role: 'manager', permissions: ['read'] },
        ],
        archive_rules: { archive_after_days: 365, compress: true, storage_tier: 'infrequent' },
        deletion_rules: { soft_delete: false, soft_delete_days: 0, require_approval: true, approval_roles: ['admin', 'finance'] },
        version_history: false,
        legal_hold: true,
        classification: 'confidential',
      },
      {
        name: 'Employee Records',
        type: 'database',
        owner: 'hr_team',
        retention_policy: { retention_days: 2555, auto_delete: false },
        encryption: { at_rest: true, in_transit: true, algorithm: 'AES-256' },
        backup_policy: { frequency: 'daily', retention_count: 90, cross_region: true, encrypted: true },
        access_rules: [
          { role: 'admin', permissions: ['read', 'write', 'delete'] },
          { role: 'hr', permissions: ['read', 'write'] },
          { role: 'manager', permissions: ['read'] },
        ],
        archive_rules: { archive_after_days: 730, compress: true, storage_tier: 'archive' },
        deletion_rules: { soft_delete: true, soft_delete_days: 90, require_approval: true, approval_roles: ['admin', 'hr'] },
        version_history: true,
        legal_hold: false,
        classification: 'restricted',
      },
      {
        name: 'Audit Logs',
        type: 'log',
        owner: 'security_team',
        retention_policy: { retention_days: 365, auto_delete: false },
        encryption: { at_rest: true, in_transit: true },
        backup_policy: { frequency: 'daily', retention_count: 365, cross_region: true, encrypted: true },
        access_rules: [
          { role: 'admin', permissions: ['read'] },
          { role: 'security', permissions: ['read'] },
        ],
        archive_rules: { archive_after_days: 90, compress: true, storage_tier: 'archive' },
        deletion_rules: { soft_delete: false, soft_delete_days: 0, require_approval: true, approval_roles: ['admin', 'legal'] },
        version_history: false,
        legal_hold: true,
        classification: 'restricted',
      },
      {
        name: 'System Backups',
        type: 'backup',
        owner: 'ops_team',
        retention_policy: { retention_days: 90, auto_delete: true },
        encryption: { at_rest: true, in_transit: true, algorithm: 'AES-256' },
        backup_policy: { frequency: 'daily', retention_count: 30, cross_region: true, encrypted: true },
        access_rules: [
          { role: 'admin', permissions: ['read', 'delete'] },
          { role: 'ops', permissions: ['read'] },
        ],
        archive_rules: { archive_after_days: 30, compress: true, storage_tier: 'archive' },
        deletion_rules: { soft_delete: false, soft_delete_days: 0, require_approval: false, approval_roles: [] },
        version_history: false,
        legal_hold: false,
        classification: 'internal',
      },
    ];

    defaultAssets.forEach(asset => {
      const id = `asset_${asset.name.toLowerCase().replace(/\s+/g, '_')}`;
      this.assets.set(id, {
        ...asset,
        id,
        created_at: new Date().toISOString(),
        last_reviewed: new Date().toISOString(),
      });
    });
  }

  async getDataAssets(): Promise<DataAsset[]> {
    return Array.from(this.assets.values());
  }

  async getDataAsset(assetId: string): Promise<DataAsset | null> {
    return this.assets.get(assetId) || null;
  }

  async createDataAsset(asset: Omit<DataAsset, 'id' | 'created_at' | 'last_reviewed'>): Promise<DataAsset> {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAsset: DataAsset = {
      ...asset,
      id,
      created_at: new Date().toISOString(),
      last_reviewed: new Date().toISOString(),
    };

    this.assets.set(id, newAsset);
    return newAsset;
  }

  async updateDataAsset(assetId: string, updates: Partial<DataAsset>): Promise<boolean> {
    const asset = this.assets.get(assetId);
    if (!asset) return false;

    Object.assign(asset, updates);
    return true;
  }

  async reviewDataAsset(assetId: string, reviewedBy: string): Promise<boolean> {
    const asset = this.assets.get(assetId);
    if (!asset) return false;

    asset.last_reviewed = new Date().toISOString();
    return true;
  }

  async putOnLegalHold(assetId: string): Promise<boolean> {
    const asset = this.assets.get(assetId);
    if (!asset) return false;

    asset.legal_hold = true;
    return true;
  }

  async removeFromLegalHold(assetId: string): Promise<boolean> {
    const asset = this.assets.get(assetId);
    if (!asset) return false;

    asset.legal_hold = false;
    return true;
  }

  async getAssetsByClassification(classification: DataAsset['classification']): Promise<DataAsset[]> {
    return Array.from(this.assets.values()).filter(a => a.classification === classification);
  }

  async getAssetsByOwner(owner: string): Promise<DataAsset[]> {
    return Array.from(this.assets.values()).filter(a => a.owner === owner);
  }

  async getDataGovernanceReport(): Promise<any> {
    const assets = Array.from(this.assets.values());
    
    return {
      summary: {
        total_assets: assets.length,
        by_type: this.groupBy(assets, 'type'),
        by_classification: this.groupBy(assets, 'classification'),
        by_owner: this.groupBy(assets, 'owner'),
        legal_holds: assets.filter(a => a.legal_hold).length,
      },
      compliance: {
        encrypted_at_rest: assets.filter(a => a.encryption.at_rest).length,
        encrypted_in_transit: assets.filter(a => a.encryption.in_transit).length,
        backed_up: assets.filter(a => a.backup_policy).length,
        with_access_rules: assets.filter(a => a.access_rules.length > 0).length,
      },
      retention: assets.map(a => ({
        name: a.name,
        retention_days: a.retention_policy.retention_days,
        auto_delete: a.retention_policy.auto_delete,
      })),
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((result, item) => {
      const group = item[key] || 'unknown';
      result[group] = (result[group] || 0) + 1;
      return result;
    }, {});
  }
}

export const dataGovernanceService = new DataGovernanceService();
