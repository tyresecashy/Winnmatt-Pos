# PRICING CLEANUP & PROTECTION FRAMEWORK

**Status:** Ready to implement
**Purpose:** Clean current live prices and protect from being overwritten by imports
**Timeline:** ~2-3 hours to apply schema + audit, then admin review of 1-2 hours

---

## 🔴 ROOT CAUSES: Why Current Prices Are Bad

### Problem 1: Seed Data Multiplied Wrong
**Evidence:**
```
Coca Cola 500ml = KSh 6,000 (WRONG - should be ~150-200)
Detergent Powder 1kg = KSh 17,500 (WRONG - should be ~200-300)
Cooking Oil 2L = KSh 35,000 (WRONG - should be ~500-800)
```

**Root Cause:** 
- Products seeded with mock prices (likely from development/demo)
- Prices likely generated with incorrect multiplier or from different currency
- No validation in seed script to verify realistic ranges
- No admin review step before products went live

**Impact:**
- Customers can't purchase (prices unrealistic)
- POS works but products not sellable
- Prevents normal business operations

### Problem 2: Mixed Manual + Mock Data
**Evidence:**
```
Eggs = KSh 20 (CORRECT - manually curated)
Bread Brown 600g = KSh 65 (CORRECT - manually curated)
```

**Root Cause:**
- Some products manually corrected by admins
- Others left as seed defaults
- No tracking of which are "trusted" vs "demo"
- No protection from overwrites during imports

**Impact:**
- Can't distinguish good from bad on import
- Risk of overwriting correct manual prices with seed data
- No audit trail of manual changes

### Problem 3: No Anomaly Detection
**Current State:**
- No validation on price entry
- No warnings for obviously wrong prices
- No way to flag products for review
- No approval workflow

**Impact:**
- Bad prices not caught before going live
- Imports will create more bad data
- Admin has no tools to clean up

---

## 📊 SCHEMA CHANGES

### 1. Products Table Extensions
```sql
ALTER TABLE products ADD:
  price_source VARCHAR(50)           -- 'seed' | 'manual' | 'import'
  price_trust_level VARCHAR(50)      -- 'high' | 'medium' | 'low'
  price_review_status VARCHAR(50)    -- 'approved' | 'flagged' | 'needs_review' | 'blocked'
  price_review_notes TEXT            -- Why flagged/approved
  price_reviewed_by UUID             -- Which admin reviewed
  price_reviewed_at TIMESTAMP        -- When reviewed
```

### 2. New Tables

#### `price_audit_log`
- Tracks all price changes for compliance
- Captures before/after values
- Records who changed what and why
- Supports batch imports and manual corrections

#### `price_anomalies`
- Flags suspicious prices automatically
- Stores suggested corrections
- Tracks review status (flagged → approved/corrected)
- Links to import batches (Phase 2)

#### `price_anomaly_rules`
- Configurable detection thresholds
- Can enable/disable rules
- Supports different severity levels
- Controls which anomalies block approval

#### `price_protections`
- Marks manually curated prices as "protected"
- Prevents overwrites by imports
- Can expire (temporary protection)
- Audit trail of who protected

### 3. Indexes Added
- price_review_status (for queries)
- price_trust_level (for queries)
- price_source (for queries)
- anomaly status, severity (for dashboard)
- batch_id (for imports)

---

## 🔍 ANOMALY DETECTION RULES

### Critical (Blocks Approval)
1. **Cost > Selling**
   - Product loses money on every sale
   - Must be corrected or blocked

2. **Selling Price > 5,000 KES**
   - Unrealistically high for typical retail items
   - Likely seed data error (30-50x too high)
   - Must be corrected

3. **Excessive Margin (>300%)**
   - Marked up more than 300%
   - Realistic retail: 20-100% margin
   - Likely pricing error

### High (Warns, May Block)
1. **Cost Price > 3,000 KES**
   - Unrealistically high wholesale cost
   - May be correct for specialty items
   - Warns admin to verify

2. **Low Margin (<10%)**
   - Very thin profit
   - Warns admin, doesn't block

---

## 📁 FILES CREATED/MODIFIED

### New Files Created

1. **`PRICING_CLEANUP_QUERIES.sql`** (380 lines)
   - Diagnostic queries to identify bad prices
   - 11 sections with specific checks
   - Baseline stats, extremes, categories, specific examples
   - Summary counts
   - Ready to run now to see current state

2. **`PRICING_PROTECTION_MIGRATION.sql`** (350 lines)
   - Database schema changes
   - 4 new tables: price_audit_log, price_anomalies, price_anomaly_rules, price_protections
   - Columns added to products table
   - Default anomaly rules populated
   - Row-level security policies
   - Mark existing products as needing review

