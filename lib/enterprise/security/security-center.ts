export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type SecurityEventType = 
  | 'failed_login'
  | 'brute_force'
  | 'suspicious_device'
  | 'impossible_travel'
  | 'permission_escalation'
  | 'sql_injection'
  | 'xss_detection'
  | 'rate_limiting'
  | 'api_abuse'
  | 'bot_detection'
  | 'malicious_ip'
  | 'session_hijack'
  | 'secret_scanning'
  | 'dependency_vulnerability';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: ThreatLevel;
  source: string;
  ip_address: string;
  user_agent: string;
  user_id?: string;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  investigated: boolean;
  resolved: boolean;
}

export interface ThreatAnalysis {
  overall_threat_level: ThreatLevel;
  active_threats: number;
  blocked_ips: number;
  failed_logins_24h: number;
  suspicious_activities: number;
  vulnerability_count: number;
  last_scan: string;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  rules: SecurityRule[];
  action: 'log' | 'alert' | 'block' | 'quarantine';
}

export interface SecurityRule {
  id: string;
  condition: string;
  threshold?: number;
  time_window_minutes?: number;
  action: string;
}

export interface BlockedIP {
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at?: string;
  blocked_by: string;
}

export interface Vulnerability {
  id: string;
  package: string;
  version: string;
  severity: ThreatLevel;
  description: string;
  fixed_in?: string;
  cve?: string;
}

export class SecurityCenterService {
  private events: SecurityEvent[] = [];
  private blockedIPs: BlockedIP[] = [];
  private policies: SecurityPolicy[] = [];
  private vulnerabilities: Vulnerability[] = [];

  constructor() {
    this.initializePolicies();
    this.initializeVulnerabilities();
  }

  private initializePolicies() {
    this.policies = [
      {
        id: 'pol_001',
        name: 'Brute Force Protection',
        type: 'authentication',
        enabled: true,
        rules: [
          { id: 'rule_001', condition: 'failed_logins > 5', threshold: 5, time_window_minutes: 15, action: 'block' },
        ],
        action: 'block',
      },
      {
        id: 'pol_002',
        name: 'Rate Limiting',
        type: 'api',
        enabled: true,
        rules: [
          { id: 'rule_002', condition: 'requests > 100', threshold: 100, time_window_minutes: 1, action: 'throttle' },
        ],
        action: 'alert',
      },
      {
        id: 'pol_003',
        name: 'SQL Injection Detection',
        type: 'input_validation',
        enabled: true,
        rules: [
          { id: 'rule_003', condition: 'contains_sql_patterns', action: 'block' },
        ],
        action: 'block',
      },
      {
        id: 'pol_004',
        name: 'XSS Detection',
        type: 'input_validation',
        enabled: true,
        rules: [
          { id: 'rule_004', condition: 'contains_script_tags', action: 'block' },
        ],
        action: 'block',
      },
      {
        id: 'pol_005',
        name: 'Session Hijacking Detection',
        type: 'session',
        enabled: true,
        rules: [
          { id: 'rule_005', condition: 'ip_changed mid_session', action: 'alert' },
        ],
        action: 'alert',
      },
    ];
  }

  private initializeVulnerabilities() {
    this.vulnerabilities = [
      {
        id: 'vuln_001',
        package: 'lodash',
        version: '4.17.20',
        severity: 'medium',
        description: 'Prototype Pollution vulnerability',
        fixed_in: '4.17.21',
        cve: 'CVE-2021-23337',
      },
      {
        id: 'vuln_002',
        package: 'axios',
        version: '0.21.1',
        severity: 'low',
        description: 'Server-Side Request Forgery',
        fixed_in: '0.21.2',
        cve: 'CVE-2021-3749',
      },
    ];
  }

