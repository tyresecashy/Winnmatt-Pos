export type ScenarioType =
  | 'black_friday'
  | 'christmas_rush'
  | 'holiday_rush'
  | 'network_failure'
  | 'printer_failure'
  | 'power_failure'
  | 'database_failure'
  | 'internet_loss'
  | 'cashier_quits'
  | 'supplier_delay'
  | 'mass_refund'
  | 'inventory_corruption'
  | 'admin_lockout'
  | 'peak_hours'
  | 'flash_sale'
  | 'bulk_order';

export type ScenarioSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ScenarioConfig {
  type: ScenarioType;
  name: string;
  description: string;
  severity: ScenarioSeverity;
  duration_minutes: number;
  parameters: Record<string, unknown>;
}

export interface ScenarioResult {
  id: string;
  scenario: ScenarioType;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  metrics: ScenarioMetrics;
  issues: ScenarioIssue[];
  recommendations: string[];
}

export interface ScenarioMetrics {
  transactions_processed: number;
  average_response_time_ms: number;
  error_rate: number;
  peak_concurrent_users: number;
  data_loss: boolean;
  recovery_time_ms: number;
  user_impact: string;
}

export interface ScenarioIssue {
  id: string;
  severity: ScenarioSeverity;
  description: string;
  timestamp: string;
  resolution?: string;
}

export class ScenarioSimulatorService {
  private scenarios: Map<ScenarioType, ScenarioConfig> = new Map();
  private results: ScenarioResult[] = [];

  constructor() {
    this.initializeScenarios();
  }

  private initializeScenarios() {
    const scenarioConfigs: ScenarioConfig[] = [
      {
        type: 'black_friday',
        name: 'Black Friday Rush',
        description: 'Simulate extreme traffic with 10x normal transactions',
        severity: 'critical',
        duration_minutes: 60,
        parameters: {
          transaction_multiplier: 10,
          concurrent_users: 500,
          products_per_transaction: 15,
          payment_method_distribution: { cash: 0.3, mpesa: 0.5, card: 0.2 },
        },
      },
      {
        type: 'christmas_rush',
        name: 'Christmas Holiday Rush',
        description: 'Simulate sustained high traffic over holiday period',
        severity: 'high',
        duration_minutes: 120,
        parameters: {
          transaction_multiplier: 5,
          concurrent_users: 200,
          peak_hours: [10, 11, 12, 14, 15, 16],
        },
      },
      {
        type: 'network_failure',
        name: 'Network Failure',
        description: 'Simulate complete network outage for 5 minutes',
        severity: 'critical',
        duration_minutes: 5,
        parameters: {
          failure_type: 'complete',
          affected_services: ['api', 'database', 'storage'],
          recovery_mode: 'automatic',
        },
      },
      {
        type: 'printer_failure',
        name: 'Receipt Printer Failure',
        description: 'Simulate receipt printer going offline during transactions',
        severity: 'medium',
        duration_minutes: 30,
        parameters: {
          failure_rate: 0.5,
          fallback: 'digital_receipt',
        },
      },
      {
        type: 'power_failure',
        name: 'Power Failure',
        description: 'Simulate power loss with UPS backup',
        severity: 'high',
        duration_minutes: 15,
        parameters: {
          ups_duration_minutes: 10,
          auto_shutdown: true,
          data_preservation: true,
        },
      },
      {
        type: 'database_failure',
        name: 'Database Failure',
        description: 'Simulate primary database going offline',
        severity: 'critical',
        duration_minutes: 10,
        parameters: {
          failover_to: 'replica',
          data_loss_window_seconds: 5,
          automatic_failover: true,
        },
      },
      {
        type: 'internet_loss',
        name: 'Internet Connection Loss',
        description: 'Simulate internet connectivity issues',
        severity: 'high',
        duration_minutes: 20,
        parameters: {
          loss_pattern: 'intermittent',
          offline_mode: true,
          sync_on_reconnect: true,
        },
      },
      {
        type: 'cashier_quits',
        name: 'Cashier Abruptly Quits',
        description: 'Simulate cashier leaving mid-shift without proper handover',
        severity: 'medium',
        duration_minutes: 5,
        parameters: {
          pending_transactions: 3,
          open_drawer: true,
          shift_incomplete: true,
        },
      },
      {
        type: 'supplier_delay',
        name: 'Major Supplier Delay',
        description: 'Simulate critical supplier delivery delay',
        severity: 'high',
        duration_minutes: 60,
        parameters: {
          delayed_products: ['Milk', 'Bread', 'Eggs'],
          delay_days: 3,
          impact_stock_levels: true,
        },
      },
      {
        type: 'mass_refund',
        name: 'Mass Refund Event',
        description: 'Simulate large number of refund requests',
        severity: 'medium',
        duration_minutes: 30,
        parameters: {
          refund_count: 100,
          average_refund_amount: 2500,
          reason: 'quality_issue',
        },
      },
      {
        type: 'inventory_corruption',
        name: 'Inventory Data Corruption',
        description: 'Simulate inventory data integrity issues',
        severity: 'critical',
        duration_minutes: 15,
        parameters: {
          corruption_type: 'negative_stock',
          affected_products: 50,
          auto_detect: true,
        },
      },
      {
        type: 'admin_lockout',
        name: 'Admin Account Lockout',
        description: 'Simulate admin being locked out due to failed attempts',
        severity: 'medium',
        duration_minutes: 10,
        parameters: {
          lockout_duration_minutes: 15,
          failed_attempts: 5,
          recovery_method: 'security_question',
        },
      },
      {
        type: 'peak_hours',
        name: 'Peak Hours Surge',
        description: 'Simulate lunch hour rush with long queues',
        severity: 'high',
        duration_minutes: 60,
        parameters: {
          peak_hours: [12, 13],
          queue_length: 20,
          average_service_time_seconds: 120,
        },
      },
      {
        type: 'flash_sale',
        name: 'Flash Sale Event',
        description: 'Simulate sudden flash sale with high demand',
        severity: 'high',
        duration_minutes: 30,
        parameters: {
          discount_percentage: 50,
          affected_products: 20,
          max_quantity_per_customer: 2,
        },
      },
      {
        type: 'bulk_order',
        name: 'Large Bulk Order',
        description: 'Simulate very large corporate bulk order',
        severity: 'medium',
        duration_minutes: 45,
        parameters: {
          order_value: 500000,
          items_count: 100,
          special_delivery: true,
        },
      },
    ];

    scenarioConfigs.forEach(config => {
      this.scenarios.set(config.type, config);
    });
  }

