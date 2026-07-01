# Branch Transfers - Quick Testing & Verification Guide

## What Changed

### ✅ REPLACED
- `app/(dashboard)/transfers/page.tsx` - From 100% hardcoded mock data to real database queries
- Removed: `import { stockMovements } from "@/lib/mock-data"`
- Removed: Fake "New Transfer" button with no functionality

### ✅ CREATED
- `lib/transfer-actions.ts` - 6 server functions for real transfers
- `components/transfers/new-transfer-dialog.tsx` - Full UI dialog for creating transfers  
- `BRANCH_TRANSFERS_IMPLEMENTATION.md` - Complete audit & implementation docs

### ✅ FEATURES ADDED
- Real branch selection from database
- Real product availability checks
- Real inventory updates (source -N, destination +N)
- Real audit trail (2 stock_movements entries linked by reference_id)
- Complete validation (no negative stock, branches must differ, etc)
- Notes field for transfer reasons
- Error messages for invalid transfers

---

## 60-Second Test

### Step 1: Open Transfers Page (15 seconds)

```
1. Click Sidebar → Transfers
2. Should see "Branch Transfers" page with:
   - Total Transfers: [number]
   - Completed: [number]  
   - Pending: 0
   - "New Transfer" button

3. If this shows numbers > 0, transfers from DB are loading ✅
```

### Step 2: Create a Transfer (30 seconds)

```
1. Click "New Transfer" button
2. Source Branch: Select "Main Branch - Nakuru"
   - Wait for products to load
   - Should show products with quantities like "Coca-Cola 500ml (245 avail)"

3. Destination Branch: Select "Eldoret Branch"

4. Add Product:
   - Click product dropdown → "Coca-Cola 500ml"
   - Quantity: 50
   - Click "Add"
   - Should see row in table: Coca-Cola | 50 | 245

5. Optional: Add note: "Rebalancing stock"

6. Click "Create Transfer"
   - Dialog closes
   - Page refreshes
   - New transfer appears in "Recent Transfers" table
```

### Step 3: Verify Inventory (15 seconds)

```
1. Click Sidebar → Inventory
2. Find "Coca-Cola 500ml"
3. Check quantities:
   - Main Branch: Should have decreased by 50
   - Eldoret Branch: Should have increased by 50
```

**If all ✅ checks pass: Implementation is working correctly!**

---

## Detailed Test Scenarios

### Scenario A: Valid Transfer

**Test:** Transfer 30 units of Mumias Sugar from Main to Eldoret

**Expected:** 
- ✅ Dialog closes
- ✅ Transfer appears in table
- ✅ Main inventory decreased by 30
- ✅ Eldoret inventory increased by 30

**Run SQL Check:**
```sql
SELECT * FROM inventory 
WHERE product_id IN (SELECT id FROM products WHERE name ILIKE '%mumias%')
ORDER BY updated_at DESC;
```

---

### Scenario B: Invalid - Same Branch

**Test:** Try to transfer with same branch for source and destination

**Expected:**
- ⚠️ Error message: "Destination branch must be different from source branch"
- ❌ Destination field clears
- ❌ Cannot submit

---

### Scenario C: Invalid - Insufficient Stock

**Test:** Find a product with 10 units. Try to transfer 50.

**Expected:**
- ⚠️ Error: "Quantity exceeds available stock (10 available)"
- ❌ Item NOT added to list
- ❌ Cannot submit

---

### Scenario D: Unknown Product Destination

**Test:** Transfer product that Eldoret doesn't have inventory for yet

**Expected:**
- ✅ Transfer succeeds
- ✅ Inventory row auto-created at destination with correct quantity
- ✅ Can transfer TO destination again with correct accumulated stock

**Run SQL Check:**
```sql
SELECT p.name, i.branch_id, b.name, i.quantity
FROM inventory i
JOIN products p ON i.product_id = p.id  
JOIN branches b ON i.branch_id = b.id
WHERE p.name = '[transferred product name]'
ORDER BY b.name;
```

---

## SQL Verification (Copy & Paste)

### Check 1: See All Transfers

```sql
SELECT 
  sm.reference_id,
  p.name as product,
  b.name as branch,
  sm.quantity,
  sm.created_at
FROM stock_movements sm
JOIN products p ON sm.product_id = p.id
JOIN branches b ON sm.branch_id = b.id
WHERE sm.type = 'transfer'
ORDER BY sm.created_at DESC
LIMIT 20;
```

### Check 2: Verify Matched Pairs

```sql
SELECT 
  reference_id,
  COUNT(*) as entries,
  STRING_AGG(b.name, ' ↔ ' ORDER BY sm.quantity) as route,
  SUM(ABS(sm.quantity)) as total_units,
  MAX(sm.created_at) as date
FROM stock_movements sm
JOIN branches b ON sm.branch_id = b.id
WHERE sm.type = 'transfer'
GROUP BY reference_id
ORDER BY date DESC;
```

### Check 3: Verify Inventory Math

```sql
-- For a specific product, show before/after quantities at each branch
SELECT 
  p.name,
  b.name as branch,
  i.quantity as current_qty,
  i.updated_at
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN branches b ON i.branch_id = b.id
WHERE p.name ILIKE '%coca%'
ORDER BY b.name, p.name;
```

### Check 4: Find Transfers by Reference ID

```sql
-- Paste reference_id from transfer (e.g., TRANSFER-1712282400000-abc123)
SELECT 
  sm.id,
  b.name,
  p.name,
  sm.quantity,
  sm.notes,
  sm.created_at
FROM stock_movements sm
JOIN branches b ON sm.branch_id = b.id
JOIN products p ON sm.product_id = p.id
WHERE sm.reference_id = 'TRANSFER-PUT-ACTUAL-ID-HERE'
ORDER BY sm.quantity;
```

---

## What Not To Do

❌ Don't edit `mock-data.ts` - transfers no longer use it  
❌ Don't expect "Pending" transfers - everything auto-completes (future: add approval)  
❌ Don't transfer to same branch - validation prevents this  
❌ Don't transfer 0 or negative quantities - validation prevents this  
❌ Don't expect hardcoded branch names - now comes from database  

---

## Troubleshooting

### Dialogs Don't Open
- Verify `components/transfers/new-transfer-dialog.tsx` exists ✓
- Check browser console for errors
- Clear browser cache and reload

### Products Don't Load in Dialog
- Make sure source branch has products with stock > 0
- Check inventory table has rows for that branch
- Verify products are linked to correct files

### Transfer Creates But Inventory Doesn't Update
- Check `lib/transfer-actions.ts` createStockTransfer() runs without errors
- Verify inventory table rows exist for both branches/products
- Check RLS policies allow updates (likely not the issue if you can create sales)

### Need to Undo a Transfer?
- Manually adjust inventory quantities in database
- Create reverse transfer (Eldoret → Main with same quantity)
- Or contact support for manual audit correction

---

## Performance Notes

- Transfers load instantly (indexed queries)
- Dialog product loading is O(1) - fast lookup by branch
- Creating transfers is transactional - either all items succeed or none
- Stock movements appear instantly - no async delay

---

## What's Next?

Future enhancements (not implemented):
- [ ] Approval workflow for transfers (Pending → Approved → Completed)
- [ ] Transfer rejection/cancellation
- [ ] Batch transfers (multiple products at once, template reuse)
- [ ] Transfer history with user who initiated
- [ ] Dashboard widget showing recent transfers
- [ ] Export transfer reports
- [ ] Recurring transfers schedule

