-- ============================================================================
-- WINNMATT POS: PRICE CLEANUP VERIFICATION QUERIES
-- Run these after PRICING_CLEANUP_PRODUCTION.sql completes
-- ============================================================================

-- ============================================================================
-- QUERY 1: VERIFY ALL CORRECTIONS APPLIED
-- Expected: 13 products corrected
-- ============================================================================
SELECT 'QUERY 1: Verify Corrections Applied' as query_info;

SELECT 
    sku,
    name,
    selling_price,
    purchase_price,
    price_source,
    price_review_status
FROM products
WHERE price_source = 'seed_corrected'
ORDER BY name;

-- Expected results (13 products):
-- Coca Cola 500ml | 70 | seed_corrected | approved
-- Sprite 500ml | 70 | seed_corrected | approved
-- Fanta Orange 500ml | 70 | seed_corrected | approved
-- Milk 1L | 155 | seed_corrected | approved
-- Yogurt 500ml | 200 | seed_corrected | approved
-- Bread White 700g | 110 | seed_corrected | approved
-- Doritos 50g | 60 | seed_corrected | approved
-- Lay's Classic 50g | 60 | seed_corrected | approved
-- Mentos 25g | 45 | seed_corrected | approved
-- Detergent Powder 1kg | 210 | seed_corrected | approved
-- Soap Bar 150g | 280 | seed_corrected | approved
-- Toothpaste 120g | 290 | seed_corrected | approved
-- Cooking Oil 2L | 689 | seed_corrected | approved

-- ============================================================================
-- QUERY 2: VERIFY PROTECTED MANUAL PRICES (Unchanged)
-- Expected: 7 products with price_trust_level = 'high'
-- ============================================================================
SELECT 'QUERY 2: Verify Protected Manual Prices' as query_info;

SELECT 
    sku,
    name,
    selling_price,
    purchase_price,
    price_source,
    price_trust_level,
    price_review_status
FROM products
WHERE price_trust_level = 'high'
ORDER BY name;

-- Expected results (7 products):
-- Bread Brown 600g | 65 | manual | high | approved
-- Eggs | 20 | manual | high | approved
-- JEMBE 2KGS | 160 | manual | high | approved
-- Kiwi 100ml | 60 | manual | high | approved
-- ROSY LIQUID HAND WASH 500ML | 300 | manual | high | approved
-- SOMO 10LTRS | 1050 | manual | high | approved
-- jogoo 2kgs | 180 | manual | high | approved

-- ============================================================================
-- QUERY 3: VERIFY FLAGGED ITEMS (Uncertain - Manual Review Required)
-- Expected: 2 products flagged
-- ============================================================================
SELECT 'QUERY 3: Verify Flagged Items (Manual Review Required)' as query_info;

SELECT 
    sku,
    name,
    selling_price,
    purchase_price,
    price_review_status,
    price_trust_level,
    price_review_notes
FROM products
WHERE price_review_status = 'flagged'
ORDER BY name;

-- Expected results (2 products):
-- Ice Cream 500ml | 22000 | flagged | low | "Flagged for manual review: ice cream pricing varies by brand..."
-- Rice 10kg | 110000 | flagged | low | "Flagged for manual review: bulk rice pricing varies..."

-- ============================================================================
-- QUERY 4: VERIFY AUDIT TRAIL CREATED
-- Expected: 13 audit log entries (one per correction)
-- ============================================================================
SELECT 'QUERY 4: Verify Audit Trail' as query_info;

SELECT 
    COUNT(*) as total_audit_entries,
    MIN(created_at) as first_entry,
    MAX(created_at) as last_entry
FROM price_audit_log
WHERE change_type = 'correction';

-- Expected: total_audit_entries = 13

-- Detail audit entries
SELECT 
    p.name,
    pal.previous_selling_price,
    pal.new_selling_price,
    pal.change_reason,
    pal.created_at
FROM price_audit_log pal
JOIN products p ON pal.product_id = p.id
WHERE pal.change_type = 'correction'
ORDER BY p.name;

