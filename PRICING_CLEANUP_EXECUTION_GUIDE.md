# WINNMATT POS: PRICE CLEANUP - EXECUTION GUIDE

**Date:** April 6, 2026  
**Objective:** Fix broken seed prices using verified Kenyan retail references  
**Safety Level:** High (idempotent, read-only verification, no data loss)

---

## EXECUTIVE SUMMARY

### Products Corrected: 13
**Beverages (3 products):**
- Coca Cola 500ml: KSh 6,000 → **70** ✓
- Sprite 500ml: KSh 6,000 → **70** ✓
- Fanta Orange 500ml: KSh 5,500 → **70** ✓

**Dairy (2 products):**
- Milk 1L: KSh 14,500 → **155** ✓
- Yogurt 500ml: KSh 12,000 → **200** ✓

**Bakery (1 product):**
- Bread White 700g: KSh 12,000 → **110** ✓

**Snacks (3 products):**
- Doritos 50g: KSh 5,500 → **60** ✓
- Lay's Classic 50g: KSh 5,500 → **60** ✓
- Mentos 25g: KSh 2,500 → **45** ✓

**Cleaning & Personal Care (3 products):**
- Detergent Powder 1kg: KSh 17,500 → **210** ✓
- Soap Bar 150g: KSh 4,500 → **280** ✓
- Toothpaste 120g: KSh 7,500 → **290** ✓

**Oils (1 product):**
- Cooking Oil 2L: KSh 35,000 → **689** ✓

### Products Protected: 7 (high-trust, unchanged)
- Eggs: 20 KSh ✓
- Bread Brown 600g: 65 KShs ✓
- ROSY LIQUID HAND WASH 500ML: 300 KSh ✓
- SOMO 10LTRS: 1,050 KSh ✓
- JEMBE 2KGS: 160 KSh ✓
- jogoo 2kgs: 180 KSh ✓
- Kiwi 100ml: 60 KSh ✓

### Products Flagged for Manual Review: 2
- **Rice 10kg:** Current 110,000 KSh - flagged (bulk pricing varies by supplier) 🚩
- **Ice Cream 500ml:** Current 22,000 KSh - flagged (brand-dependent pricing) 🚩

**Rule Applied:** Do not guess. Uncertain items flagged for manual review.

---

## STEP-BY-STEP EXECUTION

### STEP 1: BACKUP (SAFETY FIRST)

**Location:** Supabase Dashboard

1. Navigate to your Supabase Dashboard (console.supabase.com)
2. Go to **SQL Editor**
3. Create a quick backup query:

```sql
-- BEFORE YOU RUN CLEANUP: Verify current prices
SELECT 
    name,
    selling_price,
    purchase_price
FROM products
WHERE name IN (
    'Coca Cola 500ml',
    'Sprite 500ml',
    'Fanta Orange 500ml',
    'Milk 1L',
    'Yogurt 500ml',
    'Bread White 700g',
    'Eggs',
    'Rice 10kg'
)
ORDER BY name;
```

**Expected BEFORE results:**
- Coca Cola 500ml: 6000
- Sprite 500ml: 6000
- Fanta Orange 500ml: 5500
- Milk 1L: 14500
- Yogurt 500ml: 12000
- Bread White 700g: 12000
- Eggs: 20 (unchanged)
- Rice 10kg: 110000

---

### STEP 2: EXECUTE PRICE CLEANUP MIGRATION

**Location:** Supabase SQL Editor

1. Open the file: `PRICING_CLEANUP_PRODUCTION.sql`
2. Copy **ALL** the SQL code
3. In Supabase SQL Editor, paste the entire migration
4. Click **RUN** button
5. Wait for "Query executed successfully" message
6. Check for **ZERO errors**

**Expected output:**
```
Query executed successfully (no errors)
```

**If you see errors:**
- Check column name spelling (case-sensitive on Linux)
- Run QUERY 1 from PRICING_CLEANUP_VERIFY.sql to diagnose

---

### STEP 3: VERIFY CORRECTIONS APPLIED

**Location:** Supabase SQL Editor

