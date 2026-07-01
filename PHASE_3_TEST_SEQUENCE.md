# PHASE 3 CONTROLLED TEST RUN
# CSV Import Pipeline Verification Flow

---

## TEST PACK OVERVIEW

**File:** `PHASE_3_TEST_PRODUCTS.csv` (19 rows + header)

**Contents:**
- ✅ 5 valid products (Coca Cola, Sprite, Blue Band, Brookside, Nescafe)
- ✅ 1 duplicate-like (Coca Cola 500ml listed twice, different sources)
- ✅ 3 missing optional fields (Fanta, Nakumatt bread, Royco - no image_url)
- ✅ 2 pricing anomalies:
  - CSV_RICE_ANOMALY_001: price = 8 KES (below 10 threshold) → CRITICAL
  - CSV_SALT_ANOMALY_001: price = 999,999 KES (above 500K threshold) → CRITICAL
- ✅ Mix of data sources: jumia (5), nairobi_wholesalers (4), direct_supplier (1), csv_import (9)
- ✅ All realistic Kenyan products (beverages, grains, condiments, dairy, oils, toiletries)

**Expected Pipeline Behavior:**
- Import 19 products → Raw imports created
- Normalize → Standardize names, extract brands, normalize units
- Deduplicate → Flag Coca Cola duplicate (fuzzy match ~95% similar)
- Analyze prices → Flag 2 critical anomalies, 15 valid
- Admin review → Should reject 2 anomalies, approve 17 good ones
- Publish → 17 new products to live, 0 updates
- POS search → Find any published product

---

## EXACT TEST SEQUENCE

### STEP 1: Database Baseline (5 minutes)

**Purpose:** Record initial state before import

**SQL Queries (Run in Supabase SQL Editor):**

```sql
-- Query 1.1: Baseline product count
SELECT COUNT(*) as baseline_product_count, COUNT(DISTINCT status) as status_types
FROM products
WHERE status = 'active';
-- Save this number: _______________

-- Query 1.2: Check for existing source data
SELECT DISTINCT source_id FROM products WHERE source_id IS NOT NULL;
-- Expected: Should be empty or have different sources

-- Query 1.3: Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('product_import_batches', 'product_imports', 'products_staging', 'price_anomalies')
AND table_schema = 'public';
-- Expected: All 4 tables exist
```

**Success Criteria:**
- ✅ Baseline count recorded
- ✅ All required tables exist
- ✅ No existing imports from test sources (jumia, nairobi_wholesalers, direct_supplier, csv_import)

---

### STEP 2: CSV Upload (5 minutes)

**Purpose:** Upload test CSV and trigger pipeline

**Browser Steps:**
```
1. Open http://localhost:3000 (login if needed)
2. Navigate to http://localhost:3000/import
   → Should see "Product Ingestion" page
   → Button: "Import CSV"
3. Click "Import CSV" button
   → Dialog opens: "Import Products from CSV"
4. Select data source dropdown
   → Choose: "CSV Import" (not jumia, matches header)
5. Click file input
   → Choose: PHASE_3_TEST_PRODUCTS.csv
   → File size should show ~1.2 KB
6. Click "Upload & Import" button
   → Loading spinner appears
   → Wait 2-3 seconds for upload
7. Success message appears:
   ✅ Toast: "Import started - 19 products queued"
   ✅ Batch ID shown (e.g., "550e8400-e29b-41d4-a716-446655440000")
   ✅ Page shows batch summary
8. Page auto-switches to "Staging Review" tab
   → Summary shows: "Pending Review: 19"
```

**Save for Later:**
- Batch ID: _______________________________________________
- Import time (for performance check): _______________

**Success Criteria:**
- ✅ No file upload errors
- ✅ Success toast appears
- ✅ Batch ID returned
- ✅ Page auto-switches to review tab
- ✅ Staging shows "Pending Review: 19"

---

### STEP 3: Pipeline Processing (10-15 seconds background)

**Purpose:** Let normalization/deduplication/analysis run

