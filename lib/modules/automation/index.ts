/**
 * Automation Module — Public API
 *
 * Event bus, rules engine, scheduler.
 * Other modules should ONLY import from this file.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AutomationRule {
  id: string
  name: string
  description: string | null
  is_active: boolean | null
  priority: number | null
  cooldown_ms: number | null
  max_daily: number | null
  trigger_event: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AutomationEvent {
  id: string
  event_type: string
  source: string | null
  entity_type: string | null
  entity_id: string | null
  payload: Record<string, unknown> | null
  processed: boolean | null
  processed_at: string | null
  created_at: string
}

export interface AutomationLog {
  id: string
  rule_id: string | null
  event_id: string | null
  action_type: string
  status: string
  error_msg: string | null
  duration_ms: number | null
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  created_at: string
}

// ─── Event Types ────────────────────────────────────────────────────────────

export const ALL_EVENTS = {
  // Sales
  SALE_COMPLETED: 'sale.completed',
  SALE_VOIDED: 'sale.voided',
  SALE_RETURNED: 'sale.returned',
  SALE_HIGH_VALUE: 'sale.high_value',

  // Inventory
  STOCK_CHANGED: 'stock.changed',
  STOCK_LOW: 'stock.low',
  STOCK_OUT: 'stock.out',
  STOCK_RECEIVED: 'stock.received',
  STOCK_TRANSFERRED: 'stock.transferred',
  STOCK_COUNTED: 'stock.counted',

  // Products
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRICE_CHANGED: 'product.price_changed',

  // Customers
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_TIER_CHANGED: 'customer.tier_changed',

  // Shifts
  SHIFT_OPENED: 'shift.opened',
  SHIFT_CLOSED: 'shift.closed',
  SHIFT_CASH_VARIANCE: 'shift.cash_variance',

  // Finance
  JOURNAL_POSTED: 'journal_entry.posted',
  PERIOD_CLOSED: 'period.closed',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',
  EXPENSE_APPROVED: 'expense.approved',
  EXPENSE_REJECTED: 'expense.rejected',

  // Workforce
  EMPLOYEE_CREATED: 'employee.created',
  CLOCK_IN: 'employee.clock_in',
  CLOCK_OUT: 'employee.clock_out',
  PAYROLL_PROCESSED: 'payroll.processed',

  // System
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  SETTINGS_CHANGED: 'settings.changed',
} as const

export type EventType = (typeof ALL_EVENTS)[keyof typeof ALL_EVENTS]

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Emit an event into the automation bus.
 * Events are persisted and evaluated against automation rules.
 */
export async function emitEvent(
  eventType: EventType,
  payload: Record<string, unknown>,
  options?: {
    source?: string
    entity_type?: string
    entity_id?: string
  }
): Promise<{ success: boolean; event_id?: string; error?: string }> {
  throw new Error('Not implemented — use lib/automation/events.ts directly')
}

/**
 * Get all automation rules.
 */
export async function getRules(): Promise<AutomationRule[]> {
  throw new Error('Not implemented')
}

/**
 * Get recent automation events.
 */
export async function getRecentEvents(limit?: number): Promise<AutomationEvent[]> {
  throw new Error('Not implemented')
}

/**
 * Get automation logs.
 */
export async function getLogs(filters?: {
  rule_id?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<{ data: AutomationLog[]; total: number }> {
  throw new Error('Not implemented')
}
