# PHASE 3 TESTING & VERIFICATION GUIDE
# CSV Ingestion Pipeline Implementation

---

## QUICK REFERENCE

**New Features:**
- CSV import pipeline (CSV → imports → staging → live)
- Deterministic + fuzzy deduplication
- Anomaly detection (out-of-range prices, missing data)
- Admin staging review workflow
- Publish-to-live with approval gates

**Key Files Created:**
- `lib/csv-importer.ts` - CSV parsing & import
- `lib/product-normalizer.ts` - Name/unit/brand normalization
- `lib/product-deduplicator.ts` - Duplicate detection
- `lib/pricing-analyzer.ts` - Price anomalies & suggestions
- `lib/staging-actions.ts` - Server actions for review/publish
- `app/api/import/csv/route.ts` - CSV upload API endpoint
- `components/import/csv-upload-dialog.tsx` - Upload UI
- `components/import/staging-review-table.tsx` - Review table
- `components/import/publish-dialog.tsx` - Publish confirmation
- `app/(dashboard)/import/page.tsx` - Admin import page

**Safety Guarantees:**
- ✅ Do NOT publish directly - imports → staging only
- ✅ Do NOT overwrite live prices without approval
- ✅ Do NOT auto-publish - admin approval required
- ✅ Critical anomalies block approval
- ✅ Complete audit trail maintained

---

## CSV SAMPLE DATA

### Example CSV File Format

Save as `products.csv`:

```csv
source_name,source_product_id,source_url,scraped_name,brand,pack_size,unit,category,listed_price,currency,barcode,image_url
jumia,JUMIA001,https://jumia.co.ke/coca-cola-500ml,Coca Cola 500ml,Coca Cola,500,ml,Beverages,150,KES,5000112345678,https://example.com/coca-500.jpg
jumia,JUMIA002,https://jumia.co.ke/sprite-2l,Sprite 2L,Sprite,2,l,Beverages,300,KES,5000112345679,https://example.com/sprite-2l.jpg
jumia,JUMIA003,https://jumia.co.ke/fanta-350ml,Fanta Orange 350ml,Fanta,350,ml,Beverages,120,KES,5000112345680,https://example.com/fanta-350.jpg
nairobi_wholesalers,NW001,https://nw.co.ke/eddoe-rice,Eddoe Rice 2kg,Eddoe,2,kg,Grains,450,KES,5000112345681,https://example.com/rice-2kg.jpg
nairobi_wholesalers,NW002,https://nw.co.ke/kimbo-maize,Kimbo Maize Flour 1kg,Kimbo,1,kg,Grains,80,KES,5000112345682,https://example.com/maize-1kg.jpg
direct_supplier,SUP001,,Local Tomato Paste 200g,Local Brand,200,g,Condiments,65,KES,5000112345683,
csv_import,CSV001,,Bread Loaf White 500g,Bakery Brand,500,g,Bakery,50,KES,,
```

### Minimal Required Fields

CSV **must** have at least these 3 columns:
1. `source_name` - Source identifier (e.g., "jumia", "nairobi_wholesalers")
2. `source_product_id` - Unique ID from that source
3. `scraped_name` - Product name

### Optional Columns

- `source_url` - Link to product on source website
- `brand` - Product brand (auto-extracted if not provided)
- `pack_size` - Quantity in package (e.g., "500", "2")
- `unit` - Unit of measurement (ml, l, g, kg, pcs)
- `category` - Product category
- `listed_price` - Price from source (KES, integer)
- `currency` - Currency code (default: KES)
- `barcode` - Product barcode EAN/UPC
- `image_url` - Product image URL

---

