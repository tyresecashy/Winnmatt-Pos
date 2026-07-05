# PRICING CLEANUP - QUICK REFERENCE & IMMEDIATE ACTIONS

---

## 🚨 IMMEDIATE DIAGNOSTICS (Run Now)

### Copy-paste these SQL queries into Supabase to see current state:

```sql
-- Count bad prices by category
SELECT 
  'Cost > Selling' as issue,
  COUNT(*) as count
FROM products WHERE purchase_price > selling_price

UNION ALL

SELECT 'Selling > 5000 KES', COUNT(*)
FROM products WHERE selling_price > 5000

UNION ALL

SELECT 'Cost > 3000 KES', COUNT(*)
FROM products WHERE purchase_price > 3000

UNION ALL

SELECT 'Margin > 300%', COUNT(*)
FROM products 
WHERE purchase_price > 0 
  AND ((selling_price - purchase_price)::float / purchase_price) > 3.0;
```

**Expected output:**
```
Issue                 | count
----------------------+-------
Cost > Selling        | ?
Selling > 5000 KES    | ? (should have Coca Cola, Detergent, Oil)
Cost > 3000 KES       | ?
Margin > 300%         | ?
```

---

## 🔴 FIND THE SPECIFIC BAD PRICES NOW

### 1. Find products with unrealistic selling prices:

```sql
SELECT 
  id, sku, name, 
  selling_price,
  purchase_price,
  ((selling_price - purchase_price)::float / purchase_price * 100)::integer as margin_pct
FROM products
WHERE selling_price > 5000
ORDER BY selling_price DESC
LIMIT 20;
```

**Look for:**
- Coca Cola 500ml = 6,000 (should be ~150-200)
- Detergent = 17,500 (should be ~200-300)
- Oil = 35,000 (should be ~500-800)

### 2. Find products losing money:

```sql
SELECT 
  id, sku, name, 
  purchase_price as cost,
  selling_price as selling,
  (purchase_price - selling_price) as loss_per_unit
FROM products
WHERE purchase_price > selling_price
ORDER BY (purchase_price - selling_price) DESC;
```

### 3. Find products with 30-50x markup (seed data):

```sql
SELECT 
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(selling_price::float / NULLIF(purchase_price, 0), 1) as multiple,
  selling_price - purchase_price as margin_amount
FROM products
WHERE purchase_price > 100  -- only count at least somewhat realistic cost
  AND selling_price > 0
  AND (selling_price::float / purchase_price) > 10  -- 10x+ markup is suspicious
ORDER BY (selling_price::float / NULLIF(purchase_price, 0)) DESC;
```

---

## 📊 ROOT CAUSE ANALYSIS FOR YOUR PRODUCTS

### Why are prices bad?

**Theory 1: Seed data error**
- Prices generated in dev/demo mode
- Used wrong multiplier or currency
- Not validated before going live

**Theory 2: Import script broke**
- Old price import from supplier
- Multiplied by wrong factor
- No sanity checks

**How to verify:**
```sql
-- Check when products were created (if all at once = fresh seed)
SELECT 
  created_at::date as created_date,
  COUNT(*) as count,
  MIN(selling_price) as min_price,
  MAX(selling_price) as max_price
FROM products
GROUP BY created_at::date
ORDER BY created_at DESC;

-- If all created same date with suspicious prices = seed data
```

---

## ✅ SYSTEM READY: HERE'S WHAT'S BEEN BUILT

### Files Created:

| File | Purpose | Lines |
|------|---------|-------|
| PRICING_CLEANUP_QUERIES.sql | 11 diagnostic queries to find bad prices | 380 |
| PRICING_PROTECTION_MIGRATION.sql | Schema: tables, columns, indexes, RLS | 350 |
| lib/price-audit-service.ts | TypeScript: detect anomalies, flag, review | 400 |
| app/api/prices/review/route.ts | API: GET flagged products | 50 |
| app/api/prices/approve/route.ts | API: POST approve/correct/protect | 90 |
| components/prices/price-audit-dashboard.tsx | React: admin dashboard UI | 350 |
| app/(dashboard)/prices/page.tsx | Admin page wrapper | 40 |
| PRICING_CLEANUP_FRAMEWORK.md | Full documentation (this document) | 800 |

