# PHASE 2 VERIFICATION & TESTING GUIDE
# Product Ingestion System - Pre-Deployment Checklist

---

## DATABASE VERIFICATION

### Pre-Migration Baseline Test

Run these queries **BEFORE** running the migration SQL:

```sql
-- Baseline count
SELECT COUNT(*) as baseline_product_count FROM products;
-- Save this number: _______________

SELECT COUNT(*) as baseline_inventory_count FROM inventory;
-- Save this number: _______________

-- Check for null selling prices (should be 0)
SELECT COUNT(*) as null_selling_prices 
FROM products WHERE selling_price IS NULL;
-- Expected: 0

-- Check column types (verify not accidentally changed)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
-- Save count of columns: _______________
```

### Post-Migration Verification

Run these **AFTER** migration SQL completes:

```sql
-- 1. Verify all new tables exist
SELECT COUNT(*) as new_table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'product_sources', 'product_import_batches', 'product_imports',
    'products_staging', 'product_deduplications', 'product_price_history',
    'pricing_suggestions', 'price_anomalies', 'normalization_units'
  );
-- Expected: 9

-- 2. Verify new columns exist on products
SELECT COUNT(*) as new_columns_count
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN (
    'brand', 'unit', 'barcode', 'image_url', 'status',
    'source_product_id', 'source_id', 'suggested_selling_price',
    'approved_at', 'approved_by'
  );
-- Expected: 10

-- 3. Verify products count unchanged
SELECT COUNT(*) as post_migration_count FROM products;
-- Expected: [same as baseline]

-- 4. Verify inventory count unchanged
SELECT COUNT(*) as post_migration_count FROM inventory;
-- Expected: [same as baseline]

-- 5. Verify no null selling prices created
SELECT COUNT(*) as null_selling_prices
FROM products WHERE status = 'active' AND selling_price IS NULL;
-- Expected: 0

-- 6. Verify status column defaults correctly
SELECT COUNT(*) as active_default_count
FROM products WHERE status IS NOT NULL;
-- Expected: [your baseline count] (all products get 'active' default)

-- 7. Verify unit column defaults correctly
SELECT COUNT(*) as unit_default_count
FROM products WHERE unit IS NOT NULL;
-- Expected: [your baseline count] (all products get 'pcs' default)

-- 8. Check normalization_units were seeded
SELECT COUNT(*) as units_seeded FROM normalization_units;
-- Expected: 4+

-- 9. Verify RLS enabled
SELECT COUNT(*) as rls_enabled_count
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = TRUE
  AND tablename IN ('product_sources', 'products_staging', 'product_imports');
-- Expected: 3 (new tables should have RLS)

-- 10. Test index creation (indexes should exist)
SELECT COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND tablename IN (
    'product_sources', 'product_import_batches', 'product_imports',
    'products_staging', 'price_anomalies'
  );
-- Expected: 15+ (indexes created successfully)
```

---

## DATA INTEGRITY TESTS

### Foreign Key Integrity

```sql
-- Test 1: No orphaned inventory
SELECT COUNT(*) as orphaned_inventory
FROM inventory i
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = i.product_id);
-- Expected: 0

-- Test 2: No orphaned sale_items
SELECT COUNT(*) as orphaned_sale_items
FROM sale_items si
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = si.product_id);
-- Expected: 0

-- Test 3: No orphaned stock_movements
SELECT COUNT(*) as orphaned_stock_movements
FROM stock_movements sm
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = sm.product_id);
-- Expected: 0

-- Test 4: All sales have valid cashiers
SELECT COUNT(*) as orphaned_sales
FROM sales s
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.cashier_id);
-- Expected: 0
```

### Schema Consistency

```sql
-- Test 5: No duplicate SKUs
SELECT sku, COUNT(*) as duplicate_count
FROM products
GROUP BY sku
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- Test 6: No duplicate barcodes (new column)
SELECT barcode, COUNT(*) as duplicate_count
FROM products
WHERE barcode IS NOT NULL
GROUP BY barcode
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- Test 7: Check data types match schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN (
  'product_imports', 'products_staging', 'product_price_history'
)
ORDER BY table_name, ordinal_position;
-- Visually verify types are correct (UUID, TEXT, INTEGER, TIMESTAMP, JSONB, BOOLEAN)
```

