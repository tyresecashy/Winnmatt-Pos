# PRICING CLEANUP - IMPLEMENTATION CHECKLIST

Use this checklist to implement the price protection framework step-by-step.

---

## ✅ PRE-IMPLEMENTATION (Now)

### Understand the Problem
- [ ] Read PRICING_CLEANUP_SUMMARY.md
- [ ] Understand root causes (seed data 30-50x too high)
- [ ] Understand impact (bad prices block Phase 3 imports)
- [ ] Understand timeline (5 hours total to implementation + review)

### Gather Current State
- [ ] Open Supabase SQL editor
- [ ] Run diagnostic query to count bad prices:
  ```sql
  SELECT 
    SUM(CASE WHEN purchase_price > selling_price THEN 1 ELSE 0 END) as cost_gt_selling,
    SUM(CASE WHEN selling_price > 5000 THEN 1 ELSE 0 END) as selling_gt_5000,
    COUNT(*) as total_products
  FROM products;
  ```
- [ ] Document the numbers
- [ ] Note which specific products are wrong (Coca Cola, Detergent, Oil?)

### Get Stakeholder Buy-In
- [ ] Show numbers to stakeholders
- [ ] Explain 5-hour time investment
- [ ] Explain prevents weeks of cleanup later
- [ ] Get approval to proceed

---

## ✅ PHASE 1: DATABASE SCHEMA (10 minutes)

### Apply Migration
- [ ] Open PRICING_PROTECTION_MIGRATION.sql
- [ ] Copy entire file contents
- [ ] Go to Supabase → SQL Editor → New Query
- [ ] Paste the migration
- [ ] Click "Run" button
- [ ] Wait for completion (should be fast)
- [ ] Check for any error messages
  - If error about schema_versions table: comment out that section and rerun

### Verify Schema Applied
- [ ] In SQL editor, run:
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE schemaname='public' AND tablename LIKE 'price_%'
  ORDER BY tablename;
  ```
- [ ] Expected result:
  ```
  price_anomalies
  price_anomaly_rules
  price_audit_log
  price_protections
  ```
- [ ] Verify products table extended:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name='products' AND column_name LIKE 'price_%'
  ORDER BY column_name;
  ```
- [ ] Expected result:
  ```
  price_review_notes
  price_review_status
  price_reviewed_at
  price_reviewed_by
  price_source
  price_trust_level
  ```

### Verify Default Rules
- [ ] In SQL editor:
  ```sql
  SELECT rule_name, severity, blocks_approval FROM price_anomaly_rules
  ORDER BY rule_name;
  ```
- [ ] Should see 6 rules:
  - HighCostPrice
  - HighRetailPrice
  - CostGtSelling (CRITICAL, blocks_approval=TRUE)
  - ExcessiveMargin (HIGH, blocks_approval=TRUE)
  - LowMargin
  - UnrealisticCombination

**CHECKPOINT 1: Schema is in place ✓**

---

## ✅ PHASE 2: APPLICATION CODE (Already Done)

### Code Files Created
- [x] lib/price-audit-service.ts - Backend service
- [x] app/api/prices/review/route.ts - API endpoint
- [x] app/api/prices/approve/route.ts - API endpoint
- [x] components/prices/price-audit-dashboard.tsx - React component
- [x] app/(dashboard)/prices/page.tsx - Admin page

### Verify Files Exist
- [ ] Check lib/price-audit-service.ts exists
  ```bash
  ls -la lib/price-audit-service.ts
  ```
- [ ] Check API routes exist:
  ```bash
  ls -la app/api/prices/
  ```
- [ ] Check components exist:
  ```bash
  ls -la components/prices/price-audit-dashboard.tsx
  ```

### Build & Deploy
- [ ] If local development:
  ```bash
  npm run dev
  # App starts on localhost:3000
  ```
- [ ] If using production:
  - Already deployed (no action needed)
  - Or deploy using your normal process

**CHECKPOINT 2: Application code is in place ✓**

---

## ✅ PHASE 3: BROWSER TESTING (15 minutes)

