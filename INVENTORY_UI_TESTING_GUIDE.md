# INVENTORY OPERATIONS - BROWSER TESTING GUIDE

## Overview
This guide walks through testing the inventory management UI for stock adjustments with full audit trail verification.

---

## PREREQUISITE: Get IDs

Before testing, you need these IDs for later verification:

1. **Login to the POS system** and note:
   - Your **Branch ID** (shown in Inventory page subtitle)
   - Your **Branch Name**

2. **From Inventory page**:
   - Click on any product to note its:
     - SKU
     - Product Name
     - Current Stock Quantity
     - Product ID (optional, from network tab)

---

## TEST SCENARIO 1: INCREASE STOCK (Incoming Shipment)

### Browser Steps

1. **Navigate to `/dashboard/inventory`**
   - You should see inventory table with products, current quantities, and status badges

2. **Find "Paracetamol 500mg"** (or any product in stock)
   - Note current quantity (e.g., 50)

3. **Click the ✏️ (Edit) button** in the Actions column
   - Stock Adjustment dialog opens
   - Shows current quantity

4. **In the dialog**:
   - **Adjustment Type**: Select "Increase Stock"
   - **Quantity**: Enter `15`
   - **Reason**: Type `Incoming shipment from Supplier ABC - Purchase Order REQ-001`
   - Click **Confirm Adjustment**

5. **Verify feedback**:
   - ✅ Toast notification: "Stock adjusted - Stock updated successfully"
   - Inventory table refreshes automatically
   - Product quantity changed from 50 → 65

6. **Database verification** (run in Supabase):
   ```sql
   -- Replace PRODUCT_ID and BRANCH_ID
   SELECT quantity, updated_at FROM inventory 
   WHERE product_id = '{{PRODUCT_ID}}' 
   AND branch_id = '{{BRANCH_ID}}';
   -- Expect: quantity = 65, updated_at = very recent timestamp
   ```

---

## TEST SCENARIO 2: DECREASE STOCK (Damage/Loss)

### Browser Steps

1. **On Inventory page**, find the same product from Test 1
   - Current quantity should now be 65 (or whatever it was)

2. **Click the ✏️ button** for that product

3. **In the dialog**:
   - **Adjustment Type**: Select "Decrease Stock"
   - **Quantity**: Enter `5`
   - **Reason**: Type `5 units damaged during storage inspection - Count #20260405`
   - Click **Confirm Adjustment**

4. **Verify feedback**:
   - ✅ Toast notification: "Stock adjusted"
   - Table refreshes
   - Quantity decreased from 65 → 60

5. **Database verification**:
   ```sql
   SELECT quantity, updated_at FROM inventory 
   WHERE product_id = '{{PRODUCT_ID}}' 
   AND branch_id = '{{BRANCH_ID}}';
   -- Expect: quantity = 60
   ```

---

## TEST SCENARIO 3: SET EXACT QUANTITY (Physical Count)

### Browser Steps

1. **On Inventory page**, find a low-stock product
   - Note current quantity (e.g., 8)

2. **Click the ✏️ button**

3. **In the dialog**:
   - **Adjustment Type**: Select "Set to Exact Quantity"
   - **Quantity**: Enter `20`
   - **Reason**: Type `Physical count performed - Counted 20 units on shelf`
   - Click **Confirm Adjustment**

4. **Verify feedback**:
   - ✅ Toast: "Stock adjusted"
   - Table shows quantity changed from 8 → 20
   - Dialog note shows: "Change: +12"

5. **Database verification**:
   ```sql
   SELECT quantity, updated_at FROM inventory 
   WHERE product_id = '{{PRODUCT_ID}}' 
   AND branch_id = '{{BRANCH_ID}}';
   -- Expect: quantity = 20
   ```

---

## TEST SCENARIO 4: VIEW STOCK MOVEMENT HISTORY

### Browser Steps

1. **On Inventory page**, find the product you've adjusted multiple times

2. **Click the 🕐 (History) button** in the Actions column
   - Stock Movements Dialog opens
   - Shows list of all movements for that product

