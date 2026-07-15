# WINNMATT POS — Event Catalog

**ID:** D-11
**author:** OpenWork
**verified_by:** User
**verification_status:** Verified (Phase 2)
**last_verified:** 2026-07-15
**confidence:** High
**stable_id:** D-11
**Freshness:** 180 days (permanent)

**@see** [03_ARCHITECTURE.md](03_ARCHITECTURE.md) (event bus layer) · [04_MODULE_MAP.md](04_MODULE_MAP.md) (module event tables) · [ID_REGISTRY.md](ID_REGISTRY.md) (E- event IDs) · [event-catalog.md](../docs/event-catalog.md) (legacy reference)

---

## Purpose

This document catalogs every significant event in the WINNMATT POS system: event types, payloads, emitters, consumers, and processing pathways. It supersedes `docs/event-catalog.md` as the authoritative Brain document.

---

## Event Architecture Overview

WINNMATT has **three event subsystems**:

| Subsystem | Channel | Persistence | Primary Use |
|-----------|---------|-------------|-------------|
| **Event Bus** | Redis Pub/Sub (`pos:events`) or in-memory | None (transient) | Cross-instance SSE broadcast, real-time UI updates |
| **Automation Engine** | `emitEvent()` → `automation_events` table | PostgreSQL | Rule-based actions, notifications, audit trail |
| **Cash Events** | `cash_events` table | PostgreSQL | Physical drawer-level cash tracking |
| **Attendance Events** | `attendance_events` table | PostgreSQL | Employee clock-in/clock-out/break tracking |
| **Repository Audit** | `audit_log` table | PostgreSQL | Per-entity change history (wildcard patterns) |

The automation engine (`lib/automation/events.ts`) calls `emitEvent()` which:
1. Persists to `automation_events` table
2. Evaluates matching rules (priority-based, AND/OR/NOT conditions)
3. Executes rule actions (notify, audit, webhook)
4. Publishes to the realtime event bus for SSE broadcast

**@see** D-01 §3.2 (Event Bus), D-03 M-02 (Automation module)

---

## Event Type Inventory

### Notes on Convention

- All event types use `domain.action` lowercase dot notation
- E-commerce uses dynamic templates: `` `order.${status}` ``
- Some events are **declared** (in type unions) but **never actively emitted** — these are marked `⚠️ Defined only`
- Some events are **emitted** but **not declared** in any type union — these are marked `⚠️ Not in type union`

---

### 1. Sales Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `sale.completed` | E-001 | `completePaymentAction()` | `lib/actions/complete-payment-action.ts:675` | ✅ Active | `{ sale_id, total_amount, payment_method, customer_id, branch_id }` |
| `sale.voided` | E-002 | `voidSale()` | `lib/sales-actions.ts:1403` | ✅ Active | `{ sale_id, reason, voided_by, total_amount }` |
| `sale.returned` | E-003 | `processReturn()` | `lib/sales-actions.ts:1701` | ✅ Active | `{ sale_id, items, refund_amount, reason }` |
| `sale.refunded` | — | *(never emitted)* | `lib/realtime/types.ts` | ⚠️ Defined only | *(none)* |
| `sale.high_value` | E-004 | *(never emitted)* | `lib/automation/types.ts` | ⚠️ Defined only | `{ sale_id, total_amount, threshold }` |

### 2. Payment Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `payment.confirmed` | — | `publishEvent()` | `lib/mpesa-events.ts` | ✅ Active | M-Pesa callback success |
| `payment.failed` | — | `publishEvent()` | `lib/mpesa-events.ts` | ✅ Active | M-Pesa callback failure |
| `payment.received` | — | *(never emitted)* | Webhooks UI | ⚠️ UI-only listing | *(none)* |

