# WinnMatt POS - Shift Management Readiness Audit
**Audit Date:** April 6, 2026  
**Scope:** Complete system assessment for shift management implementation

---

## 1. CURRENT CASHIER MODEL ✅

### Implementation Status: **FULLY IMPLEMENTED**

| Aspect | Details |
|--------|---------|
| **Cashier Tracking** | ✅ All sales have `cashier_id` field |
| **Table** | `users` table |
| **Cashier Columns** | • `id` (UUID PK)<br>• `email` (UNIQUE)<br>• `full_name`<br>• `branch_id` (FK to branches)<br>• `role` ('admin'\|'manager'\|'cashier')<br>• `status` ('active'\|'inactive')<br>• `created_at`, `updated_at` |
| **Role System** | ✅ 3-tier: admin, manager, cashier |
| **Status Field** | ✅ Active/Inactive flags exist |
| **File References** | • [db-migrations.sql](db-migrations.sql#L20-L28)<br>• [lib/db.types.ts](lib/db.types.ts#L1-L50) |

---

## 2. SALES TABLE STRUCTURE ✅

### Implementation Status: **FULLY IMPLEMENTED** (with recent audit log additions)

**Table: `sales`**

| Column | Type | FK | Notes |
|--------|------|----|----|
| `id` | UUID | PK | |
| `branch_id` | UUID | branches.id | ✅ Multi-branch support |
| `cashier_id` | UUID | users.id | ✅ **CRITICAL**: All sales linked to cashier |
| `customer_id` | UUID | customers.id (nullable) | |
| `subtotal` | INTEGER | | Amount before discount |
| `discount_amount` | INTEGER | | Total discount applied |
| `tax_amount` | INTEGER | | Currently always 0 (tax in price) |
| `total_amount` | INTEGER | | Final customer amount |
| `payment_method` | TEXT | CHECK | 'cash', 'card', 'bank_transfer', 'cheque', 'credit', 'mpesa' |
| `payment_status` | TEXT | CHECK | 'pending', 'completed', 'failed' |
| `receipt_number` | TEXT | UNIQUE | Format: `RCP-{timestamp}-{random}` |
| `notes` | TEXT | | Optional |
| **`sale_status`** | TEXT | CHECK | ✅ **NEW**: 'completed', 'voided', 'returned' (added via sales-void-migration.sql) |
| **`voided_at`** | TIMESTAMP | | ✅ Records void timestamp |
| **`void_reason`** | TEXT | | ✅ Why sale was voided |
| **`voided_by`** | UUID | users.id | ✅ Who voided it |
| **`returned_at`** | TIMESTAMP | | ✅ Return timestamp |
| **`returned_qty`** | INTEGER | | ✅ Items returned quantity |
| **`return_reason`** | TEXT | | ✅ Why items returned |
| **`returned_by`** | UUID | users.id | ✅ Who processed return |
| `created_at` | TIMESTAMP | | **CRITICAL**: Time sale was recorded |
| `updated_at` | TIMESTAMP | | Last modification |

**File References:**
- [db-migrations.sql](db-migrations.sql#L93-L109)
- [sales-void-migration.sql](sales-void-migration.sql#L4-L18)
- [lib/db.types.ts](lib/db.types.ts#L50-L85)

**Indexes:**
- ✅ `idx_sales_branch` - For branch filtering
- ✅ `idx_sales_created_at` - For date-range queries
- ✅ `idx_sales_sale_status` - For status filtering
- ✅ `idx_sales_voided_by` - For audit trail

---

## 3. PAYMENT METHODS TRACKING ✅

### Implementation Status: **FULLY IMPLEMENTED** with breakdown per transaction

**Payment Method Storage:**
```sql
-- In each sale record:
payment_method IN ('cash', 'card', 'bank_transfer', 'cheque', 'credit', 'mpesa')
```

**Aggregation Available:**
- ✅ `getSalesStats()` - Returns breakdown by payment method
- ✅ `getTodaySalesStats()` - Returns daily breakdown
- ✅ Reports page displays payment method totals

**Function:** [lib/reports-actions.ts](lib/reports-actions.ts#L1-L50)

```typescript
paymentMethods: {
  cash: { amount, count },
  card: { amount, count },
  bank_transfer: { amount, count },
  cheque: { amount, count },
  credit: { amount, count }
}
```

**M-Pesa Tracking:** Separate `mpesa_transactions` table ([MPESA_MIGRATION.sql](MPESA_MIGRATION.sql#L14-L45)) with:
- `checkout_request_id` - Daraja request ID
- `merchant_request_id` - Merchant reference
- `status` - 'pending', 'confirmed', 'failed', 'cancelled', 'timeout'
- `mpesa_receipt_number` - M-Pesa confirmation
- `callback_payload` - Full audit trail

---

## 4. EXISTING TIME-BASED FEATURES ✅

### Implementation Status: **PARTIALLY IMPLEMENTED**

**Available:**
- ✅ `getSalesByDateRange(branchId, startDate, endDate)` - [lib/sales-actions.ts](lib/sales-actions.ts#L190-L210)
- ✅ `getTodaySalesStats(branchId)` - [lib/sales-actions.ts](lib/sales-actions.ts#L215-L250)
- ✅ `getSalesStats(branchId, startDate, endDate)` - [lib/reports-actions.ts](lib/reports-actions.ts#L1-L50)
- ✅ Date filters on Reports page ([app/(dashboard)/reports/page.tsx](app/(dashboard)/reports/page.tsx#L154))
- ✅ All sales have `created_at` timestamp

**Missing for Shift Management:**
- ❌ **Shift table/concept** - Does not exist
- ❌ **Shift start/end times** - No fields to define shift boundaries
- ❌ **Shift-specific filtering** - Current filters work by date range, not shift
- ❌ **Shift ownership** - Can't tie sales to a specific shift entity
- ❌ **Shift duration tracking** - No mechanism to mark when cashier clocked in/out

**Impact:** You **CANNOT YET** query "all sales from Shift #5" or "all sales by Cashier A on Date B during Shift C"

---

## 5. SHIFT DATA INFRASTRUCTURE

### Implementation Status: **NOT IMPLEMENTED** ❌

**Critical Missing Components:**

| Need | Status | Impact |
|------|--------|--------|
| **`shifts` table** | ❌ Missing | Can't track shift sessions |
| **`shift_ledger` table** | ❌ Missing | Can't track cash opening/closing |
| **`shift_id` in sales** | ❌ Missing | Can't link sales to shifts |
| **Shift open/close timestamps** | ❌ Missing | Can't determine shift duration |
| **Cashier shift assignment** | ❌ Missing | Can't track which cashier worked which shift |
| **Shift status field** | ❌ Missing | Can't track open/closed/reconciled |

**What needs to be created:**
1. `shifts` table (parent entity)
2. `shift_ledgers` table (cash tracking)
3. Modify `sales` to add `shift_id`
4. Modify `users` or create "shift_assignment" junction table

---

## 6. FLOAT/OPENING CASH CONCEPTS

### Implementation Status: **NOT IMPLEMENTED** ❌

**Critical Missing:**
- ❌ **Opening float/till balance** - Nowhere to record "Cashier A started with 5000 KShs"
- ❌ **Closing balance** - No field for "Cashier A ended with 12500 KShs"
- ❌ **Float table** - No audit trail for cash counts
- ❌ **Cash movement log** - Can't track cash in/out of till

**What needs to be created:**
1. `shift_ledgers` table with:
   - `opening_float` (amount in till at shift start)
   - `closing_float` (amount in till at shift end)
   - `expected_cash` (calculated from sales)
   - `actual_cash` (counted by manager)
   - `variance` (difference)

2. `cash_movements` table for:
   - Initial float deposit
   - Cash takeover/bank drops
   - Emergency petty cash

---

## 7. RECONCILIATION FEATURES

### Implementation Status: **PARTIALLY IMPLEMENTED**

**Existing Reconciliation Features:**

✅ **M-Pesa Reconciliation:**
- Function: `getPendingMpesaTransactions()` - [lib/mpesa-actions.ts](lib/mpesa-actions.ts#L255-L285)
- Can find stuck/pending payments
- M-Pesa transactions linked to sales via `sale_id`

✅ **Audit Logging:**
- `sale_audit_log` table tracks all modifications - [sales-void-migration.sql](sales-void-migration.sql#L28-L37)
- Records: void, return, partial_return actions
- Includes: who performed, reason, timestamp, details (JSONB)

✅ **Sales Status Tracking:**
- Can identify: completed, voided, returned sales
- View: `sales_void_status` - [sales-void-migration.sql](sales-void-migration.sql#L54-L76)

**Missing Shift Reconciliation:**
- ❌ **Expected vs Actual cash** - No mechanism
- ❌ **Payment method breakdown matching** - Not reconciled to till
- ❌ **Shift closing process** - No workflow
- ❌ **Manager sign-off** - No approval field
- ❌ **Variance reporting** - Can't identify shorts/overages

---

## 8. REPORTS & DASHBOARDS

### Implementation Status: **COMPREHENSIVE** ✅

**Dashboard Components:** [app/(dashboard)/dashboard/page.tsx](app/(dashboard)/dashboard/page.tsx#L1)
1. ✅ DashboardStats
2. ✅ SalesTrendChart
3. ✅ BranchComparison
4. ✅ TopProducts
5. ✅ LowStockAlerts
6. ✅ RecentTransactions

**Reports Page:** [app/(dashboard)/reports/page.tsx](app/(dashboard)/reports/page.tsx#L83)
- ✅ Sales Report (with date ranges)
- ✅ Top Selling Products
- ✅ Slow Moving Products (7+ days without sale)
- ✅ Inventory Value by Category
- ✅ Branch Performance Stats
- ✅ Stock Movement Summary
- ✅ CSV export functionality

**What Will Be Affected by Shifts:**
- ⚠️ **Sales Report** - Currently by date range; will need shift filtering
- ⚠️ **Top Products** - Currently global; will need per-shift version
- ⚠️ **Branch Performance** - Will need per-shift breakdown
- ⚠️ **Daily dashboard** - Need to show current shift stats vs historical

---

## 9. USER/CASHIER ROLE SYSTEM

### Implementation Status: **FULLY IMPLEMENTED** ✅

**Role Definition:**
```sql
role IN ('admin', 'manager', 'cashier')
```

**Role Enforcement:**

| Feature | Admin | Manager | Cashier | File |
|---------|-------|---------|---------|------|
| Create Users | ✅ Yes | ❌ No | ❌ No | [lib/user-management.ts](lib/user-management.ts#L146-L148) |
| Void Sales | ✅ Yes | ✅ Yes | ❌ No | [lib/sales-actions.ts](lib/sales-actions.ts#L280-L295) |
| Return Sales | ✅ Yes | ✅ Yes | ✅ Yes | [lib/sales-actions.ts](lib/sales-actions.ts#L399-L415) |
| Process Sales | ✅ Yes | ✅ Yes | ✅ Yes | All POS operations |
| Edit Receipt Settings | ✅ Yes | ❌ No | ❌ No | [lib/receipt-settings.ts](lib/receipt-settings.ts#L93-L101) |
| Access Import | ✅ Yes | ❌ No | ❌ No | [app/(dashboard)/import/page.tsx](app/(dashboard)/import/page.tsx#L119) |
| Access Pricing | ✅ Yes | ❌ No | ❌ No | [app/(dashboard)/prices/page.tsx](app/(dashboard)/prices/page.tsx#L22) |
| Access Settings | ✅ Yes | ❌ No | ❌ No | [app/(dashboard)/settings/page.tsx](app/(dashboard)/settings/page.tsx#L80) |

**Permission Checking Pattern:**
```typescript
if (!['manager', 'admin'].includes(userData.role)) {
  throw new Error('Only managers and admins can void sales')
}
```

**User Status Field:**
- ✅ `status` field exists: 'active' | 'inactive'
- ✅ Can disable users without deletion
- Location: [db-migrations.sql](db-migrations.sql#L23-L24)

**Permission Checks for Shift Management:**
- ✅ Branch isolation already enforced (can't access other branch's data)
- ✅ Role checks ready to extend
- ⚠️ Need to add: "shift_manager" role or use "manager" for shift operations

---

## 10. TRANSACTION SAFETY & LOCKING

### Implementation Status: **PARTIAL** ⚠️

**Existing:** [lib/sales-actions.ts](lib/sales-actions.ts#L1-L670)

**Safe Operations:**
- ✅ **Sales creation:** Sequential inserts (sales → items → inventory → movements)
- ✅ **Inventory updates:** Fetch → calculate new → update with `eq()` filter
- ✅ **Audit logging:** Separate inserts, no blocking

**Risks:**
- ⚠️ **Race conditions on inventory:** Two cashiers could both fetch qty=10, both subtract 5, both set to 5 instead of 0
- ⚠️ **Double-settlement:** Payment could be marked completed twice
- ⚠️ **No pessimistic locking:** Can't lock a sale while it's being voided vs returned simultaneously

**Missing Guarantees:**
- ❌ **Atomic transactions** - Not using database-level transactions (BEGIN/COMMIT)
- ❌ **Isolation levels** - Can't guarantee SERIALIZABLE isolation
- ❌ **Optimistic locking** - No version field for concurrency control
- ❌ **Pessimistic locking** - Can't lock rows during shift closing

**Impact for Shift Closing:**
- ⚠️ Risky to allow sales while shift is being closed
- ⚠️ Reconciliation must account for potential double-counting

---

## SUMMARY: REQUIREMENTS FOR SHIFT MANAGEMENT

### ✅ Ready to Use
1. Cashier tracking (sales linked to `cashier_id`)
2. Sales have timestamps (`created_at`)
3. Role-based access control (admin, manager, cashier)
4. Payment method breakdown (cash, card, m-pesa, etc.)
5. Audit logging framework (sale_audit_log existente)
6. Multi-branch support (branch_id in sales)

### ⚠️ Needs Refinement
1. **Fine-grained permissions:** Add "shift_manager" role or clarify manager permissions
2. **Transaction safety:** Implement database transactions or optimistic locking for shift closing
3. **Time precision:** Current `created_at` is sufficient, but ensure timezone consistency

### ❌ Must Be Created
1. **`shifts` table** - Track shift sessions (id, branch_id, cashier_id, status, opened_at, closed_at, opened_by, closed_by)
2. **`shift_ledgers` table** - Track cash (shift_id, opening_float, closing_float, expected_cash, actual_cash, variance, coins_breakdown)
3. **`shift_id` in sales** - Link sales to shifts for filtering
4. **`sales_expected_amounts` table** - Pre-calculate expected totals by payment method (optional optimization)
5. **Shift opening workflow** - UI + backend to create shift
6. **Shift closing workflow** - UI + backend to:
   - Freeze sales from that shift
   - Calculate expected amounts
   - Prompt for physical cash count
   - Record variance
   - Mark shift as closed
7. **Shift reports** - Dashboard showing current shift stats
8. **Cash movement audit trail** - Track opens/deposits/floats

---

## FILE MAPPING SUMMARY

| What | Where | Status |
|------|-------|--------|
| User/Cashier Table | [db-migrations.sql#L20-L28](db-migrations.sql#L20-L28) | ✅ |
| Sales Table | [db-migrations.sql#L93-L109](db-migrations.sql#L93-L109) | ✅ |
| Sale Status Fields | [sales-void-migration.sql#L4-L18](sales-void-migration.sql#L4-L18) | ✅ |
| Audit Log | [sales-void-migration.sql#L28-L37](sales-void-migration.sql#L28-L37) | ✅ |
| Create Sale | [lib/sales-actions.ts#L12-L110](lib/sales-actions.ts#L12-L110) | ✅ |
| Void Sale | [lib/sales-actions.ts#L252-L390](lib/sales-actions.ts#L252-L390) | ✅ |
| Return Sale | [lib/sales-actions.ts#L396-L550](lib/sales-actions.ts#L396-L550) | ✅ |
| Sales Stats | [lib/reports-actions.ts#L1-L50](lib/reports-actions.ts#L1-L50) | ✅ |
| Reports Page | [app/(dashboard)/reports/page.tsx](app/(dashboard)/reports/page.tsx) | ✅ |
| Dashboard | [app/(dashboard)/dashboard/page.tsx](app/(dashboard)/dashboard/page.tsx) | ✅ |
| User Management | [lib/user-management.ts](lib/user-management.ts) | ✅ |
| Receipt Settings (role check) | [lib/receipt-settings.ts#L93-L101](lib/receipt-settings.ts#L93-L101) | ✅ |
| Import Page (admin only) | [app/(dashboard)/import/page.tsx#L119](app/(dashboard)/import/page.tsx#L119) | ✅ |
| Pricing Page (admin only) | [app/(dashboard)/prices/page.tsx#L22](app/(dashboard)/prices/page.tsx#L22) | ✅ |
| Settings (admin only) | [app/(dashboard)/settings/page.tsx#L80](app/(dashboard)/settings/page.tsx#L80) | ✅ |
| M-Pesa Transactions | [MPESA_MIGRATION.sql#L14-L45](MPESA_MIGRATION.sql#L14-L45) | ✅ |
| M-Pesa Reconciliation | [lib/mpesa-actions.ts#L255-L285](lib/mpesa-actions.ts#L255-L285) | ✅ |

---

## READINESS SCORE

| Category | Score | Notes |
|----------|-------|-------|
| **Cashier Tracking** | 10/10 | Perfect - cashier_id on every sale |
| **Sales Data** | 10/10 | All necessary fields present |
| **Timestamps** | 10/10 | created_at on every record |
| **Audit Trail** | 9/10 | sale_audit_log exists, need shift_audit_log |
| **Role System** | 8/10 | Works but may need shift_manager role |
| **Payments Tracking** | 10/10 | Per-method breakdown available |
| **Reports** | 7/10 | Good reports, need shift variants |
| **Report Safety** | 6/10 | Race conditions possible on inventory |
| **Shift Infrastructure** | 0/10 | Must be built from scratch |
| **Float/Cash Tracking** | 0/10 | Must be built from scratch |
| **Overall Readiness** | 42% | **Can proceed with: planning, schema, safe operations; Must implement: shift tables, workflows, UI** |

---

## NEXT STEPS

### Phase 1: Schema & Foundations (Week 1)
- [ ] Create `shifts` table
- [ ] Create `shift_ledgers` table
- [ ] Create `shift_cash_movements` table
- [ ] Add `shift_id` FK to sales
- [ ] Create shift opening/closing triggers/views
- [ ] Add shift-related indexes

### Phase 2: Workflows (Week 2)
- [ ] Shift opening endpoint (create shift + initial float)
- [ ] Shift closing endpoint (freeze sales + calculate expected)
- [ ] Cash count recording endpoint
- [ ] Variance calculation & reporting
- [ ] Manager approval workflow

### Phase 3: UI (Week 2-3)
- [ ] Shift opening dialog
- [ ] Shift closing dialog with cash count form
- [ ] Shift dashboard widget
- [ ] Cash movement history view
- [ ] Manager reconciliation screen

### Phase 4: Testing & Deployment (Week 4)
- [ ] Unit tests for shift operations
- [ ] End-to-end shift workflow tests
- [ ] Performance testing on closing
- [ ] UAT with branch managers
- [ ] Production deployment plan

---

**Report Generated:** April 6, 2026 by System Audit
**System:** WinnMatt POS v2.0+
