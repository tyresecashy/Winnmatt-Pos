-- INVENTORY OPERATIONS VERIFICATION QUERIES
-- Run these SQL checks in Supabase to verify stock adjustments and movements

-- ============================================================
-- 1. VERIFY INVENTORY QUANTITY AFTER ADJUSTMENT
-- ============================================================
-- Check that inventory.quantity was actually updated
SELECT 
  i.id as inventory_id,
  p.sku,
  p.name,
  i.quantity as current_qty,
  i.last_counted_at,
  i.updated_at
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE i.product_id = '{{PRODUCT_ID}}'
  AND i.branch_id = '{{BRANCH_ID}}'
ORDER BY i.updated_at DESC;

-- ============================================================
-- 2. VERIFY STOCK MOVEMENTS AUDIT TRAIL
-- ============================================================
-- Check all stock movements for a product at a branch
SELECT 
  sm.id,
  sm.type,
  sm.quantity,
  CASE 
    WHEN sm.type = 'sale' THEN 'Sale'
    WHEN sm.type = 'receipt' THEN 'Purchase Receipt'
    WHEN sm.type = 'transfer' THEN 'Transfer'
    WHEN sm.type = 'adjustment' THEN 'Manual Adjustment'
    WHEN sm.type = 'damage' THEN 'Damage'
  END as movement_type,
  sm.reference_id,
  sm.notes,
  sm.created_at
FROM stock_movements sm
WHERE sm.product_id = '{{PRODUCT_ID}}'
  AND sm.branch_id = '{{BRANCH_ID}}'
ORDER BY sm.created_at DESC;

-- ============================================================
-- 3. COMPLETE AUDIT TRAIL FOR SPECIFIC PRODUCT + BRANCH
-- ============================================================
-- Shows inventory history with all adjustments
SELECT 
  DATE(sm.created_at) as date,
  sm.created_at as timestamp,
  sm.type,
  sm.quantity,
  sm.notes,
  sm.reference_id,
  (
    -- Running balance calculation
    SELECT SUM(sm2.quantity)
    FROM stock_movements sm2
    WHERE sm2.product_id = sm.product_id
      AND sm2.branch_id = sm.branch_id
      AND sm2.created_at <= sm.created_at
  ) as cumulative_change,
  (
    SELECT i.quantity
    FROM inventory i
    WHERE i.product_id = sm.product_id
      AND i.branch_id = sm.branch_id
  ) + (
    SELECT SUM(sm2.quantity)
    FROM stock_movements sm2
    WHERE sm2.product_id = sm.product_id
      AND sm2.branch_id = sm.branch_id
      AND sm2.created_at > sm.created_at
  ) as inventory_at_that_time
FROM stock_movements sm
WHERE sm.product_id = '{{PRODUCT_ID}}'
  AND sm.branch_id = '{{BRANCH_ID}}'
ORDER BY sm.created_at DESC;

-- ============================================================
-- 4. VERIFY ADJUSTMENT-TYPE MOVEMENTS ONLY
-- ============================================================
-- Show only manual adjustments (type='adjustment')
SELECT 
  sm.id,
  sm.quantity,
  sm.notes,
  sm.created_at,
  i.quantity as current_inventory
FROM stock_movements sm
JOIN inventory i ON sm.product_id = i.product_id AND sm.branch_id = i.branch_id
WHERE sm.product_id = '{{PRODUCT_ID}}'
  AND sm.branch_id = '{{BRANCH_ID}}'
  AND sm.type = 'adjustment'
ORDER BY sm.created_at DESC;

-- ============================================================
-- 5. LATEST MOVEMENT FOR EACH PRODUCT IN BRANCH
-- ============================================================
-- Quick overview of last change for all products
SELECT 
  p.id,
  p.sku,
  p.name,
  i.quantity as current_stock,
  sm.type as last_movement_type,
  sm.quantity as last_quantity_change,
  sm.notes,
  sm.created_at as last_movement_at
FROM products p
JOIN inventory i ON p.id = i.product_id
LEFT JOIN LATERAL (
  SELECT type, quantity, notes, created_at
  FROM stock_movements
  WHERE product_id = p.id
    AND branch_id = '{{BRANCH_ID}}'
  ORDER BY created_at DESC
  LIMIT 1
) sm ON TRUE
WHERE i.branch_id = '{{BRANCH_ID}}'
ORDER BY p.name;

-- ============================================================
-- 6. CHECK FOR NEGATIVE INVENTORY (SHOULD NOT EXIST)
-- ============================================================
-- Verify no inventory went negative (protection check)
SELECT 
  p.sku,
  p.name,
  i.quantity,
  i.branch_id,
  'WARNING: NEGATIVE STOCK' as alert
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE i.quantity < 0
ORDER BY i.quantity ASC;

-- ============================================================
-- 7. STOCK MOVEMENT SUMMARY FOR DATE RANGE
-- ============================================================
-- Summary of all movements in a time period
SELECT 
  DATE(sm.created_at) as date,
  sm.type,
  COUNT(*) as count,
  SUM(CASE WHEN sm.quantity > 0 THEN sm.quantity ELSE 0 END) as total_in,
  SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) ELSE 0 END) as total_out,
  SUM(sm.quantity) as net_change
FROM stock_movements sm
WHERE sm.branch_id = '{{BRANCH_ID}}'
  AND sm.created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(sm.created_at), sm.type
ORDER BY date DESC, type;

-- ============================================================
-- 8. VERIFY SALE INVENTORY DEDUCTION
-- ============================================================
-- Check that a specific sale actually reduced inventory
-- (Run after selling 3 units of a product)
SELECT 
  s.id as sale_id,
  s.receipt_number,
  si.product_id,
  p.name,
  si.quantity as units_sold,
  i.quantity as current_inventory,
  (i.quantity + si.quantity) as inventory_before_sale,
  sm.quantity as stock_movement_qty,
  s.created_at as sale_date,
  sm.created_at as movement_date
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
JOIN products p ON si.product_id = p.id
JOIN inventory i ON p.id = i.product_id AND s.branch_id = i.branch_id
LEFT JOIN stock_movements sm ON s.id = sm.reference_id AND sm.type = 'sale' AND sm.product_id = si.product_id
WHERE s.id = '{{SALE_ID}}'
ORDER BY si.product_id;
