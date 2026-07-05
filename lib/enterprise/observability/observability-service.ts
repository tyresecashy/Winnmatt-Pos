export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
}

export interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;
  source: string;
  trace_id?: string;
  span_id?: string;
  metadata: Record<string, any>;
}

export interface Trace {
  trace_id: string;
  spans: Span[];
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: 'ok' | 'error';
}

export interface Span {
  span_id: string;
  parent_span_id?: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: 'ok' | 'error';
  attributes: Record<string, any>;
}

export interface UserJourney {
  id: string;
  user_id: string;
  session_id: string;
  events: UserEvent[];
  start_time: string;
  end_time: string;
  duration_ms: number;
  page_views: number;
  actions: number;
  errors: number;
}

export interface UserEvent {
  id: string;
  type: 'page_view' | 'click' | 'input' | 'api_call' | 'error' | 'custom';
  name: string;
  timestamp: string;
  duration_ms?: number;
  metadata: Record<string, any>;
}

export interface ObservabilityDashboard {
  metrics: Metric[];
  recent_logs: LogEntry[];
  active_traces: Trace[];
  user_journeys: UserJourney[];
  alerts: Alert[];
  summary: ObservabilitySummary;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface ObservabilitySummary {
  total_requests: number;
  error_rate: number;
  average_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  active_users: number;
  active_sessions: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  storage_used_gb: number;
}

export class ObservabilityService {
  private metrics: Metric[] = [];
  private logs: LogEntry[] = [];
  private traces: Trace[] = [];
  private userJourneys: UserJourney[] = [];
  private alerts: Alert[] = [];

  async recordMetric(metric: Omit<Metric, 'timestamp'>): Promise<void> {
    this.metrics.push({
      ...metric,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics.shift();
    }
  }

  async recordLog(log: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> {
    this.logs.push({
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 50000 logs
    if (this.logs.length > 50000) {
      this.logs.shift();
    }

    // Create alert for errors
    if (log.level === 'error' || log.level === 'fatal') {
      await this.createAlert({
        severity: log.level === 'fatal' ? 'critical' : 'error',
        message: log.message,
        source: log.source,
      });
    }
  }

  async recordTrace(trace: Omit<Trace, 'trace_id'>): Promise<Trace> {
    const fullTrace: Trace = {
      ...trace,
      trace_id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.traces.push(fullTrace);

    // Keep only last 1000 traces
    if (this.traces.length > 1000) {
      this.traces.shift();
    }

    return fullTrace;
  }

  async recordUserJourney(journey: Omit<UserJourney, 'id'>): Promise<void> {
    this.userJourneys.push({
      ...journey,
      id: `journey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    // Keep only last 1000 journeys
    if (this.userJourneys.length > 1000) {
      this.userJourneys.shift();
    }
  }

  async createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
    };

    this.alerts.push(newAlert);
    return newAlert;
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  async getMetrics(filters?: { name?: string; source?: string; since?: string }): Promise<Metric[]> {
    let filtered = [...this.metrics];

    if (filters?.name) {
      filtered = filtered.filter(m => m.name === filters.name);
    }
    if (filters?.source) {
      filtered = filtered.filter(m => m.tags.source === filters.source);
    }
    if (filters?.since) {
      const since = new Date(filters.since);
      filtered = filtered.filter(m => new Date(m.timestamp) >= since);
    }

    return filtered;
  }

  async getLogs(filters?: { level?: string; source?: string; since?: string; limit?: number }): Promise<LogEntry[]> {
    let filtered = [...this.logs];

    if (filters?.level) {
      filtered = filtered.filter(l => l.level === filters.level);
    }
    if (filters?.source) {
      filtered = filtered.filter(l => l.source === filters.source);
    }
    if (filters?.since) {
      const since = new Date(filters.since);
      filtered = filtered.filter(l => new Date(l.timestamp) >= since);
    }

    return filtered.slice(0, filters?.limit || 100);
  }

  async getTraces(limit: number = 50): Promise<Trace[]> {
    return this.traces.slice(-limit);
  }

  async getUserJourneys(limit: number = 50): Promise<UserJourney[]> {
    return this.userJourneys.slice(-limit);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return this.alerts.filter(a => !a.resolved);
  }

  async getDashboard(): Promise<ObservabilityDashboard> {
    const summary = await this.getSummary();
    const activeAlerts = await this.getActiveAlerts();

    return {
      metrics: this.metrics.slice(-100),
      recent_logs: this.logs.slice(-50),
      active_traces: this.traces.slice(-10),
      user_journeys: this.userJourneys.slice(-10),
      alerts: activeAlerts,
      summary,
    };
  }

  async getSummary(): Promise<ObservabilitySummary> {
    // Simulate summary data
    return {
      total_requests: Math.floor(Math.random() * 10000) + 5000,
      error_rate: Math.random() * 2,
      average_response_time: Math.floor(Math.random() * 200) + 100,
      p95_response_time: Math.floor(Math.random() * 500) + 200,
      p99_response_time: Math.floor(Math.random() * 1000) + 500,
      active_users: Math.floor(Math.random() * 100) + 50,
      active_sessions: Math.floor(Math.random() * 200) + 100,
      memory_usage_mb: Math.floor(Math.random() * 500) + 200,
      cpu_usage_percent: Math.floor(Math.random() * 30) + 20,
      storage_used_gb: Math.floor(Math.random() * 50) + 10,
    };
  }

  async getMetricsTrend(metricName: string, hours: number = 24): Promise<any[]> {
    const trend = [];
    const now = new Date();

    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      trend.push({
        timestamp: timestamp.toISOString(),
        value: Math.floor(Math.random() * 1000) + 500,
      });
    }

    return trend;
  }

  async searchLogs(query: string, limit: number = 100): Promise<LogEntry[]> {
    const lowerQuery = query.toLowerCase();
    return this.logs
      .filter(l => l.message.toLowerCase().includes(lowerQuery))
      .slice(-limit);
  }

  async correlateIncident(incidentId: string): Promise<any> {
    // Correlate logs, metrics, and traces for an incident
    return {
      incident_id: incidentId,
      related_logs: this.logs.slice(-20),
      related_metrics: this.metrics.slice(-50),
      related_traces: this.traces.slice(-10),
      timeline: [],
      root_cause: 'Simulated root cause analysis',
    };
  }
}

export const observabilityService = new ObservabilityService();
