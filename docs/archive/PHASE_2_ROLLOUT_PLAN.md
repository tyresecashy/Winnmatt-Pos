# PHASE 2 ROLLOUT & SAFETY PLAN
# Product Ingestion System - Database Migration
# Date: April 2026

## EXECUTIVE SUMMARY

This Phase 2 migration introduces 9 new tables and extends the products table with 11 new columns. All changes are **non-breaking** and **fully reversible**.

**Current live system**: Untouched. All existing POS, inventory, sales, reports operations continue without interruption.

**New system**: Staging area for imports. No data published to live products without explicit admin approval.

---

## ROLLOUT SEQUENCE

### STEP 1: PRE-MIGRATION BACKUP & VERIFICATION (5 minutes)

**Actions**:
```sql
-- Step 1a: Create snapshot of current products for rollback
CREATE TABLE products_backup_20260405 AS SELECT * FROM products;
CREATE TABLE inventory_backup_20260405 AS SELECT * FROM inventory;

-- Step 1b: Verify product count before
SELECT 'Before Migration' as checkpoint, COUNT(*) as product_count 
FROM products;

-- Step 1c: Verify no null selling prices in active products
SELECT COUNT(*) as null_selling_prices FROM products 
WHERE status = 'active' AND selling_price IS NULL;
-- Expected: 0

-- Step 1d: Verify inventory integrity
SELECT COUNT(*) as inventory_records FROM inventory;
SELECT COUNT(DISTINCT product_id) as products_with_inventory 
FROM inventory;
```

**Expected Output**:
- products_backup_20260405 created with all current products
- inventory_backup_20260405 created with all current inventory
- product_count = [your current total, e.g., 150]
- null_selling_prices = 0
- inventory_records = [total, e.g., 300]

**Rollback if any of the above fails**: Stop immediately, do not proceed.

---

### STEP 2: RUN MIGRATION SQL (10 minutes)

**Action**:
```sql
-- Copy entire db-product-ingestion-migration.sql and run in Supabase SQL Editor
-- This creates:
-- - 9 new tables (product_sources, product_import_batches, etc.)
-- - Adds 11 columns to products table
-- - Creates 15+ indexes
-- - Seeds normalization_units table
```

**Expected Behavior**:
- No errors
- All IF NOT EXISTS conditions satisfied
- Tables created in the public schema

**Verify Migration Success**:
```sql
-- Check all new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'product_sources', 'product_import_batches', 'product_imports',
    'products_staging', 'product_deduplications', 'product_price_history',
    'pricing_suggestions', 'price_anomalies', 'normalization_units'
  )
ORDER BY table_name;

-- Expected: 9 rows returned, all table names present

-- Check new columns on products table exist
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'products' 
  AND column_name IN (
    'brand', 'unit', 'barcode', 'image_url', 'status', 
    'source_product_id', 'source_id', 'suggested_selling_price',
    'approved_at', 'approved_by'
  )
ORDER BY column_name;

-- Expected: 10 rows (all new columns present)

-- Check normalization_units seed data
SELECT COUNT(*) as unit_count FROM normalization_units;
-- Expected: 4+ rows seeded

-- Verify existing products untouched
SELECT COUNT(*) as product_count FROM products;
-- Expected: Same as Step 1b

-- Verify all selling_prices still present
SELECT COUNT(*) as active_products FROM products 
WHERE status = 'active' AND selling_price IS NOT NULL;
-- Expected: Same as Step 1c
```

**Rollback Procedure if Migration Fails**:
```sql
-- Drop all new tables (if they exist)
DROP TABLE IF EXISTS price_anomalies;
DROP TABLE IF EXISTS pricing_suggestions;
DROP TABLE IF EXISTS product_price_history;
DROP TABLE IF EXISTS product_deduplications;
DROP TABLE IF EXISTS products_staging;
DROP TABLE IF EXISTS product_imports;
DROP TABLE IF EXISTS product_import_batches;
DROP TABLE IF EXISTS product_sources;
DROP TABLE IF EXISTS normalization_units;

-- Remove new columns from products (if migration was partially successful)
ALTER TABLE products DROP COLUMN IF EXISTS brand;
ALTER TABLE products DROP COLUMN IF EXISTS unit;
ALTER TABLE products DROP COLUMN IF EXISTS barcode;
ALTER TABLE products DROP COLUMN IF EXISTS image_url;
ALTER TABLE products DROP COLUMN IF EXISTS status;
ALTER TABLE products DROP COLUMN IF EXISTS source_product_id;
ALTER TABLE products DROP COLUMN IF EXISTS source_id;
ALTER TABLE products DROP COLUMN IF EXISTS suggested_selling_price;
ALTER TABLE products DROP COLUMN IF EXISTS approved_at;
ALTER TABLE products DROP COLUMN IF EXISTS approved_by;

-- Verify rollback successful
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'products' 
ORDER BY ordinal_position;
-- Should match pre-migration column count
```

---

