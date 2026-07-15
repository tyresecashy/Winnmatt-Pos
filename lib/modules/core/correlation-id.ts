/**
 * Correlation ID — Enterprise traceability context
 *
 * Provides a per-request correlation ID for tracing operations
 * across service boundaries. Falls back to a module-level value
 * when no async context is available.
 *
 * Constitution Reference: §5 (Module Architecture), §9 (Transaction & Event Rules)
 */

import { createId } from '@paralleldrive/cuid2'

// ─── Module-level correlation ID (fallback when no async context) ───────────

let _correlationId = createId()

/**
 * Returns the current correlation ID. In production this would be
 * propagated via AsyncLocalStorage; for now returns a module-level value.
 */
export function getCorrelationId(): string {
  return _correlationId
}

/**
 * Generates a new correlation ID, sets it as the current value, and returns it.
 */
export function generateCorrelationId(): string {
  _correlationId = createId()
  return _correlationId
}