3. **Verify you see**:
   - All three adjustments (increase, decrease, set)
   - Each shows:
     - Type badge: "Adjustment"
     - Quantity: +15, -5, +12
     - Reason/notes: Your typed reasons
     - Reference ID (first 8 chars of ID)
     - Timestamp: Created date/time
   - Recent movements appear first

4. **Check the order**:
   - Should be reverse chronological (newest first)

---

## TEST SCENARIO 5: EDGE CASE - PREVENT NEGATIVE STOCK

### Browser Steps

1. **Find a product with 3 units** (or select one with low stock)

2. **Click the ✏️ button**

3. **Try to decrease by more than available**:
   - **Adjustment Type**: "Decrease Stock"
   - **Quantity**: Enter `10` (more than 3)
   - **Reason**: `Test negative boundary`
   - Click **Confirm Adjustment**

4. **Verify error**:
   - ❌ Toast error: "Cannot decrease by 10. Only 3 units available."
   - Dialog stays open
   - Inventory NOT changed

5. **Database verification** (stock should be unchanged):
   ```sql
   SELECT quantity FROM inventory 
   WHERE product_id = '{{PRODUCT_ID}}' 
   AND branch_id = '{{BRANCH_ID}}';
   ```

---

## TEST SCENARIO 6: VERIFY STOCK MOVEMENTS TABLE

### Browser Steps

1. **Complete the above adjustments** (at least 2-3 different products)

2. **In Supabase SQL Editor**, run:
   ```sql
   SELECT 
     p.sku,
     p.name,
     sm.type,
     sm.quantity,
     sm.notes,
     sm.created_at
   FROM stock_movements sm
   JOIN products p ON sm.product_id = p.id
   WHERE sm.branch_id = '{{YOUR_BRANCH_ID}}'
     AND sm.type = 'adjustment'
   ORDER BY sm.created_at DESC;
   ```

3. **Verify results**:
   - ✅ Should see all adjustments you made
   - ✅ `quantity` column shows +15, -5, +12 (with correct signs)
   - ✅ `notes` column matches your reasons
   - ✅ `created_at` matches dialog timestamps

---

## TEST SCENARIO 7: VERIFY SALE INVENTORY DEDUCTION (End-to-End)

### Browser Steps

1. **Go to POS (`/dashboard/pos`)**

2. **Complete a test sale**:
   - Search and add a product to cart (e.g., 3 units)
   - Complete checkout with any payment method
   - Note the **Receipt Number** in success toast

3. **Verify inventory was deducted**:
   - Go back to Inventory page
   - Find that product
   - ✅ Quantity should be 3 less than before

4. **Click History (🕐) for that product**
   - ✅ Should see a "Sale" movement entry
   - ✅ Type: "Sale"
   - ✅ Quantity: -3
   - ✅ Ref: Receipt number (first 8 chars)

5. **In Supabase, run full audit query**:
   ```sql
   SELECT 
     s.receipt_number,
     si.product_id,
     si.quantity as sold_qty,
     i.quantity as current_inventory,
     sm.type,
     sm.quantity as movement_qty
   FROM sales s
   JOIN sale_items si ON s.id = si.sale_id
   JOIN inventory i ON si.product_id = i.product_id
   LEFT JOIN stock_movements sm ON s.id = sm.reference_id
   WHERE s.receipt_number = '{{RECEIPT_NUMBER}}'
   ORDER BY si.product_id;
   ```

---

## TEST SCENARIO 8: VERIFY BRANCH ISOLATION

### Browser Steps

1. **If you have multiple branches**, this verifies adjustments only affect the correct branch

2. **Ask another user on a different branch to**:
   - Note inventory quantity for a product

3. **You adjust that same product** (increase by 10)
   - In your branch

4. **Other user checks** that product inventory:
   - ✅ Should NOT have changed
   - Still shows original quantity

5. **SQL verification**:
   ```sql
   SELECT 
     b.name as branch,
     i.quantity,
     i.branch_id
   FROM inventory i
   JOIN branches b ON i.branch_id = b.id
   WHERE i.product_id = '{{PRODUCT_ID}}'
   ORDER BY b.name;
   -- Should see different quantities per branch
   ```