  async recordSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'investigated' | 'resolved'>): Promise<SecurityEvent> {
    const newEvent: SecurityEvent = {
      ...event,
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      investigated: false,
      resolved: false,
    };

    this.events.push(newEvent);

    // Check if IP should be blocked
    if (event.severity === 'critical' || event.severity === 'high') {
      await this.blockIP(event.ip_address, `Security event: ${event.type}`);
    }

    return newEvent;
  }

  async blockIP(ipAddress: string, reason: string, expiresAt?: string): Promise<void> {
    this.blockedIPs.push({
      ip_address: ipAddress,
      reason,
      blocked_at: new Date().toISOString(),
      expires_at: expiresAt,
      blocked_by: 'system',
    });
  }

  async unblockIP(ipAddress: string): Promise<boolean> {
    const index = this.blockedIPs.findIndex(b => b.ip_address === ipAddress);
    if (index !== -1) {
      this.blockedIPs.splice(index, 1);
      return true;
    }
    return false;
  }

  async investigateEvent(eventId: string): Promise<boolean> {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.investigated = true;
      return true;
    }
    return false;
  }

  async resolveEvent(eventId: string): Promise<boolean> {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.resolved = true;
      return true;
    }
    return false;
  }

  async getSecurityEvents(filters?: { type?: SecurityEventType; severity?: ThreatLevel; since?: string }): Promise<SecurityEvent[]> {
    let filtered = [...this.events];

    if (filters?.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }
    if (filters?.severity) {
      filtered = filtered.filter(e => e.severity === filters.severity);
    }
    if (filters?.since) {
      const since = new Date(filters.since);
      filtered = filtered.filter(e => new Date(e.timestamp) >= since);
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getThreatAnalysis(): Promise<ThreatAnalysis> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = this.events.filter(e => new Date(e.timestamp) >= oneDayAgo);
    const failedLogins = recentEvents.filter(e => e.type === 'failed_login').length;
    const suspiciousActivities = recentEvents.filter(e => 
      e.severity === 'high' || e.severity === 'critical'
    ).length;

    let overallThreatLevel: ThreatLevel = 'none';
    if (suspiciousActivities > 10) overallThreatLevel = 'critical';
    else if (suspiciousActivities > 5) overallThreatLevel = 'high';
    else if (suspiciousActivities > 2) overallThreatLevel = 'medium';
    else if (suspiciousActivities > 0) overallThreatLevel = 'low';

    return {
      overall_threat_level: overallThreatLevel,
      active_threats: suspiciousActivities,
      blocked_ips: this.blockedIPs.length,
      failed_logins_24h: failedLogins,
      suspicious_activities: suspiciousActivities,
      vulnerability_count: this.vulnerabilities.length,
      last_scan: new Date().toISOString(),
    };
  }

  async getBlockedIPs(): Promise<BlockedIP[]> {
    return this.blockedIPs;
  }

  async getPolicies(): Promise<SecurityPolicy[]> {
    return this.policies;
  }

  async updatePolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<boolean> {
    const policy = this.policies.find(p => p.id === policyId);
    if (policy) {
      Object.assign(policy, updates);
      return true;
    }
    return false;
  }

  async getVulnerabilities(): Promise<Vulnerability[]> {
    return this.vulnerabilities;
  }

  async scanForVulnerabilities(): Promise<Vulnerability[]> {
    // Simulate vulnerability scan
    return this.vulnerabilities;
  }

  async getFailedLogins(limit: number = 50): Promise<SecurityEvent[]> {
    return this.events
      .filter(e => e.type === 'failed_login')
      .slice(-limit);
  }

  async getSuspiciousDevices(): Promise<SecurityEvent[]> {
    return this.events.filter(e => e.type === 'suspicious_device');
  }

  async getSecuritySummary(): Promise<Record<string, unknown>> {
    const analysis = await this.getThreatAnalysis();
    const recentEvents = await this.getSecurityEvents({ since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() });

    return {
      threat_level: analysis.overall_threat_level,
      active_threats: analysis.active_threats,
      blocked_ips: analysis.blocked_ips,
      failed_logins_24h: analysis.failed_logins_24h,
      events_today: recentEvents.length,
      critical_events: recentEvents.filter(e => e.severity === 'critical').length,
      unresolved_events: recentEvents.filter(e => !e.resolved).length,
    };
  }

  async detectAnomalies(): Promise<any[]> {
    // Simulate anomaly detection
    return [
      { type: 'unusual_hour', description: 'Login attempt at 3:00 AM', severity: 'medium' },
      { type: 'multiple_failures', description: '5 failed logins in 2 minutes', severity: 'high' },
    ];
  }
}

export const securityCenterService = new SecurityCenterService();