---

## APPLICATION-LEVEL VERIFICATION

### TypeScript Type Checking

```bash
# In project root, run:
npx tsc --noEmit

# Expected: ✅ No errors
# If errors, check:
# - lib/product-ingestion.types.ts imports
# - enum values match database CHECK constraints
# - nullable fields marked as optional (?)
```

### eslint & Code Quality

```bash
npx eslint lib/product-ingestion.types.ts

# Expected: No linting errors
```

### API Endpoint Tests

```bash
# Test that POS still works
curl -s http://localhost:3000/api/products | jq '.length'
# Expected: [your product count]

# Test that inventory still works
curl -s http://localhost:3000/api/inventory | jq '.length'
# Expected: [your inventory count]

# Test that sales still work (create test sale)
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-uuid-here",
    "cashierId": "user-uuid-here",
    "items": [{"productId": "prod-uuid", "quantity": 1, "unitPrice": 1000}],
    "paymentMethod": "cash"
  }'
# Expected: 200 OK, sale created

# Test that reports still work
curl -s http://localhost:3000/api/dashboard/stats | jq '.totalSales'
# Expected: Number > 0 (sales dashboard still works)
```

---

## ROLLBACK VERIFICATION

### Test Rollback Without Committing

```sql
-- Simulate rollback in a transaction (won't persist)
BEGIN;

DROP TABLE IF EXISTS price_anomalies CASCADE;
DROP TABLE IF EXISTS pricing_suggestions CASCADE;
DROP TABLE IF EXISTS product_price_history CASCADE;
DROP TABLE IF EXISTS product_deduplications CASCADE;
DROP TABLE IF EXISTS products_staging CASCADE;
DROP TABLE IF EXISTS product_imports CASCADE;
DROP TABLE IF EXISTS product_import_batches CASCADE;
DROP TABLE IF EXISTS product_sources CASCADE;
DROP TABLE IF EXISTS normalization_units CASCADE;

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

-- Verify rollback works
SELECT COUNT(*) as new_tables_remaining
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('product_sources', 'products_staging');
-- Expected: 0 (all new tables gone)

-- Check products is still intact
SELECT COUNT(*) as products_count FROM products;
-- Expected: [baseline count]

-- ROLLBACK (don't commit)
ROLLBACK;

-- Verify we're back to post-migration state
SELECT COUNT(*) as new_tables_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('product_sources', 'products_staging');
-- Expected: 2 (tables restored)
```

---

## PERFORMANCE BENCHMARKS

Before declaring success, verify these performance metrics:

```sql
-- Benchmark 1: Simple product query (POS speed)
EXPLAIN ANALYZE
SELECT id, sku, name, selling_price 
FROM products 
WHERE status = 'active' 
LIMIT 100;

-- Expected: < 10ms execution time
-- If > 100ms, something is wrong with indexes

-- Benchmark 2: Staging review query (Admin UI speed)
EXPLAIN ANALYZE
SELECT id, normalized_name, confidence_score, price_anomaly
FROM products_staging
WHERE batch_id = 'test-batch'
  AND review_status = 'pending'
ORDER BY confidence_score ASC
LIMIT 50;

-- Expected: < 50ms execution time

-- Benchmark 3: Price history lookup
EXPLAIN ANALYZE
SELECT * FROM product_price_history
WHERE product_id = 'test-product-id'
ORDER BY created_at DESC
LIMIT 20;

-- Expected: < 10ms execution time
```

---

## SAFETY CHECKLIST

Before deploying to production, verify:

### Database Safety
- [ ] Backup created and verified (`products_backup_20260405` table exists)
- [ ] All new tables created with correct schemas
- [ ] All indexes created without errors
- [ ] No data loss (counts match baseline)
- [ ] No null selling prices introduced
- [ ] Foreign key integrity maintained
- [ ] RLS enabled on staging tables

### Application Safety
- [ ] TypeScript compilation passes (`npx tsc`)
- [ ] No new code errors in product types file
- [ ] POS endpoints still work (`/api/products`, `/api/sales`)
- [ ] Dashboard still loads without errors
- [ ] Inventory operations still function
- [ ] Reports still generate