3. **`lib/price-audit-service.ts`** (400 lines)
   - TypeScript service for price auditing
   - `detectPriceAnomalies()` - finds problematic prices
   - `flagProductForReview()` - flags in database
   - `approvePriceReview()` - admin approves price
   - `rejectPriceReview()` - admin corrects and approves
   - `protectPrice()` - marks as high-trust
   - `checkPriceProtection()` - verifies protection
   - `getFlaggedProducts()` - list for dashboard

4. **`app/api/prices/review/route.ts`** (50 lines)
   - GET endpoint to fetch flagged products
   - Admin-only access
   - Returns all anomalies with product data

5. **`app/api/prices/approve/route.ts`** (90 lines)
   - POST endpoint for admin actions
   - Supports: approve, correct (with new prices), protect
   - Validates admin role
   - Creates audit log
   - Logs all changes

6. **`components/prices/price-audit-dashboard.tsx`** (350 lines)
   - React component for admin UI
   - Summary: total/critical/high/medium counts
   - Table: all flagged products
   - Actions: approve, correct, protect
   - Dialog: detailed review + price input
   - Integrates with API

7. **`app/(dashboard)/prices/page.tsx`** (40 lines)
   - Admin page for price audit
   - Requires admin role
   - Shows PriceAuditDashboard component
   - Protection instructions

### Modified Files
- None yet (schema migration is separate DDL)

---

## 🧪 TEST PROCEDURES

### Step 1: Apply Schema Migration

```bash
# In Supabase SQL Editor or local psql:
-- Copy contents of PRICING_PROTECTION_MIGRATION.sql
-- Execute in order

-- Verify tables created:
\dt price_*

-- Verify products columns added:
\d products

-- Verify default rules:
SELECT * FROM price_anomaly_rules;
```

### Step 2: Run Diagnostics

```bash
# In Supabase SQL Editor:
-- Run queries from PRICING_CLEANUP_QUERIES.sql

-- Query 2: Products with selling_price > 5000
SELECT id, sku, name, selling_price, purchase_price FROM products 
WHERE selling_price > 5000 ORDER BY selling_price DESC;

-- Expected result: See the bad prices (Coca Cola, Detergent, Oil)

-- Query 4: Products where cost > selling
SELECT id, sku, name, purchase_price, selling_price FROM products
WHERE purchase_price > selling_price;

-- Expected result: Shows products losing money

-- Summary counts:
SELECT 
  SUM(CASE WHEN purchase_price > selling_price THEN 1 ELSE 0 END) as cost_gt_selling,
  SUM(CASE WHEN selling_price > 5000 THEN 1 ELSE 0 END) as selling_gt_5000,
  COUNT(*) as total_products
FROM products;
```

### Step 3: Access Price Audit Dashboard

```bash
# In browser:
1. Login as admin
2. Navigate to Settings → Prices (or /dashboard/prices)
3. Should see Price Audit Dashboard
4. Should show flagged products with anomalies
5. Each anomaly shows:
   - Product name/SKU
   - Current vs suggested prices
   - Severity badge (red/orange/yellow)
   - Action buttons (Approve/Correct/Protect)
```

### Step 4: Review and Approve Prices

```bash
# For each flagged product:
1. Click product row
2. Dialog opens showing:
   - Current prices
   - Reason for flag
   - Suggested correction (if available)
3. Choose action:
   - [Approve] - Accept current price as-is
   - [Correct] - Enter new prices and confirm
   - [Protect] - Mark as high-trust (won't be overwritten)
4. Add notes explaining decision
5. Confirm
6. Audit log records change
```

### Step 5: Verify Audit Trail

```bash
# Check audit log:
SELECT * FROM price_audit_log 
WHERE product_id = '[product_id]'
ORDER BY created_at DESC;

# Should show:
- Previous price values
- New price values
- Admin who reviewed
- Timestamp
- Notes

# Check anomalies:
SELECT * FROM price_anomalies
WHERE product_id = '[product_id]'
ORDER BY created_at DESC;

# Should show:
- Status changed from 'flagged' to 'approved'/'corrected'
- Reviewed by admin
- Review timestamp
```

### Step 6: Verify POS Still Works

```bash
# In POS:
1. Search for product (e.g., "Coca Cola")
2. If price corrected: shows correct price (e.g., KSh 150)
3. If price protected: shows protected price (unchanged)
4. Should be able to add to cart
5. Price should ring up correctly
```

---

## 🛡️ IMPORT PROTECTION INTEGRATION

### How Phase 3 CSV Import Respects Prices

Before merging CSV prices with live products:

```typescript
// In price audit service (to be called from import workflow):

// 1. Check if product has high-trust protection
const isProtected = await isPriceProtected(productId)
if (isProtected) {
  // Import creates anomaly instead of overwriting
  flagProductForReview(productId, [
    {
      anomalyType: 'IMPORT_OVERWRITE_PROTECTED',
      description: 'Import tried to change high-trust manual price',
      severity: 'high',
      currentSellingPrice: currentPrice,
      newSellingPrice: importedPrice,
      blocksApproval: true
    }
  ])
  // Admin must explicitly approve overwrite
  return
}

// 2. For unprotected products, import can proceed
// BUT all price changes still go through anomaly detection
const anomalies = await detectPriceAnomalies(
  importedSellingPrice,
  importedCostPrice,
  productId
)

// 3. If anomalies found, flag for review
if (anomalies.length > 0) {
  await flagProductForReview(productId, anomalies, batchId)
  // Don't apply prices yet
  return
}

// 4. Only apply prices if no anomalies or anomalies approved
```

