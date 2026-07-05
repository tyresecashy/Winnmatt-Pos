# Phase 5.2 — Automation Engine (Business Rules & Workflows)

## Executive Summary

Build a configurable IF/THEN business rules engine that reacts to POS events, runs scheduled tasks, and sends notifications — all without requiring external infrastructure (no Kafka, no Redis). Uses PostgreSQL triggers + `pg_cron` + application-level event dispatching within the existing Supabase + Next.js stack.

---

## Current State (Audit Results)

### What EXISTS (ready to wire up)
| Asset | Status | Location |
|-------|--------|----------|
| `notifications` table | Schema ready, **never written to** | `phase4-migration.sql:382-414` |
| `notification_rules` table | Schema ready, **never used** | `phase4-migration.sql:348-380` |
| `createNotification()` | Function ready, **never called** | `lib/notification-actions.ts` |
| `system_audit_log` table | Schema ready, **never written to** | `phase4-migration.sql:426-448` |
| `reorder_suggestions` table | Schema ready, **never populated** | `phase2-migration.sql:252-267` |
| `reorder_engine_view` | View ready, **never queried** | `phase2-migration.sql` |
| `product_activity_log` table | Schema ready, **never written to** | `phase2-migration.sql:252-267` |
| `recurring_expenses` table | Schema ready, **no auto-generator** | `expenses-migration.sql:77-94` |
| `loyalty_settings.expiry_*` | Config ready, **no expirer** | owner-loyalty-migration |
| Low stock dashboard polling | Read-only, **no push/notify** | `components/dashboard/low-stock-alerts.tsx` |

### What DOES NOT EXIST (must build)
1. **Event Dispatcher** — No way to emit events when things happen
2. **Automation Rules Table** — No configurable IF/THEN rules
3. **Rule Evaluator** — No condition evaluation engine
4. **Action Executor** — No action execution framework
5. **Scheduled Task Runner** — No cron/scheduler
6. **Notification Generation** — `createNotification()` exists but no code calls it
7. **Audit Trail Writing** — Tables exist but nothing writes to them

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    WINNMATT POS (Next.js)                     │
│                                                               │
│  Server Actions ──emit()──► Event Dispatcher ──log()──►      │
│                              ┌────────────────┐               │
│                              │  event_logs    │               │
│                              └───────┬────────┘               │
│                                      │                         │
│                              ┌───────▼────────┐               │
│                              │  Rule Engine   │               │
│                              │  (evaluate)    │               │
│                              └───────┬────────┘               │
│                                      │                         │
│                          ┌───────────┼───────────┐            │
│                          ▼           ▼           ▼            │
│                    ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│                    │ In-App   │ │  Audit   │ │ Scheduled│    │
│                    │ Notifs   │ │  Log     │ │ Actions  │    │
│                    └──────────┘ └──────────┘ └──────────┘    │
│                                                               │
│  Supabase Edge Function (pg_cron) ──trigger()──► Scheduler   │
│  Runs daily/weekly to check due tasks                         │
└──────────────────────────────────────────────────────────────┘
```

### Design Principles
1. **No external dependencies** — uses PostgreSQL triggers + Supabase RPCs only
2. **Synchronous for critical paths** — sale completion triggers rules immediately
3. **Asynchronous for non-critical** — reports, emails, webhooks via pg_cron
4. **Fail-safe** — failed actions logged but never block the main operation
5. **Configurable** — rules managed via UI, no code changes needed

---

## Data Model (6 New Tables)

### 1. `automation_rules` — Master rules table
```sql
CREATE TABLE automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  priority      INT DEFAULT 0,          -- higher = executes first
  cooldown_ms   INT DEFAULT 0,          -- prevent re-firing within ms
  max_daily     INT,                     -- NULL = unlimited
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### 2. `automation_conditions` — Tree-based conditions (AND/OR/NOT)
```sql
CREATE TABLE automation_conditions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES automation_conditions(id),  -- for nesting
  logic_gate    TEXT DEFAULT 'AND' CHECK (logic_gate IN ('AND','OR','NOT','LEAF')),
  -- LEAF fields:
  field         TEXT,          -- e.g. 'sale.total', 'inventory.quantity', 'customer.tier'
  operator      TEXT,          -- '=', '>', '<', '>=', '<=', 'IN', 'CONTAINS'
  value         TEXT,          -- comparison value (JSON-encoded)
  sort_order    INT DEFAULT 0
);
```

