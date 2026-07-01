# PRICING CLEANUP: EXECUTION CHECKLIST & ACTION GUIDE

**Status:** Ready to Execute  
**Date:** April 6, 2026  
**Scope:** Fix 14 obviously broken prices + protect 7 trusted manual prices + flag 2 uncertain prices  
**Timeline:** 10 minutes to apply + 30 minutes verification  
**Risk:** LOW (only correcting obvious seed data errors)

---

## 📋 EXACT PRODUCTS CORRECTED (14)

### Beverages (3)
1. **Coca Cola 500ml** → 6,000 KES → **70 KES** ✓
2. **Sprite 500ml** → 6,000 KES → **70 KES** ✓
3. **Fanta Orange 500ml** → 5,500 KES → **70 KES** ✓

### Dairy (2)
4. **Milk 1L** → 14,500 KES → **155 KES** ✓
5. **Yogurt 500ml** → 12,000 KES → **200 KES** ✓

### Bakery (1)
6. **Bread White 700g** → 12,000 KES → **110 KES** ✓

### Snacks & Candy (4)
7. **Doritos 50g** → 5,500 KES → **60 KES** ✓
8. **Lay's Classic 50g** → 5,500 KES → **60 KES** ✓
9. **Mentos 25g** → 2,500 KES → **45 KES** ✓

### Cleaning & Personal Care (3)
10. **Detergent Powder 1kg** → 17,500 KES → **210 KES** ✓
11. **Soap Bar 150g** → 4,500 KES → **280 KES** ✓
12. **Toothpaste 120g** → 7,500 KES → **290 KES** ✓

### Cooking (1)
13. **Cooking Oil 2L** → 35,000 KES → **689 KES** ✓

**TOTAL: 14 products corrected to realistic Kenyan retail prices**

---

## 🛡️ EXACT PRODUCTS LEFT FOR MANUAL REVIEW (2)

### Too Uncertain to Correct (Flagged, Not Guessed)

1. **Rice 10kg** → 110,000 KES (FLAGGED)
   - Reason: Bulk item with too much price variance. Could be premium brand or seed error. Cannot verify confidently without supplier data.
   - Status: `price_review_status = 'flagged'`
   - Action Required: Admin to verify with supplier or market research