### 3. Inventory / Stock Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `inventory.updated` | — | *(never emitted)* | `lib/realtime/types.ts` | ⚠️ Defined only | *(none)* |
| `stock.changed` | E-008 | *(no emit call found)* | `lib/automation/types.ts` | ⚠️ Defined only | `{ product_id, branch_id, old_qty, new_qty, type }` |
| `stock.low` | E-009 | *(no emit call found)* | `lib/realtime/types.ts` | ⚠️ Defined only | `{ product_id, branch_id, current_qty, reorder_level }` |
| `stock.out` | E-010 | *(no emit call found)* | `lib/realtime/types.ts` | ⚠️ Defined only | `{ product_id, branch_id }` |
| `stock.transferred` | E-012 | *(no emit call found)* | `lib/realtime/types.ts` | ⚠️ Defined only | `{ transfer_id, from_branch, to_branch, items }` |
| `stock.received` | E-011 | *(no emit call found)* | `lib/automation/types.ts` | ⚠️ Defined only | `{ transfer_id, items }` |
| `stock.counted` | E-013 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ count_id, items, variance }` |
| `stock.adjusted` | — | *(never emitted)* | Webhooks UI | ⚠️ UI-only listing | *(none)* |

### 4. Product Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `product.created` | E-005 | `createProduct()` | `lib/products-actions.ts:464` | ✅ Active | `{ product_id, name, sku, branch_id }` |
| `product.updated` | E-006 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ product_id, changes }` |
| `product.price_changed` | E-007 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ product_id, old_price, new_price, branch_id }` |
| `price.changed` | — | *(never emitted)* | `lib/automation/types.ts` | ⚠️ Duplicate | Same concept as `product.price_changed` |

### 5. Customer Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `customer.created` | E-014 | `createCustomer()` | `lib/customers-actions.ts:270` | ✅ Active | `{ customer_id, name, phone, type }` |
| `customer.updated` | E-015 | *(no emit call found)* | `lib/automation/types.ts` | ⚠️ Defined only | `{ customer_id, changes }` |
| `customer.tier_changed` | E-016 | *(no emit call found)* | `lib/automation/types.ts` | ⚠️ Defined only | `{ customer_id, old_tier, new_tier, points }` |

### 6. Shift Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `shift.opened` | E-017 | `openShift()` | `lib/shift-actions.ts:142` | ✅ Active | `{ shift_id, branch_id, cashier_id, opening_float }` |
| `shift.closed` | E-018 | `closeShift()` | `lib/shift-actions.ts:350` | ✅ Active | `{ shift_id, total_sales, closing_amount, variance }` |
| `shift.cash_variance` | E-019 | *(never emitted)* | `lib/automation/types.ts` | ⚠️ Defined only | `{ shift_id, expected, actual, variance }` |

### 7. Finance Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `journal_entry.posted` | E-020 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ entry_id, total_debit, total_credit }` |
| `period.closed` | E-021 | `closeFinancialPeriod()` | `lib/finance-actions.ts:698` | ✅ Active | `{ period_id, name, start_date, end_date }` |
| `invoice.created` | E-022 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ invoice_id, customer_id, total_amount }` |
| `invoice.paid` | E-023 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ invoice_id, amount_paid, payment_method }` |
| `invoice.overdue` | E-024 | Scheduler | `lib/automation/types.ts` | ⚠️ Defined only | `{ invoice_id, customer_id, days_overdue }` |
| `credit.limit_reached` | — | *(never emitted)* | `lib/automation/types.ts` | ⚠️ Defined only | `{ customer_id, credit_limit, current_balance }` |
| `expense.approved` | E-025 | `approveExpense()` | `lib/expenses-actions.ts:330` | ✅ Active | `{ expense_id, amount, category, approved_by }` |
| `expense.rejected` | E-026 | `approveExpense()` | `lib/expenses-actions.ts:330` | ✅ Active | `{ expense_id, reason, rejected_by }` |