### STEP 3: POST-MIGRATION VERIFICATION (5 minutes)

**Actions**:
```sql
-- Step 3a: Comprehensive Integrity Check
SELECT 
  'products' as table_name, COUNT(*) as row_count
FROM products
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL
SELECT 'stock_movements', COUNT(*) FROM stock_movements
ORDER BY table_name;

-- Step 3b: Verify Foreign Key Integrity
-- Products still exist for all inventory records
SELECT COUNT(*) as inventory_with_missing_product
FROM inventory i
LEFT JOIN products p ON p.id = i.product_id
WHERE p.id IS NULL;
-- Expected: 0

-- Step 3c: Verify Sales Integrity
SELECT COUNT(*) as sale_items_with_missing_product
FROM sale_items si
LEFT JOIN products p ON p.id = si.product_id
WHERE p.id IS NULL;
-- Expected: 0

-- Step 3d: Sample data integrity
SELECT 
  p.id, p.sku, p.name, p.selling_price, p.brand, p.unit, p.status,
  i.quantity
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
LIMIT 5;

-- Step 3e: Verify RLS is enabled on new tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('product_sources', 'products_staging')
  AND rowsecurity = TRUE;
-- Expected: All new tables have rowsecurity=true
```

**Expected Results**:
- All table counts match pre-migration
- inventory_with_missing_product = 0
- sale_items_with_missing_product = 0
- Sample data looks correct with new columns visible
- RLS enabled on all new tables

---

### STEP 4: APPLICATION DEPLOYMENT (15 minutes)

**Actions**:
1. Merge Phase 2 branch to main
2. Deploy new TypeScript types (lib/product-ingestion.types.ts)
3. Restart application server
4. Run application health check tests

**Application Change Checklist**:
- ✅ TypeScript types imported in any code that uses products
- ✅ Product dialog doesn't break (status column has default value)
- ✅ Sales/inventory operations don't change
- ✅ Existing POS functionality unchanged
- ✅ Reports still work (they ignore new columns)

**Health Check**:
```bash
# Test that existing POS still works
curl http://localhost:3000/api/products
# Expected: 200 OK, product list returned

# Test that sales still process
# (manual test via POS UI required)

# Test that reports still load
curl http://localhost:3000/api/dashboard/stats
# Expected: 200 OK, dashboard data returned
```

**Rollback if Application Issues Occur**:
1. Revert code to pre-Phase2 commit
2. Restart application
3. Database stays as-is (read-only operations only on new tables)
4. No data loss occurs
5. If needed to reverse database, use Step 2 rollback procedure

---

### STEP 5: STAGING AREA LOCK-IN (Configuration)

**Action**: Set environment variables to lock down ingestion:
```env
IMPORT_SYSTEM_ENABLED=false        # Don't accept imports yet
APPROVAL_ONLY_FOR_ADMIN=true       # Only admins can approve
AUTO_PUBLISH_DISABLED=true         # Require manual publish decision
ANOMALY_DETECTION_ENABLED=true     # Flag suspicious prices
PRICE_CHANGE_LOG_ENABLED=true      # Log all price changes
```

**Verify**:
```sql
-- Confirm staging tables are empty (no premature imports)
SELECT COUNT(*) as 
  (
    SELECT COUNT(*) as imports FROM product_imports
  )
  + (
    SELECT COUNT(*) as staging FROM products_staging
  )
  + (
    SELECT COUNT(*) as batches FROM product_import_batches
  ) as total_import_records;
-- Expected: 0
```

---

## ROLLBACK PLAN (If Needed After Step 3)

### Full Rollback (Database Only)

```sql
-- Complete reversal to pre-Phase2 state
BEGIN TRANSACTION;

-- Drop new tables (if needed)
DROP TABLE IF EXISTS price_anomalies CASCADE;
DROP TABLE IF EXISTS pricing_suggestions CASCADE;
DROP TABLE IF EXISTS product_price_history CASCADE;
DROP TABLE IF EXISTS product_deduplications CASCADE;
DROP TABLE IF EXISTS products_staging CASCADE;
DROP TABLE IF EXISTS product_imports CASCADE;
DROP TABLE IF EXISTS product_import_batches CASCADE;
DROP TABLE IF EXISTS product_sources CASCADE;
DROP TABLE IF EXISTS normalization_units CASCADE;

-- Remove new columns from products
ALTER TABLE products DROP COLUMN IF EXISTS brand;
ALTER TABLE products DROP COLUMN IF EXISTS unit;
ALTER TABLE products DROP COLUMN IF EXISTS barcode;
ALTER TABLE products DROP COLUMN IF EXISTS image_url;
ALTER TABLE products DROP COLUMN IF EXISTS status;
ALTER TABLE products DROP COLUMN IF EXISTS source_product_id;
ALTER TABLE products DROP COLUMN IF EXISTS source_id;
ALTER TABLE products DROP COLUMN IF EXISTS suggested_selling_price;
ALTER TABLE products DROP COLUMN IF EXISTS approved_at;
ALTER TABLE products DROP COLUMN IF EXISTS approved_by;

-- Remove new indexes (optional, but cleans up)
DROP INDEX IF EXISTS idx_products_status;
DROP INDEX IF EXISTS idx_products_barcode;
DROP INDEX IF EXISTS idx_products_source;
-- ... (remove all other new indexes)

COMMIT;

-- Verify rollback
SELECT COUNT(*) as product_count FROM products;
-- Should match pre-migration count

SELECT COUNT(*) as new_tables FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('product_sources', 'products_staging');
-- Expected: 0 (all new tables gone)
```