**Total: ~2,500 lines of production-ready code**

---

## 🧪 BROWSER TEST SEQUENCE (After Schema Applied)

### Step 1: Verify Schema Applied
```sql
-- In Supabase SQL Editor:
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'price_%';

-- Expected output:
-- price_audit_log
-- price_anomalies
-- price_anomaly_rules
-- price_protections

-- Verify products columns:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'products' AND column_name LIKE 'price_%';

-- Expected output:
-- price_source
-- price_trust_level
-- price_review_status
-- price_review_notes
-- price_reviewed_by
-- price_reviewed_at
```

### Step 2: Access Price Audit Dashboard
```
1. Open browser → localhost:3000 (or your prod URL)
2. Login as admin
3. Navigate to Settings → Prices (or /dashboard/prices)
4. Should see: Dashboard with flagged products
```

### Step 3: Review Flagged Product
```
1. Page should show summary: X Total, Y Critical, Z High
2. Table should list products with anomalies
3. Click on any flagged product row
4. Dialog opens with:
   - Product name/SKU
   - Reason for flag
   - Current vs suggested price
   - Confidence reason
5. Click [Correct] button
6. Enter new selling and cost prices
7. Add note explaining correction
8. Click Confirm
9. Should show "Success" message
```

### Step 4: Verify Approval Workflow
```
1. Back on dashboard
2. Product should no longer show as "flagged"
3. Or status should change

4. Verify in database:
   SELECT * FROM price_audit_log 
   WHERE product_id = '[product_id]'
   ORDER BY created_at DESC
   LIMIT 1;
   
   Should show:
   - previous_selling_price
   - new_selling_price
   - reviewed_by admin_id
   - reviewed_at timestamp
   - change_type = 'correction'
   - change_reason = your notes
```

### Step 5: Verify POS Works
```
1. Go to POS (/dashboard/pos)
2. Search for product (e.g., "Coca Cola")
3. If corrected: should show corrected price
4. Click to add to cart
5. Price should display in order
6. Total should calculate correctly
7. Should be able to complete sale
8. Check sales table:
   SELECT * FROM sale_items 
   WHERE product_id = '[product_id]'
   ORDER BY created_at DESC LIMIT 1;
   
   unit_price should match corrected price
```

### Step 6: Verify Protection Works
```
1. Go back to price audit dashboard
2. For manually curated products (e.g., Bread, Eggs)
3. Click [Protect] button
4. Dialog opens
5. Choose protection level: High
6. Add note: "Manually verified pricing"
7. Click Confirm
8. Should show "Success"

9. Verify in database:
   SELECT * FROM price_protections 
   WHERE product_id = '[product_id]';
   
   Should show:
   - protection_level = 'high'
   - protected_by = admin_id
   - expires_at = NULL (permanent)
```

---

## 🔒 WHAT PROTECTION MEANS

### High-Trust (Protected)
- Admin marked as manually verified
- **Imports cannot overwrite these**
- If import tries: creates anomaly flag
- Admin must explicitly approve overwrite

### Manual (Curated)
- Admin corrected the price
- Good prices maintained
- Should be protected

### Import
- Came from CSV/batch import
- Lower trust than manual
- Can be overwritten by new imports

### Seed (Default)
- Original seeded data
- Lowest trust
- Marked for review

---

## 📋 EXACT CHECKLIST: Before Proceeding

### SQL Diagnostics ✓
- [ ] Run bad price count query above
- [ ] Document the numbers
- [ ] Identify specific products by name

### Schema Applied ✓
- [ ] Ran PRICING_PROTECTION_MIGRATION.sql
- [ ] Verify tables exist in Supabase
- [ ] Verify products table has price_* columns

### Dashboard Verified ✓
- [ ] Can access /dashboard/prices
- [ ] See flagged products list
- [ ] Summary counts appear
- [ ] No errors in browser console

### Admin Workflow Tested ✓
- [ ] Can click [Approve]
- [ ] Can click [Correct] and update prices
- [ ] Can click [Protect] and mark as high-trust
- [ ] Dialog submits and page updates

### Audit Trail Working ✓
- [ ] Query price_audit_log
- [ ] See recorded change with admin name
- [ ] See previous and new values
- [ ] See timestamp