### Audit & Compliance
- [ ] Backup location documented: _______________
- [ ] Rollback procedure tested and verified
- [ ] Migration duration logged
- [ ] All changes logged in git commit message
- [ ] Stakeholders notified of deployment

### Performance
- [ ] Product query < 10ms
- [ ] Staging review query < 50ms
- [ ] Price history query < 10ms
- [ ] No index bloat detected
- [ ] CPU usage normal during heavy operations

---

## SMOKE TEST SCENARIOS

Run these real-world scenarios to verify safety:

### Scenario 1: POS Checkout Still Works
```
1. Open POS UI
2. Search for a product: "Coca Cola"
3. Add to cart: qty 2
4. Complete sale with cash payment
5. Verify receipt prints
6. Check inventory decreased by 2

Expected: ✅ All steps succeed, no errors
```

### Scenario 2: Reports Still Accurate
```
1. Navigate to Dashboard → Reports
2. View "Sales Today"
3. View "Top Products"
4. View "Payment Methods" pie chart

Expected: ✅ All data loads, numbers look reasonable
```

### Scenario 3: Inventory Operations Still Work
```
1. Navigate to Inventory page
2. Select a product
3. View current stock levels by branch
4. Try to add stock (purchase order)

Expected: ✅ UI responsive, no errors
```

### Scenario 4: Product Management Still Works
```
1. Navigate to Products page
2. Search for a product
3. Click Edit
4. Change price: 10000 → 12000
5. Save

Expected: ✅ Product updated, new price visible
```

---

## KNOWN ISSUES & EXPECTED BEHAVIORS

### Expected (Not Bugs)

- [ ] **New columns appear NULL for existing products**
  - Expected: brand, barcode, source_id will be NULL for pre-existing products
  - This is correct - they'll be populated during first import
  
- [ ] **Status column shows 'active' for all existing products**
  - Expected: All current products get status='active' as default
  - This is correct - preserves existing products as active

- [ ] **Staging tables are empty**
  - Expected: product_imports, products_staging, etc. are empty after migration
  - This is correct - no data imported yet, only schema created

- [ ] **No price_history entries for old products**
  - Expected: product_price_history only tracks NEW changes from now on
  - This is correct - historical prices aren't backfilled

- [ ] **New indexes slow down writes slightly**
  - Expected: INSERT/UPDATE on products might be 1-2ms slower
  - This is normal and acceptable trade-off for faster reads

### Potential Issues (Investigate)

- ❌ **Migration takes > 30 seconds**
  - Investigate: Are there 100,000+ products already?
  - Solution: Migration can be run off-peak if needed

- ❌ **RLS enforcement causes permission errors**
  - Investigate: Are Supabase auth policies set up?
  - Solution: Check RLS policies, may need to update if using custom auth

- ❌ **Index creation fails with "memory exceeded"**
  - Investigate: Is this a shared/small Supabase instance?
  - Solution: Create indexes one-by-one instead of batch

- ❌ **Application fails to start**
  - Investigate: Are new TypeScript types imported correctly?
  - Solution: Check file imports, ensure types are exported from lib/

---

## FINAL APPROVAL SIGN-OFF

Before declaring Phase 2 complete:

**Database Health**: 
- [ ] All tables created
- [ ] All data preserved
- [ ] All indexes functional
- [ ] Rollback verified as working

**Application Health**:
- [ ] No TypeScript errors
- [ ] All POS features still work
- [ ] Reports still load
- [ ] Smoke tests pass

**Documentation**:
- [ ] Rollout plan documented
- [ ] Implementation guide created
- [ ] Types file created
- [ ] Backup procedure verified

**Team Sign-Off**:
- [ ] DBA: Verified at _________ (name/date)
- [ ] Developer: Verified at _________ (name/date)
- [ ] QA: Tested at _________ (name/date)

---

## NEXT STEPS AFTER VERIFICATION

Once all verifications pass:

1. ✅ Phase 2 is COMPLETE
2. 📋 Schedule Phase 3 kickoff (CSV importer, admin UI)
3. 📧 Notify stakeholders: "Product ingestion system ready for Phase 3"
4. 🔐 Lock down environment variables (IMPORT_SYSTEM_ENABLED=false)
5. 📞 Begin Phase 3 planning: Which supermarket sources to integrate first?

---

**END OF VERIFICATION GUIDE**

