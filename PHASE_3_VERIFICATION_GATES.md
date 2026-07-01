# PHASE 3 VERIFICATION GATES & PHASE 4 PLANNING
# Pre-Production Readiness & Web Adapter Strategy

---

## PHASE 3 SUCCESS GATE CRITERIA

Before proceeding to Phase 4 (web source adapters), ALL of these must be verified ✅:

### Data Pipeline Integrity (MUST PASS)
- [ ] Import batch created successfully (1 entry in product_import_batches)
- [ ] All 19 CSV rows inserted to product_imports (raw data preserved)
- [ ] All 19 products normalized and staged (products_staging)
- [ ] Exactly 2 critical price anomalies detected and blocked
- [ ] Anomalies prevent approval (code enforcement verified)
- [ ] Deduplication working (fuzzy match >= 85% similarity)
- [ ] Duplicate Coca Cola products detected as potential match
- [ ] Suggested prices calculated for all 19 products (1.25x markup)
- [ ] Confidence scores generated (0-100 range)

### Admin Review Workflow (MUST PASS)
- [ ] CSV upload UI works without errors
- [ ] File validation enforces (.csv, <10MB)
- [ ] Admin-only authorization checks API endpoint
- [ ] Batch processing completes in < 30 seconds
- [ ] Staging review table loads with all products
- [ ] Anomaly icons (red) display correctly
- [ ] Duplicate icons (yellow) display correctly
- [ ] Admin can approve products
- [ ] Admin can reject products with reason
- [ ] Cannot approve products with critical anomalies
- [ ] Approval metadata stored (user_id, timestamp)

### Publishing & Live Products (MUST PASS)
- [ ] Publish button only available when approved > 0
- [ ] Publish dialog shows confirmation + warnings
- [ ] 10-12 approved products published to live
- [ ] Staging records marked status='published'
- [ ] 10-12 new rows created in products table
- [ ] Source tracking preserved (source_id, source_product_id)
- [ ] Price history entries created for each publish
- [ ] Existing live products NOT overwritten
- [ ] Total product count = baseline + published (no loss)
- [ ] No data corruption or orphaned records

### POS Integration (MUST PASS)
- [ ] Published products searchable by name
- [ ] Rejected/anomalous products NOT in POS search
- [ ] Can add imported products to cart
- [ ] Checkout works without errors
- [ ] Receipt shows correct product name + price
- [ ] Inventory tracking functional after import
- [ ] Sales recorded with source attribution

### Audit Trail (MUST PASS)
- [ ] Batch creation logged with timestamp
- [ ] Each raw import linked to batch_id
- [ ] Anomalies recorded with severity + message
- [ ] Duplicates recorded with confidence score + reason
- [ ] Rejections logged with reason + user_id
- [ ] Approvals logged with timestamp + user_id
- [ ] Publish operations logged (qty, timestamp, user)
- [ ] No critical data missing from audit tables

---

## TEST RUN RESULTS TEMPLATE

**Fill this out after completing PHASE_3_TEST_SEQUENCE.md:**

```
TEST DATE: _______________
TESTER: _______________
ENVIRONMENT: [dev/staging/production]

CSV BASELINE:
- Test file: PHASE_3_TEST_PRODUCTS.csv (19 rows)
- Batch ID: _______________

UPLOAD PHASE:
- Upload time: _____ seconds
- Success: YES / NO
- Errors: _____________________

PROCESSING PHASE:
- Processing time: _____ seconds
- Status: normalizing → deduplicating → reviewing → staged: YES / NO
- Errors: _____________________

ANOMALY DETECTION:
- Critical anomalies detected: 2 / [other]
- Product 1: CSV_RICE (8 KES) detected: YES / NO
- Product 2: CSV_SALT (999,999 KES) detected: YES / NO
- Duplicates detected: _____ count
- Coca Cola duplicate flagged: YES / NO

ADMIN APPROVAL:
- Products approved: _____ (expected 10-12)
- Products rejected: _____ (expected 2)
- Products pending: _____ (expected 5-7)
- Cannot approve critical anomalies enforced: YES / NO

PUBLISH:
- Products published: _____ (expected 10-12)
- Publishing success: YES / NO
- Time taken: _____ seconds

DATABASE VERIFICATION:
- Live products created: _____ (expected 10-12)
- Price history entries: _____ (expected 10-12)
- Audit records intact: YES / NO
- No data loss: YES / NO

POS TESTING:
- Coca Cola searchable: YES / NO
- Sprite searchable: YES / NO
- Rice anomaly NOT searchable: YES / NO
- Salt anomaly NOT searchable: YES / NO
- Can add to cart: YES / NO
- Checkout successful: YES / NO
- Receipt shows source: YES / NO

OVERALL RESULT: ✅ PASS / ❌ FAIL

ISSUES FOUND (if any):
1. _____________________
2. _____________________
3. _____________________

FIXES APPLIED:
1. _____________________
2. _____________________

SIGN-OFF:
Name: _________________ Date: _________
```

---

## PHASE 4: WEB SOURCE ADAPTERS PLANNING

**Start Phase 4 ONLY after Phase 3 test passes all criteria.**