**Browser Steps:**
```
1. Stay on /import page (should be on Staging Review tab)
2. Notice status in summary:
   → Initially: refresh page or wait
   → Should see status changing: "normalizing" → "deduplicating" → "reviewing" → "staged"
3. After ~10-15 seconds:
   → Batch status shows "staged"
   → "Pending Review" count shows 19
   → "Avg Confidence" shows calculated percentage
4. If not ready, click refresh button (⟲) in summary
```

**Success Criteria:**
- ✅ Batch status reaches "staged"
- ✅ Pipeline completes in < 30 seconds
- ✅ No error messages in browser console

---

### STEP 4: Verify Import Database State (5 minutes)

**Purpose:** Confirm all data inserted correctly into database

**SQL Queries (Run in Supabase SQL Editor):**

```sql
-- Query 4.1: Verify batch created
SELECT id, source_name, status, total_records, normalized_records, created_at
FROM product_import_batches
WHERE source_name = 'csv_import'
ORDER BY created_at DESC LIMIT 1;

-- Save batch_id: _______________

-- Expected result:
-- id: [batch_id]
-- source_name: csv_import
-- status: staged
-- total_records: 19
-- normalized_records: 19

-- Query 4.2: Verify raw imports inserted
SELECT COUNT(*) as raw_import_count
FROM product_imports
WHERE batch_id = '[batch_id]';
-- Expected: 19

-- Query 4.3: Check raw data structure (sample fields)
SELECT 
  id,
  source_name,
  source_product_id,
  (raw_data->>'scraped_name') as product_name,
  (raw_data->>'listed_price')::int as price
FROM product_imports
WHERE batch_id = '[batch_id]'
LIMIT 5;

-- Expected: All rows have raw_data JSONB with complete product info

-- Query 4.4: Verify staging products
SELECT COUNT(*) as staging_count
FROM products_staging
WHERE batch_id = '[batch_id]';
-- Expected: 19

-- Query 4.5: Check staging data quality
SELECT
  product_id,
  normalized_name,
  brand,
  unit,
  listed_price,
  suggested_selling_price,
  confidence_score,
  review_status,
  has_critical_anomaly
FROM products_staging
WHERE batch_id = '[batch_id]'
ORDER BY confidence_score DESC
LIMIT 10;

-- Expected:
-- All 19 products listed
-- normalized_name lowercase (coca cola, sprite, etc)
-- brand extracted (Coca Cola, Sprite, Fanta, etc)
-- unit normalized (ml, l, g, kg, pcs)
-- confidence_score 60-100% range
-- has_critical_anomaly: true for 2 products, false for 17
```

**Success Criteria:**
- ✅ Batch created with status "staged"
- ✅ 19 raw imports saved with JSONB data
- ✅ 19 staging products created
- ✅ Names normalized (lowercase)
- ✅ Brands extracted correctly
- ✅ Units standardized
- ✅ Confidence scores calculated

---

### STEP 5: Verify Anomaly Detection (5 minutes)

**Purpose:** Confirm critical anomalies flagged correctly

**SQL Queries:**

```sql
-- Query 5.1: Count anomalies by severity
SELECT
  severity,
  COUNT(*) as count
FROM price_anomalies
WHERE batch_id = '[batch_id]'
GROUP BY severity
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END;

-- Expected:
-- critical: 2 (rice at 8 KES, salt at 999,999 KES)
-- warning: 0-3 (if any missing prices or brands)
-- info: 0+ (missing optional fields)

-- Query 5.2: View critical anomalies
SELECT
  pa.id,
  pa.anomaly_type,
  pa.severity,
  pa.message,
  ps.normalized_name,
  ps.listed_price
FROM price_anomalies pa
JOIN products_staging ps ON ps.product_id = pa.staging_product_id
WHERE pa.batch_id = '[batch_id]'
  AND pa.severity = 'critical'
ORDER BY pa.created_at;

-- Expected output:
-- Row 1: anomaly_type='outlier', message='Price KES 8 is below minimum...'
-- Row 2: anomaly_type='outlier', message='Price KES 999999 exceeds maximum...'

-- Query 5.3: Check staging products marked with critical
SELECT COUNT(*) as with_critical_anomaly
FROM products_staging
WHERE batch_id = '[batch_id]' AND has_critical_anomaly = true;
-- Expected: 2

-- Query 5.4: Verify suggested prices calculated
SELECT
  normalized_name,
  listed_price,
  suggested_selling_price,
  ROUND((suggested_selling_price::float / NULLIF(listed_price::float, 0))::numeric, 2) as markup
FROM products_staging
WHERE batch_id = '[batch_id]'
  AND suggested_selling_price IS NOT NULL
ORDER BY confidence_score DESC
LIMIT 10;

-- Expected: Most products have suggested = listed * 1.25 (25% markup)
-- Example: listed=150 → suggested=188
```

