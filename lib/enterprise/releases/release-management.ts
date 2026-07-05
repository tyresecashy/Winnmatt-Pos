export type ReleaseChannel = 'stable' | 'beta' | 'canary' | 'preview' | 'emergency' | 'hotfix';
export type ReleaseStatus = 'draft' | 'testing' | 'staging' | 'approved' | 'deployed' | 'archived';

export interface Release {
  id: string;
  version: string;
  release_number: string;
  channel: ReleaseChannel;
  status: ReleaseStatus;
  author: string;
  approver?: string;
  features: ReleaseItem[];
  bug_fixes: ReleaseItem[];
  database_changes: DatabaseChange[];
  migration_status: 'pending' | 'running' | 'completed' | 'failed';
  rollback_plan: string;
  risk_score: number;
  deployment_notes: string;
  known_issues: string[];
  support_notes: string;
  created_at: string;
  released_at?: string;
  archived_at?: string;
}

export interface ReleaseItem {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'bugfix' | 'improvement' | 'breaking_change';
  priority: 'low' | 'medium' | 'high' | 'critical';
  ticket_id?: string;
  author: string;
}

export interface DatabaseChange {
  id: string;
  type: 'migration' | 'seed' | 'function' | 'trigger' | 'index';
  description: string;
  sql: string;
  rollback_sql: string;
  applied: boolean;
  applied_at?: string;
}

export interface ReleaseMetrics {
  total_releases: number;
  by_channel: Record<ReleaseChannel, number>;
  by_status: Record<ReleaseStatus, number>;
  average_risk_score: number;
  recent_releases: Release[];
}

export class ReleaseManagementService {
  private releases: Map<string, Release> = new Map();
  private releaseCounter: number = 1;

  constructor() {
    this.initializeReleases();
  }

  private initializeReleases() {
    // Initialize with some historical releases
    const historicalReleases: Release[] = [
      {
        id: 'rel_001',
        version: '1.0.0',
        release_number: 'R-001',
        channel: 'stable',
        status: 'deployed',
        author: 'admin@winnmatt.com',
        approver: 'admin@winnmatt.com',
        features: [
          { id: 'f1', title: 'Initial POS System', description: 'Core POS functionality', type: 'feature', priority: 'critical', author: 'dev@winnmatt.com' },
        ],
        bug_fixes: [],
        database_changes: [],
        migration_status: 'completed',
        rollback_plan: 'Restore from backup',
        risk_score: 30,
        deployment_notes: 'Initial release',
        known_issues: [],
        support_notes: 'First production release',
        created_at: '2024-01-15T10:00:00Z',
        released_at: '2024-01-15T14:00:00Z',
      },
    ];

    historicalReleases.forEach(r => this.releases.set(r.id, r));
    this.releaseCounter = historicalReleases.length + 1;
  }

  async createRelease(release: Omit<Release, 'id' | 'release_number' | 'created_at' | 'migration_status'>): Promise<Release> {
    const newRelease: Release = {
      ...release,
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      release_number: `R-${this.releaseCounter.toString().padStart(3, '0')}`,
      migration_status: 'pending',
      created_at: new Date().toISOString(),
    };

    this.releaseCounter++;
    this.releases.set(newRelease.id, newRelease);
    return newRelease;
  }

  async updateRelease(releaseId: string, updates: Partial<Release>): Promise<Release | null> {
    const release = this.releases.get(releaseId);
    if (!release) return null;

    const updatedRelease = { ...release, ...updates };
    this.releases.set(releaseId, updatedRelease);
    return updatedRelease;
  }

  async getRelease(releaseId: string): Promise<Release | null> {
    return this.releases.get(releaseId) || null;
  }

