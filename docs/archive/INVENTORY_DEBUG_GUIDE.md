# Inventory Page Debugging Guide

## Root Cause Analysis

The Inventory page shows "No products found" despite real inventory data existing in the database. This guide helps identify the exact issue.

## Potential Issues Identified

1. **Profile/Branch Context Issue**: `profile?.branch_id` might be undefined or null
2. **Query Data Format Issue**: Supabase relations might not be resolving correctly
3. **Data Mapping Issue**: The returned data structure might not match what the UI expects
4. **Empty Result Issue**: The query might be returning an empty array

## Browser Console Debugging

### Step 1: Check Browser Logs
Open browser DevTools (F12) and go to Console tab:

1. **Reload the Inventory page** while watching the console
2. **Look for these log messages** (all tagged with `[INVENTORY]` or `[INVENTORY PAGE]`):
   ```
   [INVENTORY PAGE] Profile: {...}
   [INVENTORY PAGE] Branch ID: <uuid-string>
   [INVENTORY PAGE] Fetching inventory for branch: <uuid-string>
   [INVENTORY] Fetching inventory for branch: <uuid-string>
   [INVENTORY] Basic query (no relations) test result:
   [INVENTORY] - Error: <null or error object>
   [INVENTORY] - Data count: <number>
   [INVENTORY] Received data: [...]
   [INVENTORY PAGE] Data length: <number>
   ```

### Step 2: Identify the Failure Point

Check which of these conditions is true:

```
CHECK A: Is profil e loading?
→ Look for: [INVENTORY PAGE] Profile: {..., branch_id: "...", branch: {...}}
  ✓ YES: Profile loaded → Go to CHECK B
  ✗ NO: Profile is null/undefined → **ISSUE: Auth context not loading**

CHECK B: Is branch_id present?
→ Look for: [INVENTORY PAGE] Branch ID: <uuid>
  ✓ YES: Branch ID found → Go to CHECK C
  ✗ NO: Branch ID is null/undefined → **ISSUE: User not assigned to branch**

CHECK C: Is Supabase query returning results?
→ Look for: [INVENTORY] - Data count: <number>
  ✓ > 0: Data found → Go to CHECK D
  ✗ = 0: Empty results → **ISSUE: No inventory rows for this branch**

CHECK D: Is data structure correct?
→ Look for: [INVENTORY] - Has product relation? YES
  ✓ YES: Relations resolved → Go to CHECK E
  ✗ NO: Relations not resolved → **ISSUE: Supabase relation parsing failed**

CHECK E: Is data being displayed?
→ Look for: [INVENTORY PAGE] Data length: <number>
  ✓ > 0: Data displayed → ✓ FIXED
  ✗ = 0: Not displayed → **ISSUE: Data lost in component state**
```

## SQL Verification Steps

Run these SQL commands in Supabase SQL Editor to verify database state:

### Query 1: Check your branch exists
```sql
-- Find your branch by name
SELECT id, name, code FROM branches 
WHERE name LIKE '%Bungoma%' OR code LIKE '%MAIN%';

-- Copy the `id` value - you'll need it for next queries
```

### Query 2: Check your user assignment
```sql
-- Replace <USER_ID> with your user ID from the UI or logs
SELECT id, email, full_name, branch_id, role 
FROM users 
WHERE email = 'tyresecashy@gmail.com';

-- Copy the `branch_id` value - should match the id from Query 1
```

### Query 3: Check inventory exists for your branch
```sql
-- Replace <BRANCH_ID> with the branch_id from Query 2
SELECT COUNT(*) as total_rows, COUNT(DISTINCT product_id) as unique_products
FROM inventory 
WHERE branch_id = '<BRANCH_ID>';

-- Expected: total_rows > 0, unique_products > 0
```

### Query 4: Check inventory items with products
```sql
-- Replace <BRANCH_ID> with the branch_id from Query 2
SELECT 
  i.id,
  i.quantity,
  p.name,
  p.sku,
  p.purchase_price,
  p.reorder_level,
  c.name as category
FROM inventory i
JOIN products p ON i.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE i.branch_id = '<BRANCH_ID>'
ORDER BY p.name
LIMIT 10;

-- Expected: 10 rows with product names, quantities, etc.
```