### Access Dashboard
- [ ] Open browser → localhost:3000 (or production URL)
- [ ] Login with admin account
  - [ ] Username: (your admin email)
  - [ ] Password: (your password)
- [ ] Should see dashboard menu
- [ ] Navigate to: Settings → Prices
  - OR direct: /dashboard/prices

### Verify Dashboard Loads
- [ ] Page should show title: "Price Audit & Protection"
- [ ] Should show blue info box with key points
- [ ] Should show summary boxes:
  - [ ] "Total Anomalies" count
  - [ ] "Critical" count (red box)
  - [ ] "High" count (orange box)
  - [ ] "Medium" count (yellow box)
- [ ] Below summary: Table with flagged products
  - [ ] Columns: Product | Anomaly Type | Severity | Current Price | Suggested | Actions
  - [ ] Rows: List of products with anomalies
  - [ ] Buttons per row: Approve | Correct | Protect

### Check for Specific Products
- [ ] Look for Coca Cola in the table
  - [ ] Current selling should be 6000 or similar (wrong)
  - [ ] Suggested selling should be lower (correct)
  - [ ] Severity should be "HIGH" (red badge)
- [ ] Look for any products with "Cost > Selling"
  - [ ] Severity should be "CRITICAL" (dark red)
- [ ] Look for Detergent and Oil
  - [ ] Should also be flagged with HIGH severity

**CHECKPOINT 3: Dashboard displays correctly ✓**

---

## ✅ PHASE 4: ADMIN WORKFLOW TEST (30 minutes)

### Test [Approve] Action
- [ ] Find a product with severity="MEDIUM"
- [ ] Click the [Approve] button
- [ ] Dialog opens with:
  - [ ] Product name at top
  - [ ] Current prices shown
  - [ ] Optional notes field
- [ ] Enter notes: "Reviewed and approved"
- [ ] Click "Confirm" button
- [ ] Wait for success message
- [ ] Verify:
  - [ ] Message shows "Success"
  - [ ] Product removed from table (or status changed)
  - [ ] Refresh page to confirm persistent

### Test [Correct] Action
- [ ] Find problematic product (e.g., Coca Cola @ 6000)
- [ ] Click the [Correct] button
- [ ] Dialog opens with:
  - [ ] Product name
  - [ ] Current price fields (should show 6000 selling price)
  - [ ] "New Selling Price" field (empty or suggested value)
  - [ ] "New Cost Price" field (empty or suggested)
  - [ ] Notes field
- [ ] Update fields:
  - [ ] New Selling Price: 150 (realistic for Coca Cola)
  - [ ] New Cost Price: 100 (reasonable wholesale)
  - [ ] Notes: "Corrected from seed data - original was 6000"
- [ ] Click "Confirm" button
- [ ] Verify:
  - [ ] Success message appears
  - [ ] Product removed from table
  - [ ] No errors in browser console

### Test [Protect] Action
- [ ] Find manually curated product (e.g., Bread @ 65, Eggs @ 20)
- [ ] Click the [Protect] button
- [ ] Dialog opens
- [ ] Enter notes: "Manually verified good price - protect from import overwrites"
- [ ] Click "Confirm"
- [ ] Verify:
  - [ ] Success message
  - [ ] Product changed status

### Test Audit Trail
- [ ] After correcting prices, go to Supabase SQL editor
- [ ] Run:
  ```sql
  SELECT 
    product_id, 
    previous_selling_price, 
    new_selling_price,
    change_type,
    change_reason,
    reviewed_by,
    reviewed_at
  FROM price_audit_log
  ORDER BY reviewed_at DESC
  LIMIT 5;
  ```
- [ ] Verify results show:
  - [ ] Previous price (e.g., 6000)
  - [ ] New price (e.g., 150)
  - [ ] change_type = 'correction'
  - [ ] change_reason = your notes
  - [ ] reviewed_by = admin user ID
  - [ ] reviewed_at = timestamp

**CHECKPOINT 4: Admin workflow works ✓**

---

## ✅ PHASE 5: POS INTEGRATION TEST (10 minutes)

