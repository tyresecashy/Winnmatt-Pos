export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json' | 'encrypted';
  category: string;
  description: string;
  default_value: any;
  is_required: boolean;
  is_env_specific: boolean;
  validation_regex?: string;
  min_value?: number;
  max_value?: number;
  allowed_values?: any[];
  last_modified: string;
  modified_by: string;
  version: number;
}

export interface ConfigCategory {
  id: string;
  name: string;
  description: string;
  configs: SystemConfig[];
}

export interface ConfigChange {
  id: string;
  config_key: string;
  old_value: any;
  new_value: any;
  changed_by: string;
  changed_at: string;
  reason?: string;
  approved_by?: string;
}

export class ConfigManagementService {
  private configs: Map<string, SystemConfig> = new Map();
  private changes: ConfigChange[] = [];

  constructor() {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs() {
    const defaultConfigs: Omit<SystemConfig, 'id' | 'version' | 'last_modified' | 'modified_by'>[] = [
      // Tax Configuration
      {
        key: 'tax.rate.vat',
        value: 16,
        type: 'number',
        category: 'tax',
        description: 'VAT rate percentage',
        default_value: 16,
        is_required: true,
        is_env_specific: false,
        min_value: 0,
        max_value: 100,
      },
      {
        key: 'tax.enabled',
        value: true,
        type: 'boolean',
        category: 'tax',
        description: 'Enable tax calculation',
        default_value: true,
        is_required: true,
        is_env_specific: false,
      },

      // Receipt Configuration
      {
        key: 'receipt.header.text',
        value: 'WINNMATT SUPERMARKET',
        type: 'string',
        category: 'receipt',
        description: 'Receipt header text',
        default_value: 'WINNMATT SUPERMARKET',
        is_required: true,
        is_env_specific: true,
      },
      {
        key: 'receipt.footer.text',
        value: 'Thank you for shopping with us!',
        type: 'string',
        category: 'receipt',
        description: 'Receipt footer text',
        default_value: 'Thank you for shopping with us!',
        is_required: false,
        is_env_specific: true,
      },
      {
        key: 'receipt.printer.timeout_ms',
        value: 5000,
        type: 'number',
        category: 'receipt',
        description: 'Receipt printer timeout in milliseconds',
        default_value: 5000,
        is_required: true,
        is_env_specific: false,
        min_value: 1000,
        max_value: 30000,
      },

      // Loyalty Configuration
      {
        key: 'loyalty.points.per_kes',
        value: 100,
        type: 'number',
        category: 'loyalty',
        description: 'Points earned per KES 100 spent',
        default_value: 100,
        is_required: true,
        is_env_specific: false,
        min_value: 1,
      },
      {
        key: 'loyalty.tier.silver_threshold',
        value: 20000,
        type: 'number',
        category: 'loyalty',
        description: 'Total spend threshold for Silver tier',
        default_value: 20000,
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'loyalty.tier.gold_threshold',
        value: 50000,
        type: 'number',
        category: 'loyalty',
        description: 'Total spend threshold for Gold tier',
        default_value: 50000,
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'loyalty.tier.platinum_threshold',
        value: 100000,
        type: 'number',
        category: 'loyalty',
        description: 'Total spend threshold for Platinum tier',
        default_value: 100000,
        is_required: true,
        is_env_specific: false,
      },

      // Discount Configuration
      {
        key: 'discount.max_percentage',
        value: 50,
        type: 'number',
        category: 'discount',
        description: 'Maximum discount percentage allowed',
        default_value: 50,
        is_required: true,
        is_env_specific: false,
        min_value: 0,
        max_value: 100,
      },
      {
        key: 'discount.manager_approval_threshold',
        value: 20,
        type: 'number',
        category: 'discount',
        description: 'Discount percentage requiring manager approval',
        default_value: 20,
        is_required: true,
        is_env_specific: false,
      },

      // Payment Configuration
      {
        key: 'payment.mpesa.enabled',
        value: true,
        type: 'boolean',
        category: 'payment',
        description: 'Enable M-Pesa payments',
        default_value: true,
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'payment.card.enabled',
        value: true,
        type: 'boolean',
        category: 'payment',
        description: 'Enable card payments',
        default_value: true,
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'payment.credit.enabled',
        value: false,
        type: 'boolean',
        category: 'payment',
        description: 'Enable credit payments',
        default_value: false,
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'payment.credit.limit',
        value: 50000,
        type: 'number',
        category: 'payment',
        description: 'Maximum credit limit per customer',
        default_value: 50000,
        is_required: true,
        is_env_specific: false,
      },

      // Currency Configuration
      {
        key: 'currency.code',
        value: 'KES',
        type: 'string',
        category: 'currency',
        description: 'Default currency code',
        default_value: 'KES',
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'currency.symbol',
        value: 'KES',
        type: 'string',
        category: 'currency',
        description: 'Currency symbol',
        default_value: 'KES',
        is_required: true,
        is_env_specific: false,
      },

      // Notification Configuration
      {
        key: 'notifications.sms.enabled',
        value: true,
        type: 'boolean',
        category: 'notifications',
        description: 'Enable SMS notifications',
        default_value: true,
        is_required: false,
        is_env_specific: false,
      },
      {
        key: 'notifications.email.enabled',
        value: true,
        type: 'boolean',
        category: 'notifications',
        description: 'Enable email notifications',
        default_value: true,
        is_required: false,
        is_env_specific: false,
      },

      // Business Rules
      {
        key: 'business.return.days_limit',
        value: 30,
        type: 'number',
        category: 'business',
        description: 'Number of days allowed for returns',
        default_value: 30,
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'business.inventory.reorder_buffer',
        value: 10,
        type: 'number',
        category: 'business',
        description: 'Buffer quantity for automatic reorder',
        default_value: 10,
        is_required: true,
        is_env_specific: false,
      },

      // Approval Limits
      {
        key: 'approval.refund.amount_limit',
        value: 10000,
        type: 'number',
        category: 'approval',
        description: 'Refund amount requiring manager approval',
        default_value: 10000,
        is_required: true,
        is_env_specific: false,
      },
      {
        key: 'approval.purchase_order.amount_limit',
        value: 100000,
        type: 'number',
        category: 'approval',
        description: 'Purchase order amount requiring approval',
        default_value: 100000,
        is_required: true,
        is_env_specific: false,
      },
    ];

    defaultConfigs.forEach(config => {
      const id = `cfg_${config.key.replace(/\./g, '_')}`;
      this.configs.set(config.key, {
        ...config,
        id,
        version: 1,
        last_modified: new Date().toISOString(),
        modified_by: 'system',
      });
    });
  }

  async getConfig(key: string): Promise<SystemConfig | null> {
    return this.configs.get(key) || null;
  }

  async getConfigValue(key: string): Promise<any> {
    const config = this.configs.get(key);
    return config?.value ?? config?.default_value;
  }

  async setConfig(key: string, value: any, modifiedBy: string, reason?: string): Promise<boolean> {
    const config = this.configs.get(key);
    if (!config) return false;

    // Validate value
    if (!this.validateConfigValue(config, value)) {
      return false;
    }

    const oldValue = config.value;
    config.value = value;
    config.version++;
    config.last_modified = new Date().toISOString();
    config.modified_by = modifiedBy;

    // Record change
    this.changes.push({
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config_key: key,
      old_value: oldValue,
      new_value: value,
      changed_by: modifiedBy,
      changed_at: new Date().toISOString(),
      reason,
    });

    return true;
  }

  private validateConfigValue(config: SystemConfig, value: any): boolean {
    // Type validation
    switch (config.type) {
      case 'number':
        if (typeof value !== 'number') return false;
        if (config.min_value !== undefined && value < config.min_value) return false;
        if (config.max_value !== undefined && value > config.max_value) return false;
        break;
      case 'string':
        if (typeof value !== 'string') return false;
        if (config.validation_regex && !new RegExp(config.validation_regex).test(value)) return false;
        break;
      case 'boolean':
        if (typeof value !== 'boolean') return false;
        break;
      case 'json':
        try {
          JSON.parse(JSON.stringify(value));
        } catch {
          return false;
        }
        break;
    }

    // Allowed values validation
    if (config.allowed_values && !config.allowed_values.includes(value)) {
      return false;
    }

    return true;
  }

  async getConfigsByCategory(category: string): Promise<SystemConfig[]> {
    return Array.from(this.configs.values()).filter(c => c.category === category);
  }

  async getCategories(): Promise<ConfigCategory[]> {
    const categoryMap = new Map<string, SystemConfig[]>();
    
    this.configs.forEach(config => {
      const existing = categoryMap.get(config.category) || [];
      existing.push(config);
      categoryMap.set(config.category, existing);
    });

    return Array.from(categoryMap.entries()).map(([id, configs]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      description: `Configuration for ${id}`,
      configs,
    }));
  }

