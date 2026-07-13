-- PRICING CLEANUP DIAGNOSTIC QUERIES
-- Run these immediately to identify bad prices in current live data
-- Keep these results for documentation before changes

-- =============================================================================
-- 1. BASELINE: Current product count and price distribution
-- =============================================================================

-- Total products and basic stats
SELECT 
  COUNT(*) as total_products,
  MIN(selling_price) as min_selling_price,
  MAX(selling_price) as max_selling_price,
  AVG(selling_price) as avg_selling_price,
  MIN(purchase_price) as min_purchase_price,
  MAX(purchase_price) as max_purchase_price,
  AVG(purchase_price) as avg_purchase_price
FROM products;

-- =============================================================================
-- 2. UNREALISTIC RETAIL PRICES (selling_price)
-- =============================================================================

-- Products with very high selling prices (likely demo/seed data)
-- Realistic retail in Kenya: most items <5,000 KES (bulk items ~10,000 max)
SELECT 
  id, sku, name, 
  selling_price,
  purchase_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent,
  created_at
FROM products
WHERE selling_price > 5000
ORDER BY selling_price DESC
LIMIT 50;

-- Extreme selling prices (very likely errors)
SELECT 
  id, sku, name, 
  selling_price,
  purchase_price,
  category_id,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent
FROM products
WHERE selling_price > 10000
ORDER BY selling_price DESC;

-- =============================================================================
-- 3. UNREALISTIC COST PRICES (purchase_price)
-- =============================================================================

-- Products with very high cost prices
-- Realistic cost in Kenya: most items <3,000 KES
SELECT 
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent,
  created_at
FROM products
WHERE purchase_price > 3000
ORDER BY purchase_price DESC
LIMIT 30;

-- =============================================================================
-- 4. COST > SELLING PRICE (CRITICAL - losing money)
-- =============================================================================

SELECT 
  id, sku, name, 
  purchase_price as cost,
  selling_price as selling,
  (purchase_price - selling_price) as loss_per_unit,
  ROUND(((purchase_price - selling_price)::float / purchase_price * 100)::numeric, 1) as negative_margin_percent,
  created_at
FROM products
WHERE purchase_price > selling_price
ORDER BY (purchase_price - selling_price) DESC;

-- =============================================================================
-- 5. SUSPICIOUS MARGINS - Too High
-- =============================================================================

-- Products with unrealistic markup (>300% margin is suspicious for retail)
-- Healthy retail margin: 20-100% depending on item
SELECT 
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent,
  (selling_price - purchase_price) as margin_amount,
  created_at,
  category_id
FROM products
WHERE purchase_price > 0
  AND ((selling_price - purchase_price)::float / purchase_price) > 3.0  -- >300% margin
ORDER BY ((selling_price - purchase_price)::float / purchase_price) DESC
LIMIT 50;

-- =============================================================================
-- 6. SUSPICIOUS MARGINS - Too Low or Negative
-- =============================================================================

-- Products with unrealistic low/negative markup (<10% or negative)
SELECT 
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent,
  (selling_price - purchase_price) as margin_amount,
  created_at
FROM products
WHERE purchase_price > 0
  AND ((selling_price - purchase_price)::float / purchase_price) < 0.1  -- <10% margin
ORDER BY ((selling_price - purchase_price)::float / purchase_price) ASC
LIMIT 50;

-- =============================================================================
-- 7. PRICE ANOMALIES BY CATEGORY
-- =============================================================================

-- Show price distribution by category to spot outliers
SELECT 
  c.name as category,
  COUNT(p.id) as product_count,
  MIN(p.selling_price) as min_selling,
  MAX(p.selling_price) as max_selling,
  ROUND(AVG(p.selling_price)::numeric, 0) as avg_selling,
  MIN(p.purchase_price) as min_cost,
  MAX(p.purchase_price) as max_cost,
  ROUND(AVG(p.purchase_price)::numeric, 0) as avg_cost
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY c.id, c.name
ORDER BY max_selling DESC;

-- =============================================================================
-- 8. SEED/DEMO PRODUCTS (likely high prices or very low prices)
-- =============================================================================

-- Products with extremely round prices (likely seed data)
-- Seed data often has round numbers: 1000, 5000, 10000, etc
SELECT 
  id, sku, name, 
  selling_price,
  purchase_price,
  created_at,
  -- Check if price is suspiciously round
  CASE 
    WHEN selling_price % 1000 = 0 AND selling_price > 1000 THEN 'Very round (seed?)'
    WHEN selling_price % 500 = 0 AND selling_price > 1000 THEN 'Round (seed?)'
    ELSE 'Normal'
  END as seed_indicator
FROM products
WHERE selling_price > 500
ORDER BY selling_price DESC;

-- Products created early (likely seed data)
SELECT 
  id, sku, name, 
  selling_price,
  purchase_price,
  created_at,
  AGE(CURRENT_DATE::timestamp, created_at) as age
FROM products
ORDER BY created_at ASC
LIMIT 50;

-- =============================================================================
-- 9. SPECIFIC PROBLEM EXAMPLES FROM USER
-- =============================================================================

-- Find the problematic products mentioned
SELECT 
  id, sku, name, 
  selling_price,
  purchase_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent,
  created_at
FROM products
WHERE 
  LOWER(name) LIKE '%coca%cola%' 
  OR LOWER(name) LIKE '%detergent%'
  OR LOWER(name) LIKE '%cooking oil%'
  OR LOWER(name) LIKE '%eggs%'
  OR LOWER(name) LIKE '%bread%'
ORDER BY selling_price DESC;

-- =============================================================================
-- 10. PRODUCTS NEEDING IMMEDIATE REVIEW
-- =============================================================================

-- Combined query: all suspicious products flagged
SELECT 
  'CRITICAL: Cost > Selling' as issue_type,
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent
FROM products
WHERE purchase_price > selling_price

UNION ALL

SELECT 
  'HIGH: Margin >300%' as issue_type,
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent
FROM products
WHERE purchase_price > 0
  AND ((selling_price - purchase_price)::float / purchase_price) > 3.0

UNION ALL

SELECT 
  'HIGH: Selling >5000 KES' as issue_type,
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent
FROM products
WHERE selling_price > 5000

UNION ALL

SELECT 
  'MEDIUM: Cost >3000 KES' as issue_type,
  id, sku, name, 
  purchase_price,
  selling_price,
  ROUND(((selling_price - purchase_price)::float / purchase_price * 100)::numeric, 1) as margin_percent
FROM products
WHERE purchase_price > 3000

ORDER BY issue_type, selling_price DESC;

-- =============================================================================
-- 11. SUMMARY COUNTS
-- =============================================================================

SELECT 
  SUM(CASE WHEN purchase_price > selling_price THEN 1 ELSE 0 END) as cost_gt_selling,
  SUM(CASE WHEN purchase_price > 0 AND ((selling_price - purchase_price)::float / purchase_price) > 3.0 THEN 1 ELSE 0 END) as margin_over_300pct,
  SUM(CASE WHEN selling_price > 5000 THEN 1 ELSE 0 END) as selling_gt_5000,
  SUM(CASE WHEN purchase_price > 3000 THEN 1 ELSE 0 END) as cost_gt_3000,
  COUNT(*) as total_products
FROM products;