### Test Product Search
- [ ] Go to POS page (/dashboard/pos)
- [ ] Search for corrected product (e.g., "Coca Cola")
- [ ] Verify:
  - [ ] Product appears in search results
  - [ ] Price displays correctly (e.g., 150 not 6000)
  - [ ] Product name/SKU correct

### Test Add to Cart
- [ ] Click product to add to cart
- [ ] Verify:
  - [ ] Product added to order
  - [ ] Unit price shows correct value
  - [ ] Subtotal calculates correctly
  - [ ] No errors

### Test Checkout
- [ ] Add more items if needed
- [ ] Click "Checkout" or "Complete Sale"
- [ ] Enter customer info if required
- [ ] Select payment method
- [ ] Click "Complete"
- [ ] Verify:
  - [ ] Sale completes successfully
  - [ ] Receipt prints (or preview shows)
  - [ ] Prices are correct on receipt

### Verify in Database
- [ ] Go to Supabase SQL editor
- [ ] Run:
  ```sql
  SELECT 
    s.id, s.total_amount, s.created_at,
    si.product_id, si.unit_price, si.quantity
  FROM sales s
  JOIN sale_items si ON s.id = si.sale_id
  WHERE si.product_id = '[coca_cola_product_id]'
  ORDER BY s.created_at DESC
  LIMIT 1;
  ```
- [ ] Verify:
  - [ ] unit_price shows corrected value (e.g., 150)
  - [ ] total_amount calculated with correct price
  - [ ] timestamp is recent (just now)

**CHECKPOINT 5: POS integration works ✓**

---

## ✅ PHASE 6: FULL CLEANUP REVIEW (1-2 hours)

### Review All Flagged Products
- [ ] Return to /dashboard/prices
- [ ] For EACH product in the list:
  - [ ] Click product row
  - [ ] Decide: Approve / Correct / Protect
  - [ ] Enter appropriate price if correcting
  - [ ] Add notes explaining decision
  - [ ] Submit
  - [ ] Move to next product

### Typical Decisions:
**CRITICAL Products (Cost > Selling):**
- [ ] MUST be corrected
- [ ] Usually: 25-50% markup on cost
- [ ] Action: [Correct]

**HIGH Selling > 5000:**
- [ ] MUST be corrected
- [ ] Find realistic price for category
- [ ] Action: [Correct]

**HIGH Margin > 300%:**
- [ ] MUST be corrected
- [ ] Reduce to 50-100% markup
- [ ] Action: [Correct]

**MEDIUM/LOW Severity:**
- [ ] Can usually [Approve]
- [ ] Or [Correct] if concerned
- [ ] Action: [Approve] or [Correct]

**Manually Curated (Bread, Eggs):**
- [ ] Very [Protect] to prevent overwrites
- [ ] Or [Approve] if confident
- [ ] Action: [Protect]

### Track Progress
- [ ] Keep note of total count
- [ ] After each product, decrement
- [ ] Aim to complete in 1-2 hours
- [ ] Refresh to see updated counts

**CHECKPOINT 6: All products reviewed and approved ✓**

---

## ✅ PHASE 7: FINAL VERIFICATION (15 minutes)

### Verify All Data
- [ ] Go to Supabase SQL editor
- [ ] Run summary:
  ```sql
  SELECT 
    COUNT(DISTINCT product_id) as reviewed_products,
    COUNT(*) as total_actions,
    COUNT(DISTINCT reviewed_by) as admins,
    MAX(reviewed_at) as last_action
  FROM price_audit_log;
  ```
- [ ] Verify:
  - [ ] reviewed_products = approximate match to flagged count
  - [ ] total_actions > reviewed_products
  - [ ] All actions recorded with timestamps

### Verify Protections
- [ ] Run:
  ```sql
  SELECT COUNT(*) as protected_count FROM price_protections;
  ```
- [ ] Should be > 0 (at least the manually curated ones)

### Verify Anomalies Status
- [ ] Run:
  ```sql
  SELECT status, COUNT(*) as count 
  FROM price_anomalies 
  GROUP BY status
  ORDER BY status;
  ```
- [ ] Most should be 'approved' or 'corrected'
- [ ] Few/none should be 'flagged'

