# PHASE 2 IMPLEMENTATION GUIDE
# Product Ingestion System - Detailed Architecture & Deployment

---

## PART 1: SCHEMA DESIGN OVERVIEW

### New Tables Hierarchy

```
External Product Sources
    │
    ├─→ product_sources (Who provides data?)
    │
    ├─→ product_import_batches (When & how much?)
    │   │
    │   ├─→ product_imports (Raw data as-is)
    │   │
    │   ├─→ products_staging (After normalization & dedup review)
    │   │   │
    │   │   ├─→ pricing_suggestions (Price analysis from sources)
    │   │   │
    │   │   └─→ price_anomalies (Suspicious pricing flagged)
    │   │
    │   └─→ product_deduplications (Records of merged products)
    │
    └─→ product_price_history (Audit trail of all changes)
        │
        └─→ products (Live catalog - NEVER overwritten without approval)
```

### Data Flow (Lifecycle)

```
[EXTERNAL SOURCES: CSV, API, Web]
            ↓
[IMPORT] → product_imports (raw)
            ↓
[NORMALIZE] → normalized fields, unit conversion, brand extraction
            ↓
[DEDUPLICATE] → Check against existing products + staging
            ↓
[STAGE] → products_staging (ready for review)
            ↓
[ANALYZE PRICING] → pricing_suggestions + price_anomalies
            ↓
[ADMIN REVIEW] → Review staging products, check anomalies
            ↓
[APPROVE] → review_status='approved' in staging
            ↓
[PUBLISH] → Move selected products to live 'products' table
            → Create price_history records
            → Products now available in POS
```

---

## PART 2: TABLE-BY-TABLE BREAKDOWN

### 1. product_sources (Registry of External Data Providers)

**Purpose**: Track where product data comes from.

**Key Fields**:
- `id` (UUID): Unique source identifier
- `name` (TEXT): Display name (e.g., "Jumia Kenya", "Local CSV Import")
- `source_type` (TEXT): csv_upload | api | web_scraper | manual_csv | other
- `is_active` (BOOLEAN): Can this source still receive imports?
- `config` (JSONB): Source-specific configuration (API keys, URLs, etc)

**Example Records**:
```sql
-- Local CSV importer
INSERT INTO product_sources (name, source_type, is_active, config) VALUES
  ('Bulk CSV Upload', 'csv_upload', true, '{"max_file_size_mb": 100, "delimiter": ","}');

-- Future: Jumia API connector
INSERT INTO product_sources (name, source_type, is_active, config) VALUES
  ('Jumia Kenya API', 'api', false, 
   '{"api_url": "https://api.jumia.co.ke/products", "auth_type": "bearer"}');
```

**Indexes**:
- `idx_product_sources_active`: For filtering active sources

---

### 2. product_import_batches (Bulk Import Tracking)

**Purpose**: Track bulk imports with status, progress, and audit info.

**Key Fields**:
- `batch_hash` (TEXT UNIQUE): SHA256(source_id + timestamp + record_count) for deduplication - prevents re-importing same data
- `status` (TEXT): pending → normalizing → deduplicating → reviewing → staged → approved → published
- `processed_records` / `failed_records` / `duplicates_found`: Progress tracking
- `error_log` (JSONB): Capture errors for debugging and retry decisions
- `imported_by` / `published_by` (UUID): Who did this action (audit trail)

**Lifecycle Example**:
```
Time 09:00 → User uploads CSV with 5000 products
  → batch created with status='pending'
  
Time 09:01 → Normalization service processes
  → status='normalizing', processed_records=5000
  
Time 09:02 → Dedup service runs
  → status='deduplicating', duplicates_found=120
  
Time 09:03 → Ready for admin review
  → status='reviewing', staged 4880 products
  
Time 10:00 → Admin reviews and approves
  → status='approved'
  
Time 10:05 → Publish triggered
  → status='published', published_at=NOW(), published_by=admin_id
```

**Indexes**:
- `idx_import_batches_source`: Find all imports from a source
- `idx_import_batches_status`: Find batches in 'reviewing' or 'pending' status
- `idx_import_batches_created`: Most recent batches first

---

### 3. product_imports (Raw Import Data)

**Purpose**: Store raw product data exactly as received from source, before any processing.

**Key Fields**:
- `raw_data` (JSONB): Full original data structure (all fields from CSV/API)
- `source_product_id` (TEXT): External ID (URL slug, CSV row number, API ID)
- `processing_status` (TEXT): pending → normalized → duplicate_flagged → merged → failed
- `source_retail_price`: Original price from source (before any conversion/margins)