**Success Criteria:**
- ✅ Exactly 2 critical anomalies detected
- ✅ Critical anomalies labeled correctly (price bounds)
- ✅ 2 staging products marked has_critical_anomaly=true
- ✅ Suggested prices calculated (1.25x markup)

---

### STEP 6: Verify Deduplication (5 minutes)

**Purpose:** Confirm duplicate detection working

**SQL Queries:**

```sql
-- Query 6.1: Count deduplication matches
SELECT
  match_type,
  COUNT(*) as count,
  ROUND(AVG(confidence)::numeric, 0) as avg_confidence
FROM product_deduplications
WHERE batch_id = '[batch_id]'
GROUP BY match_type;

-- Expected:
-- fuzzy: 1+ matches (Coca Cola duplicate should fuzzy match at 90%+)
-- deterministic: 0-2 (unlikely in test set)

-- Query 6.2: View dedup matches
SELECT
  pd.staging_product_id,
  pd.match_type,
  pd.confidence,
  pd.reason,
  ps.normalized_name,
  ps.listed_price
FROM product_deduplications pd
JOIN products_staging ps ON ps.product_id = pd.staging_product_id
WHERE pd.batch_id = '[batch_id]'
ORDER BY pd.confidence DESC;

-- Expected: Should see Coca Cola flagged as potential fuzzy match 
-- between JUMIA_COCA_001 and JUMIA_COCA_002

-- Query 6.3: Check if Coca duplicate flagged
SELECT COUNT(*) as coca_duplicates
FROM product_deduplications
WHERE batch_id = '[batch_id]'
  AND reason LIKE '%coca%'
  AND match_type = 'fuzzy';

-- Expected: 1+ (should detect similarity between duplicate Coca entries)
```

**Success Criteria:**
- ✅ Deduplication completed
- ✅ Coca Cola duplicate detected as fuzzy match (>85% similarity)
- ✅ All matches recorded with confidence scores

---

### STEP 7: Review Products in UI (5 minutes)

**Purpose:** Admin review interface showing all data correctly

**Browser Steps:**
```
1. On /import page, "Staging Review" tab (should be active)
2. Scroll table to see product list
3. Verify columns visible:
   ✅ Product name (normalized)
   ✅ Brand
   ✅ Unit
   ✅ Listed Price (KES)
   ✅ Suggested Price (highlighted button to edit)
   ✅ Status badge
   ✅ Issue icons (red, yellow, or none)
   ✅ Action menu (⋮)

4. Look for CRITICAL ISSUES (red warning icon):
   - Should find CSV_RICE (8 KES) → red flag
   - Should find CSV_SALT (999,999 KES) → red flag
   
5. Hover over red icon for CSV_RICE:
   → Tooltip: "Price KES 8 is below minimum threshold..."
   
6. Hover over red icon for CSV_SALT:
   → Tooltip: "Price KES 999999 exceeds maximum threshold..."

7. Look for DUPLICATES (yellow warning icon):
   - Should see Coca Cola entries flagged with yellow
   
8. Hover over yellow icon:
   → Tooltip: "Potential Duplicates: fuzzy (90%)"

9. Summary metrics should show:
   - Pending Review: 19
   - Avg Confidence: 70-80%
   - Critical Issues: 2
   - (If duplicates showing) Potential Duplicates: 1+
```

**Success Criteria:**
- ✅ Table loads with 19 products
- ✅ Critical anomalies clearly marked with red icons
- ✅ Potential duplicates marked with yellow icons
- ✅ Tooltips show detailed error messages
- ✅ All product data visible and correct

---

### STEP 8: Admin Approval/Rejection (5 minutes)

**Purpose:** Test approval workflow with safety gates