### Partial Rollback (Keep Schema, Empty Staging)

If you want to keep the new schema but clear all staging/import data:

```sql
-- Delete all import data (keep schema)
DELETE FROM price_anomalies;
DELETE FROM pricing_suggestions;
DELETE FROM product_price_history;
DELETE FROM product_deduplications;
DELETE FROM products_staging;
DELETE FROM product_imports;
DELETE FROM product_import_batches;
DELETE FROM product_sources;

-- Reset sequences
ALTER SEQUENCE product_sources_id_seq RESTART WITH 1;

-- Verify
SELECT COUNT(*) FROM product_import_batches;
-- Expected: 0

SELECT COUNT(*) FROM products;
-- Expected: Original count (untouched)
```

---

## SAFETY VERIFICATION QUERIES

Run these DURING and AFTER migration to confirm safety:

### Pre-Migration (Baseline)
```sql
-- Baseline metrics
WITH metrics AS (
  SELECT 
    'products' as metric, COUNT(*) as value FROM products
  UNION ALL
  SELECT 'inventory', COUNT(*) FROM inventory
  UNION ALL
  SELECT 'sales', COUNT(*) FROM sales
  UNION ALL
  SELECT 'sale_items', COUNT(*) FROM sale_items
  UNION ALL
  SELECT 'active_products', COUNT(*) FROM products WHERE status = 'active'
  UNION ALL
  SELECT 'products_with_selling_price', COUNT(*) FROM products WHERE selling_price > 0
)
SELECT * FROM metrics
ORDER BY metric;
```

### Post-Migration (Comparison)
```sql
-- Same query as above - should match exactly
WITH metrics AS (
  SELECT 
    'products' as metric, COUNT(*) as value FROM products
  UNION ALL
  SELECT 'inventory', COUNT(*) FROM inventory
  UNION ALL
  SELECT 'sales', COUNT(*) FROM sales
  UNION ALL
  SELECT 'sale_items', COUNT(*) FROM sale_items
  UNION ALL
  SELECT 'active_products', COUNT(*) FROM products WHERE status = 'active'
  UNION ALL
  SELECT 'products_with_selling_price', COUNT(*) FROM products WHERE selling_price > 0
)
SELECT * FROM metrics
ORDER BY metric;
```

### Integrity After Migration
```sql
-- No orphaned records
SELECT 
  'inventory_missing_product' as check_name, 
  COUNT(*) as issues
FROM inventory i
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = i.product_id)
UNION ALL
SELECT 'sale_items_missing_product', COUNT(*)
FROM sale_items si
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = si.product_id)
UNION ALL
SELECT 'stock_movements_missing_product', COUNT(*)
FROM stock_movements sm
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = sm.product_id)
ORDER BY issues DESC;

-- Expected: All checks show 0 issues
```

---

## MONITORING & ALERTS

### During Migration
- Monitor Supabase CPU: Should stay <50%
- Monitor connection count: Should stay <20
- Check error logs for migration failures

### After Migration
- Set up alerts for:
  - New tables receiving unexpected data (staging should be empty for now)
  - Product table changes via audit logs
  - Any failed approval transactions
  - Price anomalies detection (will be used in Phase 3)

---

## TIMELINE ESTIMATE

| Step | Task | Time | Cumulative |
|------|------|------|-----------|
| 1 | Pre-migration backup & verification | 5 min | 5 min |
| 2 | Run migration SQL | 10 min | 15 min |
| 3 | Post-migration verification | 5 min | 20 min |
| 4 | Application deployment & testing | 15 min | 35 min |
| 5 | Configuration & lock-in | 5 min | 40 min |
| **TOTAL** | | | **~40 minutes** |

**Recommended**: Deploy during low-traffic window (early morning or late evening).

---

## SUCCESS CRITERIA

✅ Phase 2 is complete when:
1. All 9 new tables exist and are empty
2. Products table has 10 new columns, all with correct defaults
3. Existing products, inventory, and sales data is 100% intact
4. All new indexes are created
5. Application starts without errors
6. POS functionality works unchanged
7. Backup tables created and verified
8. Environment variables set to lock down imports

---

## NEXT STEPS (Phase 3)

Once Phase 2 is verified:
1. Build CSV importer service
2. Create admin staging/review UI
3. Implement approval workflow
4. Add price calculation engine
5. Implement anomaly detection
6. Build audit trail dashboard