-- ============================================================================
-- QUERY 5: MARGIN ANALYSIS - Verify corrected prices are healthy
-- Expected: All corrected items should have 20-50% margin
-- ============================================================================
SELECT 'QUERY 5: Margin Analysis for Corrected Items' as query_info;

SELECT 
    sku,
    name,
    purchase_price,
    selling_price,
    ROUND(((selling_price - purchase_price) * 100.0 / purchase_price), 1) as margin_percent,
    CASE 
        WHEN ((selling_price - purchase_price) * 100.0 / purchase_price) < 10 THEN 'LOW (⚠️ below 10%)'
        WHEN ((selling_price - purchase_price) * 100.0 / purchase_price) > 100 THEN 'HIGH (may be excessive)'
        ELSE 'HEALTHY (✓)'
    END as margin_health,
    price_source
FROM products
WHERE price_source = 'seed_corrected'
ORDER BY margin_percent;

-- Expected: All margins should be 20-70% (healthy retail margin)

-- ============================================================================
-- QUERY 6: CRITICAL - Remaining Suspicious Prices After Cleanup
-- This is the FINAL VALIDATION QUERY
-- Expected: ZERO critical issues remaining
-- ============================================================================
SELECT 'QUERY 6: CRITICAL - Remaining Suspicious Prices' as query_info;

SELECT 
    sku,
    name,
    purchase_price,
    selling_price,
    CASE 
        WHEN selling_price <= purchase_price THEN 'CRITICAL: Cost ≥ Selling (losing money!) 🔴'
        WHEN selling_price > 5000 AND price_source != 'manual' THEN 'CRITICAL: Unusual high price 🔴'
        WHEN ((selling_price - purchase_price) * 100.0 / purchase_price) > 200 THEN 'HIGH: Margin > 200% 🟠'
        WHEN purchase_price > 3000 AND ((selling_price - purchase_price) * 100.0 / purchase_price) < 10 THEN 'MEDIUM: Low margin on expensive item 🟡'
        ELSE 'OK ✓'
    END as issue_type,
    price_source,
    price_review_status
FROM products
WHERE 
    -- Identify remaining suspicious prices
    (
        selling_price <= purchase_price
        OR (selling_price > 5000 AND price_source NOT IN ('manual', 'seed_corrected'))
        OR ((selling_price - purchase_price) * 100.0 / purchase_price) > 200
        OR (purchase_price > 3000 AND ((selling_price - purchase_price) * 100.0 / purchase_price) < 10)
    )
    AND price_review_status != 'blocked'
ORDER BY 
    CASE 
        WHEN selling_price <= purchase_price THEN 1
        WHEN selling_price > 5000 AND price_source != 'manual' THEN 2
        WHEN ((selling_price - purchase_price) * 100.0 / purchase_price) > 200 THEN 3
        ELSE 4
    END,
    name;

-- ============================================================================
-- QUERY 7: QUICK SUMMARY - Before vs After
-- ============================================================================
SELECT 'QUERY 7: Cleanup Summary' as query_info;

SELECT 
    'Products Corrected' as category,
    COUNT(*) as count
FROM products
WHERE price_source = 'seed_corrected'

UNION ALL

SELECT 
    'Protected High-Trust',
    COUNT(*)
FROM products
WHERE price_trust_level = 'high'

UNION ALL

SELECT 
    'Flagged for Manual Review',
    COUNT(*)
FROM products
WHERE price_review_status = 'flagged'

UNION ALL

SELECT 
    'Total Products',
    COUNT(*)
FROM products;

-- ============================================================================
-- QUERY 8: POS INTEGRATION TEST PREP
-- Verify corrected prices will work correctly in sales module
-- ============================================================================
SELECT 'QUERY 8: POS Integration Readiness' as query_info;

SELECT 
    name,
    selling_price,
    purchase_price,
    'Ready for POS' as status
FROM products
WHERE price_source IN ('seed_corrected', 'manual')
  AND price_review_status = 'approved'
ORDER BY selling_price DESC;

-- These are the prices that will appear in POS searches