**Browser Actions:**

```
PHASE A: REJECT CRITICAL ANOMALIES
1. Find CSV_RICE_ANOMALY_001 (8 KES product)
2. Click ⋮ menu on right
3. Click "Reject"
   → Dialog: "Reject Product?"
4. Enter reason: "Price too low - clearly an error"
5. Click "Reject" button
   → Toast: "Product rejected"
   → Row status changes to "rejected"

6. Find CSV_SALT_ANOMALY_001 (999,999 KES product)
7. Click ⋮ menu
8. Click "Reject"
9. Enter reason: "Price exceeds maximum reasonable value"
10. Click "Reject" button
    → Toast: "Product rejected"
    → Status: "rejected"

PHASE B: APPROVE VALID PRODUCTS (Approve 10-12 good ones)
   (Don't approve all 17 - leave some as pending for test variation)

11. Find Coca Cola 500ml (150 KES) - good price
12. Click ⋮
13. Click "Approve"
    → Dialog: "Approve Product?"
    → Text: "Product is ready for publishing"
14. Click "Approve"
    → Toast: "Product approved"
    → Status: "approved"

15. Find Sprite 500ml (150 KES) - approve
16. Find Blue Band 500g (180 KES) - approve
17. Find Brookside Milk 500ml (95 KES) - approve
18. Find Nescafe 50g (250 KES) - approve
19. Find Bidco Oil 1L (320 KES) - approve
20. Find Royco Cubes (45 KES) - approve
21. Find White Bread (50 KES) - approve
22. Find Blue Band (180 KES) - approve
23. Find Milly Sugar 2kg (280 KES) - approve

(Stop at ~10-12 approvals, leave 4-5 as "pending" for realism)

RESULT AFTER THIS STEP:
   - 2 rejected (anomalies)
   - 10-12 approved (good products)  
   - 5-7 pending (to test partial batch publish)
   - Summary should show: "Approved: 10-12"
```

**Success Criteria:**
- ✅ Cannot approve products with critical anomalies
- ✅ Can reject with reason
- ✅ Can approve good products
- ✅ Status badges update in table
- ✅ Summary count increases with approvals

---

### STEP 9: Verify Approved Products in Database (5 minutes)

**Purpose:** Confirm approval state saved correctly

**SQL Queries:**

```sql
-- Query 9.1: Count by review status
SELECT
  review_status,
  COUNT(*) as count
FROM products_staging
WHERE batch_id = '[batch_id]'
GROUP BY review_status
ORDER BY count DESC;

-- Expected:
-- approved: 10-12
-- rejected: 2
-- pending: 5-7

-- Query 9.2: Verify no approved products have critical anomalies
SELECT COUNT(*) as bad_approvals
FROM products_staging ps
WHERE ps.batch_id = '[batch_id]'
  AND ps.review_status = 'approved'
  AND EXISTS (
    SELECT 1 FROM price_anomalies pa
    WHERE pa.staging_product_id = ps.product_id
      AND pa.severity = 'critical'
  );

-- Expected: 0 (should not be able to approve with critical)

-- Query 9.3: Get approved product details
SELECT
  product_id,
  normalized_name,
  suggested_selling_price,
  review_status,
  approved_at,
  approved_by
FROM products_staging
WHERE batch_id = '[batch_id]'
  AND review_status = 'approved'
ORDER BY confidence_score DESC;

-- Expected:
-- All 10-12 products listed
-- suggested_selling_price populated
-- review_status = 'approved'
-- approved_at = current timestamp
-- approved_by = user UUID
```

**Success Criteria:**
- ✅ 2 products rejected
- ✅ 10-12 products approved
- ✅ 5-7 products pending
- ✅ No approved products have critical anomalies
- ✅ Approval metadata recorded

---

### STEP 10: Publish to Live (5 minutes)

**Purpose:** Move approved products from staging to live products table

