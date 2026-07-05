# WINNMATT Event Catalog

Every significant operation in WINNMATT emits an event. This document catalogs all events, their payloads, and which actions emit them.

## Events by Domain

### Sales Events
| Event | Emitted By | Payload |
|-------|-----------|---------|
| `sale.completed` | `completePaymentAction()` | `{ sale_id, total_amount, payment_method, customer_id, branch_id }` |
| `sale.voided` | `voidSale()` | `{ sale_id, reason, voided_by, total_amount }` |
| `sale.returned` | `processReturn()` | `{ sale_id, items, refund_amount, reason }` |
| `sale.high_value` | `completePaymentAction()` | `{ sale_id, total_amount, threshold }` |

### Inventory Events
| Event | Emitted By | Payload |
|-------|-----------|---------|
| `product.created` | `createProduct()` | `{ product_id, name, sku, branch_id }` |
| `product.updated` | `updateProduct()` | `{ product_id, changes }` |
| `product.price_changed` | `updateProduct()` | `{ product_id, old_price, new_price, branch_id }` |
| `stock.changed` | `adjustStock()` | `{ product_id, branch_id, old_qty, new_qty, type }` |
| `stock.low` | `adjustStock()` | `{ product_id, branch_id, current_qty, reorder_level }` |
| `stock.out` | `adjustStock()` | `{ product_id, branch_id }` |
| `stock.received` | `receiveStockTransfer()` | `{ transfer_id, items }` |
| `stock.transferred` | `createStockTransfer()` | `{ transfer_id, from_branch, to_branch, items }` |
| `stock.counted` | `submitStockCount()` | `{ count_id, items, variance }` |

### Customer Events
| Event | Emitted By | Payload |
|-------|-----------|---------|
| `customer.created` | `createCustomer()` | `{ customer_id, name, phone, type }` |
| `customer.updated` | `updateCustomer()` | `{ customer_id, changes }` |
| `customer.tier_changed` | `awardLoyaltyPoints()` | `{ customer_id, old_tier, new_tier, points }` |

### Shift Events
| Event | Emitted By | Payload |
|-------|-----------|---------|
| `shift.opened` | `openShift()` | `{ shift_id, branch_id, cashier_id, opening_float }` |
| `shift.closed` | `closeShift()` | `{ shift_id, total_sales, closing_amount, variance }` |
| `shift.cash_variance` | `closeShift()` | `{ shift_id, expected, actual, variance }` |

### Finance Events
| Event | Emitted By | Payload |
|-------|-----------|---------|
| `journal_entry.posted` | `createJournalEntry()` | `{ entry_id, total_debit, total_credit }` |
| `period.closed` | `closeFinancialPeriod()` | `{ period_id, name, start_date, end_date }` |
| `invoice.created` | `createInvoice()` | `{ invoice_id, customer_id, total_amount }` |
| `invoice.paid` | `payInvoice()` | `{ invoice_id, amount_paid, payment_method }` |
| `invoice.overdue` | Scheduler | `{ invoice_id, customer_id, days_overdue }` |
| `expense.approved` | `approveExpense()` | `{ expense_id, amount, category, approved_by }` |
| `expense.rejected` | `approveExpense()` | `{ expense_id, reason, rejected_by }` |

### Workforce Events
| Event | Emitted By | Payload |
|-------|-----------|---------|
| `employee.created` | `createEmployee()` | `{ employee_id, name, department, position }` |
| `employee.clock_in` | `clockIn()` | `{ employee_id, branch_id, time }` |
| `employee.clock_out` | `clockOut()` | `{ employee_id, branch_id, time, hours_worked }` |
| `payroll.processed` | `processPayrollRun()` | `{ run_id, employee_count, total_gross, total_net }` |

### System Events
| Event | Emitted By | Payload |
|-------|-----------|---------|
| `user.login` | Auth system | `{ user_id, email, branch_id }` |
| `user.logout` | Auth system | `{ user_id }` |
| `settings.changed` | `updateSettings()` | `{ setting_key, old_value, new_value, changed_by }` |

## Event Payload Schema

All events follow this structure:

```typescript
interface EventPayload {
  // Required
  event_type: string
  payload: Record<string, unknown>
  
  // Optional
  source?: string          // Module that emitted the event
  entity_type?: string     // Type of entity affected
  entity_id?: string       // ID of entity affected
}
```

## Adding New Events

1. Add the event type to `ALL_EVENTS` in `lib/modules/automation/index.ts`
2. Call `emitEvent()` from the server action
3. Create automation rules to react to the event
4. Document the event in this catalog

## Event Processing

Events are processed by the automation engine:
1. Event is persisted to `automation_events` table
2. Matching rules are evaluated (priority-based)
3. Conditions are checked (AND/OR/NOT logic)
4. Actions are executed (notify, audit, etc.)
5. Results are logged to `automation_logs` table

## Scheduler Events

The scheduler runs daily and emits:
- `scheduler.daily_close` — End-of-day reconciliation
- `scheduler.inventory_check` — Stock level alerts
- `scheduler.loyalty_expiry` — Expire old loyalty points
- `scheduler.promo_expiry` — Deactivate expired promotions