## EXACT IMPORT FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CSV UPLOAD                                                   │
│    User selects CSV file + data source name                     │
│    File size validated (max 10MB)                               │
│    File type validated (.csv only)                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CSV PARSING                                                  │
│    Parse CSV with PapaParse                                     │
│    Validate required fields: source_name, source_product_id,    │
│    scraped_name                                                 │
│    Convert listed_price to integer (KES)                        │
│    Collect parse errors (skip invalid rows)                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. IMPORT TO DATABASE (product_imports)                         │
│    Create product_import_batches record                         │
│    Status: "normalizing"                                        │
│    Insert raw CSV rows into product_imports table               │
│    Store entire row as JSONB in raw_data field                  │
│    Return batch_id + counts                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼ (Async background processing)
│
└─────────────────────────────────────────────────────────────────┐
│ 4. NORMALIZATION (product_normalizer.ts)                        │
│    For each raw import:                                         │
│      - Normalize product name (lowercase, trim, remove special)  │
│      - Extract brand if not provided (pattern matching)         │
│      - Normalize unit (ml→ml, liters→l, gram→g, kg→kg, etc)    │
│      - Calculate confidence score (0-100)                       │
│    Insert normalized products into products_staging             │
│    Status: "pending"                                            │
│    Status: "pending"                                            │
│    Update batch: status="deduplicating"                         │
└──────────────────────┬──────────────────────────────────────────┘
              │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. DEDUPLICATION (product-deduplicator.ts)                      │
│    For each staging product:                                    │
│      Deterministic match: exact SKU, normalized name+brand+unit │
│      Fuzzy match: Levenshtein similarity > 85%                  │
│    If deterministic match: mark as "suspect_duplicate"          │
│    If fuzzy match: flag for manual review                       │
│    Record all matches in product_deduplications (audit)         │
│    Update batch: status="reviewing"                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. ANOMALY DETECTION (pricing-analyzer.ts)                      │
│    For each staging product:                                    │
│      - Check price < 10 KES → CRITICAL                          │
│      - Check price > 500K KES → CRITICAL                        │
│      - Check missing price → WARNING                            │
│      - Check missing brand → INFO                               │
│      - Check price > 5x median → WARNING                        │
│    Calculate suggested selling price (listed_price * 1.25)      │
│    Record anomalies in price_anomalies table                    │
│    Update staging: has_critical_anomaly, suggested_selling_price│
│    Update batch: status="staged"                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. ADMIN REVIEW (staging-review-table.tsx)                      │
│    User navigates to /import page                               │
│    Admin selects batch to review                                │
│    Views all staging products with:                             │
│      - Product name + confidence score                          │
│      - Listed vs suggested price                                │
│      - Critical anomalies (highlighted in red)                  │
│      - Potential duplicates (highlighted in yellow)             │
│    Admin can:                                                   │
│      - Approve product → status="approved"                      │
│      - Reject product → status="rejected"                       │
│      - Override suggested price                                 │
│    Cannot approve if critical anomalies exist                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. PUBLISH TO LIVE (publishBatchToLive)                         │
│    Admin clicks "Publish X Products"                            │
│    System:                                                      │
│      - Finds all approved products from batch                   │
│      - For each approved product:                               │
│        * Check if product exists in live (source_id+source_product_id)
│        * If exists: UPDATE with new metadata (keep local price) │
│        * If not exists: INSERT as new product                   │
│      - Record in product_price_history (audit)                  │
│      - Mark staging: status="published"                         │
│      - Update batch: status="published"                         │
│    POS can now search/sell these products                       │
└──────────────────────────────────────────────────────────────────┘

