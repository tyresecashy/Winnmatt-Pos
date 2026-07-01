# PHASE 1 QUICK TEST GUIDE - TEST THIS NOW

## ⏱️ 15-Minute Quick Test

### Prerequisites
- ✅ Build completed successfully
- ✅ Database running (Supabase accessible)
- ✅ Have 1 admin user created
- ✅ Have 3+ products in database
- ✅ Have 1+ branch in database

---

## TEST 1: Basic Cash Sale (5 min)

**Goal:** Verify sale is saved to database

**Steps:**
```
1. npm run dev
2. Navigate to http://localhost:3000/pos
3. Login as admin/user
4. Add 3 products: Search by name or SKU, click to add
5. Verify cart shows all 3 items with prices
6. Click "PROCEED TO PAYMENT"
7. Select "Cash" payment method
8. Enter amount (equal or higher than total)
9. Click "COMPLETE PAYMENT"

Expected: Green toast "Sale Completed - Receipt #RCP-... saved successfully"
Error: Red toast with specific error message
```

**Verification:**
- [ ] Toast appeared (success or specific error)
- [ ] Cart cleared
- [ ] Dialog closed
- [ ] Ready for next transaction

---

## TEST 2: Database Verification (5 min)

**In Supabase Dashboard:**

```
1. Go to SQL Editor
2. Run:
   SELECT id, receipt_number, total_amount, payment_method 
   FROM sales 
   ORDER BY created_at DESC LIMIT 1;

3. Note the receipt_number from POS

Expected: Row with matching receipt number, payment_method='cash'

4. Run:
   SELECT * FROM sale_items 
   WHERE sale_id = '<sale_id_from_above>'

Expected: 3 rows (one per product) with quantities matching what you added

5. Run:
   SELECT * FROM stock_movements 
   WHERE reference_id = '<sale_id>' AND type='sale'

Expected: 3 rows with negative quantities (inventory decrement)
```

**Verification:**
- [ ] Sales row exists
- [ ] Receipt number matches POS
- [ ] 3 sale_items rows created
- [ ] 3 stock_movements rows created
- [ ] All timestamps recent

---

## TEST 3: M-Pesa Payment (3 min)

**Steps:**
```
1. Add 2 products to cart
2. Click "PROCEED TO PAYMENT"
3. Select "M-Pesa"
4. Click "COMPLETE PAYMENT"

Expected: Success toast, new sale with payment_method='bank_transfer'
```

**Verify in DB:**
```
SELECT payment_method FROM sales 
ORDER BY created_at DESC LIMIT 1;

Expected: 'bank_transfer'
```

---

## TEST 4: Error Handling (2 min)

**Test: No Products in Cart**
```
1. Go to POS page with empty cart
2. Click "PROCEED TO PAYMENT"

Expected: Should not open payment dialog (button disabled or error)
```

**Test: Network Error**
- [ ] Disable internet
- [ ] Try to complete sale
- [ ] Expected: Error toast "Failed to save sale"
- [ ] Enable internet, cart still has items
- [ ] Complete sale - should work now

---

## ✅ SUCCESS CRITERIA

All tests pass when:
- [ ] Test 1: Sale completes with success toast
- [ ] Test 2: Sales + sale_items + stock_movements records exist in DB
- [ ] Test 3: M-Pesa saves with payment_method='bank_transfer'
- [ ] Test 4: Errors handled gracefully with clear messages

---

## 🐛 Troubleshooting

**Issue:** Toast shows error "Missing required information"
- **Cause:** User has no branch assigned
- **Fix:** Ensure logged-in user has valid branch_id in users table

**Issue:** Toast shows error "Failed to save sale" with Supabase error
- **Cause:** Database connection issue or schema mismatch
- **Fix:** Verify db-migrations.sql was run, check Supabase status

**Issue:** No toast appears, just clears cart
- **Cause:** Old version still running
- **Fix:** Stop dev server, rebuild: `npm run build`, restart: `npm run dev`

**Issue:** Database records not appearing
- **Cause:** Different database/branch context
- **Fix:** Check Supabase project is same, reload dashboard

---

## 📝 Record Your Results

**Test Date:** _____________

**Environment:** 
- Branch: _____________
- User: _____________
- Database: _____________

**Test Results:**
- Test 1 (Cash): [ ] PASS [ ] FAIL
- Test 2 (DB): [ ] PASS [ ] FAIL
- Test 3 (M-Pesa): [ ] PASS [ ] FAIL
- Test 4 (Errors): [ ] PASS [ ] FAIL

**Issues Found:**
_________________________________________________
_________________________________________________

**Notes:**
_________________________________________________

---

## 🎯 What To Do Next

**If ALL TESTS PASS:**
→ Move to Phase 2: Real Inventory Queries
→ Document results
→ Plan Phase 2 timeline

**If ANY TEST FAILS:**
→ Note the specific error
→ Check troubleshooting section
→ If still stuck, review PHASE1_IMPLEMENTATION.md for details

---

## 📊 Sample Data to Add

**If you need to populate database with test data:**

```sql
-- Insert sample branch (if doesn't exist)
INSERT INTO branches (name, code, is_main)
VALUES ('Test Branch', 'TST-001', true)
ON CONFLICT DO NOTHING;

-- Insert sample products (if doesn't exist)
INSERT INTO products (sku, name, selling_price, purchase_price, reorder_level)
VALUES 
  ('TEST-001', 'Test Product 1', 1000, 800, 10),
  ('TEST-002', 'Test Product 2', 2000, 1500, 10),
  ('TEST-003', 'Test Product 3', 1500, 1200, 10)
ON CONFLICT DO NOTHING;

-- Insert inventory (link products to branch)
INSERT INTO inventory (product_id, branch_id, quantity)
SELECT p.id, b.id, 100
FROM products p, branches b
WHERE p.sku LIKE 'TEST-%' AND b.code = 'TST-001'
ON CONFLICT DO NOTHING;
```

Run in Supabase SQL Editor, then refresh POS page to see products.