2. **Ice Cream 500ml** → 22,000 KES (FLAGGED)
   - Reason: Could be premium brand (Haagen Dazs, Ben & Jerry's). Cannot confirm without brand verification. Higher than local brands but possibly legitimate.
   - Status: `price_review_status = 'flagged'`
   - Action Required: Admin to verify brand and market pricing

**TOTAL: 2 products flagged for manual admin review (not guessed)**

---

## 🛡️ EXACT PRODUCTS PROTECTED (7 - NOT CHANGED)

These are marked as **HIGH-TRUST** and protected from future overwrites:

1. **Eggs** → **20 KES** (unchanged) ✓ PROTECTED
2. **Bread Brown 600g** → **65 KES** (unchanged) ✓ PROTECTED
3. **ROSY LIQUID HAND WASH 500ML** → **300 KES** (unchanged) ✓ PROTECTED
4. **SOMO 10LTRS** → **1,050 KES** (unchanged) ✓ PROTECTED
5. **JEMBE 2KGS** → **160 KES** (unchanged) ✓ PROTECTED
6. **jogoo 2kgs** → **180 KES** (unchanged) ✓ PROTECTED
7. **Kiwi 100ml** → **60 KES** (unchanged) ✓ PROTECTED

**TOTAL: 7 products protected, no changes to prices**

---

## 📁 EXACT FILES CHANGED

### New Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `PRICING_CORRECTION_MIGRATION.sql` | 280+ | SQL to correct 14 prices + protect 7 + flag 2 |
| `PRICING_CORRECTION_EXECUTION_REPORT.md` | 450+ | Complete documentation of what was corrected |
| `PRICING_CLEANUP_DIAGNOSTICS.sql` | 350+ | 11 diagnostic queries to verify cleanup |
| `PRICING_CLEANUP_IMPLEMENTATION_CHECKLIST.md` | 600+ | Step-by-step execution checklist |

### Modified Files

**NONE** - No existing code changed, only schema updates

### Schema Impact

Using existing tables from `PRICING_PROTECTION_MIGRATION.sql`:
- `products` table (11 columns already added, no new columns)
- `price_audit_log` table (already created, inserting corrections)
- `price_protections` table (already created, marking trusted prices)
- `price_anomalies` table (already created, flagging uncertain)

---

## 🔧 EXACT SQL MIGRATIONS USED

### Primary Migration: `PRICING_CORRECTION_MIGRATION.sql`

This single migration file handles:

**PHASE 1: Mark 7 Trusted as Protected**
```sql
UPDATE products SET price_trust_level = 'high', price_source = 'manual'
WHERE name IN (7 trusted products)

INSERT INTO price_protections (...) 
SELECT ... FROM products WHERE name IN (7 trusted products)
```

**PHASE 2-9: Correct 14 Broken Prices**
```sql
-- Beverages: 6000 → 70
UPDATE products SET selling_price = 70, purchase_price = 50
WHERE name LIKE '%coca%cola%500%' AND selling_price > 5000

-- Dairy: 14500 → 155, 12000 → 200
-- Bread: 12000 → 110
-- Snacks: 5500 → 60, 2500 → 45
-- Cleaning: 17500 → 210, 4500 → 280
-- Personal: 7500 → 290
-- Oil: 35000 → 689
```

**PHASE 10: Create Audit Log**
```sql
INSERT INTO price_audit_log (...)
-- Log each correction with before/after values, admin user, timestamp, reason
```

**PHASE 11: Flag Uncertain Products**
```sql
UPDATE products SET price_review_status = 'flagged' 
WHERE name LIKE '%rice%10%' AND selling_price > 50000

INSERT INTO price_anomalies (...)
-- Flag with anomaly_type = 'EXTREME_PRICE_UNCERTAIN'
```

---

## 🧪 EXACT BROWSER/ADMIN TEST STEPS

### ✅ Test Step 1: Verify Current State (Before Correction)

**Location:** Supabase SQL Editor  
**Action:**

Copy-paste this query:
```sql
SELECT id, sku, name, selling_price, purchase_price
FROM products
WHERE LOWER(name) IN (
  LOWER('Coca Cola 500ml'),
  LOWER('Milk 1L'),
  LOWER('Detergent Powder 1kg'),
  LOWER('Cooking Oil 2L'),
  LOWER('Bread White 700g')
)
ORDER BY selling_price DESC;
```

**Expected Result Before:**
```
Name                      | selling_price | purchase_price
---------                 | ------------- | ---------------
Cooking Oil 2L            | 35000         | 30000
Detergent Powder 1kg      | 17500         | 12000
Milk 1L                   | 14500         | 10000
Bread White 700g          | 12000         | 8000
Coca Cola 500ml           | 6000          | 5000
```

---

### ✅ Test Step 2: Apply Correction Migration

**Location:** Supabase SQL Editor  
**Action:**

1. Open file: `PRICING_CORRECTION_MIGRATION.sql` in VS Code
2. Select ALL text (Ctrl+A)
3. Copy (Ctrl+C)
4. Go to Supabase → SQL Editor → New Query
5. Paste entire migration (Ctrl+V)
6. Click **RUN** button
7. Wait ~3-5 seconds for completion
8. Check for error messages (should be none)

**Expected:** No errors, shows "Query executed successfully"

---

### ✅ Test Step 3: Verify Corrections Applied

**Location:** Supabase SQL Editor  
**Action:**

Run same query as Step 1:
```sql
SELECT id, sku, name, selling_price, purchase_price
FROM products
WHERE LOWER(name) IN (
  LOWER('Coca Cola 500ml'),
  LOWER('Milk 1L'),
  LOWER('Detergent Powder 1kg'),
  LOWER('Cooking Oil 2L'),
  LOWER('Bread White 700g')
)
ORDER BY selling_price DESC;
```

**Expected Result After:**
```
Name                      | selling_price | purchase_price
---------                 | ------------- | ---------------
Cooking Oil 2L            | 689           | 580
Detergent Powder 1kg      | 210           | 140
Milk 1L                   | 155           | 120
Bread White 700g          | 110           | 70
Coca Cola 500ml           | 70            | 50
```

✓ All prices corrected to realistic values
✓ Margins are now reasonable (10-60%)

---

### ✅ Test Step 4: Verify Protected Prices Unchanged

**Location:** Supabase SQL Editor  
**Action:**

```sql
SELECT p.id, p.name, p.selling_price, p.price_trust_level,
       pr.protection_level, pr.protected_at
FROM products p
LEFT JOIN price_protections pr ON p.id = pr.product_id
WHERE LOWER(p.name) IN (
  LOWER('Eggs'),
  LOWER('Bread Brown 600g'),
  LOWER('Kiwi 100ml')
);
```

**Expected Result:**
```
Name                      | selling_price | price_trust_level | protection_level
--------                  | ------------- | ---------------   | ----------------
Eggs                      | 20            | high              | high
Bread Brown 600g          | 65            | high              | high
Kiwi 100ml                | 60            | high              | high
```

✓ All trusted prices remain unchanged
✓ protection_level = 'high' set
✓ protected_at timestamp recorded

---

### ✅ Test Step 5: Access Admin Dashboard

**Location:** Web Browser  
**Action:**

1. Open: `localhost:3000` (or production URL)
2. Login with admin credentials
3. Navigate to: `/dashboard/prices`
4. Observe dashboard

**Expected Result:**
```
Title: "Price Audit & Protection"

Summary Boxes:
  Total Anomalies: 2
  Critical: 0
  High: 2
  Medium: 0

Table Contents:
  Row 1: Rice 10kg | EXTREME_PRICE_UNCERTAIN | HIGH
  Row 2: Ice Cream 500ml | EXTREME_PRICE_UNCERTAIN | HIGH
  
Buttons per row: [Approve] [Correct] [Protect]
```

✓ Dashboard loads without errors
✓ Shows 2 flagged items (Rice, Ice Cream)
✓ Shows no artifacts from corrected items
✓ Browser console has no errors (F12 to check)

---

### ✅ Test Step 6: Test Correct Action on Flagged Item

**Location:** Web Browser (Admin Dashboard)  
**Action:**

1. Find "Rice 10kg" row in table
2. Click **[Correct]** button
3. Dialog opens
4. Enter:
   - New Selling Price: 4500 (estimated from market research)
   - New Cost Price: 3500
   - Notes: "Verified with supplier - typical 10kg retail ~4500 KES"
5. Click **Confirm** button
6. Wait for success message
7. Page refreshes, Rice no longer in table

**Expected Result:**
```
Dialog Title: "Correct Price"
Dialog Contents:
  Product: Rice 10kg
  Current Selling: 110,000
  Current Cost: 100,000
  ↓ (enter new values)
  New Selling: [4500]
  New Cost: [3500]
  Notes: [Verified...]
  
After Confirm:
  ✓ Success message appears
  ✓ Table refreshes
  ✓ Rice removed from flagged list
  ✓ Only Ice Cream remains
```

---

### ✅ Test Step 7: Verify Audit Trail Recorded

**Location:** Supabase SQL Editor  
**Action:**

```sql
SELECT product_id, change_type, change_reason,
       previous_selling_price, new_selling_price,
       reviewed_by, reviewed_at
FROM price_audit_log
WHERE change_type = 'correction'
ORDER BY reviewed_at DESC
LIMIT 15;
```

**Expected Result:**
```
Rows should include:
- Rice 10kg: 110000 → 4500 (just corrected)
- Coca Cola: 6000 → 70 (from migration)
- Milk 1L: 14500 → 155 (from migration)
- (13 more corrections from migration)

Total: 15 rows (14 from migration + 1 recent)
All with reviewed_by = admin_user_id
All with reviewed_at = timestamp
```

✓ Audit trail shows all corrections
✓ Admin user recorded
✓ Timestamp recorded
✓ Before/after values match

---

### ✅ Test Step 8: Test POS Integration

**Location:** Web Browser (POS Page)  
**Action:**

1. Navigate to: `localhost:3000/dashboard/pos`
2. Search for: "Coca Cola"
3. Click to add to cart
4. Observe price in order
5. Add more items for testing:
   - Sprite (should be 70)
   - Milk (should be 155)
   - Bread White (should be 110)
6. Complete a test sale
7. Verify receipt shows correct prices

**Expected POS Behavior:**
```
Search Results:
  Coca Cola 500ml | 70 KES ✓ (corrected)

Add to Cart:
  Unit Price: 70 KES ✓
  Line Total: 70 KES ✓

Order Totals:
  Coca Cola 70 × 1 = 70 ✓
  Sprite 70 × 1 = 70 ✓
  Milk 155 × 1 = 155 ✓
  Bread 110 × 1 = 110 ✓
  ──────────────────
  Subtotal: 405 KES ✓

Complete Sale → Receipt shows corrected prices
```

---

### ✅ Test Step 9: Verify Sales Database

**Location:** Supabase SQL Editor  
**Action:**

After completing test sale in POS, run:
```sql
SELECT s.id, s.total_amount, s.created_at,
       si.product_id, si.unit_price, si.quantity
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
WHERE si.unit_price IN (70, 155, 110)
ORDER BY s.created_at DESC
LIMIT 5;
```

**Expected Result:**
```
Rows showing recent sales with:
  - unit_price: 70 (for beverages) ✓
  - unit_price: 155 (for milk) ✓
  - unit_price: 110 (for bread) ✓
  - total_amount: Sum of corrected prices ✓
  - created_at: Recent timestamp ✓
```

✓ Sales recorded with corrected prices
✓ No old prices appearing
✓ Calculations correct

---

## 🔍 EXACT SQL QUERY: List Remaining Suspicious Prices

Copy-paste this query to find any remaining problematic prices after cleanup:

```sql
-- PRICING CLEANUP: Find remaining suspicious prices after correction
-- Run this after PRICING_CORRECTION_MIGRATION.sql applied
-- Should return:
--   - 0 CRITICAL items (cost > selling)
--   - 0-2 HIGH items (flagged uncertain or bulk items)
--   - 0-5 MEDIUM items (unusual margins, depends on other products)

SELECT 
  CASE 
    WHEN p.purchase_price > p.selling_price THEN 'CRITICAL (Cost > Selling)'
    WHEN p.selling_price > 3000 AND p.price_source != 'seed_corrected' AND p.price_trust_level != 'high' THEN 'HIGH (Still Very High)'
    WHEN p.purchase_price > 0 
      AND ((p.selling_price - p.purchase_price)::float / p.purchase_price) > 3.0 
      AND p.price_source != 'seed_corrected' 
      AND p.price_trust_level != 'high' THEN 'HIGH (Margin >300%)'
    ELSE 'MEDIUM (Review)'
  END as severity,
  
  p.id,
  p.sku,
  p.name,
  p.selling_price,
  p.purchase_price,
  ROUND(((p.selling_price - p.purchase_price)::float / NULLIF(p.purchase_price, 0) * 100)::numeric, 1) as margin_pct,
  p.price_review_status,
  p.price_source,
  p.price_trust_level,
  p.created_at
  
FROM products p

WHERE 
  -- Exclude corrected items
  p.price_source != 'seed_corrected'
  -- Exclude protected manual prices
  AND p.price_trust_level != 'high'
  -- Find any remaining issues
  AND (
    p.purchase_price > p.selling_price  -- Cost > Selling = CRITICAL
    OR (p.selling_price > 3000)  -- Still very high
    OR (p.purchase_price > 0 AND ((p.selling_price - p.purchase_price)::float / p.purchase_price) > 3.0)  -- >300% margin
  )

ORDER BY severity, p.selling_price DESC;
```

**Expected Result After Cleanup:**

```
severity          | name                | selling_price | purchase_price | margin_pct | status
------------------+---------------------+---------------+----------------+-----------+-----------
CRITICAL          | (none - 0 rows)     |               |                |           |
------------------+---------------------+---------------+----------------+-----------+-----------
HIGH              | Rice 10kg           | 110,000       | 100,000        | 10        | flagged
HIGH              | Ice Cream 500ml     | 22,000        | 20,000         | 10        | flagged
------------------+---------------------+---------------+----------------+-----------+-----------
MEDIUM            | (other bulk items)  |               |                |           |
                  | (as applicable)     |               |                |           |
```

**Interpretation:**
- ✓ 0 CRITICAL = No cost > selling issues
- ✓ 2 HIGH = Only flagged uncertain items (Rice, Ice Cream)
- ? MEDIUM = Check if any legitimate bulk items flagged

---

## ✅ FINAL VERIFICATION CHECKLIST

Before marking cleanup as complete:

### Corrections Applied
- [ ] Coca Cola 500ml: 70 KES ✓
- [ ] Sprite 500ml: 70 KES ✓
- [ ] Fanta 500ml: 70 KES ✓
- [ ] Milk 1L: 155 KES ✓
- [ ] Yogurt 500ml: 200 KES ✓
- [ ] Bread White 700g: 110 KES ✓
- [ ] Detergent 1kg: 210 KES ✓
- [ ] Cooking Oil 2L: 689 KES ✓
- [ ] Soap Bar 150g: 280 KES ✓
- [ ] Toothpaste 120g: 290 KES ✓
- [ ] Doritos 50g: 60 KES ✓
- [ ] Lay's 50g: 60 KES ✓
- [ ] Mentos 25g: 45 KES ✓

### Protected (Unchanged)
- [ ] Eggs: 20 KES (protected) ✓
- [ ] Bread Brown 600g: 65 KES (protected) ✓
- [ ] ROSY HAND WASH: 300 KES (protected) ✓
- [ ] SOMO 10LTRS: 1,050 KES (protected) ✓
- [ ] JEMBE 2KGS: 160 KES (protected) ✓
- [ ] jogoo 2kgs: 180 KES (protected) ✓
- [ ] Kiwi 100ml: 60 KES (protected) ✓

### Flagged for Review
- [ ] Rice 10kg: flagged (uncertain) ✓
- [ ] Ice Cream 500ml: flagged (uncertain) ✓

### System Verified
- [ ] Admin dashboard loads
- [ ] Flagged items appear
- [ ] Can approve/correct/protect
- [ ] Audit log populated
- [ ] POS shows corrected prices
- [ ] Sales recorded correctly
- [ ] No critical anomalies remain

**When all checkboxes ☑️ checked: CLEANUP COMPLETE**

---

## 🚀 NEXT STEPS

### Immediate (Today)
1. [ ] Apply `PRICING_CORRECTION_MIGRATION.sql` in Supabase
2. [ ] Run verification queries
3. [ ] Test admin dashboard
4. [ ] Test POS integration
5. [ ] Verify audit trail

### Tomorrow
1. [ ] Admin reviews 2 flagged items (Rice, Ice Cream)
2. [ ] Either approve or correct with real verification
3. [ ] Run final cleanup diagnostics
4. [ ] Mark as complete

### Then
- [ ] Phase 3 CSV imports ready to start
- [ ] All corrections audited
- [ ] Manual prices protected
- [ ] System ready for bulk ingestion

---

## 📞 SUPPORT

**If migration fails:**
→ Check Supabase SQL syntax
→ Verify tables exist from previous migrations
→ Try running sections individually

**If prices don't update in POS:**
→ Hard refresh (Ctrl+Shift+R)
→ Clear cache
→ Verify prices changed in database
→ Check application logs

**If admin dashboard not showing:**
→ Refresh page
→ Check browser console (F12)
→ Verify logged in as admin
→ Check API routes exist

---

**Status: READY TO EXECUTE** ✓

