-- PRICING CLEANUP: POST-CORRECTION DIAGNOSTIC QUERIES
-- Run these after applying PRICING_CORRECTION_MIGRATION.sql
-- to verify the cleanup was successful

-- =============================================================================
-- QUERY 1: VERIFY CORRECTIONS APPLIED
-- =============================================================================
-- Should show all 14 corrected products with new realistic prices

SELECT 
  'CORRECTED PRODUCTS' as category,
  p.id, p.sku, p.name,
  p.selling_price as new_price,
  p.purchase_price as cost,
  ROUND(((p.selling_price - p.purchase_price)::float / p.purchase_price * 100)::numeric, 1) as margin_pct,
  p.price_source,
  p.price_review_status
FROM products p
WHERE p.price_source = 'seed_corrected'
ORDER BY p.selling_price DESC;

-- Expected: 14 rows with realistic prices (70, 110, 155, 210, 689, etc)

-- =============================================================================
-- QUERY 2: VERIFY TRUSTED PRICES PROTECTED
-- =============================================================================
-- Should show 7 protected manual prices, all unchanged

SELECT 
  'PROTECTED MANUAL PRICES' as category,
  p.id, p.sku, p.name,
  p.selling_price,
  p.price_trust_level,
  pr.protection_level,
  pr.protected_at
FROM products p
LEFT JOIN price_protections pr ON p.id = pr.product_id
WHERE p.price_trust_level = 'high'
  AND p.price_source = 'manual'
ORDER BY p.selling_price ASC;

-- Expected: 7 rows (Eggs 20, Bread Brown 65, etc) with protection_level='high'

-- =============================================================================
-- QUERY 3: VERIFY FLAGGED ITEMS FOR REVIEW
-- =============================================================================
-- Should show 2 items flagged as uncertain (not guessed)

SELECT 
  'FLAGGED FOR MANUAL REVIEW' as category,
  p.id, p.sku, p.name,
  p.selling_price,
  p.price_review_status,
  pa.anomaly_type,
  pa.severity,
  pa.suggestion_reason
FROM products p
LEFT JOIN price_anomalies pa ON p.id = pa.product_id
WHERE p.price_review_status = 'flagged'
ORDER BY p.selling_price DESC;

-- Expected: 2 rows (Rice 10kg, Ice Cream 500ml) - not corrected, flagged for review

-- =============================================================================
-- QUERY 4: AUDIT TRAIL - ALL CORRECTIONS LOGGED
-- =============================================================================
-- Should show complete history of all price changes

SELECT 
  al.product_id,
  p.name,
  al.previous_selling_price,
  al.new_selling_price,
  al.change_type,
  al.change_reason,
  al.reviewed_by,
  al.reviewed_at
FROM price_audit_log al
JOIN products p ON al.product_id = p.id
WHERE al.change_type = 'correction'
ORDER BY al.reviewed_at DESC
LIMIT 20;

-- Expected: 14 rows showing before/after for each corrected product

-- =============================================================================
-- QUERY 5: SUMMARY - CURRENT STATE OF ALL PRODUCTS
-- =============================================================================
-- Overview of how many products are in each state

SELECT 
  CASE 
    WHEN price_source = 'seed_corrected' THEN 'Corrected (Seed→Real Data)'
    WHEN price_trust_level = 'high' THEN 'Protected (Manual)'
    WHEN price_review_status = 'flagged' THEN 'Flagged (Needs Review)'
    ELSE 'Other'
  END as status,
  COUNT(*) as count,
  MIN(selling_price) as min_price,
  MAX(selling_price) as max_price,
  ROUND(AVG(selling_price)::numeric, 0) as avg_price
FROM products
GROUP BY 
  CASE 
    WHEN price_source = 'seed_corrected' THEN 'Corrected (Seed→Real Data)'
    WHEN price_trust_level = 'high' THEN 'Protected (Manual)'
    WHEN price_review_status = 'flagged' THEN 'Flagged (Needs Review)'
    ELSE 'Other'
  END
