# Archived SQL Migrations

These SQL files were originally at the project root. They have been moved here to keep the root directory clean.

## Status

### Absorbed into managed migrations (`supabase/migrations/`)
These files' content has been fully absorbed into timestamped managed migrations:

| File | Managed Migration | Notes |
|------|-------------------|-------|
| `credit-invoice-migration.sql` | `20260703054305_credit_invoices.sql` | Same schema |
| `expenses-migration.sql` | `20260703052029_expenses_module.sql` | Identical content (6877 bytes) |
| `return-items-migration.sql` | `20260709000002_fix_void_return_tables.sql` | Same table, evolved schema |
| `sales-void-migration.sql` | `20260709000002_fix_void_return_tables.sql` | `sale_audit_log` table absorbed |
| `shift-management-migration.sql` | `20260708000002_shifts.sql` | Same schema |
| `tax-migration.sql` | `20260703052555_tax_configuration.sql` | Same schema |

### Orphan (not yet in managed migrations)
These files contain DDL that does NOT have a corresponding managed migration. They may have been applied manually to the production DB, or may be pending. A DB audit is needed to confirm:

| File | Key Objects |
|------|-------------|
| `cash-sale-transaction-migration.sql` | `save_cash_sale_transaction()` RPC function |
| `customer-segments-migration.sql` | `customer_segments`, `customer_segment_members` |
| `db-migrations.sql` | Core 16-table schema (branches, users, categories, products, inventory, customers, suppliers, sales, sale_items, stock_movements, purchase_orders, purchase_order_items, stock_transfers, stock_transfer_items, business_settings, branch_receipt_settings) |
| `db-product-ingestion-migration.sql` | Product ingestion system |
| `hold-sale-migration.sql` | `sale_status` constraint + `hold_notes` column |
| `loyalty-engine-migration.sql` | Loyalty tier configuration |
| `mpesa-migration.sql` | `mpesa_transactions` table |
| `MPESA_MIGRATION.sql` | Alternate `mpesa_transactions` schema (duplicate) |
| `owner-loyalty-migration.sql` | Loyalty settings, transactions, redemptions + owner role |
| `phase2-migration.sql` | Inventory, warehouses, procurement (24 tables) |
| `phase4-migration.sql` | Employees, cash drawers, scheduling, notifications (18 tables) |
| `promotions-migration.sql` | `promotions` table |
| `RECEIPT_SETTINGS_MIGRATION.sql` | `business_settings`, `branch_receipt_settings` |
| `redemption-migration.sql` | Loyalty redemption configuration |
| `split-payments-migration.sql` | `payment_splits` table |
| `stock-count-migration.sql` | `stock_counts`, `stock_count_items` |
| `super-admin-migration.sql` | Super admin role + branch profile fields |

### One-time fix scripts
These were run in production to fix data issues. They are not schema migrations:

| File | Description |
|------|-------------|
| `PRICING_CLEANUP_PRODUCTION.sql` | Price correction DDL + UPDATE statements |
| `PRICING_CORRECTION_MIGRATION.sql` | UPDATE statements correcting broken prices |
| `PRICING_PROTECTION_MIGRATION.sql` | Price protection infrastructure |

### Verification/query scripts (SELECT-only)
These are diagnostic queries, not migrations. Safe to delete:

| File | Description |
|------|-------------|
| `CUSTOMERS_VERIFICATION_QUERIES.sql` | Verify customer CRUD |
| `INVENTORY_VERIFICATION_QUERIES.sql` | Verify stock adjustments |
| `PRICING_CLEANUP_DIAGNOSTICS.sql` | Verify price corrections |
| `PRICING_CLEANUP_QUERIES.sql` | Identify bad prices |
| `PRICING_CLEANUP_VERIFY.sql` | Verify cleanup results |

### Seed data
| File | Description |
|------|-------------|
| `db-seed.sql` | INSERT seed data for branches, categories, products |

## Action Items
1. **Run a DB audit** comparing objects in the live database against the "Absorbed" and "Orphan" lists
2. For confirmed "Absorbed" files, delete them from this archive
3. For "Orphan" files that are confirmed present in the live DB, create corresponding managed migrations to capture the schema
4. For confirmed "Orphan" files not yet applied, run them via Supabase migration tooling
5. Delete query-only and one-time-fix files after confirming their work is complete