**Browser Steps:**
```
1. Still on Staging Review tab
2. Check summary box
   → Should show: "Approved: 10-12"
   → Green button: "Publish 10-12 Products"
3. Click "Publish 10-12 Products" button
   → Dialog opens: "Publish to Live Products?"
   → Shows: "Ready to publish: 10-12 products"
   → Warning: "This action cannot be undone"
   → Note: "Approved products move to live"

4. Review the warnings (safety gates):
   ✅ "Approved products move to live products table"
   ✅ "New products are created, duplicates are updated"
   ✅ "POS can immediately sell these products"
   ✅ "Current live prices not overwritten for existing products"

5. Click "Publish 10-12 Products" button in dialog
   → Loading spinner
   → Wait 2-3 seconds

6. Success message appears:
   ✅ Toast: "Published! 10-12 products published to live catalog"
   ✅ Summary updates: "Published: 10-12"
   ✅ Status badges change to "published" in table

7. Summary now shows:
   - Pending Review: 0 or fewer
   - Approved: 0
   - Published: 10-12
```

**Success Criteria:**
- ✅ Publish button active when approved > 0
- ✅ Dialog warns about action
- ✅ Success toast appears
- ✅ Summary updated
- ✅ Table status updated to "published"

---

### STEP 11: Verify Published Products in Database (5 minutes)

**Purpose:** Confirm products created in live products table

**SQL Queries:**

```sql
-- Query 11.1: Check staging marked as published
SELECT COUNT(*) as published_count
FROM products_staging
WHERE batch_id = '[batch_id]' AND review_status = 'published';
-- Expected: 10-12

-- Query 11.2: Verify live products created
SELECT COUNT(*) as new_live_products
FROM products
WHERE source_id IN ('jumia', 'nairobi_wholesalers', 'direct_supplier', 'csv_import')
  AND status = 'active'
  AND created_at > NOW() - INTERVAL '5 minutes';
-- Expected: 10-12 (newly created)

-- Query 11.3: View published products in live table
SELECT
  id,
  name,
  brand,
  unit,
  cost_price,
  selling_price,
  status,
  source_id,
  source_product_id,
  approved_at
FROM products
WHERE source_id = 'csv_import'
  AND status = 'active'
ORDER BY created_at DESC;

-- Expected: Shows 6-9 csv_import products (subset of batch)
-- All fields populated correctly

-- Query 11.4: Check price history recorded
SELECT COUNT(*) as price_history_entries
FROM product_price_history
WHERE created_at > NOW() - INTERVAL '5 minutes';
-- Expected: 10-12 (one per published product)

-- Query 11.5: Verify existing products not overwritten
SELECT COUNT(*) as total_active_products
FROM products
WHERE status = 'active';
-- Expected: [baseline_from_step1] + 10-12

-- Query 11.6: Check barcode integrity
SELECT
  normalized_name,
  barcode,
  source_product_id
FROM products_staging ps
WHERE batch_id = '[batch_id]'
  AND review_status = 'published'
  AND EXISTS (
    SELECT 1 FROM products p
    WHERE p.source_product_id = ps.source_product_id
  )
ORDER BY ps.normalized_name;

-- Expected: All barcodes preserved from CSV
```

**Success Criteria:**
- ✅ 10-12 staging products marked "published"
- ✅ 10-12 new products created in products table
- ✅ All fields populated (name, brand, unit, price, source info)
- ✅ Price history entries created
- ✅ No existing products overwritten
- ✅ Total product count increased by 10-12

---

### STEP 12: Search in POS (5 minutes)

**Purpose:** Verify newly imported products searchable in POS

**Browser Steps:**
```
1. Open new tab: http://localhost:3000/pos
2. Login if required
3. On POS main screen, at top there should be product search
4. Search for "coca cola"
   → Should find: "Coca Cola Original 500ml" (if approved and published)
   → Shows source: csv_import or jumia
   → Price: ~188 KES (1.25x 150 markup)

5. Click on product
   → Details show: name, price, category
   → Can add to cart

6. Search for "sprite"
   → Should find: "Sprite Lemon 500ml"
   → Price should show suggested_selling_price

7. Search for "rice"
   → Should NOT find: "Generic White Rice 5kg" (was rejected for 8 KES anomaly)
   → Anomalous products not in POS ✓

8. Search for "salt"
   → Should NOT find salt anomaly product (rejected)

9. Search for "breadmaker" or "bread"
   - Should find white bread if it was approved

10. Try adding approved product to cart:
    - Click product
    - Enter qty: 2
    - Click "Add to Cart"
    → Toast: "Added 2 x Product Name to cart"
    → Cart count increases

11. Take cart to checkout (optional):
    - Review items
    - Select payment method
    - Confirm
    → Receipt shows imported product with correct name + price
```

