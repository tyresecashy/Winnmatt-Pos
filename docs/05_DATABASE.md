# WINNMATT POS — Database Schema Guide

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: Medium
stable_id: D-04
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) · [supabase/migrations/](../supabase/migrations/) (full SQL) · [db/archived-migrations/](../db/archived-migrations/) (archived)

---

## Executive Summary

WINNMATT POS uses a Supabase (PostgreSQL 15+) database with ~147 tables across 40 managed migrations plus 33 archived migration files. The schema covers sales, inventory, finance, HR, CRM, devices, security, and automation domains. All tables use UUID primary keys, `created_at`/`updated_at` timestamps, and RLS policies.

**Migration Status:** 40 managed SQL files in `supabase/migrations/` (applied) + 33 archived in `db/archived-migrations/` (cataloged, not applied). 1 health check table migration added on 2026-07-13.

---

## Migration Inventory (40 managed)

| Date Range | Migration | Focus | Tables Affected |
|------------|-----------|-------|-----------------|
| 2026-07-03 | `20260703*` | Expenses, tax, credit invoices, RLS fixes | 4 migrations |
| 2026-07-04 | `20260704*` | Finance foundation, KES conversion, feature flags, global search, plugins, multi-currency, webhooks, e-commerce, notifications, workforce tasks, white-label | 11 migrations |
| 2026-07-05 | `20260705*` | Automation engine, Stripe columns | 2 migrations |
| 2026-07-06 | `20260706*` | Supplier payments, stock movements, transfers, snapshots | 5 migrations |
| 2026-07-07 | `20260707*` | Warehouse locations, backorders, supplier invoices, invoice matching, campaigns | 5 migrations |
| 2026-07-08 | `20260708*` | Devices, shifts | 2 migrations |
| 2026-07-09 | `20260709*` | Shift cash sync, void/return tables, bank reconciliation, login history, system audit log | 5 migrations |
| 2026-07-10 | `20260710*` | Purchase requisitions, PO attachments, supplier returns, stock movement fixes | 4 migrations |
| 2026-07-13 | `20260713*` | Health check table | 1 migration |

Archived: 33 SQL files in `db/archived-migrations/` with categorization README.

---

## Major Table Groups

### Sales & POS
- `sales` — Core sale transactions (with `shift_id` FK)
- `sale_items` — Line items per sale
- `void_requests`, `return_requests` — Void/return lifecycle
- `receipts` — Generated receipts (with `receipt_number`)
- `payment_transactions` — Payment records (M-Pesa, Stripe, cash, card)

### Inventory & Products
- `products` — Product catalog (with `sku`, `barcode`, `price`)
- `inventory` — Stock levels per product per branch
- `stock_movements` — All stock adjustments (with type enum)
- `stock_counts` — Physical count snapshots
- `inventory_snapshots` — Periodic inventory snapshots
- `warehouses`, `warehouse_locations` — Physical storage hierarchy

### Purchasing & Suppliers
- `purchase_orders` — PO header
- `purchase_order_items` — PO line items
- `purchase_receipts` — Goods received records
- `purchase_requisitions` — Requisition workflow
- `suppliers`, `supplier_invoices`, `supplier_returns` — Supplier management
- `invoice_matching` — 3-way matching (PO ↔ receipt ↔ invoice)

### Finance
- `chart_of_accounts` — COA hierarchy
- `journal_entries`, `journal_entry_lines` — Double-entry accounting
- `financial_periods` — Accounting period management
- `bank_reconciliation` — Bank statement matching
- `expenses` — Expense tracking with approval workflow
- `credit_invoices`, `customer_credit` — Credit management
- `tax_configuration` — Tax rates and rules

### Workforce & HR
- `employees` — Employee records
- `attendance`, `leaves` — Time tracking
- `payroll_runs`, `payroll_items` — Payroll processing
- `payslips` — Individual payslip records
- `schedules`, `tasks` — Scheduling and task management
- `shift_management` — Extended shift tables

### CRM & Customers
- `customers` — Customer profiles
- `customer_credit` — Credit limits and balances
- `loyalty_points`, `loyalty_tiers` — Loyalty program
- `campaigns` — Marketing campaigns
- `segments` — Customer segmentation

### System & Security
- `users` — User profiles (extends Supabase auth.users)
- `roles`, `permissions` — RBAC
- `branches` — Multi-branch configuration
- `devices` — POS terminal registry
- `shifts`, `shift_ledgers`, `shift_audit_log` — Cashier shift management
- `login_history` — Authentication audit trail
- `system_audit_log` — System-wide audit log
- `health_check` — Health check ping table
- `webhook_hub` — Webhook configuration
- `feature_flags` — Feature toggle storage
- `notification_logs` — Sent notification records

### Automation & Integrations
- `automation_rules` — Automation engine rules
- `mpesa_transactions` — M-Pesa payment records
- `ecommerce_products`, `ecommerce_orders` — E-commerce integration
- `plugin_registry` — Plugin system storage

---

## RLS Policies

All application tables have RLS enabled. Policies follow a role-based pattern:

- **admin** — Full access to all tables
- **manager** — Branch-scoped read/write
- **cashier** — Sales + inventory read + customer read
- **viewer** — Read-only across permitted scopes

RLS is enforced at the Supabase level, not the app level.

---

## Indexes

Key indexes are created in-line with migration statements:
- `sales(receipt_number)` — ILIKE search on receipt number
- `sale_items(sale_id)` — FK join
- `products(sku, barcode)` — Product lookup
- `inventory(product_id, branch_id)` — Stock lookup
- `stock_movements(product_id, branch_id)` — Movement history
- `shifts(user_id, status)` — Active shift lookup

---

## Known Limitations

1. **No formal schema documentation** — No single-file schema overview or ER diagram exists. Schema is reverse-engineerable only from SQL migrations.
2. **Migration duplication risk** — 33 archived migration files in `db/archived-migrations/` are not applied but could conflict with future migrations.
3. **No migration rollback procedures** — Down migrations are not written.
4. **~147 tables is approximate** — Exact count not verified; some feature-flag and plugin tables are dynamically created.
5. **Triggers and functions** — Stored procedures and triggers exist but are undocumented.

---

## Future Direction

1. Generate a complete table catalog (T- prefix registration in ID_REGISTRY.md)
2. Create an ER diagram or schema markdown file
3. Add down migrations for rollback support
4. Document all stored procedures and triggers
5. Review archived migrations for possible consolidation
