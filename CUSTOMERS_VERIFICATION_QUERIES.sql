-- CUSTOMERS CRUD VERIFICATION QUERIES
-- Run these SQL checks in Supabase to verify customer operations

-- ============================================================
-- 1. VERIFY ALL CUSTOMERS EXIST IN DATABASE
-- ============================================================
SELECT 
  id,
  name,
  phone,
  email,
  type,
  loyalty_points,
  credit_limit,
  credit_balance,
  created_at,
  updated_at
FROM customers
ORDER BY created_at DESC;

-- ============================================================
-- 2. GET CUSTOMER COUNTS BY TYPE
-- ============================================================
SELECT 
  type,
  COUNT(*) as count
FROM customers
GROUP BY type
ORDER BY type;

-- ============================================================
-- 3. GET SPECIFIC CUSTOMER WITH PURCHASE HISTORY
-- ============================================================
-- Replace {{CUSTOMER_ID}} with actual customer UUID
SELECT 
  c.id,
  c.name,
  c.phone,
  c.email,
  c.type,
  c.loyalty_points,
  c.credit_balance,
  COUNT(s.id) as purchase_count,
  COALESCE(SUM(s.total_amount), 0) as total_spent,
  MAX(s.created_at) as last_purchase
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
WHERE c.id = '{{CUSTOMER_ID}}'
GROUP BY c.id, c.name, c.phone, c.email, c.type, c.loyalty_points, c.credit_balance;

-- ============================================================
-- 4. SEARCH CUSTOMERS BY NAME OR PHONE
-- ============================================================
-- Replace {{SEARCH_TERM}} with name, phone or email
SELECT 
  id,
  name,
  phone,
  email,
  type,
  created_at
FROM customers
WHERE 
  name ILIKE '%{{SEARCH_TERM}}%'
  OR phone ILIKE '%{{SEARCH_TERM}}%'
  OR email ILIKE '%{{SEARCH_TERM}}%'
ORDER BY name;

-- ============================================================
-- 5. GET TOP CUSTOMERS BY SPENDING
-- ============================================================
SELECT 
  c.id,
  c.name,
  c.phone,
  c.type,
  COUNT(s.id) as purchases,
  COALESCE(SUM(s.total_amount), 0) as total_spent,
  MAX(s.created_at) as last_purchase
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
GROUP BY c.id, c.name, c.phone, c.type
ORDER BY total_spent DESC
LIMIT 10;

-- ============================================================
-- 6. GET CUSTOMERS WITH CREDIT BALANCE
-- ============================================================
-- Shows customers who owe money
SELECT 
  id,
  name,
  phone,
  type,
  credit_limit,
  credit_balance,
  ROUND((credit_balance::float / NULLIF(credit_limit, 0)) * 100, 2) as credit_used_percent
FROM customers
WHERE credit_balance > 0
ORDER BY credit_balance DESC;

-- ============================================================
-- 7. GET RECENT CUSTOMERS (LAST 7 DAYS)
-- ============================================================
SELECT 
  id,
  name,
  phone,
  email,
  type,
  created_at
FROM customers
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ============================================================
-- 8. VERIFY CUSTOMER-SALES RELATIONSHIP
-- ============================================================
-- Check if sales correctly reference customers
SELECT 
  c.name,
  COUNT(s.id) as sale_count,
  SUM(s.total_amount) as total_amount
FROM customers c
LEFT JOIN sales s ON c.id = s.customer_id
WHERE c.type = 'retail'
GROUP BY c.name
ORDER BY sale_count DESC;

-- ============================================================
-- 9. FIND CUSTOMERS WITH NO PURCHASES (UNUSED)
-- ============================================================
SELECT 
  id,
  name,
  phone,
  email,
  created_at
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM sales s WHERE s.customer_id = c.id
)
ORDER BY created_at DESC;

-- ============================================================
-- 10. GET CUSTOMER PURCHASE DETAILS FOR SPECIFIC CUSTOMER
-- ============================================================
-- Replace {{CUSTOMER_ID}} with customer UUID
SELECT 
  s.id,
  s.receipt_number,
  s.total_amount,
  s.payment_method,
  s.created_at,
  COUNT(si.id) as item_count
FROM sales s
LEFT JOIN sale_items si ON s.id = si.sale_id
WHERE s.customer_id = '{{CUSTOMER_ID}}'
GROUP BY s.id, s.receipt_number, s.total_amount, s.payment_method, s.created_at
ORDER BY s.created_at DESC;