### Why This Prevents Issues

1. **Manual prices protected** - Admins can mark prices as high-trust
2. **Anomalies detected** - Import prices that don't make sense are caught
3. **Admin approval required** - All import prices reviewed before going live
4. **Audit trail** - Every change logged for compliance
5. **No data loss** - Original prices preserved until explicitly changed

---

## ✅ SUCCESS CRITERIA

### Schema Migration Complete
- [ ] price_audit_log table created
- [ ] price_anomalies table created
- [ ] price_anomaly_rules table created
- [ ] price_protections table created
- [ ] products table extended with price columns
- [ ] Indexes created
- [ ] RLS policies applied

### Anomaly Detection Working
- [ ] Products with cost > selling flagged CRITICAL
- [ ] Products with selling > 5000 flagged HIGH
- [ ] Products with excessive margin flagged HIGH
- [ ] Low margin products flagged MEDIUM
- [ ] Anomaly descriptions explain issue clearly

### Admin Workflow Complete
- [ ] Dashboard loads with flagged products
- [ ] Summary shows count by severity
- [ ] Table shows all anomalies
- [ ] Approve action marks as approved
- [ ] Correct action updates prices + creates audit log
- [ ] Protect action marks as high-trust
- [ ] Audit log shows all actions

### Data Integrity Verified
- [ ] All flagged products have correct anomaly records
- [ ] Approved products update audit log
- [ ] Corrected prices show in products table
- [ ] Protected prices cannot be queried for update
- [ ] No data loss
- [ ] Timestamps recorded
- [ ] Admin names recorded

### POS Integration Works
- [ ] POS can search for products
- [ ] Prices display correctly
- [ ] Can add to cart
- [ ] Sales ring up correctly
- [ ] No errors in logs

### Import Protection Ready
- [ ] High-trust prices not overwritten
- [ ] Import tries to overwrite → anomaly created
- [ ] Admin must approve before override
- [ ] Audit trail complete

---

## 🚀 NEXT STEPS

1. **Run diagnostics** (PRICING_CLEANUP_QUERIES.sql)
   - See what bad prices exist
   - Document counts
   - Show CEO/stakeholders impact

2. **Apply schema migration** (PRICING_PROTECTION_MIGRATION.sql)
   - Create tables
   - Add columns
   - Set up RLS
   - Populate default rules

3. **Test price audit page**
   - Login as admin
   - Navigate to /dashboard/prices
   - Verify flagged products appear
   - Verify anomalies populated correctly

4. **Review and approve prices** (1-2 hours)
   - For each flagged product
   - Decide: approve, correct, or protect
   - Add notes
   - Submit
   - Verify audit log

5. **Verify import protection**
   - Try to import CSV with conflicting prices
   - Should be blocked/flagged
   - Admin approval required

6. **Only then proceed with Phase 3 imports**
   - CSV pipeline enabled
   - Batch imports can begin
   - All price changes audited

---

## 📞 TROUBLESHOOTING

### "Dashboard shows no anomalies"
- Check schema migration applied: `SELECT COUNT(*) FROM price_anomalies;`
- Check products actually flagged: `SELECT price_review_status FROM products GROUP BY price_review_status;`
- Refresh page (possibly cached API response)

### "Can't correct price - says unauthorized"
- Must be logged in as admin
- Check user role: `SELECT role FROM users WHERE id = [your_id];`
- Must be 'admin' exactly

### "Audit log not recording"
- Check RLS policy allows inserts: `SELECT * FROM pg_policies WHERE tablename = 'price_audit_log';`
- Check user ID being passed: Should match `auth.uid()`

### "POS not finding products after correction"
- Check products table updated: `SELECT selling_price FROM products WHERE id = [id];`
- Check algolia/search index updated (if using full-text search)
- Rebuild search index if needed

---

## 📋 CHECKLIST BEFORE LARGE-SCALE IMPORTS

Before Phase 3 CSV imports begin:

- [ ] All obviously bad prices corrected (cost > selling, >5000 selling)
- [ ] Manually curated prices protected (high-trust)
- [ ] Anomaly detection rules verified working
- [ ] Admin approval workflow tested
- [ ] Audit trail recording all changes
- [ ] POS integration verified (prices display, sales work)
- [ ] Import protection tested (won't overwrite protected prices)
- [ ] All flagged anomalies resolved

**Only when ALL checkboxes are TRUE, proceed to Phase 3 CSV import.**

---

