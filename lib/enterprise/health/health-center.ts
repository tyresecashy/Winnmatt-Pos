export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latency_ms: number;
  error_rate: number;
  availability: number;
  last_checked: string;
  message?: string;
  dependencies: string[];
  health_score: number;
}

export interface SubsystemHealth {
  id: string;
  name: string;
  status: HealthStatus;
  checks: HealthCheck[];
  overall_score: number;
  uptime_percentage: number;
  last_incident?: string;
  dependencies: string[];
  metadata: Record<string, any>;
}

export interface SystemHealth {
  overall_status: HealthStatus;
  overall_score: number;
  subsystems: SubsystemHealth[];
  last_updated: string;
  active_incidents: number;
  uptime_24h: number;
  uptime_7d: number;
  uptime_30d: number;
}

export class HealthCenterService {
  private subsystems: Map<string, SubsystemHealth> = new Map();
  private healthHistory: SystemHealth[] = [];

  constructor() {
    this.initializeSubsystems();
  }

  private initializeSubsystems() {
    const subsystemConfigs = [
      { id: 'frontend', name: 'Frontend', dependencies: ['api', 'cdn'] },
      { id: 'backend', name: 'Backend API', dependencies: ['database', 'cache'] },
      { id: 'api', name: 'API Gateway', dependencies: ['backend', 'auth'] },
      { id: 'database', name: 'Database', dependencies: ['storage'] },
      { id: 'storage', name: 'File Storage', dependencies: [] },
      { id: 'auth', name: 'Authentication', dependencies: ['database'] },
      { id: 'payments', name: 'Payment Gateway', dependencies: ['api', 'external_mpesa'] },
      { id: 'notifications', name: 'Notifications', dependencies: ['api', 'external_sms'] },
      { id: 'ai', name: 'AI Services', dependencies: ['api', 'external_openrouter'] },
      { id: 'reports', name: 'Reports Engine', dependencies: ['database', 'storage'] },
      { id: 'search', name: 'Search Engine', dependencies: ['database'] },
      { id: 'sync', name: 'Sync Service', dependencies: ['database', 'cache'] },
      { id: 'offline', name: 'Offline Engine', dependencies: ['sync'] },
      { id: 'backups', name: 'Backup System', dependencies: ['database', 'storage'] },
      { id: 'monitoring', name: 'Monitoring', dependencies: ['api', 'database'] },
    ];

    subsystemConfigs.forEach(config => {
      this.subsystems.set(config.id, {
        ...config,
        status: 'healthy',
        checks: [],
        overall_score: 100,
        uptime_percentage: 99.9,
        dependencies: config.dependencies || [],
        metadata: {},
      });
    });
  }

  async checkSubsystemHealth(subsystemId: string): Promise<SubsystemHealth> {
    const subsystem = this.subsystems.get(subsystemId);
    if (!subsystem) {
      throw new Error(`Subsystem ${subsystemId} not found`);
    }

    // Simulate health checks
    const checks: HealthCheck[] = [
      {
        name: 'Connectivity',
        status: Math.random() > 0.05 ? 'healthy' : 'degraded',
        latency_ms: Math.floor(Math.random() * 100) + 10,
        error_rate: Math.random() * 0.02,
        availability: 99.9 + Math.random() * 0.1,
        last_checked: new Date().toISOString(),
        dependencies: subsystem.dependencies,
        health_score: 95 + Math.floor(Math.random() * 5),
      },
      {
        name: 'Response Time',
        status: Math.random() > 0.1 ? 'healthy' : 'degraded',
        latency_ms: Math.floor(Math.random() * 500) + 50,
        error_rate: 0,
        availability: 100,
        last_checked: new Date().toISOString(),
        dependencies: [],
        health_score: 90 + Math.floor(Math.random() * 10),
      },
      {
        name: 'Error Rate',
        status: Math.random() > 0.02 ? 'healthy' : 'unhealthy',
        latency_ms: 0,
        error_rate: Math.random() * 0.05,
        availability: 99 + Math.random() * 1,
        last_checked: new Date().toISOString(),
        dependencies: [],
        health_score: 85 + Math.floor(Math.random() * 15),
      },
    ];

    subsystem.checks = checks;
    
    // Calculate overall status
    const statuses = checks.map(c => c.status);
    if (statuses.includes('unhealthy')) {
      subsystem.status = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      subsystem.status = 'degraded';
    } else {
      subsystem.status = 'healthy';
    }

    // Calculate overall score
    subsystem.overall_score = Math.round(
      checks.reduce((sum, c) => sum + c.health_score, 0) / checks.length
    );

    return subsystem;
  }

  async checkAllSubsystems(): Promise<SystemHealth> {
    const subsystems: SubsystemHealth[] = [];

    for (const [id] of this.subsystems) {
      const health = await this.checkSubsystemHealth(id);
      subsystems.push(health);
    }

    const overallScore = Math.round(
      subsystems.reduce((sum, s) => sum + s.overall_score, 0) / subsystems.length
    );

    let overallStatus: HealthStatus = 'healthy';
    if (subsystems.some(s => s.status === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (subsystems.some(s => s.status === 'degraded')) {
      overallStatus = 'degraded';
    }

    const systemHealth: SystemHealth = {
      overall_status: overallStatus,
      overall_score: overallScore,
      subsystems,
      last_updated: new Date().toISOString(),
      active_incidents: subsystems.filter(s => s.status === 'unhealthy').length,
      uptime_24h: 99.9 + Math.random() * 0.1,
      uptime_7d: 99.8 + Math.random() * 0.2,
      uptime_30d: 99.5 + Math.random() * 0.5,
    };

    this.healthHistory.push(systemHealth);
    if (this.healthHistory.length > 1000) {
      this.healthHistory.shift();
    }

    return systemHealth;
  }

  async getSubsystemHealth(subsystemId: string): Promise<SubsystemHealth | undefined> {
    return this.subsystems.get(subsystemId);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return this.checkAllSubsystems();
  }

  async getHealthHistory(limit: number = 100): Promise<SystemHealth[]> {
    return this.healthHistory.slice(-limit);
  }

  async getUnhealthySubsystems(): Promise<SubsystemHealth[]> {
    return Array.from(this.subsystems.values())
      .filter(s => s.status === 'unhealthy' || s.status === 'degraded');
  }

  async getHealthTrend(subsystemId: string, hours: number = 24): Promise<any[]> {
    // Simulate health trend data
    const trend = [];
    const now = new Date();
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      trend.push({
        timestamp: timestamp.toISOString(),
        score: 90 + Math.floor(Math.random() * 10),
        status: Math.random() > 0.1 ? 'healthy' : 'degraded',
      });
    }

    return trend;
  }

  async getHealthSummary(): Promise<any> {
    const health = await this.checkAllSubsystems();
    
    return {
      overall: {
        status: health.overall_status,
        score: health.overall_score,
        uptime_24h: health.uptime_24h,
      },
      subsystems: health.subsystems.map(s => ({
        name: s.name,
        status: s.status,
        score: s.overall_score,
      })),
      incidents: health.active_incidents,
      last_updated: health.last_updated,
    };
  }

  async simulateFailure(subsystemId: string): Promise<void> {
    const subsystem = this.subsystems.get(subsystemId);
    if (subsystem) {
      subsystem.status = 'unhealthy';
      subsystem.overall_score = 0;
      subsystem.checks.forEach(c => {
        c.status = 'unhealthy';
        c.health_score = 0;
      });
    }
  }

  async recoverSubsystem(subsystemId: string): Promise<void> {
    await this.checkSubsystemHealth(subsystemId);
  }
}

export const healthCenterService = new HealthCenterService();