**Why Keep It**:
- Audit trail: Can always trace back to original source data
- Replay: If normalization rules change, can re-process
- Debugging: If import fails, can see exactly what was imported
- Compliance: Keep evidence of where prices came from

**Example Record**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "batch_id": "...",
  "source_product_id": "jumia_sku_45678",
  "raw_data": {
    "product_name": "Coca Cola 500ml PET Bottle",
    "brand_name": "Coca-Cola",
    "category": "Beverages / Soft Drinks",
    "price": "120.50",
    "currency": "KES",
    "size": "500ml",
    "barcode": "5000112547893",
    "image_url": "https://jumia.co.ke/...",
    "product_url": "https://jumia.co.ke/p/...",
    "in_stock": true,
    "last_updated": "2026-04-05T09:30:00Z"
  },
  "source_retail_price": 12050,  // in cents
  "processing_status": "normalized",
  "created_at": "2026-04-05T09:15:00Z"
}
```

**Indexes**:
- `idx_product_imports_batch`: Find all imports in a batch
- `idx_product_imports_source_product`: Find by external ID (if need to re-process)
- `idx_product_imports_status`: Find pending/failed imports

---

### 4. products_staging (Normalized & Deduplicated - Ready for Review)

**Purpose**: Main staging table where products await admin approval before going live.

**Key Fields**:
- `normalized_*`: Clean, standardized fields (name, brand, unit, etc)
- `source_count`: How many sources provided data for this product (2+ = high confidence)
- `min_seen_price` / `max_seen_price` / `avg_seen_price`: Price range from sources
- `suggested_selling_price`: Calculated based on margins
- `price_anomaly` / `anomaly_reason`: RED FLAGS for suspicious data
- `confidence_score`: 0-1, how confident is the normalization? (0.95 = very confident, 0.6 = needs review)
- `possible_duplicate_of_product_id`: If we think this matches an existing product
- `review_status`: pending → needs_review → approved → merged
- `reviewed_by` / `review_notes`: Admin feedback

**Critical: Anomaly Detection**

Products with anomalies are NEVER published without explicit admin action:

```typescript
// Anomaly Rules (in code during import processing)
if (suggestedPrice > MAX_PRICE_KES) → anomaly_type='extreme_margin', severity='critical'
if (suggestedPrice < MIN_PRICE_KES) → anomaly_type='outlier', severity='critical'
if (price > 5 * avg_seen_price) → anomaly_type='outlier', severity='critical'
if (!brand) → anomaly_type='missing_data', severity='warning'
if (!unit) → anomaly_type='unit_mismatch', severity='info'
if (!category_found) → anomaly_type='category_unknown', severity='warning'
```

**Example Records**:

Good Product (Confident):
```json
{
  "normalized_sku": "COK-500-PET",
  "normalized_name": "Coca Cola 500ml PET Bottle",
  "normalized_brand": "Coca-Cola",
  "normalized_unit": "ml",
  "normalized_barcode": "5000112547893",
  "min_seen_price": 11500,
  "max_seen_price": 14000,
  "avg_seen_price": 12500,
  "source_count": 3,
  "suggested_selling_price": 18750,  // 50% margin
  "price_anomaly": false,
  "confidence_score": 0.95,
  "review_status": "pending"
}
```

Suspicious Product (Requires Review):
```json
{
  "normalized_name": "Mystery Drink",
  "normalized_brand": null,
  "min_seen_price": 50000,
  "max_seen_price": 500000,
  "suggested_selling_price": 750000,
  "price_anomaly": true,
  "anomaly_reason": "Price outlier (500K KES) vs median (50K). Unit missing.",
  "confidence_score": 0.45,
  "review_status": "needs_review"
}
```

**Indexes**:
- `idx_products_staging_batch`: Find products in a import batch
- `idx_products_staging_status`: Find by review status
- `idx_products_staging_barcode` + `idx_products_staging_sku`: Match against dupes
- `idx_products_staging_anomaly`: Find only flagged products (for admin review)

---

### 5. product_deduplications (Dedup Audit Trail)

**Purpose**: Record which products were merged (e.g., "Coke 500ml" from 3 sources merged into 1).

**Key Fields**:
- `canonical_product_id`: The ONE product that survives
- `duplicate_product_id`: The product that was merged away
- `dedup_method`: exact_match | fuzzy_match | manual | barcode
- `confidence`: 0-1 (0.99 = automated exact match, 0.70 = fuzzy match, 1.0 = manual)
- `merged_by`: User who approved the merge

**Example**:
```
canonical_product_id: prod_coca_500_main
duplicate_product_id: prod_coca_500_variant_1
dedup_method: fuzzy_match
confidence: 0.92
match_reason: "Same brand, size, unit. Name differs slightly (Coke vs Coca Cola)"
merged_by: admin@winnmatt.com
merged_at: 2026-04-05T10:30:00Z
```

---

### 6. product_price_history (Immutable Audit Trail)

**Purpose**: Record EVERY price change - when, who, why, from what source.

**Key Fields**:
- `product_id`: Which product changed
- `previous_selling_price` → `new_selling_price`: The change
- `change_reason`: import | manual_edit | price_refresh | approval | system_adjustment
- `source_batch_id`: If from import, which batch
- `changed_by`: User who approved/made the change
- `change_notes`: Why? (e.g., "Approved staging review", "Matched to import data")

**Why Keep It**:
- Compliance: Show auditors where prices came from
- Debugging: If price is wrong, see history of changes
- Analytics: Understand pricing trends over time
- Dispute: If customer claims price was different, prove it with history

**Example**:
```sql
-- Original manual price (from early POS setup)
INSERT INTO product_price_history (
  product_id, previous_selling_price, new_selling_price, 
  change_reason, changed_by, change_notes
) VALUES (
  'prod_123', NULL, 15000, 'manual_edit', 'manager_1', 
  'Initial price when product added'
);

