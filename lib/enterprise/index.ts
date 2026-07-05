// Enterprise Operations Module
// Phase 7: Production Engineering, Quality Assurance, Reliability, Security Hardening & Enterprise Operations

export { testCenterService } from './testing/test-center';
export { testDataGeneratorService } from './testing/test-data-generator';
export { scenarioSimulatorService } from './testing/scenario-simulator';

export { deploymentCenterService } from './deployment/deployment-center';
export { releaseManagementService } from './releases/release-management';

export { healthCenterService } from './health/health-center';
export { observabilityService } from './observability/observability-service';
export { incidentCenterService } from './incidents/incident-center';

export { securityCenterService } from './security/security-center';
export { auditExplorerService } from './audit/audit-explorer';

export { performanceLabService } from './performance/performance-lab';
export { configManagementService } from './config/config-management';

export { dataGovernanceService } from './governance/data-governance';
export { disasterRecoveryService } from './disaster-recovery/disaster-recovery';

// Types
export type { TestType, TestStatus, TestCase, TestSuite, ModuleHealth, TestRun } from './testing/test-center';
export type { DeploymentPipeline, PipelineStageStatus, DeploymentConfig, RollbackPlan } from './deployment/deployment-center';
export type { Release, ReleaseChannel, ReleaseStatus, DatabaseChange } from './releases/release-management';
export type { HealthCheck, SubsystemHealth, SystemHealth } from './health/health-center';
export type { Metric, LogEntry, Trace, UserJourney, ObservabilityDashboard, Alert } from './observability/observability-service';
export type { Incident, IncidentSeverity, IncidentStatus, IncidentEvent } from './incidents/incident-center';
export type { SecurityEvent, ThreatLevel, SecurityEventType, ThreatAnalysis, Vulnerability } from './security/security-center';
export type { AuditRecord, AuditAction, AuditFilter, AuditStats } from './audit/audit-explorer';
export type { PerformanceMetric, BenchmarkResult, PerformanceRegression } from './performance/performance-lab';
export type { SystemConfig, ConfigCategory, ConfigChange } from './config/config-management';
export type { DataAsset, RetentionPolicy, BackupPolicy } from './governance/data-governance';
export type { Backup, RestorePoint, DisasterRecoveryPlan, RecoveryMetrics } from './disaster-recovery/disaster-recovery';

// Services
import { testCenterService } from './testing/test-center';
import { testDataGeneratorService } from './testing/test-data-generator';
import { scenarioSimulatorService } from './testing/scenario-simulator';
import { deploymentCenterService } from './deployment/deployment-center';
import { releaseManagementService } from './releases/release-management';
import { healthCenterService } from './health/health-center';
import { observabilityService } from './observability/observability-service';
import { incidentCenterService } from './incidents/incident-center';
import { securityCenterService } from './security/security-center';
import { auditExplorerService } from './audit/audit-explorer';
import { performanceLabService } from './performance/performance-lab';
import { configManagementService } from './config/config-management';
import { dataGovernanceService } from './governance/data-governance';
import { disasterRecoveryService } from './disaster-recovery/disaster-recovery';

export class EnterpriseOperationsManager {
  async getSystemOverview(): Promise<any> {
    const [health, security, incidents, performance] = await Promise.all([
      healthCenterService.getHealthSummary(),
      securityCenterService.getThreatAnalysis(),
      incidentCenterService.getOpenIncidents(),
      performanceLabService.getRecentBenchmarks(10),
    ]);

    return {
      health,
      security,
      incidents: incidents.length,
      performance: performance.map(p => ({
        name: p.name,
        status: p.status,
        value: p.value,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  async runDiagnostics(): Promise<any> {
    const startTime = Date.now();
    
    const [health, security, performance] = await Promise.all([
      healthCenterService.checkAllSubsystems(),
      securityCenterService.getThreatAnalysis(),
      performanceLabService.runAllBenchmarks(),
    ]);

    return {
      duration_ms: Date.now() - startTime,
      health: health.overall_status,
      security_level: security.overall_threat_level,
      performance_score: performance.filter(p => p.status === 'pass').length / performance.length * 100,
      issues_found: health.active_incidents + security.active_threats,
    };
  }

  async getOperationalMetrics(): Promise<any> {
    const [health, security, incidents, performance, config] = await Promise.all([
      healthCenterService.getHealthSummary(),
      securityCenterService.getThreatAnalysis(),
      incidentCenterService.getIncidentMetrics(),
      performanceLabService.getRecentBenchmarks(50),
      configManagementService.getConfigSummary(),
    ]);

    return {
      health_score: health.overall_score,
      security_level: security.overall_threat_level,
      incidents: {
        open: incidents.open_incidents,
        critical: incidents.critical_incidents,
        mttr: incidents.mttr_minutes,
      },
      performance: {
        benchmarks: performance.length,
        pass_rate: performance.filter(p => p.status === 'pass').length / performance.length * 100,
      },
      configuration: {
        total_configs: config.total_configs,
        categories: config.categories,
      },
    };
  }
}

export const enterpriseOperationsManager = new EnterpriseOperationsManager();