### Phase 4 Scope

Transform from manual CSV import to automated web scraping:
- Jumia (Kenya online retailer)
- Nairobi Wholesalers (B2B supplier)
- Direct supplier feeds (JSON API)
- Web scraper for price aggregation

### Phase 4A: Jumia Adapter (Week 1)

**Purpose:** Auto-import products from Jumia.co.ke daily

**Architecture:**
```
┌─ Scheduled Job (Daily @ 2 AM) ─┐
│                                │
├─ Jumia API / Scraper          │
│  ├─ Category list (electronics, groceries, etc)
│  ├─ Product search (popular items)
│  ├─ Price + availability
│  └─ Product images
│                                │
└─ CSV Generator (in-memory)    ─┤
  ├─ Format as JUMIA_* source   │
  ├─ Generate unique product IDs │
  ├─ Include image URLs          │
  └─ Populate suggested_price    │
                                 │
    ↓ (Use existing CSV pipeline)
    
    Import to staging → Review → Publish
```

**Technologies:**
- Puppeteer (web scraping) or Jumia API if available
- Scheduled job runner (Node.js cron or AWS Lambda)
- Error handling + retry logic
- Rate limiting (respect robots.txt)

**Files to Create:**
- `lib/adapters/jumia-scraper.ts` - Scraping logic
- `lib/adapters/jumia-formatter.ts` - CSV generation
- `scripts/run-jumia-import.ts` - Scheduled job
- `PHASE_4A_JUMIA_ADAPTER.md` - Implementation guide

**Success Criteria:**
- [ ] Can fetch 100+ products from Jumia
- [ ] Prices accurate within 2 hours of source
- [ ] Images downloaded to Cloudinary
- [ ] Imports via existing CSV pipeline (no code duplication)
- [ ] Scheduled import runs without errors
- [ ] Admin review before publishing (same as manual)

### Phase 4B: Nairobi Wholesalers Adapter (Week 2)

**Purpose:** Import wholesale prices from supplier

**API Format (assumed):**
```json
{
  "products": [
    {
      "id": "NW_SKU_001",
      "name": "Eddoe Rice 2kg",
      "wholesale_price": 400,
      "retail_suggestion": 450,
      "category": "Grains",
      "image_url": "..."
    }
  ]
}
```

**Architecture:**
```
┌─ Scheduled Job (Daily @ 3 AM) ─┐
│                                │
├─ Nairobi Wholesalers API       │
│  ├─ GET /api/products          │
│  ├─ Filter by category         │
│  └─ Include pricing levels     │
│                                │
└─ JSON to CSV Adapter          ─┤
  ├─ Map API fields to CSV       │
  ├─ Mark source: nairobi_wholesalers
  ├─ Include wholesale vs retail │
  └─ Generate batch name         │
                                 │
    ↓ (Use existing CSV pipeline)
    
    Same as above - import to staging → review → publish
```

**Files to Create:**
- `lib/adapters/nawi-api-client.ts` - API integration
- `lib/adapters/nawi-json-to-csv.ts` - Data transformation
- `scripts/run-nawi-import.ts` - Scheduled job

**Success Criteria:**
- [ ] Can fetch wholesale inventory
- [ ] API authentication working (API key)
- [ ] Transforms JSON to CSV format perfectly
- [ ] Prices correctly categorized (wholesale vs retail)
- [ ] Scheduled job runs reliably
- [ ] No duplicate SKU issues with other sources

### Phase 4C: Generic JSON API Adapter (Week 2)

**Purpose:** Support any supplier JSON feed

**Expected Format (configurable):**
```json
{
  "products": [
    {
      "externalId": "SUPPLIER_SKU",
      "productName": "Product Name",
      "price": 100,
      "category": "Category",
      "image": "url...",
      "barcode": "...",
      ... (custom fields)
    }
  ]
}
```

**Architecture:**
```
┌─ Generic JSON Adapter ─┐
│                        │
├─ Field Mapping Config │ (configurable per supplier)
│  ├─ externalId → source_product_id
│  ├─ productName → scraped_name
│  ├─ price → listed_price
│  └─ ... other fields
│                       │
└─ JSON to CSV Adapter ─┤
  └─ Uses mapping config
                        │
    ↓ (Use existing CSV pipeline)
```

**Files to Create:**
- `lib/adapters/generic-json-adapter.ts` - Flexible mapping
- `lib/adapter-configs/supplier-mappings.ts` - Field mapping storage

**Success Criteria:**
- [ ] Works with any JSON structure (via config)
- [ ] Can handle nested fields (e.g., metadata.price)
- [ ] Validates all required fields exist
- [ ] Easy to add new suppliers (just add mapping config)

### Phase 4D: Web Price Aggregator (Week 3)

**Purpose:** Monitor price changes across sources

**Concept:**
```
Run daily:
1. Scrape 5-6 popular products from Jumia, Nairobi, Direct
2. Compare prices against our live catalog
3. Suggest price adjustments if market changed
4. Alert if we're over/under market average
5. Auto-generate "price intelligence" report
```

