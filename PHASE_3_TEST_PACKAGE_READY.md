# PHASE 3 CONTROLLED TEST RUN - READY

## 📦 TEST PACKAGE CONTENTS

Everything needed for controlled Phase 3 verification:

### 1. Test Data
**File:** [PHASE_3_TEST_PRODUCTS.csv](PHASE_3_TEST_PRODUCTS.csv) (19 rows)
- ✅ 5 valid products (Coca Cola, Sprite, Blue Band, Brookside, Nescafe)
- ✅ 1 duplicate-like (Coca Cola listed twice, different sources, similar prices)
- ✅ 3 missing optional fields (no image_url for Fanta, Bread, Royco)
- ✅ 2 pricing anomalies (Rice @ 8 KES, Salt @ 999,999 KES)
- ✅ Mix of sources (jumia: 5, nairobi_wholesalers: 4, direct_supplier: 1, csv_import: 9)
- ✅ All realistic Kenyan grocery/retail products

### 2. Test Sequence
**File:** [PHASE_3_TEST_SEQUENCE.md](PHASE_3_TEST_SEQUENCE.md) (13 steps)
- Step 1: Database baseline (SQL queries to save initial state)
- Step 2: CSV upload (browser steps)
- Step 3: Pipeline processing (async background work)
- Step 4-6: Database verification (raw imports, staging, anomalies, dedup)
- Step 7: Admin review UI (check table loads correctly)
- Step 8: Admin approval/rejection (test approval workflow)
- Step 9: Verify approvals in DB (check status changes)
- Step 10: Publish to live (browser steps)
- Step 11: Verify published in DB (check live products created)
- Step 12: POS search verification (test POS integration)
- Step 13: Final verification (comprehensive SQL summary)

### 3. Verification Gates
**File:** [PHASE_3_VERIFICATION_GATES.md](PHASE_3_VERIFICATION_GATES.md)
- ✅ 30+ success criteria checkpoints
- ✅ Rollback procedures (if test fails)
- ✅ Phase 4 planning (web adapters, Jumia, Nairobi Wholesalers)
- ✅ Deployment checklist
- ✅ Post-launch monitoring plan

### 4. Implementation Status
- ✅ Phase 2 completed (schema + types)
- ✅ Phase 3 code complete (10 files created):
  - CSV importer (`lib/csv-importer.ts`)
  - Product normalizer (`lib/product-normalizer.ts`)
  - Deduplicator (`lib/product-deduplicator.ts`)
  - Pricing analyzer (`lib/pricing-analyzer.ts`)
  - Staging actions (`lib/staging-actions.ts`)
  - CSV upload API (`app/api/import/csv/route.ts`)
  - 4 UI components (CSV dialog, review table, publish dialog, import page)

---

## 🎯 QUICK START: RUN THE TEST

### Prerequisites
1. ✅ Phase 2 migration executed in Supabase (tables created)
2. ✅ Admin account created and verified
3. ✅ CSVimporter dependencies installed (`npm install papaparse`)
4. ✅ Application deployed (or running locally)

### Run Test (45 minutes)

```bash
# 1. Open SQL Editor (Supabase or local)
#    Run STEP 1 queries to record baseline
#    Save baseline_product_count

# 2. Open browser to localhost:3000
#    Navigate to /import
#    Follow STEP 2-12 from PHASE_3_TEST_SEQUENCE.md
#    Takes ~40 minutes

# 3. Run STEP 13 SQL queries
#    Verify all counts match expected

# 4. Fill out results template
#    Record in PHASE_3_VERIFICATION_GATES.md

# 5. Check all success criteria boxes
#    Phase 3 verification complete ✅
```

### Expected Results

**Final Counts After Test:**
```
Raw imports:        19  ✓
Staging products:   19  ✓
Critical anomalies: 2   ✓
Approved products:  10-12
Rejected products:  2   ✓
Published products: 10-12
Live products added: 10-12 → Total increases by 10-12
```

**POS Testing:**
- Can find: Coca Cola, Sprite, Blue Band, Brookside, Nescafe, Bread, Royco, Oil, Sugar, Instant Coffee, Soda
- Cannot find: Rice (rejected), Salt (rejected)

---

## 📋 SUCCESS CRITERIA

### MUST PASS (All 10)
1. [ ] Import batch created (1 record in product_import_batches)
2. [ ] Raw imports saved (19 records in product_imports)
3. [ ] Staging created (19 records in products_staging)
4. [ ] Anomalies detected (exactly 2 critical anomalies)
5. [ ] Anomalies block approval (cannot approve with critical issues)
6. [ ] Dedup working (Coca Cola duplicate detected)
7. [ ] Admin can approve (workflow functions)
8. [ ] Admin can reject (with reason)
9. [ ] Publish works (10-12 products moved to live)
10. [ ] POS integration (can search imported products)

### Nice to Have
- [ ] Duplicate detection confidence >85%
- [ ] Processing completes in <30 seconds
- [ ] All product metadata transferred (brand, unit, barcode)
- [ ] Confidence scores >70% for good products
- [ ] No data loss (baseline + published = new total)

---

## 🔄 WHAT HAPPENS AT EACH STAGE

### Upload → Parsing
- CSV validated (required fields, file type/size)
- 19 rows extracted
- Expected: Parse successful

### Parsing → Batch Creation
- product_import_batches record created with status='normalizing'
- 19 raw records inserted to product_imports
- Expected: Batch ID returned, status='normalizing'

### Normalization (Async)
- Product names normalized (lowercase, trim)
- Brands extracted (pattern matching)
- Units standardized (ml→ml, kg→kg, etc)
- Confidence scored (0-100)
- 19 records inserted to products_staging
- Expected: All 19 staged with valid metadata