  getScenarioConfigs(): ScenarioConfig[] {
    return Array.from(this.scenarios.values());
  }

  getScenarioConfig(type: ScenarioType): ScenarioConfig | undefined {
    return this.scenarios.get(type);
  }

  async runScenario(type: ScenarioType): Promise<ScenarioResult> {
    const config = this.scenarios.get(type);
    if (!config) {
      throw new Error(`Scenario ${type} not found`);
    }

    const result: ScenarioResult = {
      id: `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scenario: type,
      status: 'running',
      started_at: new Date().toISOString(),
      duration_ms: 0,
      metrics: {
        transactions_processed: 0,
        average_response_time_ms: 0,
        error_rate: 0,
        peak_concurrent_users: 0,
        data_loss: false,
        recovery_time_ms: 0,
        user_impact: '',
      },
      issues: [],
      recommendations: [],
    };

    try {
      // Simulate scenario execution
      const startTime = Date.now();
      
      // Simulate different scenarios
      switch (type) {
        case 'black_friday':
          await this.simulateBlackFriday(result, config);
          break;
        case 'network_failure':
          await this.simulateNetworkFailure(result, config);
          break;
        case 'database_failure':
          await this.simulateDatabaseFailure(result, config);
          break;
        case 'printer_failure':
          await this.simulatePrinterFailure(result, config);
          break;
        case 'mass_refund':
          await this.simulateMassRefund(result, config);
          break;
        default:
          await this.simulateGenericScenario(result, config);
      }

      result.duration_ms = Date.now() - startTime;
      result.status = 'completed';
      result.completed_at = new Date().toISOString();

    } catch (error) {
      result.status = 'failed';
      result.completed_at = new Date().toISOString();
      result.issues.push({
        id: `issue_${Date.now()}`,
        severity: 'critical',
        description: `Scenario failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      });
    }

    this.results.unshift(result);
    return result;
  }

  private async simulateBlackFriday(result: ScenarioResult, config: ScenarioConfig) {
    const params = config.parameters;
    
    // Simulate high transaction volume
    result.metrics.transactions_processed = Math.floor(Math.random() * 1000) + 500;
    result.metrics.average_response_time_ms = Math.floor(Math.random() * 2000) + 500;
    result.metrics.error_rate = Math.random() * 0.05;
    result.metrics.peak_concurrent_users = params.concurrent_users as any;
    result.metrics.user_impact = 'Slightly slower checkout times';

    // Identify issues
    if (result.metrics.average_response_time_ms > 1500) {
      result.issues.push({
        id: `issue_${Date.now()}`,
        severity: 'high',
        description: 'Response time degraded under load',
        timestamp: new Date().toISOString(),
        resolution: 'Scale up API servers',
      });
    }

    result.recommendations = [
      'Enable database connection pooling',
      'Activate CDN for static assets',
      'Increase API server instances',
      'Enable payment queue for high load',
    ];
  }

  private async simulateNetworkFailure(result: ScenarioResult, config: ScenarioConfig) {
    result.metrics.transactions_processed = 0;
    result.metrics.error_rate = 1.0;
    result.metrics.data_loss = false;
    result.metrics.recovery_time_ms = 30000;
    result.metrics.user_impact = 'Complete service outage';

    result.issues.push({
      id: `issue_${Date.now()}`,
      severity: 'critical',
      description: 'Network connectivity lost',
      timestamp: new Date().toISOString(),
    });

    result.recommendations = [
      'Enable offline mode for POS',
      'Switch to backup network',
      'Activate offline transaction queue',
    ];
  }

  private async simulateDatabaseFailure(result: ScenarioResult, config: ScenarioConfig) {
    result.metrics.transactions_processed = 0;
    result.metrics.error_rate = 1.0;
    result.metrics.data_loss = false;
    result.metrics.recovery_time_ms = 60000;
    result.metrics.user_impact = 'Database failover in progress';

    result.issues.push({
      id: `issue_${Date.now()}`,
      severity: 'critical',
      description: 'Primary database unreachable',
      timestamp: new Date().toISOString(),
    });

    result.recommendations = [
      'Verify automatic failover to replica',
      'Check data consistency after failover',
      'Notify operations team',
    ];
  }

  private async simulatePrinterFailure(result: ScenarioResult, config: ScenarioConfig) {
    result.metrics.transactions_processed = Math.floor(Math.random() * 50) + 20;
    result.metrics.error_rate = 0.1;
    result.metrics.user_impact = 'Digital receipts provided';

    result.issues.push({
      id: `issue_${Date.now()}`,
      severity: 'medium',
      description: 'Receipt printer offline',
      timestamp: new Date().toISOString(),
      resolution: 'Switched to digital receipts',
    });

    result.recommendations = [
      'Maintain backup printer',
      'Enable email receipt option',
      'Queue prints for later',
    ];
  }

  private async simulateMassRefund(result: ScenarioResult, config: ScenarioConfig) {
    const params = config.parameters;
    
    result.metrics.transactions_processed = params.refund_count as any;
    result.metrics.average_response_time_ms = 800;
    result.metrics.error_rate = 0.02;
    result.metrics.user_impact = 'Refund processing delayed';

    result.recommendations = [
      'Enable bulk refund processing',
      'Notify finance team',
      'Update inventory automatically',
    ];
  }

  private async simulateGenericScenario(result: ScenarioResult, config: ScenarioConfig) {
    result.metrics.transactions_processed = Math.floor(Math.random() * 100) + 50;
    result.metrics.average_response_time_ms = Math.floor(Math.random() * 1000) + 200;
    result.metrics.error_rate = Math.random() * 0.1;
    result.metrics.user_impact = 'Minor impact on operations';

    result.recommendations = [
      'Monitor system metrics',
      'Review error logs',
      'Adjust configuration if needed',
    ];
  }

  async runAllScenarios(): Promise<ScenarioResult[]> {
    const results: ScenarioResult[] = [];
    
    for (const config of this.scenarios.values()) {
      const result = await this.runScenario(config.type);
      results.push(result);
    }

    return results;
  }

  getScenarioResults(): ScenarioResult[] {
    return this.results;
  }

  getScenarioResult(id: string): ScenarioResult | undefined {
    return this.results.find(r => r.id === id);
  }

  generateScenarioReport(): Record<string, unknown> {
    const totalScenarios = this.results.length;
    const completed = this.results.filter(r => r.status === 'completed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration_ms, 0) / totalScenarios;

    return {
      summary: {
        total_scenarios: totalScenarios,
        completed,
        failed,
        success_rate: totalScenarios ? (completed / totalScenarios) * 100 : 0,
        average_duration_ms: avgDuration,
      },
      issues_by_severity: {
        critical: this.results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length, 0),
        high: this.results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'high').length, 0),
        medium: this.results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'medium').length, 0),
        low: this.results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'low').length, 0),
      },
      recommendations: this.results.flatMap(r => r.recommendations).filter((v, i, a) => a.indexOf(v) === i),
    };
  }
}

export const scenarioSimulatorService = new ScenarioSimulatorService();