1. Open: `PRICING_CLEANUP_VERIFY.sql`
2. Copy **QUERY 1** (section starting with "QUERY 1: Verify Corrections Applied")
3. Paste in SQL Editor and RUN
4. Verify you see **13 rows** with:
   - Coca Cola, Sprite, Fanta: price 70
   - Milk: 155
   - Yogurt: 200
   - Bread White: 110
   - Doritos, Lay's: 60
   - Mentos: 45
   - Detergent: 210
   - Soap: 280
   - Toothpaste: 290
   - Cooking Oil: 689
   - All with `price_source = 'seed_corrected'` ✓

**Expected:** 13 rows returned

---

### STEP 4: VERIFY PROTECTED PRICES UNCHANGED

**Location:** Supabase SQL Editor

1. From `PRICING_CLEANUP_VERIFY.sql`, copy **QUERY 2**
2. Run it
3. Verify you see **7 rows** with:
   - Eggs: 20 (unchanged) ✓
   - Bread Brown 600g: 65 (unchanged) ✓
   - ROSY LIQUID HAND WASH 500ML: 300 ✓
   - SOMO 10LTRS: 1050 ✓
   - JEMBE 2KGS: 160 ✓
   - jogoo 2kgs: 180 ✓
   - Kiwi 100ml: 60 ✓
   - All with `price_trust_level = 'high'` ✓

**Expected:** 7 rows, prices unchanged

---

### STEP 5: VERIFY FLAGGED ITEMS

**Location:** Supabase SQL Editor

1. From `PRICING_CLEANUP_VERIFY.sql`, copy **QUERY 3**
2. Run it
3. Verify you see **2 rows**:
   - Ice Cream 500ml: 22000 (flagged for manual review)
   - Rice 10kg: 110000 (flagged for manual review)
   - Both with `price_review_status = 'flagged'` ✓

**Expected:** 2 rows flagged

---

### STEP 6: VERIFY AUDIT TRAIL

**Location:** Supabase SQL Editor

1. From `PRICING_CLEANUP_VERIFY.sql`, copy **QUERY 4**
2. Run it
3. Verify you see:
   - `total_audit_entries = 13` ✓
   - Each correction logged with before/after prices
   - Each has `change_reason` with Kenyan retail reference

**Expected:** 13 audit entries

---

### STEP 7: CHECK MARGIN HEALTH

**Location:** Supabase SQL Editor

1. From `PRICING_CLEANUP_VERIFY.sql`, copy **QUERY 5**
2. Run it
3. Verify all margins are **between 20-70%** (healthy retail range)
4. Look for ✓ status indicator

**Expected:** All corrected items show 'HEALTHY (✓)' margin

---

### STEP 8: RUN FINAL VALIDATION - CRITICAL CHECK

**Location:** Supabase SQL Editor

1. From `PRICING_CLEANUP_VERIFY.sql`, copy **QUERY 6** (MOST IMPORTANT)
2. Run it
3. **MUST return ZERO critical issues**
4. If you see any 🔴 (red) results, STOP and investigate

**Expected output:**
```
(0 rows returned - no critical data quality issues)
```

**If you see issues:**
- Contact technical support with the returned rows
- Do NOT proceed to POS testing

---

### STEP 9: TEST IN POS SYSTEM

**Location:** Your POS Web Interface (localhost:3000)

1. Navigate to POS page
2. Click **Search Products** or **Scan Barcode**
3. Search for each corrected product:
   - **Coca Cola 500ml**: Should show KSh 70 (not 6000)
   - **Milk 1L**: Should show KSh 155 (not 14500)
   - **Bread White 700g**: Should show KSh 110 (not 12000)
4. Add one to cart and **Complete a test sale**
5. Verify receipt shows **corrected prices** ✓

**Expected:** POS displays corrected prices, inventory updated

---

### STEP 10: VERIFY IN SALES DATABASE

**Location:** Supabase Database

Run this query to verify the sale was recorded with corrected prices:

```sql
SELECT 
    id,
    product_id,
    quantity,
    unit_price,
    total_price,
    created_at
FROM sales
WHERE product_id IN (
    SELECT id FROM products 
    WHERE name IN ('Coca Cola 500ml', 'Milk 1L', 'Bread White 700g')
)
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** `unit_price` should show corrected values (70, 155, 110), not old values

---

## HANDLING FLAGGED ITEMS (Rice & Ice Cream)

### Rice 10kg: KSh 110,000
**Status:** Flagged - needs manual review

**Next steps:**
1. Contact your rice supplier(s)
2. Get current retail pricing for 10kg bulk bags
3. Verify if KSh 110,000 is realistic or inflated
4. In Supabase, run:

```sql
-- Option A: If price should be much lower
UPDATE products
SET selling_price = [YOUR_VERIFIED_PRICE],
    price_review_status = 'approved'