### Query 5: Check Supabase can join relationships
```sql
-- This replicates what the Supabase API should return
-- Replace <BRANCH_ID> with the branch_id from Query 2
SELECT 
  i.id,
  i.quantity,
  i.product_id,
  i.branch_id,
  p.id as product_id_check,
  p.name as product_name,
  p.sku,
  p.selling_price,
  p.purchase_price,
  p.reorder_level,
  p.category_id,
  c.id as category_id_check,
  c.name as category_name,
  c.icon
FROM inventory i
LEFT JOIN products p ON i.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE i.branch_id = '<BRANCH_ID>'
ORDER BY p.name;

-- Expected: Rows with all fields populated
```

## Manual Testing Checklist

### Before Changes
- [ ] Screenshot of "No products found" message
- [ ] Screenshot of browser console logs (copy full logs to text file)
- [ ] Note the exact branch name shown in the page header
- [ ] Run SQL Query 3 above and note the row count

### After Changes
- [ ] Reload browser (Ctrl+F5 to clear cache)
- [ ] Check browser console for new debug logs
- [ ] Scroll through all console logs looking for errors
- [ ] Note the branch_id shown in logs
- [ ] Run SQL Queries 1-4 using the branch_id from logs
- [ ] Verify SQL results show inventory data exists
- [ ] Check if inventory table now displays products

### If Still Not Working
- [ ] Check browser DevTools > Network tab
  - Look for failed requests to `/inventory` or API endpoints
  - Check response payload for errors
- [ ] Check Supabase Project → Logs
  - Look for query errors
  - Note any RLS policy rejections
- [ ] Verify branch table has all expected branches
  - Query: `SELECT id, name, code FROM branches;`
- [ ] Verify user is assig to correct branch
  - Query: `SELECT email, branch_id FROM users WHERE email = 'tyresecashy@gmail.com';`

## Files Modified

The following files have been updated with logging and debug UI:

1. **[lib/products-actions.ts](lib/products-actions.ts)**
   - Added detailed logging to `getInventoryForBranch()`
   - Tests basic query first, then with relations
   - Logs error details for debugging

2. **[app/(dashboard)/inventory/page.tsx](app/(dashboard)/inventory/page.tsx)**
   - Added debug card showing auth/branch status
   - Added detailed logging when loading inventory
   - Shows if profile or branch_id is missing

## Next Steps

1. **Open Inventory page** and check browser console
2. **Run SQL Query 3** to verify inventory data exists
3. **Match results**: If SQL shows data but browser shows nothing, it's a data structure/mapping issue
4. **Share logs**: Copy console logs and SQL query results to identify exact failure point

## Expected Log Output When Working

```
[AUTH] User profile loaded: tyresecashy@gmail.com cashier at Bungoma Main Branch
[INVENTORY PAGE] Profile: {id: "...", email: "...", branch_id: "...", branch: {id: "...", name: "Bungoma Main Branch", code: "..."}}
[INVENTORY PAGE] Branch ID: c1234567-89ab-cdef-0123-456789abcdef
[INVENTORY PAGE] Calling getInventoryForBranch with: c1234567-89ab-cdef-0123-456789abcdef
[INVENTORY] Fetching inventory for branch: c1234567-89ab-cdef-0123-456789abcdef
[INVENTORY] Basic query (no relations) test result:
[INVENTORY] - Error: null
[INVENTORY] - Data count: 18
[INVENTORY] Full query result:
[INVENTORY] - Row count: 18
[INVENTORY] - Has product relation? YES
[INVENTORY] Received data: [18 items...]
[INVENTORY PAGE] Data length: 18
```

## RLS (Row Level Security) Note

The database has RLS enabled on all tables, but NO RLS policies are defined.
- Server-side code using `supabaseAdmin` client bypasses RLS ✓
- Client-side code would be blocked by RLS policies (need to be defined)
- Current setup should work for server actions

## Contact & Support

If debug logs show:
- **"No branch_id"** - Check user provisioning in admin panel
- **"Query error"** - Check Supabase project keys and permissions
- **"Empty results"** - Verify inventory seeding ran successfully
- **"Relation error"** - Check Supabase API version compatibility

---

**Last Updated**: 2025-04-05
**Status**: Debugging Guide