**Files to Create:**
- `lib/services/price-intelligence.ts` - Aggregation logic
- `scripts/run-price-intelligence.ts` - Scheduled job
- `app/api/reports/price-intelligence/route.ts` - Admin report endpoint

**Success Criteria:**
- [ ] Tracks 20+ products across 3+ sources
- [ ] Detects price trends (up/down over time)
- [ ] Alerts when our price out of range (too high/low)
- [ ] Suggests optimal price (median + markup)
- [ ] Generates weekly report

### Phase 4 Timeline & Dependencies

```
PHASE 3 TEST ✅ (REQUIRED - Don't skip)
    ↓
PHASE 4A: Jumia Adapter (5 days)
  ├─ Would use existing CSV pipeline
  ├─ Test with 50-100 products
  └─ Verify daily schedule
    ↓
PHASE 4B: Nairobi Wholesalers (3 days)
  ├─ Depends on API access (needs API key)
  ├─ Test JSON→CSV conversion
  └─ Verify wholesale pricing
    ↓
PHASE 4C: Generic JSON Adapter (2 days)
  ├─ Allows adding new suppliers post-launch
  ├─ Configurable field mapping
  └─ No hardcoding per supplier
    ↓
PHASE 4D: Price Intelligence (3 days)
  ├─ Optional but valuable
  ├─ Helps competitive pricing
  └─ Admin reporting
    ↓
PRODUCTION LAUNCH
  ├─ Phase 1-3 fully tested
  ├─ Phase 4 adapters configured
  └─ Daily auto-imports running
```

**Estimated Phase 4 Duration:** 2 weeks (concurrent work on 4A+4B, then 4C+4D)

### Phase 4 Pre-Requirements

Before starting Phase 4, have:
- [ ] Phase 3 test passed with no critical failures
- [ ] Jumia access (API account or user-agent strategy)
- [ ] Nairobi Wholesalers API key (request from supplier)
- [ ] List of 10-15 key suppliers for Phase 5
- [ ] Pricing strategy defined (cost + markup %)
- [ ] Image storage ready (Cloudinary API configured)

---

## DEPLOYMENT CHECKLIST

Once Phase 3 verified, before production launch:

### Database & Infrastructure
- [ ] Phase 2 migration executed in production (all 9 tables created)
- [ ] RLS policies configured correctly
- [ ] Backup procedure tested
- [ ] Restored from backup tested

### Application Code
- [ ] All Phase 3 files deployed
- [ ] TypeScript compiles without errors (`npx tsc`)
- [ ] API endpoints tested (`POST /api/import/csv`)
- [ ] Admin UI fully functional
- [ ] No console errors in browser

### Admin Access
- [ ] Admin users have import permission
- [ ] Admin role verified in database
- [ ] Session/auth working
- [ ] Admin pages accessible

### Testing
- [ ] Phase 3 CSV test completed successfully
- [ ] POS integration verified
- [ ] No regressions in existing features
- [ ] Inventory tracking still works
- [ ] Sales recording works with imported products

### Monitoring
- [ ] Error logging enabled
- [ ] Performance baseline established (< 30 sec for batch)
- [ ] Database connection stable
- [ ] Supabase quotas checked

### Documentation
- [ ] Admin manual for CSV import created
- [ ] Emergency rollback procedure documented
- [ ] Support team briefed

---

## POST-LAUNCH MONITORING (First Week)

After Phase 3 goes live:

```
Daily Checks:
- [ ] Import UI loads without errors
- [ ] No failed batches
- [ ] Published products appear in POS
- [ ] No zombie/orphaned records
- [ ] Admin experience smooth

Weekly Report:
- [ ] Total products imported
- [ ] Anomaly detection accuracy
- [ ] False positive rate (duplicates, anomalies)
- [ ] Admin approval rate (% approved vs rejected)
- [ ] POS performance with imported products
```

---

## PHASE 4 GO/NO-GO DECISION

**PROCEED TO PHASE 4 IF:**
- ✅ Phase 3 test passes all criteria
- ✅ No critical bugs found
- ✅ Admin workflow intuitive
- ✅ POS integration solid
- ✅ Audit trail complete

**HOLD PHASE 4 IF:**
- ❌ Data integrity issues
- ❌ Anomaly detection unreliable
- ❌ Admin approval blocking legitimate products
- ❌ Performance issues (>30 sec batch processing)

---

## QUESTIONS FOR USER BEFORE PHASE 4

1. **Jumia Access:** Do you have API credentials, or should we use Puppeteer scraping?
2. **Nairobi Wholesalers:** What's their API endpoint and authentication method?
3. **Pricing Strategy:** Fixed markup (%) or should we adjust by category/brand?
4. **Frequency:** Daily imports, or weekly? Any time restrictions?
5. **Brand Preferences:** Prioritize certain brands/suppliers over others?
6. **Image Handling:** Download to Cloudinary or link to external URLs?
7. **Approval Workflow:** Should web imports auto-approve if low-confidence scores, or always require review?

---

**NEXT STEP:**

Complete Phase 3 test sequence from PHASE_3_TEST_SEQUENCE.md.

Document results in template above.

Return results before starting Phase 4.