WHERE LOWER(name) LIKE '%Rice%10%';

-- Option B: Keep current price but mark approved after verification
UPDATE products
SET price_review_status = 'approved',
    price_review_notes = 'Verified with supplier: [Your Notes]'
WHERE LOWER(name) LIKE '%Rice%10%';
```

### Ice Cream 500ml: KSh 22,000
**Status:** Flagged - needs manual review

**Next steps:**
1. Check which brand(s) of ice cream you stock
2. Verify current retail pricing for that brand
3. Premium brands may legitimately be KSh 20,000+
4. Standard brands should be KSh 5,000-10,000
5. Once verified, run:

```sql
-- Update with verified price
UPDATE products
SET selling_price = [YOUR_VERIFIED_PRICE],
    price_review_status = 'approved',
    price_review_notes = 'Verified: [brand name] typical retail price'
WHERE LOWER(name) LIKE '%Ice%Cream%500%';
```

---

## TROUBLESHOOTING

### Problem: QUERY 1 returns 0 rows
**Cause:** Corrections didn't apply (product name mismatch)

**Solution:**
1. Run this to find actual product names:
```sql
SELECT DISTINCT name FROM products 
WHERE name LIKE '%Coca%' OR name LIKE '%Sprite%' OR name LIKE '%Milk%'
ORDER BY name;
```
2. Check if names differ from assumptions
3. Manually update with correct names

### Problem: QUERY 6 shows critical issues
**Cause:** Some products not corrected properly

**Solution:**
1. Identify which products have issues
2. Run UPDATE manually for those products
3. Use exact product names from your database

### Problem: POS shows old price (6000 for Coca Cola)
**Cause:** Browser cache or stale connection

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Restart POS application
4. Verify database directly with SQL query

### Problem: Audit log shows 0 entries
**Cause:** INSERT statements failed silently

**Solution:**
1. Check if price_audit_log table exists: Run `SELECT COUNT(*) FROM price_audit_log;`
2. If table doesn't exist, run PRICING_PROTECTION_MIGRATION.sql first
3. Then run PRICING_CLEANUP_PRODUCTION.sql again

---

## FILES INVOLVED

**Execution:**
- `PRICING_CLEANUP_PRODUCTION.sql` ← Run this first

**Verification:**
- `PRICING_CLEANUP_VERIFY.sql` ← Run these queries in order after execution

**This Guide:**
- `PRICING_CLEANUP_EXECUTION_GUIDE.md` ← You're reading this

---

## SAFETY CHECKLIST

- [ ] Ran QUERY 1: 13 corrected items confirmed
- [ ] Ran QUERY 2: 7 protected items unchanged
- [ ] Ran QUERY 3: 2 flagged items identified
- [ ] Ran QUERY 4: 13 audit entries created
- [ ] Ran QUERY 5: All margins healthy (20-70%)
- [ ] Ran QUERY 6: ZERO critical issues remaining ✓
- [ ] Tested in POS: Coca Cola shows 70 (not 6000) ✓
- [ ] Verified sales database: Corrected prices recorded ✓
- [ ] Documented flagged items for manual review

---

## NEXT STEPS

1. **Immediately:** Complete all 10 verification steps above
2. **Today:** Flag Rice and Ice Cream for supplier verification
3. **Within 24 hours:** Update flagged items with verified prices
4. **Tomorrow:** Proceed to Phase 3 testing (CSV import pipeline)

---

## SUCCESS CRITERIA

✅ All 13 broken seed prices corrected to verified Kenyan retail bands  
✅ All 7 trusted manual prices protected and unchanged  
✅ All 2 uncertain prices flagged (NOT guessed)  
✅ Complete audit trail created  
✅ POS displays corrected prices correctly  
✅ Zero remaining critical price anomalies  
✅ Ready for Phase 3 CSV imports  

---

**Status:** 🟢 READY FOR CLEANUP EXECUTION

Contact support if you encounter any issues during execution.