### Deduplication (Async)
- Coca Cola products compared (fuzzy match ~95%)
- Potential duplicates recorded
- Expected: Match detected and logged

### Anomaly Analysis (Async)
- Price < 10 KES → CRITICAL (rice)
- Price > 500K KES → CRITICAL (salt)
- Prices calculated as 1.25x listed for others
- Expected: Exactly 2 critical anomalies

### Admin Review
- All 19 products visible in table
- Anomalies marked with red icons
- Admin can approve/reject
- Expected: Admin can control flow

### Publishing
- 10-12 approved products moved to products table
- Staging marked status='published'
- Expected: New products live, searchable

### POS Integration
- New products in catalog
- Searchable by name
- Can add to cart
- Expected: Working as normal products

---

## ⚠️ IF TEST FAILS

### Issue: "Upload fails with 401 Unauthorized"
→ Verify user is admin: `SELECT role FROM users WHERE id = '[user_id]'`

### Issue: "Staging products not appearing"
→ Batch may still processing. Refresh page. Check batch status SQL query.

### Issue: "Can't approve - says has critical anomaly"
→ This is correct behavior! Those 2 products should be rejected, not approved.

### Issue: "Publish fails"
→ Check: only "approved" products can publish. Make sure products are status='approved'

### Issue: "Products not in POS"
→ Verify: published products have status='active' in products table

### Rollback (if needed):
```sql
-- Delete test batch completely
DELETE FROM products_staging WHERE batch_id = '[batch_id]';
DELETE FROM product_imports WHERE batch_id = '[batch_id]';
DELETE FROM product_import_batches WHERE id = '[batch_id]';
DELETE FROM price_anomalies WHERE batch_id = '[batch_id]';
DELETE FROM product_deduplications WHERE batch_id = '[batch_id]';

-- OR delete imported products from live
DELETE FROM products WHERE source_id IN ('csv_import', 'jumia', 'nairobi_wholesalers')
  AND created_at > NOW() - INTERVAL '30 minutes';
```

---

## 📊 METRICS TO TRACK

During test, note:

**Performance:**
- Upload time: ___ seconds
- Batch processing time: ___ seconds
- Approval review time: ___ seconds
- Total duration: ___ minutes

**Quality:**
- Duplicate detection rate: ___ % (should be 100%)
- Anomaly accuracy: ___ % (should be 100%)
- Admin approval rate: ___ % (10-12 of 17 good products)

**Data Integrity:**
- Products before test: ___
- Products after test: ___ (should be before + 10-12)
- No orphaned records: YES / NO
- Audit trail complete: YES / NO

---

## 🚀 AFTER TEST PASSES

1. **Document Results**
   - Fill template in PHASE_3_VERIFICATION_GATES.md
   - Record all metrics

2. **Code Review**
   - Review PHASE_3_CODE_REVIEW checklist (optional)
   - Fix any identified issues

3. **Staging Deployment** (optional)
   - Deploy to staging environment
   - Run test against staging data

4. **Phase 4 Planning**
   - Review PHASE_3_VERIFICATION_GATES.md Phase 4 section
   - Decide on web adapters (Jumia, Nairobi Wholesalers, etc)
   - Get API credentials ready

5. **Production Ready**
   - Full Phase 3+4 deployment
   - Daily automated imports
   - Admin monitoring in place

---

## 📞 SUPPORT DURING TEST

If stuck on any step:
1. Check PHASE_3_TEST_SEQUENCE.md section for that step
2. Run associated SQL queries to diagnose
3. Review TROUBLESHOOTING section above
4. Check application logs (browser console, server logs)

---

## FILES CREATED FOR PHASE 3

| File | Purpose | Status |
|------|---------|--------|
| PHASE_3_TEST_PRODUCTS.csv | Test data (19 rows) | ✅ Ready |
| PHASE_3_TEST_SEQUENCE.md | Detailed 13-step test procedure | ✅ Ready |
| PHASE_3_VERIFICATION_GATES.md | Success criteria + Phase 4 planning | ✅ Ready |
| lib/csv-importer.ts | CSV parsing & import | ✅ Created |
| lib/product-normalizer.ts | Normalization service | ✅ Created |
| lib/product-deduplicator.ts | Deduplication service | ✅ Created |
| lib/pricing-analyzer.ts | Anomaly detection | ✅ Created |
| lib/staging-actions.ts | Admin review & publish | ✅ Created |
| app/api/import/csv/route.ts | Upload endpoint | ✅ Created |
| components/import/csv-upload-dialog.tsx | Upload UI | ✅ Created |
| components/import/staging-review-table.tsx | Review table | ✅ Created |
| components/import/publish-dialog.tsx | Publish dialog | ✅ Created |
| app/(dashboard)/import/page.tsx | Admin page | ✅ Created |
| PHASE_3_TESTING_GUIDE.md | Detailed test guide | ✅ Created |
| PHASE_3_QUICK_REFERENCE.md | Quick start guide | ✅ Created |

---

## 🎯 NEXT STEPS

1. **Review** this summary
2. **Run** PHASE_3_TEST_SEQUENCE.md (13 steps, ~45 min)
3. **Record** results in PHASE_3_VERIFICATION_GATES.md
4. **Verify** all success criteria pass ✅
5. **Plan** Phase 4 (web adapters)
6. **Proceed** to production deployment

---

**TEST PACKAGE READY FOR EXECUTION** ✅

All code written. All documentation complete. All procedures defined.

Ready to run controlled Phase 3 test whenever you are.