-- Later: Approved price from import
INSERT INTO product_price_history (
  product_id, previous_selling_price, new_selling_price,
  change_reason, source_batch_id, changed_by, change_notes
) VALUES (
  'prod_123', 15000, 18750, 'approval', 'batch_456', 'admin_1',
  'Approved from staging review - 50% margin on 12,500 avg market price'
);

-- Later: Manual override (cashier noticed market price changed)
INSERT INTO product_price_history (
  product_id, previous_selling_price, new_selling_price,
  change_reason, changed_by, change_notes
) VALUES (
  'prod_123', 18750, 19500, 'manual_edit', 'manager_1',
  'Market price increased, adjusted to stay competitive'
);
```

**Indexes**:
- `idx_price_history_product`: See all price changes for a product
- `idx_price_history_batch`: See prices from a specific import
- `idx_price_history_created`: Recent price changes (audit dashboard)

---

### 7. pricing_suggestions (Price Analysis)

**Purpose**: Store min/max/avg prices observed from all sources, for each product.

**Key Fields**:
- `product_id`: Which product
- `source_id`: Which data provider observed this price
- `batch_id`: When (which import)
- `observed_retail_price`: What one source said the price is
- `min_price` / `max_price` / `avg_price` / `median_price`: Aggregates across other sources
- `observation_count`: How many sources reported prices for this product
- `suggested_margin_percent`: Default 50% (configurable)
- `suggested_selling_price`: Calculated as avg_price * (1 + margin%)

**Example**:
```json
{
  "product_id": "prod_coca_500",
  "source_id": "jumia",
  "batch_id": "batch_001",
  "observed_retail_price": 12000,
  "avg_price": 12500,
  "median_price": 12400,
  "min_price": 11500,
  "max_price": 14000,
  "observation_count": 5,
  "suggested_margin_percent": 50,
  "suggested_selling_price": 18750
}
```

---

### 8. price_anomalies (Detailed Anomaly Records)

**Purpose**: Track suspicious pricing or data quality issues for admin investigation.

**Key Fields**:
- `anomaly_type`: outlier | missing_data | unit_mismatch | extreme_margin | non_numeric | category_unknown
- `severity`: info | warning | critical (critical blocks auto-publish)
- `description`: Human-readable explanation
- `flagged_value`: The actual problematic value
- `expected_range`: What we expected/allow
- `resolved`: Has admin resolved this?
- `resolution_notes`: What admin did about it

**Examples**:

```json
[
  {
    "anomaly_type": "extreme_margin",
    "severity": "critical",
    "description": "Suggested price (500K KSH) is >200% margin on observed retail (100K). Likely data error.",
    "flagged_value": "500000",
    "expected_range": "110000-150000",
    "resolved": false
  },
  {
    "anomaly_type": "missing_data",
    "severity": "warning",
    "description": "Brand not found in normalized data. May lead to duplicate products from different sources.",
    "flagged_value": null,
    "expected_range": "Text value",
    "resolved": true,
    "resolution_notes": "Brand manually added during review"
  },
  {
    "anomaly_type": "unit_mismatch",
    "severity": "info",
    "description": "Unit field empty. Assumed 'pcs' (pieces) for pricing.",
    "resolved": false
  }
]
```

**Indexes**:
- `idx_anomalies_batch`: See all anomalies in an import
- `idx_anomalies_severity`: Find critical/warning issues (urgent)
- `idx_anomalies_resolved`: Find unresolved anomalies (admin dashboard)

---

### 9. normalization_units (Reference Data)

**Purpose**: Define unit conversion rules (ml → l, g → kg, etc).

**Pre-seeded With**:
```
volume: ml, l, dl, cl (milliliters as base)
weight: g, kg, mg (grams as base)
count: pcs, piece, unit, pack (pieces as base)
```

**Used By**: Normalization service to standardize "500ML" → "ml", "0.5L" → "500ml", etc.

---

## PART 3: CRITICAL INDEXES FOR PERFORMANCE

### Index Strategy

For 100,000+ product imports, indexes are critical:

| Index | Reason | Cardinality |
|-------|--------|------------|
| `idx_products_staging_status` | Find "pending" reviews (high frequency) | Low (5 values) |
| `idx_products_staging_batch` | Find products in a batch (page through) | High |
| `idx_products_staging_anomaly` | Find flagged products (admin dashboard) | Low (boolean) |
| `idx_product_imports_batch` | Find raw imports in batch (diagnostic) | High |
| `idx_import_batches_status` | Find "reviewing" batches (workflow) | Low (9 values) |
| `idx_products_sku_lower` | "Like" searches (POS search) | High (unique) |
| `idx_products_barcode` | Match by barcode (dedup) | High (unique) |
| `idx_price_history_product` | Audit trail for a product | High |

---

## PART 4: ANOMALY DETECTION RULES

Implemented during import processing:

```typescript
const ANOMALY_RULES = {
  // Price bounds (Kenya market reality)
  MIN_SENSIBLE_PRICE_KES: 10,      // KSh 0.10 as minimum
  MAX_SENSIBLE_PRICE_KES: 500000,  // KSh 5000 as maximum for single item
  
  // Pricing anomalies
  OUTLIER_RATIO: 3.0,              // Price > 3x median = outlier
  EXTREME_MARGIN_RATIO: 5.0,       // Price > 5x cost = too extreme
  
  // Data quality
  REQUIRED_FIELDS: ['name', 'url'], // Must have these
  CONFIDENCE_THRESHOLD: 0.7,        // Below = needs review
  
  // Deduplication confidence
  EXACT_MATCH_THRESHOLD: 0.99,      // Exact = auto-merge (admin can review)
  FUZZY_MATCH_THRESHOLD: 0.80,      // Fuzzy = flag for review
}
```

**Severity Assignment**:
```
CRITICAL (blocks publish)
├─ Price < 10 KES or > 500K KES
├─ Price > 5x median (extreme margin)
├─ Non-numeric price
└─ Cannot map to category