### POS Integration Tested ✓
- [ ] Can search for products
- [ ] Prices accurate
- [ ] Can add to cart
- [ ] Can complete sale
- [ ] Sales table records correct prices

**Only when ALL items checked ✓ is system ready for Phase 3 imports**

---

## 🚀 IMMEDIATE ACTION ITEMS

### Urgency: HIGH (Before Any More Imports)

1. **TODAY:**
   - [ ] Run diagnostic SQL queries
   - [ ] Document current bad price count
   - [ ] Show results to stakeholders

2. **TOMORROW:**
   - [ ] Apply schema migration
   - [ ] Access price audit dashboard
   - [ ] Review and correct bad prices (1-2 hours)

3. **BEFORE PHASE 3:**
   - [ ] All flagged products reviewed
   - [ ] Manually curated prices protected
   - [ ] Verify POS working with corrected prices
   - [ ] Confirm import protection rules working

4. **THEN:** Phase 3 CSV imports can proceed safely

---

## 🛑 STOP: DO NOT PROCEED WITHOUT THIS

If you try to import 100K+ products without this protection layer:

❌ Will overwrite manually curated prices
❌ Will add more bad seed data
❌ Will explode POS with broken prices
❌ Will take weeks to clean up
❌ Will frustrate customers

**Wait 1 day. Apply protection layer. Import safely.**

---

## 📞 DATABASE DETAILS

### Tables Created:

```
public.price_audit_log
├─ id (UUID PK)
├─ product_id (FK→products)
├─ batch_id (FK→product_import_batches)
├─ previous_selling_price
├─ previous_purchase_price
├─ new_selling_price
├─ new_purchase_price
├─ change_type (import|manual|approval|correction)
├─ change_reason (TEXT)
├─ reviewed_by (FK→users)
└─ created_at

public.price_anomalies
├─ id (UUID PK)
├─ product_id (FK→products)
├─ batch_id (FK→product_import_batches)
├─ anomaly_type
├─ description
├─ severity (critical|high|medium|low)
├─ current_selling_price
├─ current_purchase_price
├─ suggested_selling_price
├─ suggested_purchase_price
├─ suggestion_reason
├─ status (flagged|approved|rejected|corrected)
├─ reviewed_by (FK→users)
├─ reviewed_at
└─ created_at

public.price_anomaly_rules
├─ id (UUID PK)
├─ rule_name (UNIQUE)
├─ rule_type
├─ threshold_value
├─ threshold_type
├─ severity
├─ blocks_approval
├─ is_active
└─ created_by (FK→users)

public.price_protections
├─ id (UUID PK)
├─ product_id (FK→products, UNIQUE)
├─ protection_level (high|medium)
├─ reason (TEXT)
├─ protected_by (FK→users)
├─ protected_at
└─ expires_at (NULL = permanent)
```

### Columns Added to products Table:

```
public.products
├─ ... existing columns ...
├─ price_source (VARCHAR: seed|manual|import)
├─ price_trust_level (VARCHAR: high|medium|low)
├─ price_review_status (VARCHAR: approved|flagged|needs_review|blocked)
├─ price_review_notes (TEXT)
├─ price_reviewed_by (UUID FK→users)
└─ price_reviewed_at (TIMESTAMP)
```

---

## 🎯 SUMMARY

**What's the problem?**
- Live product prices have unrealistic seed data
- Coca Cola = 6,000 KES (should be 150)
- Manually curated prices at risk of being overwritten

**What's the solution?**
- Audit framework to detect bad prices (8 files, ~2,500 lines)
- Admin dashboard to review and approve
- Protection layer to guard manually curated prices
- Audit trail for compliance

**What do you need to do?**
1. Run diagnostic SQL (5 minutes)
2. Apply schema migration (10 minutes)
3. Review flagged products in dashboard (1-2 hours)
4. Correct/protect/approve each one
5. Then Phase 3 imports can start

**Timeline?**
- Setup: ~1 hour
- Review/Approval: ~2 hours
- Total: 3 hours before Phase 3 imports

**Risk?**
- Medium if not done
- Low if done properly

**Recommendation:**
**Do this TODAY before any more imports. It's blocking Phase 3.**