**Success Criteria:**
- ✅ Approved/published products searchable by name
- ✅ Anomalous products NOT in POS search
- ✅ Rejected products NOT in POS
- ✅ Can add to cart
- ✅ Prices correct (suggested_selling_price)
- ✅ Categories and metadata display correctly

---

### STEP 13: Final Verification Summary (5 minutes)

**Purpose:** Comprehensive check that everything worked

**Run All These SQL Queries Together:**

```sql
-- 13.1: Full import pipeline summary
SELECT
  'Product Import Test Summary' as report_type,
  (SELECT COUNT(*) FROM product_import_batches WHERE source_name = 'csv_import') as batches_created,
  (SELECT COUNT(*) FROM product_imports WHERE batch_id = '[batch_id]') as raw_imports,
  (SELECT COUNT(*) FROM products_staging WHERE batch_id = '[batch_id]') as staging_normalized,
  (SELECT COUNT(*) FROM products_staging WHERE batch_id = '[batch_id]' AND has_critical_anomaly = true) as critical_anomalies,
  (SELECT COUNT(*) FROM products_staging WHERE batch_id = '[batch_id]' AND review_status = 'approved') as approved_products,
  (SELECT COUNT(*) FROM products_staging WHERE batch_id = '[batch_id]' AND review_status = 'rejected') as rejected_products,
  (SELECT COUNT(*) FROM products_staging WHERE batch_id = '[batch_id]' AND review_status = 'published') as published_products,
  (SELECT COUNT(*) FROM products WHERE source_id = 'csv_import' AND created_at > NOW() - INTERVAL '10 minutes') as live_products_created;

-- Expected output (single row with all counts):
-- batches_created: 1
-- raw_imports: 19
-- staging_normalized: 19
-- critical_anomalies: 2
-- approved_products: 10-12
-- rejected_products: 2
-- published_products: 10-12
-- live_products_created: 10-12

-- 13.2: Check no data loss
SELECT COUNT(*) as total_live_products FROM products WHERE status = 'active';
-- Expected: [baseline + 10-12]

-- 13.3: Verify audit trail (price history)
SELECT
  DATE_TRUNC('minute', created_at)::text as created_minute,
  COUNT(*) as entries
FROM product_price_history
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY created_minute DESC;
-- Expected: Multiple entries from publish time

-- 13.4: POS searchability check
SELECT COUNT(*) as searchable_imports
FROM products
WHERE source_id IN ('csv_import', 'jumia', 'nairobi_wholesalers')
  AND status = 'active'
  AND created_at > NOW() - INTERVAL '10 minutes';
-- Expected: 10-12 (matches published count)

-- 13.5: No orphaned records
SELECT
  'staging_without_batch' as issue_type,
  COUNT(*) as count
FROM products_staging
WHERE batch_id NOT IN (SELECT id FROM product_import_batches)

UNION ALL

SELECT
  'imports_without_batch',
  COUNT(*)
FROM product_imports
WHERE batch_id NOT IN (SELECT id FROM product_import_batches);

-- Expected: All counts = 0 (no orphaned records)
```

**Expected Output:**
```
batches_created    1
raw_imports        19
staging_normalized 19
critical_anomalies 2
approved_products  10-12
rejected_products  2
published_products 10-12
live_products_created 10-12

total_live_products [baseline + 10-12]  ← Confirmed
orphaned_records  0                      ← Confirmed
```

**Success Criteria:**
- ✅ 1 batch created
- ✅ 19 raw imports saved
- ✅ 19 staging products created
- ✅ Exactly 2 critical anomalies
- ✅ 2 products rejected
- ✅ 10-12 products approved
- ✅ 10-12 products published
- ✅ 10-12 new live products created
- ✅ No data loss (product count = baseline + new)
- ✅ No orphaned records
- ✅ Price history entries created
- ✅ All products searchable in POS

---

## SUCCESS CRITERIA CHECKLIST