WARNING (needs admin attention)
├─ Price > 3x median (outlier)
├─ Missing brand (hard to match)
├─ Duplicate product exists (merge?)
└─ Confidence < 70%

INFO (logged but not blocking)
├─ Missing unit (assumed 'pcs')
├─ Missing image
└─ Source URL malformed
```

---

## PART 5: SAFETY GUARDS

### Prevent Bad Data Reaching Live POS

1. **Staging-Only by Default**
   - All imports land in products_staging
   - products table NEVER auto-updated
   - Only explicit admin approval pushes to live

2. **Anomaly Blocking**
   - Critical anomalies = cannot publish
   - Requires admin review + manual override + notes

3. **Price Range Validation**
   - Prices < 10 KES: REJECTED
   - Prices > 500K KES: FLAGGED
   - Margin > 300%: FLAGGED
   - Missing unit + price >= 100K: FLAGGED

4. **Audit Trail**
   - Every price change logged in product_price_history
   - Who approved? When? Why? (from which batch?)
   - Can revert if needed

5. **Backup First**
   - products_backup_20260405 table preserved
   - Can restore if catastrophic failure

### Prevent Overwriting Good Data

```sql
-- Code rule: When publishing staging product to live:
INSERT INTO products (...) 
SELECT ... FROM products_staging
WHERE review_status = 'approved'
  AND NOT price_anomaly  -- Must not have critical anomalies
  AND id NOT IN (SELECT product_id FROM products WHERE approved_at IS NOT NULL)
  -- Don't overwrite manually curated products
RETURNING id;