### 3. `automation_actions` — Ordered action list per rule
```sql
CREATE TABLE automation_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  action_type   TEXT NOT NULL,          -- from Action Catalog
  params        JSONB DEFAULT '{}',    -- action-specific config
  sort_order    INT DEFAULT 0,
  is_async      BOOLEAN DEFAULT false  -- run in background
);
```

### 4. `automation_events` — Event log (append-only)
```sql
CREATE TABLE automation_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,          -- from Event Catalog
  source        TEXT NOT NULL,          -- 'pos', 'inventory', 'scheduler'
  entity_type   TEXT,                   -- 'sale', 'product', 'customer'
  entity_id     UUID,
  payload       JSONB NOT NULL,        -- event data
  processed     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_events_type ON automation_events(event_type, processed, created_at);
```

### 5. `automation_logs` — Action execution audit trail
```sql
CREATE TABLE automation_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID REFERENCES automation_rules(id),
  event_id      UUID REFERENCES automation_events(id),
  action_type   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success','failed','skipped')),
  error_msg     TEXT,
  duration_ms   INT,
  input         JSONB,
  output        JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 6. `automation_schedules` — Scheduled tasks
```sql
CREATE TABLE automation_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID REFERENCES automation_rules(id),
  name          TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily','weekly','monthly','cron')),
  schedule_expr TEXT NOT NULL,          -- e.g. '0 18 * * *' or 'first_monday'
  is_active     BOOLEAN DEFAULT true,
  last_run      TIMESTAMPTZ,
  next_run      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## Event Catalog (What Can Trigger Rules)

### Transaction Events
| Event | Payload | When |
|-------|---------|------|
| `sale.completed` | `{sale_id, total, items[], customer_id, payment_method}` | After checkout |
| `sale.voided` | `{sale_id, reason, voided_by}` | After void |
| `sale.returned` | `{sale_id, return_id, items[], refund_amount}` | After return |
| `sale.high_value` | `{sale_id, total, threshold}` | When total > config |

### Inventory Events
| Event | Payload | When |
|-------|---------|------|
| `stock.changed` | `{product_id, branch_id, old_qty, new_qty, delta}` | After inventory update |
| `stock.low` | `{product_id, branch_id, current_qty, reorder_level}` | When qty ≤ reorder |
| `stock.out` | `{product_id, branch_id}` | When qty = 0 |
| `stock.received` | `{product_id, branch_id, quantity, po_id}` | After PO received |

### Customer Events
| Event | Payload | When |
|-------|---------|------|
| `customer.created` | `{customer_id, name, phone, email}` | After registration |
| `customer.tier_changed` | `{customer_id, old_tier, new_tier}` | After tier update |
| `customer.birthday` | `{customer_id, name, dob}` | Daily check (scheduler) |

### Shift Events
| Event | Payload | When |
|-------|---------|------|
| `shift.opened` | `{shift_id, cashier_id, branch_id, opening_float}` | After open shift |
| `shift.closed` | `{shift_id, closing_float, expected, actual, variance}` | After close shift |
| `shift.cash_variance` | `{shift_id, variance, threshold}` | When variance > config |

### Financial Events
| Event | Payload | When |
|-------|---------|------|
| `invoice.overdue` | `{invoice_id, customer_id, amount, due_date}` | Daily check |
| `credit.limit_reached` | `{customer_id, credit_balance, credit_limit}` | After credit sale |