Before declaring Phase 3 pipeline VERIFIED, all must pass:

### Data Integrity ✅
- [ ] Baseline products unchanged
- [ ] 19 imports created
- [ ] 19 staging records created
- [ ] 2 critical anomalies detected + recorded
- [ ] 1+ deduplication matches detected (Coca Cola)
- [ ] Suggested prices calculated (all 19 products)
- [ ] Anomalies block approval (cannot approve with critical)

### Admin Workflow ✅
- [ ] Upload completes without errors
- [ ] Batch processes in < 30 seconds
- [ ] Staging UI loads with all 19 products
- [ ] Anomaly icons display correctly (red, yellow)
- [ ] Admin can approve good products
- [ ] Admin can reject bad products
- [ ] Rejected products NOT published
- [ ] Approved count in summary matches approvals

### Publishing ✅
- [ ] Publish button only enabled when approved > 0
- [ ] Dialog confirms action before publish
- [ ] 10-12 products successfully published
- [ ] Staging records marked "published"
- [ ] 10-12 new live products created
- [ ] Price history entries logged
- [ ] Existing products NOT overwritten
- [ ] Source tracking preserved

### POS Verification ✅
- [ ] Approved products searchable by name
- [ ] Rejected products NOT searchable
- [ ] Anomalous products NOT searchable
- [ ] Can add to cart
- [ ] Prices correct
- [ ] Receipt shows product name + price

### Audit Trail ✅
- [ ] All imports logged with batch_id
- [ ] All anomalies recorded with severity
- [ ] All deduplications recorded
- [ ] All rejections logged with reason
- [ ] All approvals logged with timestamp + user
- [ ] All publishes logged in price_history

---

## ROLLBACK PROCEDURE (If Needed)

If test fails at any step:

```sql
-- Option 1: Delete entire batch (if not yet published)
DELETE FROM products_staging WHERE batch_id = '[batch_id]';
DELETE FROM product_imports WHERE batch_id = '[batch_id]';
DELETE FROM product_import_batches WHERE id = '[batch_id]';
DELETE FROM price_anomalies WHERE batch_id = '[batch_id]';
DELETE FROM product_deduplications WHERE batch_id = '[batch_id]';

-- Option 2: Delete only published products (if already live)
DELETE FROM products
WHERE source_id IN ('csv_import', 'jumia', 'nairobi_wholesalers', 'direct_supplier')
  AND created_at > NOW() - INTERVAL '30 minutes';

-- Then proceed to delete staged data
DELETE FROM products_staging WHERE batch_id = '[batch_id]';
-- ... etc
```

---

## EXPECTED TIMELINE

- **Step 1 (Baseline):** 2 min
- **Step 2 (Upload):** 3 min
- **Step 3 (Processing):** 15 sec (async)
- **Step 4 (Verify Import DB):** 2 min
- **Step 5 (Verify Anomalies):** 2 min
- **Step 6 (Verify Dedup):** 2 min
- **Step 7 (Review UI):** 3 min
- **Step 8 (Approve/Reject):** 5 min
- **Step 9 (Verify Approvals):** 2 min
- **Step 10 (Publish):** 3 min
- **Step 11 (Verify Published):** 3 min
- **Step 12 (POS Search):** 3 min
- **Step 13 (Final Check):** 2 min

**Total: ~40-50 minutes**

---

## TROUBLESHOOTING

| Issue | Check | Solution |
|-------|-------|----------|
| Upload fails | API /api/import/csv returns error | Check browser console for error, verify CSV format |
| Products not appearing in staging | Check batch status | Refresh page, wait 30 sec for async processing |
| Anomalies not detected | Query price_anomalies table | Verify anomaly_thresholds set correctly in code |
| Cannot approve | Check for critical anomalies | Reject anomalies first |
| Publish fails | Check for non-approved products | Only approved products can publish |
| Products not in POS | Check status='active' in live | Verify published successfully via SQL |
| Duplicate count mismatch | Check dedup logic | Review levenshtein similarity calculation |

---

**READY FOR CONTROLLED TEST RUN**

All steps, SQL checks, and success criteria defined.

Proceed with test when ready. Document results below for Phase 4 planning.