-- Log the change:
INSERT INTO product_price_history (change_reason='approval') VALUES (...);
```

---

## PART 6: PERFORMANCE CONSIDERATIONS

### Batch Processing

```
CSV with 100,000 products
├─ Import in chunks of 1,000 (100 iterations)
├─ Each chunk: ~30 seconds (parse + validate + insert)
├─ Total time: ~50 minutes
└─ Can resume from checkpoint if interrupted
```

### Deduplication at Scale

```
100,000 new products vs. existing 150:
├─ Deterministic: barcode + sku matching = O(n) with index = fast
├─ Fuzzy: name/brand matching = O(n²) algorithm = expensive
└─ Strategy: Only fuzzy-match if deterministic fails (hybrid)
```

### Staging Review UI Pagination

```
4,880 products in staging to review
├─ Paginate by 50/page = 98 pages
├─ Admin can filter by: status, anomaly, batch, category
└─ Sort by: confidence_score (review low-confidence first)
```

---

## PART 7: NEXT PHASE (Phase 3) PREVIEW

Once Phase 2 is live:

### Phase 3a: CSV Importer Service
- Parse CSV files (configurable format)
- Validate required columns
- Handle encoding (UTF-8, Excel, etc)
- Stream large files (don't load all in memory)

### Phase 3b: Normalization Service  
- Brand extraction (from name)
- Unit standardization (L → ml)
- Size parsing (500ml, 0.5L → {size: 500, unit: ml})
- Category mapping (text → UUID)

### Phase 3c: Deduplication Service
- Deterministic: exact sku/barcode matching
- Fuzzy: Levenshtein distance on (brand + name)
- Merge logic: consolidate pricing data

### Phase 3d: Admin UI
- Staging review dashboard (paginated)
- Per-product approval
- Batch-wide approval
- Anomaly investigation
- Dedup merge interface

### Phase 3e: Publish Workflow
- Select staging products to publish
- Review proposed price changes
- Confirm vs current live products
- Publish to live products + create history
- Email notification to stakeholders

---

## PART 8: DEPLOYMENT SUMMARY

**Duration**: ~40 minutes downtime (ideally off-peak)

**Order**:
1. Backup current schema
2. Run migration SQL (creates 9 tables, adds 10 columns)
3. Verify integrity
4. Deploy app code (new TypeScript types)
5. Run health checks
6. Lock down imports (env vars)
7. Monitor for 1 hour

**Rollback**: If needed, run rollback SQL in Step 2 of PHASE_2_ROLLOUT_PLAN.md

**Success Indicators**:
- ✅ New tables exist, empty
- ✅ Products table has 10 new columns
- ✅ Existing data 100% intact
- ✅ POS still works
- ✅ All tests pass

---

## APPENDIX: QUICK REFERENCE

### Get Staging Products Pending Review
```sql
SELECT id, normalized_name, normalized_brand, min_seen_price, max_seen_price,
       confidence_score, price_anomaly, review_status
FROM products_staging
WHERE batch_id = 'batch_id_here'
  AND review_status = 'pending'
  AND confidence_score < 0.85  -- Lower confidence = review first
ORDER BY confidence_score ASC
LIMIT 50;
```

### Approve a Staging Product
```sql
UPDATE products_staging
SET review_status = 'approved',
    reviewed_by = 'admin_user_id',
    reviewed_at = NOW(),
    review_notes = 'Looks good. Price is reasonable, brand identified.'
WHERE id = 'staging_product_id';
```

### Publish Approved Products to Live
```sql
-- This is handled in Phase 3 by admin UI
-- But here's the logic:
INSERT INTO products (sku, name, brand, unit, barcode, image_url, 
                      category_id, selling_price, purchase_price,
                      reorder_level, status, source_id, suggested_selling_price)
SELECT normalized_sku, normalized_name, normalized_brand, normalized_unit,
       normalized_barcode, normalized_image_url, 
       normalized_category_id, suggested_selling_price, 
       ROUND(suggested_selling_price / 1.5)::int,  -- Estimate cost
       100, 'active', source_id, suggested_selling_price
FROM products_staging
WHERE review_status = 'approved'
  AND batch_id = 'batch_id_here'
  AND NOT price_anomaly;
```

### View Product Price History
```sql
SELECT changed_by, change_reason, previous_selling_price, new_selling_price,
       change_notes, created_at
FROM product_price_history
WHERE product_id = 'product_id_here'
ORDER BY created_at DESC;
```

---

**END OF PHASE 2 GUIDE**