SAFETY GATES:
├─ CSV Upload: Admin-only (/api/import/csv checks role)
├─ Normalization: Automatic, safely non-destructive
├─ Deduplication: Flags for review, doesn't delete
├─ Anomaly Detection: Blocks approval if CRITICAL
├─ Admin Review: Shows all issues clearly
├─ Publish: Explicit button click required
└─ Live Publishing: Preserves existing prices, doesn't overwrite
```

---

## BROWSER TEST STEPS (Admin)

### Test 1: Upload CSV and Process

**Steps:**
```
1. Log in as admin user
2. Navigate to http://localhost:3000/import
3. Click "Import CSV" button
4. Select "CSV Import" from source dropdown
5. Choose the sample products.csv file
6. Click "Upload & Import"
7. Wait for success message
8. Should see batch ID in success toast
```

**Expected Result:**
- ✅ Toast shows "Import started - X products queued"
- ✅ Page shows batch summary with "Pending Review" count
- ✅ Tab switches to "Staging Review" automatically
- ✅ Status shows "normalizing → deduplicating → reviewing → staged"

### Test 2: Review Staging Products

**Steps:**
```
1. After CSV upload completes, you're on Staging Review tab
2. Scroll through the review table
3. Find product with critical anomaly (red alert icon)
4. Hover over alert icons to see detailed messages
5. Look for "Pending Review" products
6. Click "Approve" on valid products
```

**Expected Result:**
- ✅ Table shows all imported products
- ✅ Products with price < 10 or > 500K show CRITICAL flag
- ✅ Products with missing prices show WARNING
- ✅ Badge matches review status: "pending", "approved", "rejected"
- ✅ Can click "Approve" for good products
- ✅ Cannot approve with critical anomalies

### Test 3: Override Suggested Price

**Steps:**
```
1. Find a product with suggested_selling_price
2. Click the $ icon in "Suggested Price" column
3. Edit price to different value
4. Click "Save"
5. Verify status changed to "pending"
```

**Expected Result:**
- ✅ Price field becomes editable
- ✅ Save button appears
- ✅ Price updates in table
- ✅ Status resets to "pending"

### Test 4: Bulk Approve and Publish

**Steps:**
```
1. Click "Approve" on 3-5 good products
2. Watch "Approved" counter increase in summary
3. When ready, click "Publish X Products" button
4. Review dialog shows count of products
5. Click "Publish X Products" in dialog
6. Wait for green success message
```

**Expected Result:**
- ✅ Summary shows approved count
- ✅ Publish button enabled when approved > 0
- ✅ Dialog shows what will happen
- ✅ Success message shows published + updated counts
- ✅ Products moved to live_products table

### Test 5: Verify POS Still Works

**Steps:**
```
1. Open POS in different tab (http://localhost:3000/pos)
2. Search for "Coca Cola" (from imports)
3. Should find newly imported product
4. Add to cart
5. Complete sale
6. Check receipt shows correct product name + price
```

**Expected Result:**
- ✅ POS search finds newly imported products
- ✅ Can add to cart
- ✅ Checkout completes
- ✅ Receipt shows imported product
- ✅ Inventory decreases
- ✅ Sales history records transaction

### Test 6: Reject Product

**Steps:**
```
1. Review a staging product
2. Click menu (⋮)
3. Select "Reject"
4. Enter rejection reason in dialog
5. Confirm
```

**Expected Result:**
- ✅ Dialog appears for rejection reason
- ✅ Product marked as "rejected"
- ✅ Cannot approve after rejection
- ✅ Reason stored for audit

---

## EXACT SQL CHECKS

### Pre-Import Verification

```sql
-- Check that products_import, products_staging tables exist
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('product_imports', 'products_staging')
  AND table_type = 'BASE TABLE';
-- Expected: 2

-- Verify no data in staging (fresh state)
SELECT COUNT(*) as staging_count FROM products_staging;
-- Expected: 0

-- Verify current product count (baseline)
SELECT COUNT(*) as baseline_products FROM products WHERE status = 'active';
-- Save this number: _______________
```

### Post-Import Verification (Raw Data)

```sql
-- Check import batch created
SELECT COUNT(*) as batch_count FROM product_import_batches;
-- Expected: 1+

-- Check raw imports inserted (matches CSV rows)
SELECT COUNT(*) as raw_import_count FROM product_imports;
-- Expected: [batch_total_records]

-- Verify raw data JSONB fields populated
SELECT COUNT(*) as with_data
FROM product_imports
WHERE raw_data IS NOT NULL AND raw_data != 'null'::jsonb;
-- Expected: [same as raw_import_count]

-- Check batch status progressed
SELECT id, status, total_records, normalized_records
FROM product_import_batches
ORDER BY created_at DESC LIMIT 1;
-- Expected: status should be "staged" after async processing
```

### Post-Normalization Verification

```sql
-- Check staging products created
SELECT COUNT(*) as staging_count FROM products_staging;
-- Expected: [number of valid CSV rows]

-- Verify normalized names
SELECT product_id, normalized_name, brand, unit, confidence_score
FROM products_staging
LIMIT 5;
-- Check: names are lowercase, brands detected, units normalized

-- Count products by review status
SELECT review_status, COUNT(*) as count
FROM products_staging
GROUP BY review_status
ORDER BY count DESC;
-- Expected: mostly "pending", some "suspect_duplicate"

-- Check confidence scores calculated
SELECT
  MIN(confidence_score) as min_score,
  AVG(confidence_score) as avg_score,
  MAX(confidence_score) as max_score,
  COUNT(*) as total
FROM products_staging;
-- Expected: min > 0, avg 60+, max 100
```

### Deduplication Verification

```sql
-- Check deduplication records created
SELECT COUNT(*) as dedup_count FROM product_deduplications;
-- Expected: count > 0 if matches found

-- View potential duplicates
SELECT
  staging_product_id,
  match_type,
  confidence,
  reason,
  action
FROM product_deduplications
ORDER BY confidence DESC
LIMIT 10;
-- Check: deterministic marked "flagged", fuzzy marked "flagged"

-- Count by match type
SELECT match_type, COUNT(*) as count, AVG(confidence) as avg_confidence
FROM product_deduplications
GROUP BY match_type;
-- Example: deterministic 2, fuzzy 5, avg 87
```

### Anomaly Detection Verification

```sql
-- Check anomalies recorded
SELECT COUNT(*) as anomaly_count FROM price_anomalies;
-- Expected: count > 0

-- View critical anomalies (blockers)
SELECT
  staging_product_id,
  anomaly_type,
  severity,
  message,
  created_at
FROM price_anomalies
WHERE severity = 'critical'
ORDER BY created_at DESC;
-- Check: prices < 10 or > 500K flagged

-- Count by severity
SELECT severity, COUNT(*) as count
FROM price_anomalies
GROUP BY severity
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END;
-- Example: critical 1, warning 3, info 2

-- Check suggested prices calculated
SELECT
  product_id,
  normalized_name,
  listed_price,
  suggested_selling_price,
  (suggested_selling_price::float / NULLIF(listed_price, 0))::numeric(5,2) as markup_ratio
FROM products_staging
WHERE suggested_selling_price IS NOT NULL
LIMIT 10;
-- Expected: markup between 1.1 and 1.5 (10-50%)
```

### Pre-Publish Verification

```sql
-- Count products by review status before publish
SELECT
  review_status,
  COUNT(*) as count,
  AVG(suggested_selling_price) as avg_price
FROM products_staging
WHERE batch_id = '[BATCH_ID]'
GROUP BY review_status;
-- Expected: approved=[count], pending/rejected/etc

-- Check critical anomalies on approved products
SELECT COUNT(*) as bad_approvals
FROM products_staging ps
WHERE ps.batch_id = '[BATCH_ID]'
  AND ps.review_status = 'approved'
  AND EXISTS (
    SELECT 1 FROM price_anomalies pa
    WHERE pa.staging_product_id = ps.product_id
      AND pa.severity = 'critical'
  );
-- Expected: 0 (should not be able to approve with critical issues)
```

### Post-Publish Verification

```sql
-- Check live products increased
SELECT COUNT(*) as new_total FROM products WHERE status = 'active';
-- Expected: [baseline] + [published count]

-- Verify published products in live table
SELECT COUNT(*) as published_in_live
FROM products
WHERE source_id IS NOT NULL
  AND source_product_id IS NOT NULL
ORDER BY approved_at DESC
LIMIT 20;
-- Check: source_id and source_product_id are populated

-- Verify staging marked as published
SELECT COUNT(*) as published_count
FROM products_staging
WHERE batch_id = '[BATCH_ID]'
  AND review_status = 'published';
-- Expected: [published count]

-- Check price history recorded
SELECT COUNT(*) as history_entries
FROM product_price_history
WHERE created_at > NOW() - INTERVAL '10 minutes';
-- Expected: [published count] (one entry per published product)

-- Verify no live prices overwritten incorrectly
SELECT
  ps.normalized_name,
  ps.suggested_selling_price as new_price,
  p.selling_price as live_price,
  CASE
    WHEN p.selling_price != ps.suggested_selling_price THEN 'KEPT EXISTING'
    ELSE 'UPDATED'
  END as action
FROM products_staging ps
JOIN products p ON p.source_id = ps.source_name
  AND p.source_product_id = ps.source_product_id
WHERE ps.batch_id = '[BATCH_ID]'
  AND ps.review_status = 'published'
LIMIT 10;
-- Check: existing products mostly have original price preserved
```

### Complete Audit Trail

```sql
-- Full import pipeline for a batch
SELECT
  'Batch' as stage,
  COUNT(*) as count,
  status as detail
FROM product_import_batches
WHERE id = '[BATCH_ID]'
GROUP BY status

UNION ALL

SELECT
  'Raw Imports',
  COUNT(*),
  NULL
FROM product_imports
WHERE batch_id = '[BATCH_ID]'

UNION ALL

SELECT
  'Normalized',
  COUNT(*),
  NULL
FROM products_staging
WHERE batch_id = '[BATCH_ID]'

UNION ALL

SELECT
  'Duplicates Detected',
  COUNT(*),
  match_type
FROM product_deduplications
WHERE batch_id = '[BATCH_ID]'
GROUP BY match_type

UNION ALL

SELECT
  'Anomalies Detected',
  COUNT(*),
  severity
FROM price_anomalies
WHERE batch_id = '[BATCH_ID]'
GROUP BY severity

UNION ALL

SELECT
  'Published to Live',
  COUNT(*),
  NULL
FROM products_staging
WHERE batch_id = '[BATCH_ID]'
  AND review_status = 'published';

-- Expected output: Shows full pipeline with counts at each stage
```

---

## TROUBLESHOOTING

### "CSV Upload Returns 401 Unauthorized"

**Problem:** User is not authenticated or not admin

**Solution:**
```
1. Verify user is logged in
2. Check user.role = 'admin' in database
3. Verify session token is valid
```

### "Staging Products Not Appearing"

**Problem:** Normalization didn't run

**Solution:**
```sql
-- Check batch status
SELECT id, status, normalized_records FROM product_import_batches
ORDER BY created_at DESC LIMIT 1;

-- If status = 'normalizing':
-- - Background job may be running, wait 10-20 seconds
-- - Refresh page

-- If status = 'failed':
-- - Check application logs for error
-- - Delete batch and re-upload
```

### "Critical Anomalies Not Blocking Approval"

**Problem:** Price validation not working

**Solution:**
```sql
-- Verify price in staging
SELECT product_id, listed_price, suggested_selling_price
FROM products_staging
WHERE product_id = '[ID]';

-- Verify anomalies recorded
SELECT * FROM price_anomalies
WHERE staging_product_id = '[ID]'
  AND severity = 'critical';

-- If anomalies missing, price may have been valid
-- (price >= 10 AND price <= 500000)
```

### "Publish Fails"

**Problem:** Publish action rejected

**Solution:**
```sql
-- Check for critical anomalies blocking publish
SELECT COUNT(*) as blocking_anomalies
FROM price_anomalies pa
WHERE pa.severity = 'critical'
  AND EXISTS (
    SELECT 1 FROM products_staging ps
    WHERE ps.product_id = pa.staging_product_id
      AND ps.review_status = 'approved'
  );

-- If > 0, reject those products first
-- Then re-approve without critical issues
```

---

## FILES CHANGED SUMMARY

| File | Type | Purpose |
|------|------|---------|
| `lib/csv-importer.ts` | Service | CSV parsing and import to database |
| `lib/product-normalizer.ts` | Service | Normalize names, units, brands |
| `lib/product-deduplicator.ts` | Service | Detect duplicate products |
| `lib/pricing-analyzer.ts` | Service | Anomaly detection and price suggestions |
| `lib/staging-actions.ts` | Server Actions | Admin review and publish workflow |
| `app/api/import/csv/route.ts` | API | CSV upload endpoint |
| `components/import/csv-upload-dialog.tsx` | UI | Upload CSV file dialog |
| `components/import/staging-review-table.tsx` | UI | Review and approve products table |
| `components/import/publish-dialog.tsx` | UI | Publish confirmation dialog |
| `app/(dashboard)/import/page.tsx` | Page | Import management page |

---

**PHASE 3 STATUS: ✅ COMPLETE**

All CSV ingestion pipeline components implemented and ready for testing.