### 8. Workforce Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `employee.created` | E-027 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ employee_id, name, department, position }` |
| `employee.clock_in` | E-028 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ employee_id, branch_id, time }` |
| `employee.clock_out` | E-029 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ employee_id, branch_id, time, hours_worked }` |
| `payroll.processed` | E-030 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ run_id, employee_count, total_gross, total_net }` |

### 9. System Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `user.login` | E-031 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ user_id, email, branch_id }` |
| `user.logout` | E-032 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ user_id }` |
| `settings.changed` | E-033 | *(no emit call found)* | `lib/modules/automation/index.ts` | ⚠️ Defined only | `{ setting_key, old_value, new_value, changed_by }` |
| `session.changed` | — | *(never emitted)* | `lib/realtime/types.ts` | ⚠️ Defined only | Reserved for session lifecycle |
| `notification.created` | — | *(never emitted)* | `lib/realtime/types.ts` | ⚠️ Defined only | Reserved for in-app notifications |
| `automation.triggered` | — | *(never emitted)* | `lib/realtime/types.ts` | ⚠️ Defined only | Reserved for automation pipeline |

### 10. Scheduler Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `scheduler.daily_close` | E-034 | Scheduler cron | `lib/automation/types.ts` | ⚠️ Defined only | End-of-day trigger |
| `scheduler.inventory_check` | E-035 | Scheduler cron | `lib/automation/types.ts` | ⚠️ Defined only | Stock alert trigger |
| `scheduler.loyalty_expiry` | E-036 | Scheduler cron | `lib/automation/types.ts` | ⚠️ Defined only | Loyalty points expiry |
| `scheduler.promo_expiry` | E-037 | Scheduler cron | `lib/automation/types.ts` | ⚠️ Defined only | Promotion deactivation |
| `scheduler.batch_expiry` | — | `scheduler.ts:391` | `lib/automation/scheduler.ts` | ✅ Active | Batch tracking expiry |
| `scheduler.custom` | — | `scheduler.ts:213` | `lib/automation/scheduler.ts` | ✅ Active ⚠️ Not in type union | Catch-all for unnamed tasks |

### 11. E-commerce Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `order.created` | — | `ecommerce-service.ts:357` | `lib/ecommerce-service.ts` | ✅ Active | `{ order_id, customer_id, total_amount }` |
| `order.{status}`* | — | `ecommerce-service.ts:417` | `lib/ecommerce-service.ts` | ✅ Dynamic | Status-driven (confirmed/shipped/delivered/cancelled) |

*\* Template-generated: `order.confirmed`, `order.shipped`, `order.delivered`, `order.cancelled`*

### 12. Device Events

| Event Type | E-ID | Emitted By | File | Status | Payload |
|-----------|------|-----------|------|--------|---------|
| `device.status` | — | Direct `publish()` | `app/api/devices/heartbeat/route.ts:48` | ✅ Active | Device online/offline |

---

## Cash Events (Separate Subsystem)

Written to `cash_events` table only — **not** on the event bus.

| Event Type | Emitted By | Payload |
|-----------|-----------|---------|
| `opening_float` | `lib/shift-cash-sync.ts:148` | `{ shift_id, amount, cashier_id }` |
| `cash_sale` | `lib/shift-cash-sync.ts:271` | `{ shift_id, sale_id, amount }` |
| `cash_count` | `lib/shift-cash-sync.ts:341` | `{ shift_id, counted_amount, expected_amount }` |
| `drawer_close` | `lib/shift-cash-sync.ts:362` | `{ shift_id, final_amount }` |

---

## Attendance Events (Separate Subsystem)

Written to `attendance_events` table only — **not** on the event bus.

| Event Type | Emitted By | Payload |
|-----------|-----------|---------|
| `clock_in` | `lib/attendance-actions.ts` | `{ employee_id, branch_id, timestamp }` |
| `clock_out` | `lib/attendance-actions.ts` | `{ employee_id, branch_id, timestamp, hours }` |
| `break_start` | `lib/attendance-actions.ts` | `{ employee_id, timestamp }` |
| `break_end` | `lib/attendance-actions.ts` | `{ employee_id, timestamp }` |

---

## Repository Audit Patterns (Wildcards)

Used by `BaseRepository` subclasses for entity-level change history via `audit_log` table. Patterns are namespace-level, not individual events.

| Pattern | Repository | Module |
|---------|-----------|--------|
| `sale.*` | `lib/modules/sales/repository.ts` | M-17 Sales |
| `product.*` | `lib/modules/inventory/repository.ts` | M-12 Inventory |
| `customer.*` | `lib/modules/customers/repository.ts` | M-06 Customers |
| `expense.*` | `lib/modules/expenses/repository.ts` | M-10 Expenses |
| `account.*` | `lib/modules/finance/repository.ts` | M-11 Finance |
| `warehouse.*` | `lib/modules/warehouse/repository.ts` | M-24 Warehouse |
| `transfer.*` | `lib/modules/transfers/repository.ts` | M-22 Transfers |
| `tax.*` | `lib/modules/tax/repository.ts` | M-21 Tax |
| `supplier.*` | `lib/modules/suppliers/repository.ts` | M-19 Suppliers |
| `security.*` | `lib/modules/security/repository.ts` | M-18 Security |
| `permission.*` | `lib/modules/security/repository.ts` | M-18 Security |
| `purchase.*` | `lib/modules/purchases/repository.ts` | M-15 Purchases |
| `device.*` | `lib/modules/devices/repository.ts` | M-08 Devices |
| `branch.*` | `lib/modules/branches/repository.ts` | M-02 Branches |

---

## Event Payload Schema

All automation bus events follow this TypeScript interface:

```typescript
interface AutomationEventPayload {
  event_type: string
  payload: Record<string, unknown>
  source?: string       // Module that emitted the event
  entity_type?: string  // Type of entity affected
  entity_id?: string    // ID of entity affected
}
```

Cash events, attendance events, and repository audit events have their own schemas defined in their respective subsystems.

---

## Event Flow Diagram

```
Server Action
    │
    ▼
