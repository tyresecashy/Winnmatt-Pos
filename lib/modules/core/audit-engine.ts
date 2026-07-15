/**
 * Audit Engine — Enterprise audit logging
 *
 * Records structured audit events for data mutations. Events capture
 * before/after state, actor identity, and correlation IDs for full
 * traceability.
 *
 * In production this would write to an `audit_log` table or external
 * audit service. This baseline implementation logs to console.
 *
 * Constitution Reference: §9 (Transaction & Event Rules)
 */

import { getCorrelationId } from './correlation-id'
import { now } from './business-clock'

export interface AuditEvent {
  eventType: string
  aggregateType: string
  aggregateId: string
  action: 'create' | 'update' | 'delete'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  performedBy: string | null
  branchId: string
  deviceId?: string | null
  reason?: string
  correlationId?: string
}

/**
 * Record an audit event.
 * Audit failures must never block business operations, so errors are caught.
 */
export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const auditRecord = {
      ...event,
      correlationId: event.correlationId ?? getCorrelationId(),
      timestamp: now().toISOString(),
    }
    // In production: INSERT INTO audit_log …
    console.debug('[Audit]', auditRecord.eventType, auditRecord.action, auditRecord.aggregateId)
  } catch {
    // Audit failures are non-fatal
  }
}

/**
 * Create a structured diff between two objects for audit purposes.
 */
export function createDiff(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {}
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      diff[key] = { from: before[key], to: after[key] }
    }
  }
  return diff
}