### Scheduler Events (cron-triggered)
| Event | Payload | When |
|-------|---------|------|
| `scheduler.daily_close` | `{date, branch_id}` | Daily 18:00 |
| `scheduler.inventory_check` | `{branch_id}` | Daily 06:00 |
| `scheduler.loyalty_expiry` | `{}` | Weekly Sunday |
| `scheduler.promo_expiry` | `{}` | Daily 00:00 |
| `scheduler.recurring_expense` | `{}` | Daily 00:00 |

---

## Action Catalog (What Rules Can Do)

### Notification Actions
| Action | Params | Description |
|--------|--------|-------------|
| `notify_in_app` | `{user_id OR role, title, body, severity, url}` | In-app notification |
| `notify_sms` | `{phone, message}` | SMS (future: Africa's Talking) |
| `notify_email` | `{to, subject, body}` | Email (future: SendGrid) |

### Inventory Actions
| Action | Params | Description |
|--------|--------|-------------|
| `auto_create_po` | `{supplier_id?, product_id?, quantity?}` | Auto-generate PO |
| `apply_markdown` | `{product_id, percent}` | Mark down expiring stock |
| `notify_supplier` | `{supplier_id, message}` | Contact supplier |

### Customer Actions
| Action | Params | Description |
|--------|--------|-------------|
| `award_points` | `{customer_id, points, reason}` | Award loyalty points |
| `change_tier` | `{customer_id, tier}` | Upgrade/downgrade tier |
| `send_birthday_offer` | `{customer_id, discount_percent}` | Birthday promotion |

### Financial Actions
| Action | Params | Description |
|--------|--------|-------------|
| `flag_for_review` | `{entity_type, entity_id, reason}` | Flag for manager review |
| `create_journal_entry` | `{account_id, debit, credit, memo}` | Manual journal entry |

### Audit Actions
| Action | Params | Description |
|--------|--------|-------------|
| `log_audit` | `{action, entity_type, entity_id, details}` | Write audit log |
| `generate_report` | `{report_type, date_range, recipients}` | Generate & send report |

### Workflow Actions
| Action | Params | Description |
|--------|--------|-------------|
| `escalate` | `{role, message, deadline}` | Escalate to supervisor |
| `create_task` | `{assignee_id, title, due_date}` | Create follow-up task |

---

## Pre-Built Automation Templates (Seeded Rules)

### Template 1: Low Stock Alert
```
WHEN  stock.low
IF    inventory.quantity <= inventory.reorder_level
THEN  notify_in_app(role='manager', title='Low Stock: {product.name}',
                    body='{inventory.quantity} units left', severity='warning')
      log_audit(action='stock_alert', entity_type='product', entity_id=product_id)
```

### Template 2: Out of Stock Emergency
```
WHEN  stock.out
THEN  notify_in_app(role='admin', title='OUT OF STOCK: {product.name}',
                    body='Immediate reorder required', severity='critical')
      auto_create_po(supplier_id=product.default_supplier, quantity=product.reorder_level)
```

### Template 3: High-Value Sale Review
```
WHEN  sale.completed
IF    sale.total > 50000   (KSh 50,000+)
THEN  notify_in_app(role='admin', title='High-Value Sale: KSh {sale.total}',
                    body='Sale {sale.receipt_no} requires review', severity='warning')
      flag_for_review(entity_type='sale', entity_id=sale_id, reason='High value')
```

### Template 4: Cash Drawer Variance
```
WHEN  shift.cash_variance
IF    ABS(shift.variance) > 500   (KSh 500)
THEN  notify_in_app(role='admin', title='Cash Variance: KSh {shift.variance}',
                    body='Shift {shift.id} has variance', severity='critical')
      log_audit(action='cash_variance', entity_type='shift', entity_id=shift_id)
```

### Template 5: New Customer Welcome
```
WHEN  customer.created
THEN  notify_in_app(user_id=customer.id, title='Welcome to WINNMATT!',
                    body='Your loyalty account is active. Start earning points today.',
                    severity='success')
      award_points(customer_id=customer.id, points=100, reason='Welcome bonus')
```

### Template 6: Daily Sales Report
```
SCHEDULE  daily at 18:00
THEN  generate_report(report_type='daily_sales', date=today,
                      recipients=['admin@winnmatt.com'])
      notify_in_app(role='admin', title='Daily Sales Report Ready',
                    body='View your end-of-day summary', severity='info',
                    url='/reports')
```

### Template 7: Invoice Overdue Reminder
```
SCHEDULE  daily at 09:00
WHEN  invoice.overdue
IF    invoice.due_date < today AND invoice.status != 'paid'
THEN  notify_in_app(user_id=salesperson_id,
                    title='Overdue Invoice: {invoice.number}',
                    body='Invoice for KSh {invoice.amount} is {days_overdue} days overdue',
                    severity='warning')
```

### Template 8: Loyalty Points Expiry
```
SCHEDULE  weekly Sunday 00:00
THEN  Execute: SQL to expire points older than loyalty_settings.expiry_days
      notify_in_app(affected_users, title='Points Expired',
                    body='{expired_count} points have expired', severity='info')
```

### Template 9: Customer Inactive Re-engagement
```
SCHEDULE  weekly
WHEN  customer.inactive (no visits in 30 days)
THEN  notify_in_app(role='marketing',
                    title='Re-engagement: {customer.name}',
                    body='Customer inactive for {days} days',
                    severity='info')
```

### Template 10: Shift Overtime Alert
```
WHEN  shift.opened
IF    shift.duration > 10 hours (36000 seconds)
THEN  notify_in_app(role='manager', title='Overtime Alert',
                    body='{cashier.name} has been on shift for {hours} hours',
                    severity='warning')
```

---

## Implementation Plan

### Phase 2.1: Event Dispatcher + Event Logging (Foundation)
**Files to create/modify:**
1. `supabase/migrations/20260705000000_automation_tables.sql` — 6 new tables
2. `lib/automation/events.ts` — Event dispatcher: `emitEvent(type, payload)`, `logEvent()`
3. `lib/automation/conditions.ts` — Condition evaluator: `evaluateConditions(rule, context)`
4. `lib/automation/actions.ts` — Action executor: `executeAction(type, params)`
5. `lib/automation/engine.ts` — Main engine: `processEvent(event)`, ties it all together
6. `lib/automation/types.ts` — All TypeScript types

**Integration points (server actions to modify):**
- `lib/actions/complete-payment-action.ts` → `emitEvent('sale.completed', {...})`
- `lib/sales-actions.ts` (voidSale/returnSale) → `emitEvent('sale.voided', {...})`
- `lib/products-actions.ts` (updateInventory) → `emitEvent('stock.changed', {...})`
- `lib/shift-actions.ts` (openShift/closeShift) → `emitEvent('shift.opened/closed', {...})`
- `lib/customer-crm-actions.ts` (createCustomer) → `emitEvent('customer.created', {...})`

### Phase 2.2: Rule Engine + Pre-Built Templates
**Files to create:**
1. `lib/automation/rules.ts` — Rule CRUD: `getActiveRules()`, `createRule()`, `updateRule()`
2. `lib/automation/templates.ts` — 10 pre-built template definitions
3. `lib/automation/rpc-process-event.sql` — PostgreSQL function to process events via RPC

**Integration:**
- `lib/automation/engine.ts` — calls `processEvent()` which loads rules, evaluates, executes

### Phase 2.3: Notification Wiring
**Files to modify:**
1. `lib/notification-actions.ts` — Already has `createNotification()`, add wiring
2. `lib/automation/actions.ts` — `notify_in_app` action calls `createNotification()`

**Fix existing broken:**
- Wire up `createNotification()` — it exists but is never called
- Wire up `notification_rules` table — schema exists but unused

### Phase 2.4: Scheduler (pg_cron)
**Files to create:**
1. `supabase/migrations/20260705000001_enable_pg_cron.sql` — Enable pg_cron extension
2. `supabase/migrations/20260705000002_scheduler_functions.sql` — SQL functions for daily/weekly tasks
3. `lib/automation/scheduler.ts` — Scheduler management: `scheduleTask()`, `getDueTasks()`

**Scheduled jobs:**
- Daily 00:00 → Check promo expiry, recurring expenses, overdue invoices
- Daily 06:00 → Inventory check across branches
- Daily 18:00 → Daily sales report
- Weekly Sunday → Loyalty points expiry, inactive customer check

### Phase 2.5: Admin UI — Automation Center
**Files to create:**
1. `app/(dashboard)/automation/page.tsx` — Main automation center page
2. `app/(dashboard)/automation/rules/page.tsx` — Rules list with CRUD
3. `app/(dashboard)/automation/rules/[id]/page.tsx` — Rule detail/edit
4. `app/(dashboard)/automation/events/page.tsx` — Event log viewer
5. `app/(dashboard)/automation/logs/page.tsx` — Action execution logs
6. `app/(dashboard)/automation/schedules/page.tsx` — Schedule manager
7. `components/automation/rule-builder.tsx` — Visual rule builder component
8. `components/automation/event-timeline.tsx` — Event timeline visualization
9. `lib/automation-actions.ts` — Server actions for UI

### Phase 2.6: Dashboard Integration
**Files to modify:**
1. `app/(dashboard)/dashboard/page.tsx` — Add "Recent Automations" widget
2. `app/(dashboard)/pos/page.tsx` — Show real-time notifications when rules fire
3. `components/app-sidebar.tsx` — Add "Automation" nav item (admin only)

---

## File Structure

```
lib/automation/
├── types.ts              # All TypeScript types/interfaces
├── events.ts             # Event dispatcher + logging
├── conditions.ts         # Condition tree evaluator
├── actions.ts            # Action executor (notify, audit, PO, etc.)
├── engine.ts             # Main engine: processEvent()
├── rules.ts              # Rule CRUD
├── templates.ts          # 10 pre-built templates
├── scheduler.ts          # Scheduled task management
└── rpc-process-event.sql # PostgreSQL function

supabase/migrations/
├── 20260705000000_automation_tables.sql
├── 20260705000001_enable_pg_cron.sql
└── 20260705000002_scheduler_functions.sql

app/(dashboard)/automation/
├── page.tsx              # Automation Center dashboard
├── rules/
│   ├── page.tsx          # Rules list
│   └── [id]/page.tsx     # Rule detail/edit
├── events/page.tsx       # Event log
├── logs/page.tsx         # Action logs
└── schedules/page.tsx    # Schedule manager

components/automation/
├── rule-builder.tsx      # Visual condition builder
├── event-timeline.tsx    # Event visualization
├── action-config.tsx     # Action parameter form
└── automation-stats.tsx  # Dashboard widget
```

---

## Testing Strategy

1. **Unit tests** — Condition evaluator, action executor
2. **Integration tests** — Emit event → verify notification created → verify audit log
3. **E2E tests** — Complete sale → verify stock alert fires → verify notification appears
4. **Performance tests** — 1000 events/second throughput test
5. **Manual testing** — Create rule in UI → trigger event → verify action

---

## Success Criteria

1. Admin can create automation rules via UI (no code changes)
2. Rules fire within 1 second of triggering event
3. 10 pre-built templates work out of the box
4. Notifications appear in-app within 5 seconds
5. Audit trail captures all rule executions
6. Scheduler runs daily tasks reliably
7. Failed actions never block POS operations
8. System handles 100+ active rules without performance degradation
