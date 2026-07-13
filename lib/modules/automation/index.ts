/**
 * Automation Module — Public API
 *
 * Event bus, rules engine, scheduler.
 * Other modules should ONLY import from this file.
 */

import { logger } from '@/lib/logger'
import * as auto from '@/lib/automation-actions'

// ─── Types (re-exported from automation-actions) ───────────────────────────

export type { AutomationRule, AutomationEvent, AutomationLog } from '@/lib/automation-actions'

// ─── Event Types ────────────────────────────────────────────────────────────

export const ALL_EVENTS = {
  SALE_COMPLETED: 'sale.completed',
  SALE_VOIDED: 'sale.voided',
  SALE_RETURNED: 'sale.returned',
  SALE_HIGH_VALUE: 'sale.high_value',
  STOCK_CHANGED: 'stock.changed',
  STOCK_LOW: 'stock.low',
  STOCK_OUT: 'stock.out',
  STOCK_RECEIVED: 'stock.received',
  STOCK_TRANSFERRED: 'stock.transferred',
  STOCK_COUNTED: 'stock.counted',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRICE_CHANGED: 'product.price_changed',
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_TIER_CHANGED: 'customer.tier_changed',
  SHIFT_OPENED: 'shift.opened',
  SHIFT_CLOSED: 'shift.closed',
  SHIFT_CASH_VARIANCE: 'shift.cash_variance',
  JOURNAL_POSTED: 'journal_entry.posted',
  PERIOD_CLOSED: 'period.closed',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',
  EXPENSE_APPROVED: 'expense.approved',
  EXPENSE_REJECTED: 'expense.rejected',
  EMPLOYEE_CREATED: 'employee.created',
  CLOCK_IN: 'employee.clock_in',
  CLOCK_OUT: 'employee.clock_out',
  PAYROLL_PROCESSED: 'payroll.processed',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  SETTINGS_CHANGED: 'settings.changed',
} as const

export type EventType = (typeof ALL_EVENTS)[keyof typeof ALL_EVENTS]

// ─── Backward-Compatible Re-exports ──────────────────────────────────────────

export { getAutomationStats } from '@/lib/automation-actions'
export { getAutomationRules } from '@/lib/automation-actions'
export { getAutomationRule } from '@/lib/automation-actions'
export { createAutomationRule } from '@/lib/automation-actions'
export { updateAutomationRule } from '@/lib/automation-actions'
export { toggleAutomationRule } from '@/lib/automation-actions'
export { deleteAutomationRule } from '@/lib/automation-actions'
export { upsertCondition } from '@/lib/automation-actions'
export { deleteCondition } from '@/lib/automation-actions'
export { upsertAction } from '@/lib/automation-actions'
export { deleteAction } from '@/lib/automation-actions'
export { getAutomationEvents } from '@/lib/automation-actions'
export { getAutomationLogs } from '@/lib/automation-actions'