  async getConfigChanges(limit: number = 50): Promise<ConfigChange[]> {
    return this.changes
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
      .slice(0, limit);
  }

  async getConfigHistory(key: string): Promise<ConfigChange[]> {
    return this.changes
      .filter(c => c.config_key === key)
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  }

  async exportConfig(category?: string): Promise<Record<string, any>> {
    const configObj: Record<string, any> = {};
    
    this.configs.forEach((config, key) => {
      if (!category || config.category === category) {
        configObj[key] = config.value;
      }
    });

    return configObj;
  }

  async importConfig(configs: Record<string, any>, importedBy: string): Promise<number> {
    let imported = 0;

    for (const [key, value] of Object.entries(configs)) {
      if (this.configs.has(key)) {
        await this.setConfig(key, value, importedBy, 'Imported from backup');
        imported++;
      }
    }

    return imported;
  }

  async resetToDefaults(category?: string): Promise<number> {
    let reset = 0;

    this.configs.forEach((config, key) => {
      if (!category || config.category === category) {
        config.value = config.default_value;
        config.version++;
        config.last_modified = new Date().toISOString();
        config.modified_by = 'system';
        reset++;
      }
    });

    return reset;
  }

  async getConfigSummary(): Promise<any> {
    const categories = await this.getCategories();
    
    return {
      total_configs: this.configs.size,
      categories: categories.length,
      recent_changes: this.changes.length,
      last_modified: Array.from(this.configs.values())
        .sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime())[0]?.last_modified,
    };
  }
}

export const configManagementService = new ConfigManagementService();