emitEvent()  ──►  automation_events (PostgreSQL)
    │                  │
    ▼                  ▼
  Rules Engine    Automation Rules Table
    │                  │
    ├── No match: log and exit
    ├── Match: evaluate conditions (AND/OR/NOT)
    │          │
    │          ├── Execute actions (notify, audit, webhook)
    │          └── Log to automation_logs
    │
    ▼
publish()  ──►  Event Bus (Redis/In-memory)
    │
    ▼
SSE stream  ──►  Client UI updates
```

---

## Event Source Map (Where to Add New Events)

To add a new event:
1. Add event type string to `ALL_EVENTS` in `lib/modules/automation/index.ts`
2. Optionally add to the `EventType` union in `lib/automation/types.ts`
3. Optionally add to `EventTypes` constant in `lib/realtime/types.ts` (for SSE broadcast)
4. Call `emitEvent(eventType, payload)` from the server action
5. Document in this catalog with E-ID from `ID_REGISTRY.md`
6. Optionally register automation rules to react to the event

---

## Known Issues & Gaps

| # | Issue | Impact |
|---|-------|--------|
| 1 | `sale.refunded` defined but never emitted — return flow uses `sale.returned` | Dead type; confusing |
| 2 | `sale.high_value`, `sales.target_met` defined but never emitted | Dead rules |
| 3 | `price.changed` and `product.price_changed` are duplicates | Ambiguity in rule conditions |
| 4 | `scheduler.custom` emitted but not in `EventType` union | Works via `| string` escape hatch |
| 5 | `order.{status}` events emitted dynamically but not declared in types | No type checking |
| 6 | 7 inventory/stock events defined but **none** actively emitted via `emitEvent()` | Stock changes don't trigger automation |
| 7 | `user.login`, `user.logout`, `settings.changed` defined but never emitted | No user activity triggers for automation |
| 8 | `credit.limit_reached` defined but never emitted | Dead rule condition |
| 9 | Cash events and attendance events are **completely separate** from the event bus | Two-tier monitoring blind spots |
| 10 | No event retention/purging policy documented | `automation_events` table grows unbounded |

---

## Stability

| Metric | Status |
|--------|--------|
| Events with active emitters | 17 of 43 defined bus events (39%) |
| Events defined but never emitted | 26 |
| Events emitted but not declared | 2 (`scheduler.custom`, `order.{status}`) |
| Duplicate event names | 1 (`price.changed` / `product.price_changed`) |
| Subsystem count | 5 (bus, cash, attendance, audit, scheduler) |
| Distinct event type strings | ~60 across all subsystems |

---

*D-11 — Phase 2 — 2026-07-15*