### Check for Zero Critical Anomalies
- [ ] Run:
  ```sql
  SELECT COUNT(*) as critical_flagged
  FROM price_anomalies
  WHERE severity='critical' AND status='flagged';
  ```
- [ ] Result should be: 0
- [ ] All CRITICAL anomalies must be corrected

### Dashboard Should Be Empty
- [ ] Go back to /dashboard/prices
- [ ] Dashboard should show:
  - [ ] Checkmark: "All prices approved ✓"
  - [ ] Message: "No anomalies detected"
  - [ ] Table: Empty or minimal

**CHECKPOINT 7: All cleanup complete ✓**

---

## ✅ PHASE 8: READINESS FOR PHASE 3 (5 minutes)

### Final Checklist
- [ ] All critical anomalies corrected
- [ ] Dashboard shows clean state
- [ ] Audit log populated with all changes
- [ ] Protections set on manually curated prices
- [ ] POS integration tested and working
- [ ] No errors in logs or browser console

### Sign-Off
- [ ] Get stakeholder sign-off:
  - [ ] CEO/Manager reviews price corrections
  - [ ] Confirms bad prices are fixed
  - [ ] Approves proceeding to Phase 3
- [ ] Document:
  - [ ] Total bad prices found: ___
  - [ ] Total corrected: ___
  - [ ] Total protected: ___
  - [ ] Time taken: ___
  - [ ] Date completed: ___

**CHECKPOINT 8: System ready for Phase 3 ✓**

---

## 🚀 PROCEED TO PHASE 3

Once all 8 checkpoints passed:

- [ ] Phase 3 CSV import can proceed safely
- [ ] Protected prices won't be overwritten
- [ ] All import prices go through anomaly detection
- [ ] Complete audit trail maintained
- [ ] Admin has full control

### Next Actions:
1. Read PHASE_3_TEST_PACKAGE_READY.md
2. Prepare CSV test data
3. Execute Phase 3 test sequence
4. Verify import protection works
5. Proceed to production imports

---

## ⏱️ TIME TRACKING

| Phase | Task | Time |
|-------|------|------|
| 1 | Schema migration | 10 min |
| 2 | Code verification | 5 min |
| 3 | Dashboard access | 15 min |
| 4 | Workflow testing | 30 min |
| 5 | POS integration | 10 min |
| 6 | Full product review | 60-120 min |
| 7 | Final verification | 15 min |
| 8 | Readiness sign-off | 5 min |
| **TOTAL** | | **2-3 hours** |

(Plus initial 30 min for understanding + stakeholder buy-in)

---

## 📞 TROUBLESHOOTING

### Schema Application Failed
- [ ] Error message about syntax?
  - Check you copied the entire file
  - Try running smaller sections
  - Check Supabase syntax
- [ ] Error about schema_versions table?
  - Comment out the INSERT statement
  - Table might already exist
- [ ] Permission error?
  - Make sure you're using admin/service role
  - Check project settings

### Dashboard Won't Load
- [ ] Getting 401 error?
  - Must be logged in as admin
  - Check role: SELECT role FROM users WHERE id='[your_id]'
- [ ] Getting 403 error?
  - Your account isn't admin
  - Ask admin to grant role
- [ ] Component not rendering?
  - Check browser console (F12)
  - Look for JavaScript errors
  - Refresh hard (Ctrl+Shift+R)

### Approve/Correct Button Not Working
- [ ] Getting API error?
  - Check you're admin
  - Check API route files exist
  - Check browser console for details
- [ ] Dialog won't submit?
  - Make sure fields are valid
  - Check for required fields
  - Check browser console

### Prices Not Updating in POS
- [ ] Products not searchable?
  - Wait 1-2 minutes (cache)
  - Hard refresh POS page
  - Check products table has data
- [ ] Old prices showing?
  - Refresh page (F5)
  - Clear browser cache (Ctrl+Shift+Del)
  - Check database directly

---

## 📋 PRINT THIS AND MARK OFF BOXES

Print this checklist and maintain it as you work through implementation. Check off each item as you complete it. This provides a clear progress indicator and helps identify any gaps.

**Good luck! You've got this. ✨**

