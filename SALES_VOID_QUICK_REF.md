# Sales Void/Return - Quick Reference Guide

## What Was Changed

### 1. Database (New & Modified)
- ✅ Added `sale_status` column to `sales` table (completed/voided/returned)
- ✅ Added void audit fields: `voided_at`, `void_reason`, `voided_by`
- ✅ Added return fields: `returned_at`, `returned_qty`, `return_reason`, `returned_by`
- ✅ Created `sale_audit_log` table (tracks all sale modifications)
- ✅ Stock movements now support type='reversal' for inventory restoration

### 2. Backend (New Functions)
- ✅ `voidSale()` - Completely reverse a sale with permission checks
- ✅ `returnSale()` - Process customer returns (full or partial)
- ✅ `getSaleAuditTrail()` - View modification history per sale
- ✅ Updated all report queries to exclude voided sales

### 3. UI (New Buttons & Dialogs)
- ✅ "Void Sale" button (red, managers/admins only)
- ✅ Void confirmation dialog with reason input
- ✅ Sale status column (shows VOIDED/RETURNED/COMPLETED)
- ✅ Audit trail viewer (click "View Audit Trail" in details)

---

## How to Use It

### As a Manager
1. Go to **Sales History**
2. Click **Eye icon** on any completed sale
3. Click **"Void Sale"** button
4. Enter reason (e.g., "Wrong item scanned")
5. Click **"Confirm Void"**
6. Sale status changes to **VOIDED** (red badge)
7. Inventory automatically restored
8. Sale excluded from all reports

### As a Cashier
- Can see voided sales in history but **cannot void them**
- Void button is hidden when not logged in as manager/admin

---

## What the Void Does

When you void a sale:

1. ✅ Changes `sale_status` from 'completed' to 'voided'
2. ✅ Records `void_reason` (why it was voided)
3. ✅ Records `voided_by` (which manager voided it)
4. ✅ Records `voided_at` (when it was voided)
5. ✅ **Restores all inventory** (adds back quantities)
6. ✅ Creates **reversal stock movement** (for audit)
7. ✅ **Records in audit log** (who, when, why)
8. ✅ **Automatically excluded from reports** (daily sales, trends, etc.)
9. ✅ **Cannot be unvoided** (permanent action)

---

## Rules & Safeguards

| Rule | Implementation |
|------|-----------------|
| Only managers/admins can void | Role check in `voidSale()` function |
| Void reason is mandatory | Dialog won't submit without reason |
| Cannot void an already voided sale | Status check prevents re-void |
| Cannot void from another branch | Branch validation enforces same-branch only |
| Inventory always restored | Transaction-safe stock movement creation |
| Voided sales tracked forever | Audit log permanent, can't delete |
| Reports auto-exclude voids | All report queries have `.neq('sale_status', 'voided')` |

---

## Files to Apply Migration

**Important:** Must run this in Supabase before void functionality works

Location: `/sales-void-migration.sql`

**Steps:**
1. Go to **Supabase SQL Editor**
2. Copy entire contents of `sales-void-migration.sql`
3. Run in the SQL Editor
4. Verify success (should see "ALTER TABLE" messages)

---

## Critical SQL Checks (Verify It Worked)

```sql
-- Check columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name='sales' AND column_name='sale_status';

-- Check audit log table exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_name='sale_audit_log'
);

-- Check a voided sale
SELECT receipt_number, sale_status, void_reason, voided_at 
FROM sales WHERE sale_status='voided' LIMIT 1;

-- Check inventory was restored
SELECT type, quantity FROM stock_movements 
WHERE reference_id='[SALE_ID]' ORDER BY created_at;
-- Should show: sale (-5), reversal (+5)
```

---

## Common Scenarios

### Scenario: Customer Returns Wrong Item
1. Original sale: `RCP-123` for wrong item
2. Go to Sales History
3. Find the sale, click Eye
4. Click "Void Sale"
5. Reason: "Customer returned wrong item"
6. Confirm
7. **Result:** Sale voided, inventory restored, report updated