ORDER BY count DESC;

-- Expected summary:
-- Corrected: 14 products
-- Protected: 7 products  
-- Flagged: 2 products

-- =============================================================================
-- QUERY 6: HEALTH CHECK - NO CRITICAL ISSUES REMAINING
-- =============================================================================
-- Verify no critical anomalies remain (cost > selling, unrealistic margins)

SELECT 
  'CRITICAL ISSUES' as severity,
  COUNT(*) as count,
  'Cost > Selling' as issue_type
FROM products
WHERE purchase_price > selling_price

UNION ALL

SELECT 'HIGH', COUNT(*), 'Selling > 3000 KES'
FROM products
WHERE selling_price > 3000 AND price_source != 'seed_corrected'

UNION ALL

SELECT 'HIGH', COUNT(*), 'Margin > 300%'
FROM products
WHERE purchase_price > 0
  AND ((selling_price - purchase_price)::float / purchase_price) > 3.0
  AND price_source != 'seed_corrected'

ORDER BY severity, issue_type;

-- Expected after cleanup:
-- CRITICAL issues: 0
-- HIGH (margin > 300%): 0-2 (maybe Rice if not corrected)
-- HIGH (selling > 3000): 2-4 (Rice, possibly Ice Cream, others if legitimate bulk items)

-- =============================================================================
-- QUERY 7: CORRECTED PRICES - DETAILED BREAKDOWN
-- =============================================================================
-- See all corrected prices categorized

SELECT 
  CASE
    WHEN LOWER(name) LIKE '%coca%' OR LOWER(name) LIKE '%sprite%' OR LOWER(name) LIKE '%fanta%' THEN 'Beverages'
    WHEN LOWER(name) LIKE '%bread%' THEN 'Bakery'
    WHEN LOWER(name) LIKE '%milk%' OR LOWER(name) LIKE '%yogurt%' THEN 'Dairy'
    WHEN LOWER(name) LIKE '%detergent%' OR LOWER(name) LIKE '%soap%' THEN 'Cleaning'
    WHEN LOWER(name) LIKE '%oil%' THEN 'Cooking Oil'
    WHEN LOWER(name) LIKE '%toothpaste%' THEN 'Dental'
    WHEN LOWER(name) LIKE '%doritos%' OR LOWER(name) LIKE '%lay%' OR LOWER(name) LIKE '%mentos%' THEN 'Snacks'
    ELSE 'Other'
  END as category,
  COUNT(*) as corrected_count,
  ROUND(AVG(selling_price)::numeric, 0) as avg_price,
  MIN(selling_price) as min_price,
  MAX(selling_price) as max_price
FROM products
WHERE price_source = 'seed_corrected'
GROUP BY category
ORDER BY category;

-- Expected breakdown by category with realistic average prices

-- =============================================================================
-- QUERY 8: REMAINING SUSPICIOUS PRICES - FULL LIST
-- =============================================================================
-- Complete list of prices that still need attention
-- (after correcting the 14 obvious ones)

SELECT 
  CASE 
    WHEN p.purchase_price > p.selling_price THEN 'CRITICAL'
    WHEN p.selling_price > 3000 AND p.price_source != 'seed_corrected' THEN 'HIGH'
    WHEN p.purchase_price > 0 AND ((p.selling_price - p.purchase_price)::float / p.purchase_price) > 3.0 AND p.price_source != 'seed_corrected' THEN 'HIGH'
    ELSE 'MEDIUM'
  END as severity,
  p.id, p.sku, p.name,
  p.selling_price,
  p.purchase_price,
  ROUND(((p.selling_price - p.purchase_price)::float / NULLIF(p.purchase_price, 0) * 100)::numeric, 1) as margin_pct,
  p.price_review_status,
  p.price_source
