export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type IncidentStatus = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affected_branches: string[];
  affected_services: string[];
  timeline: IncidentEvent[];
  root_cause?: string;
  fix?: string;
  owner: string;
  resolution_time_minutes?: number;
  lessons_learned?: string;
  linked_deployment?: string;
  linked_bug?: string;
  linked_complaints?: string[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
}

export interface IncidentEvent {
  id: string;
  timestamp: string;
  type: 'created' | 'updated' | 'status_change' | 'comment' | 'escalation' | 'resolution';
  description: string;
  author: string;
}

export interface IncidentMetrics {
  total_incidents: number;
  by_severity: Record<IncidentSeverity, number>;
  by_status: Record<IncidentStatus, number>;
  average_resolution_time_minutes: number;
  mttr_minutes: number;
  mtbf_hours: number;
  open_incidents: number;
  critical_incidents: number;
}

export class IncidentCenterService {
  private incidents: Map<string, Incident> = new Map();

  async createIncident(incident: Omit<Incident, 'id' | 'timeline' | 'created_at' | 'updated_at'>): Promise<Incident> {
    const newIncident: Incident = {
      ...incident,
      id: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timeline: [
        {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'created',
          description: 'Incident created',
          author: incident.owner,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.incidents.set(newIncident.id, newIncident);
    return newIncident;
  }

  async updateIncident(incidentId: string, updates: Partial<Incident>): Promise<Incident | null> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    const updatedIncident = {
      ...incident,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Add timeline event
    updatedIncident.timeline.push({
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'updated',
      description: 'Incident updated',
      author: updates.owner || incident.owner,
    });

    this.incidents.set(incidentId, updatedIncident);
    return updatedIncident;
  }

  async addTimelineEvent(incidentId: string, event: Omit<IncidentEvent, 'id' | 'timestamp'>): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    incident.timeline.push({
      ...event,
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
    });

    incident.updated_at = new Date().toISOString();
    return true;
  }

  async resolveIncident(incidentId: string, rootCause: string, fix: string, lessonsLearned?: string): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    incident.status = 'resolved';
    incident.root_cause = rootCause;
    incident.fix = fix;
    incident.lessons_learned = lessonsLearned;
    incident.resolved_at = new Date().toISOString();
    incident.updated_at = new Date().toISOString();

    // Calculate resolution time
    const createdAt = new Date(incident.created_at);
    const resolvedAt = new Date(incident.resolved_at);
    incident.resolution_time_minutes = Math.round((resolvedAt.getTime() - createdAt.getTime()) / 60000);

    // Add resolution event
    incident.timeline.push({
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'resolution',
      description: `Incident resolved: ${fix}`,
      author: incident.owner,
    });

    return true;
  }

  async closeIncident(incidentId: string): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    incident.status = 'closed';
    incident.closed_at = new Date().toISOString();
    incident.updated_at = new Date().toISOString();

    return true;
  }

  async getIncident(incidentId: string): Promise<Incident | null> {
    return this.incidents.get(incidentId) || null;
  }

  async getIncidents(filters?: { severity?: IncidentSeverity; status?: IncidentStatus }): Promise<Incident[]> {
    let incidents = Array.from(this.incidents.values());

    if (filters?.severity) {
      incidents = incidents.filter(i => i.severity === filters.severity);
    }
    if (filters?.status) {
      incidents = incidents.filter(i => i.status === filters.status);
    }

    return incidents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getOpenIncidents(): Promise<Incident[]> {
    return this.getIncidents({ status: 'open' });
  }

  async getCriticalIncidents(): Promise<Incident[]> {
    return this.getIncidents({ severity: 'critical' });
  }

  async getIncidentMetrics(): Promise<IncidentMetrics> {
    const incidents = Array.from(this.incidents.values());

    const bySeverity: Record<IncidentSeverity, number> = {
      critical: 0, high: 0, medium: 0, low: 0, informational: 0,
    };
    const byStatus: Record<IncidentStatus, number> = {
      open: 0, investigating: 0, identified: 0, monitoring: 0, resolved: 0, closed: 0,
    };

    incidents.forEach(i => {
      bySeverity[i.severity]++;
      byStatus[i.status]++;
    });

    const resolvedIncidents = incidents.filter(i => i.resolution_time_minutes);
    const avgResolutionTime = resolvedIncidents.length
      ? resolvedIncidents.reduce((sum, i) => sum + (i.resolution_time_minutes || 0), 0) / resolvedIncidents.length
      : 0;

    return {
      total_incidents: incidents.length,
      by_severity: bySeverity,
      by_status: byStatus,
      average_resolution_time_minutes: avgResolutionTime,
      mttr_minutes: avgResolutionTime,
      mtbf_hours: 720 / Math.max(1, bySeverity.critical + bySeverity.high),
      open_incidents: byStatus.open + byStatus.investigating + byStatus.identified + byStatus.monitoring,
      critical_incidents: bySeverity.critical,
    };
  }

  async getIncidentTimeline(incidentId: string): Promise<IncidentEvent[]> {
    const incident = this.incidents.get(incidentId);
    return incident?.timeline || [];
  }

  async generateIncidentReport(incidentId: string): Promise<string> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return '';

    let report = `# Incident Report: ${incident.title}\n\n`;
    report += `**Incident ID:** ${incident.id}\n`;
    report += `**Severity:** ${incident.severity}\n`;
    report += `**Status:** ${incident.status}\n`;
    report += `**Owner:** ${incident.owner}\n`;
    report += `**Created:** ${incident.created_at}\n`;
    report += `**Resolved:** ${incident.resolved_at || 'Pending'}\n\n`;

    report += `## Description\n\n${incident.description}\n\n`;

    report += `## Affected Services\n\n`;
    incident.affected_services.forEach(s => {
      report += `- ${s}\n`;
    });
    report += '\n';

    report += `## Affected Branches\n\n`;
    incident.affected_branches.forEach(b => {
      report += `- ${b}\n`;
    });
    report += '\n';

    if (incident.root_cause) {
      report += `## Root Cause\n\n${incident.root_cause}\n\n`;
    }

    if (incident.fix) {
      report += `## Fix\n\n${incident.fix}\n\n`;
    }

    if (incident.lessons_learned) {
      report += `## Lessons Learned\n\n${incident.lessons_learned}\n\n`;
    }

    report += `## Timeline\n\n`;
    incident.timeline.forEach(event => {
      report += `- **${event.timestamp}** - ${event.description} (${event.author})\n`;
    });

    return report;
  }

  async linkDeployment(incidentId: string, deploymentId: string): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    incident.linked_deployment = deploymentId;
    return true;
  }

  async linkBug(incidentId: string, bugId: string): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    incident.linked_bug = bugId;
    return true;
  }
}

export const incidentCenterService = new IncidentCenterService();