### Scenario: Cashier Scanned Wrong Item
1. Just realized mistake 5 minutes after sale
2. Sale not yet printed/given to customer
3. Go to Sales History
4. Find the incorrect sale
5. Void with reason: "Incorrect item scanned"
6. Create correct sale immediately after
7. **Result:** Wrong sale gone from reports, inventory fixed

### Scenario: Payment Not Received But Sale Completed
1. Sale was marked completed by mistake
2. Customer hasn't paid yet
3. Go to Sales History, find sale
4. Void with reason: "Payment not received"
5. **Result:** Inventory restored, sale hidden from revenue
6. Customer can pay and normal sale created again

---

## Audit Trail Example

When viewing audit trail for a voided sale, you'll see:

```
[Creation]
Action: CREATED
Date: 2026-04-06 10:00 AM
User: John Cashier
Details: 3 items, KShs 5,000

[Void]
Action: VOIDED  
Date: 2026-04-06 10:05 AM
User: Sarah Manager
Reason: Customer returned wrong item
Details: 3 items restored
```

---

## Permission Levels

| Role | Can View Voided Sales | Can Create Voids | Can View Audit Trail |
|------|----------------------|------------------|----------------------|
| Cashier | ✅ Yes | ❌ No | ❌ No |
| Manager | ✅ Yes | ✅ Yes | ✅ Yes |
| Admin | ✅ Yes | ✅ Yes | ✅ Yes |

---

## No UI Changes for Completed Sales

- POS work flow: **UNCHANGED** (sales still created same way)
- Payment flow: **UNCHANGED** (cash, M-Pesa, etc. work same)
- Receipt printing: **UNCHANGED**
- Checkout experience: **UNCHANGED** for customers

**Only change:** New ability to reverse mistakes afterward in Sales History

---

## Support for Returns (Coming Next)

Current implementation includes:
- ✅ Full sale reversals (voids)
- ⏳ Partial returns (function exists, UI coming)
- ⏳ Refund payment routing (structure ready)

For now: Use void for all reversals. Full return UI coming in next phase.

---

## Troubleshooting

### "Void Sale button is disabled"
→ You must be logged in as **manager** or **admin**

### "I can't void a sale - button shows greyed out"
→ The sale may already be voided. Check the red box - if it says "voided", you can't void again

### "Inventory didn't restore"
→ Check database: Did `stock_movements` get a 'reversal' type entry?
→ Run: `SELECT type, quantity FROM stock_movements WHERE reference_id='[SALE_ID]'`

### "Reports still show the voided sale"
→ Did you apply the migration? Check if database has `sale_status` column
→ Run: `SELECT COUNT(*) FROM sales WHERE sale_status='voided'`

### "Audit Trail doesn't show"
→ Sale must have been modified. New sales show "No modifications recorded"
→ Once you void a sale, audit trail populates

---

## What's NOT Changing

✅ Daily POS workflow  
✅ Customer checkout  
✅ Payment methods (cash, card, M-Pesa, etc.)  
✅ Receipt printing  
✅ Inventory levels (still decremented on sale, restored on void)  
✅ Receipt history (voided receipts marked clearly, kept for records)  
✅ User roles and permissions  

---

## Key Metrics

| Metric | Details |
|--------|---------|
| Files Modified | 6 (2 new, 4 updated) |
| Code Added | ~650 lines backend + UI |
| Database Columns | 8 new columns |
| New Tables | 1 (`sale_audit_log`) |
| New Indexes | 5 for performance |
| Functions Added | 3 |
| UI Elements Added | 2 dialogs, 1 column, 1 button |
| Breaking Changes | 0 |

---

**Status:** ✅ Ready to apply and test  
**Created:** April 6, 2026  
**Last Updated:** April 6, 2026
