// ============================================================
// Automation Engine — TypeScript Types
// ============================================================

// --- Event Types ---
export type EventType =
  // Transaction events
  | 'sale.completed'
  | 'sale.voided'
  | 'sale.returned'
  | 'sale.high_value'
  // Inventory events
  | 'stock.changed'
  | 'stock.low'
  | 'stock.out'
  | 'stock.received'
  // Customer events
  | 'customer.created'
  | 'customer.updated'
  | 'customer.tier_changed'
  // Shift events
  | 'shift.opened'
  | 'shift.closed'
  | 'shift.cash_variance'
  // Price events
  | 'price.changed'
  // Financial events
  | 'invoice.overdue'
  | 'credit.limit_reached'
  // Scheduler events
  | 'scheduler.daily_close'
  | 'scheduler.inventory_check'
  | 'scheduler.loyalty_expiry'
  | 'scheduler.promo_expiry'
  | string // allow custom events

export type EventSource = 'pos' | 'inventory' | 'customer' | 'shift' | 'scheduler' | 'app' | 'api'

export interface AutomationEvent {
  id: string
  event_type: EventType
  source: EventSource
  entity_type: string | null
  entity_id: string | null
  payload: Record<string, unknown>
  processed: boolean
  processed_at: string | null
  created_at: string
}

// --- Rule Types ---
export type LogicGate = 'AND' | 'OR' | 'NOT' | 'LEAF'
export type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT_IN' | 'CONTAINS' | 'NOT_CONTAINS' | 'EXISTS' | 'NOT_EXISTS'

export interface AutomationRule {
  id: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  cooldown_ms: number
  max_daily: number | null
  trigger_event: EventType
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AutomationCondition {
  id: string
  rule_id: string
  parent_id: string | null
  logic_gate: LogicGate
  field: string | null
  operator: Operator | null
  value: string | null
  sort_order: number
}

export interface AutomationAction {
  id: string
  rule_id: string
  action_type: string
  params: Record<string, unknown>
  sort_order: number
  is_async: boolean
}

// --- Log Types ---
export type ActionStatus = 'success' | 'failed' | 'skipped'

export interface AutomationLog {
  id: string
  rule_id: string | null
  event_id: string | null
  action_type: string
  status: ActionStatus
  error_msg: string | null
  duration_ms: number | null
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  created_at: string
}

// --- Schedule Types ---
export type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'cron'

export interface AutomationSchedule {
  id: string
  rule_id: string | null
  name: string
  schedule_type: ScheduleType
  schedule_expr: string
  is_active: boolean
  last_run: string | null
  next_run: string | null
  created_at: string
}

// --- Event Payloads (typed for each event) ---
export interface SaleCompletedPayload {
  sale_id: string
  receipt_no: string
  total: number
  items_count: number
  payment_method: string
  customer_id: string | null
  branch_id: string
  branch_name: string
  cashier_name: string
}

export interface StockChangedPayload {
  product_id: string
  product_name: string
  branch_id: string
  branch_name: string
  old_qty: number
  new_qty: number
  reorder_level: number | null
}

export interface StockLowPayload {
  product_id: string
  product_name: string
  branch_id: string
  branch_name: string
  quantity: number
  reorder_level: number
}

export interface ShiftClosedPayload {
  shift_id: string
  cashier_id: string
  cashier_name: string
  branch_id: string
  branch_name: string
  opening_float: number
  closing_float: number
  expected: number
  actual: number
  variance: number
  duration_minutes: number
}

export interface CustomerCreatedPayload {
  customer_id: string
  name: string
  phone: string
  email: string | null
  branch_id: string | null
}

// --- Engine Types ---
export interface EmitEventOptions {
  eventType: EventType
  source?: EventSource
  entityType?: string
  entityId?: string
  payload: Record<string, unknown>
}

export interface ProcessEventResult {
  eventId: string
  rulesEvaluated: number
  actionsExecuted: number
  durationMs: number
}