FROM products p
WHERE p.price_source != 'seed_corrected'
  AND p.price_trust_level != 'high'
  AND (
    p.purchase_price > p.selling_price  -- Cost > Selling
    OR p.selling_price > 3000  -- Still high after cleanup
    OR (p.purchase_price > 0 AND ((p.selling_price - p.purchase_price)::float / p.purchase_price) > 3.0)  -- >300% margin
  )
ORDER BY severity, p.selling_price DESC;

-- Expected: Should show only 2 flagged items (Rice, Ice Cream) + any other legitimate bulk items

-- =============================================================================
-- QUERY 9: COMPARE BEFORE/AFTER FOR KEY PRODUCTS
-- =============================================================================
-- Show audit trail for a few key corrections

SELECT 
  p.name,
  al.previous_selling_price as before,
  al.new_selling_price as after,
  ROUND(((al.new_selling_price - al.previous_selling_price)::float / al.previous_selling_price * 100)::numeric, 1) as pct_change,
  al.change_reason,
  al.reviewed_at
FROM price_audit_log al
JOIN products p ON al.product_id = p.id
WHERE al.change_type = 'correction'
  AND LOWER(p.name) IN (
    LOWER('Coca Cola 500ml'),
    LOWER('Milk 1L'),
    LOWER('Detergent Powder 1kg'),
    LOWER('Cooking Oil 2L'),
    LOWER('Bread White 700g')
  )
ORDER BY al.reviewed_at DESC;

-- Expected: Shows key corrections with ~98%+ price reductions

-- =============================================================================
-- QUERY 10: READINESS CHECK FOR PHASE 3 IMPORTS
-- =============================================================================
-- Verify system is ready for Phase 3 CSV imports

SELECT 
  (SELECT COUNT(*) FROM products WHERE price_source = 'seed_corrected') as corrected_products,
  (SELECT COUNT(*) FROM products WHERE price_trust_level = 'high') as protected_products,
  (SELECT COUNT(*) FROM products WHERE price_review_status = 'flagged') as flagged_products,
  (SELECT COUNT(*) FROM price_protections) as active_protections,
  (SELECT COUNT(*) FROM price_audit_log) as audit_entries,
  (SELECT MAX(reviewed_at) FROM price_audit_log) as last_correction_time
AS readiness_check;

-- Expected output (all should show progress):
-- corrected_products: 14 (or more if additional corrections made)
-- protected_products: 7 (trusted prices)
-- flagged_products: 2 (Rice, Ice Cream)
-- active_protections: >= 7
-- audit_entries: >= 14
-- last_correction_time: recent timestamp

-- =============================================================================
-- QUERY 11: FINAL VALIDATION - MARGIN ANALYSIS
-- =============================================================================
-- Verify margins are within reasonable retail ranges after cleanup

SELECT 
  CASE
    WHEN ROUND(((p.selling_price - p.purchase_price)::float / p.purchase_price * 100)::numeric, 0) BETWEEN 10 AND 150 THEN '✓ Healthy (10-150%)'
    WHEN ROUND(((p.selling_price - p.purchase_price)::float / p.purchase_price * 100)::numeric, 0) < 10 THEN '⚠ Low (<10%)'
    WHEN ROUND(((p.selling_price - p.purchase_price)::float / p.purchase_price * 100)::numeric, 0) > 300 THEN '✗ Excessive (>300%)'
    ELSE 'High (150-300%)'
  END as margin_health,
  COUNT(*) as product_count,
  ROUND(AVG(CASE WHEN p.purchase_price > 0 THEN ((p.selling_price - p.purchase_price)::float / p.purchase_price * 100) ELSE 0 END)::numeric, 1) as avg_margin_pct
FROM products p
WHERE p.price_source = 'seed_corrected' OR p.price_trust_level = 'high'
GROUP BY margin_health
ORDER BY margin_health DESC;

-- Expected: Most should be in "Healthy (10-150%)" range after cleanup