  async getReleases(filters?: { channel?: ReleaseChannel; status?: ReleaseStatus }): Promise<Release[]> {
    let releases = Array.from(this.releases.values());

    if (filters?.channel) {
      releases = releases.filter(r => r.channel === filters.channel);
    }
    if (filters?.status) {
      releases = releases.filter(r => r.status === filters.status);
    }

    return releases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getLatestRelease(channel: ReleaseChannel = 'stable'): Promise<Release | null> {
    const releases = await this.getReleases({ channel, status: 'deployed' });
    return releases[0] || null;
  }

  async approveRelease(releaseId: string, approver: string): Promise<boolean> {
    const release = this.releases.get(releaseId);
    if (!release) return false;

    release.status = 'approved';
    release.approver = approver;
    return true;
  }

  async deployRelease(releaseId: string): Promise<boolean> {
    const release = this.releases.get(releaseId);
    if (!release) return false;

    release.status = 'deployed';
    release.released_at = new Date().toISOString();
    return true;
  }

  async archiveRelease(releaseId: string): Promise<boolean> {
    const release = this.releases.get(releaseId);
    if (!release) return false;

    release.status = 'archived';
    release.archived_at = new Date().toISOString();
    return true;
  }

  async calculateRiskScore(release: Release): Promise<number> {
    let score = 0;

    // Factor in number of changes
    score += release.features.length * 5;
    score += release.bug_fixes.length * 2;
    score += release.database_changes.length * 10;

    // Factor in breaking changes
    const breakingChanges = release.features.filter(f => f.type === 'breaking_change');
    score += breakingChanges.length * 25;

    // Factor in priority
    const criticalItems = [...release.features, ...release.bug_fixes].filter(i => i.priority === 'critical');
    score += criticalItems.length * 15;

    // Cap at 100
    return Math.min(100, score);
  }

  async getNextVersion(channel: ReleaseChannel): Promise<string> {
    const releases = await this.getReleases({ channel });
    const latest = releases[0];

    if (!latest) {
      return '1.0.0';
    }

    const [major, minor, patch] = latest.version.split('.').map(Number);

    switch (channel) {
      case 'hotfix':
      case 'emergency':
        return `${major}.${minor}.${patch + 1}`;
      case 'canary':
      case 'preview':
        return `${major}.${minor + 1}.0-beta.1`;
      case 'beta':
        return `${major}.${minor + 1}.0-beta.${releases.length + 1}`;
      default:
        return `${major}.${minor + 1}.0`;
    }
  }

  async generateChangelog(releaseId: string): Promise<string> {
    const release = this.releases.get(releaseId);
    if (!release) return '';

    let changelog = `# Release ${release.version} (${release.release_number})\n\n`;
    changelog += `**Channel:** ${release.channel}\n`;
    changelog += `**Author:** ${release.author}\n`;
    changelog += `**Released:** ${release.released_at || 'Pending'}\n\n`;

    if (release.features.length > 0) {
      changelog += `## Features\n\n`;
      release.features.forEach(f => {
        changelog += `- ${f.title}: ${f.description}\n`;
      });
      changelog += '\n';
    }

    if (release.bug_fixes.length > 0) {
      changelog += `## Bug Fixes\n\n`;
      release.bug_fixes.forEach(f => {
        changelog += `- ${f.title}: ${f.description}\n`;
      });
      changelog += '\n';
    }

    if (release.database_changes.length > 0) {
      changelog += `## Database Changes\n\n`;
      release.database_changes.forEach(c => {
        changelog += `- ${c.type}: ${c.description}\n`;
      });
      changelog += '\n';
    }

    if (release.known_issues.length > 0) {
      changelog += `## Known Issues\n\n`;
      release.known_issues.forEach(i => {
        changelog += `- ${i}\n`;
      });
      changelog += '\n';
    }

    return changelog;
  }

  async getReleaseMetrics(): Promise<ReleaseMetrics> {
    const releases = Array.from(this.releases.values());
    
    const byChannel: Record<ReleaseChannel, number> = {
      stable: 0, beta: 0, canary: 0, preview: 0, emergency: 0, hotfix: 0,
    };
    const byStatus: Record<ReleaseStatus, number> = {
      draft: 0, testing: 0, staging: 0, approved: 0, deployed: 0, archived: 0,
    };

    releases.forEach(r => {
      byChannel[r.channel]++;
      byStatus[r.status]++;
    });

    return {
      total_releases: releases.length,
      by_channel: byChannel,
      by_status: byStatus,
      average_risk_score: releases.reduce((sum, r) => sum + r.risk_score, 0) / releases.length || 0,
      recent_releases: releases.slice(0, 5),
    };
  }
}

export const releaseManagementService = new ReleaseManagementService();