---

## TEST SCENARIO 9: REASON/NOTES AUDIT REQUIREMENT

### Browser Steps

1. **On Inventory page**, click ✏️ for any product

2. **Try to save WITHOUT a reason**:
   - Fill in quantity
   - Leave **Reason** empty
   - Try to click **Confirm Adjustment**
   - ❌ Button should be disabled (grayed out)
   - Or show error toast if you somehow submit

3. **Try again with reason**:
   - Add a reason
   - ✅ Button activates
   - Adjustment succeeds

---

## COMPLETE VERIFICATION QUERY

After all tests, run this in Supabase to see complete audit trail:

```sql
-- Replace {{BRANCH_ID}} with your branch ID
SELECT 
  DATE(sm.created_at) as date,
  p.sku,
  p.name,
  sm.type,
  sm.quantity,
  sm.notes,
  CASE 
    WHEN sm.reference_id IS NULL THEN 'Manual'
    ELSE sm.reference_id
  END as reference,
  sm.created_at
FROM stock_movements sm
JOIN products p ON sm.product_id = p.id
WHERE sm.branch_id = '{{BRANCH_ID}}'
  AND sm.created_at >= NOW() - INTERVAL '1 day'
ORDER BY sm.created_at DESC;
```

---

## EXPECTED FILES TO EXIST

After implementation, verify these files exist:

- ✅ `lib/inventory-actions.ts` - Server actions for adjustments
- ✅ `components/inventory/stock-adjustment-dialog.tsx` - Adjustment UI
- ✅ `components/inventory/stock-movements-dialog.tsx` - History viewer
- ✅ `app/(dashboard)/inventory/page.tsx` - Updated inventory page with buttons
- ✅ `lib/products-actions.ts` - Contains `adjustStockQuantity()` function
- ✅ `lib/sales-actions.ts` - Updated with inventory deduction on sale

---

## TROUBLESHOOTING

### Problem: Dialog doesn't open
- **Check**: Browser console for JS errors
- **Check**: Network tab - any 500 errors?
- **Fix**: Verify imports in page.tsx

### Problem: Toast doesn't show success
- **Check**: `use-toast.ts` hook is imported correctly
- **Check**: Toaster component is in root layout

### Problem: Inventory doesn't refresh
- **Check**: `onAdjustmentSuccess()` callback is being called
- **Check**: `getInventoryForBranch()` completes successfully

### Problem: Stock went negative
- **Check**: Min 0 protection is in `adjustStockQuantity()` function
- **Check**: Decrease validation in dialog component
- **Fix**: Run this to find and fix:
  ```sql
  SELECT id, product_id, quantity FROM inventory 
  WHERE quantity < 0 
  ORDER BY quantity ASC;
  ```

### Problem: Reason not shown in history
- **Check**: `notes` column is being saved in `stock_movements`
- **Check**: Dialog passes reason as second parameter to action

---

## SUCCESS CRITERIA

All of these must pass:

- [ ] Increase stock works → inventory.quantity increases
- [ ] Decrease stock works → inventory.quantity decreases
- [ ] Set exact quantity works → inventory.quantity set precisely
- [ ] Reason is required → can't submit without it
- [ ] History shows all movements → 🕐 button shows adjustment history
- [ ] Negative protection works → can't decrease below current
- [ ] Sales deduct inventory → completing sale reduces quantity
- [ ] Branch isolation works → adjustments don't affect other branches
- [ ] Audit trail complete → stock_movements table has all records
- [ ] Toast feedback works → success/error messages show

---

## DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Test all 9 scenarios above
- [ ] Verify SQL queries return expected results
- [ ] Check error handling for network failures
- [ ] Verify toasts show in dark mode
- [ ] Test on mobile (inventory page responsiveness)
- [ ] Verify permission checks (only managers/admins can adjust)
- [ ] Load test with 1000+ inventory items
- [ ] Check database constraints prevent edge cases
