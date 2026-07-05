/**
 * Shared Module Contracts
 *
 * Defines how modules communicate with each other.
 * No module should directly import from another module's internal files.
 * All cross-module communication goes through events or these shared interfaces.
 */

// ─── Module Identifiers ─────────────────────────────────────────────────────

export const MODULES = {
  SALES: 'sales',
  INVENTORY: 'inventory',
  FINANCE: 'finance',
  CUSTOMERS: 'customers',
  WORKFORCE: 'workforce',
  AUTOMATION: 'automation',
} as const

export type ModuleId = (typeof MODULES)[keyof typeof MODULES]

// ─── Event Bus Contract ─────────────────────────────────────────────────────

export interface EventBus {
  /**
   * Emit an event. Returns immediately — handlers run asynchronously.
   */
  emit(eventType: string, payload: Record<string, unknown>, options?: {
    source?: ModuleId
    entity_type?: string
    entity_id?: string
  }): Promise<void>

  /**
   * Subscribe to an event type.
   */
  on(eventType: string, handler: EventHandler): void

  /**
   * Unsubscribe from an event type.
   */
  off(eventType: string, handler: EventHandler): void
}

export type EventHandler = (
  event: BusEvent
) => Promise<void> | void

export interface BusEvent {
  type: string
  payload: Record<string, unknown>
  source?: ModuleId
  entity_type?: string
  entity_id?: string
  timestamp: string
}

// ─── Module Health Contract ─────────────────────────────────────────────────

export interface ModuleHealth {
  module: ModuleId
  status: 'healthy' | 'degraded' | 'down'
  last_check: string
  error_count: number
  details?: Record<string, unknown>
}

// ─── Audit Trail Contract ───────────────────────────────────────────────────

export interface AuditEntry {
  actor_id: string
  action: string
  resource_type: string
  resource_id: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  branch_id?: string
  details?: string
}

/**
 * Record an audit entry.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  // Implementation in lib/audit-actions.ts
}

// ─── Notification Contract ──────────────────────────────────────────────────

export interface NotificationPayload {
  user_id: string
  title: string
  body: string
  event_type?: string
  reference_type?: string
  reference_id?: string
  severity?: 'info' | 'warning' | 'error' | 'success'
  action_url?: string
}

/**
 * Send an in-app notification.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // Implementation in lib/notification-actions.ts
}

// ─── Currency Contract ──────────────────────────────────────────────────────

/**
 * Format amount as KES.
 */
export function formatKES(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE')}`
}

/**
 * Convert between currencies (future).
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  if (from === to) return amount
  // TODO: Implement exchange rate lookup
  throw new Error('Currency conversion not yet implemented')
}
