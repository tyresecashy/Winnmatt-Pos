/**
 * Enterprise Module — Public API
 *
 * Enterprise-level operations: audit, security, releases, deployments, incidents.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/enterprise-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as enterprise from '@/lib/enterprise-actions'

// ─── Types ──────────────────────────────────────────────────────────────────

export type { AuditEntry, Incident, SecurityUser, DeploymentEntry, ReleaseEntry, TestSuiteStatus } from '@/lib/enterprise-actions'

// ─── Backward-Compatible Re-exports ──────────────────────────────────────────

export { getAuditLog } from '@/lib/enterprise-actions'
export { getAuditStats } from '@/lib/enterprise-actions'
export { getSystemInfo } from '@/lib/enterprise-actions'
export { getIncidents } from '@/lib/enterprise-actions'
export { getSecurityOverview } from '@/lib/enterprise-actions'
export { getDeployments } from '@/lib/enterprise-actions'
export { getReleases } from '@/lib/enterprise-actions'
export { getTestingStatus } from '@/lib/enterprise-actions'
export { getFeatureFlags } from '@/lib/enterprise-actions'
export { toggleFeatureFlag } from '@/lib/enterprise-actions'
