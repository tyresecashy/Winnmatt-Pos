-- ============================================================
-- Global Search Engine (PostgreSQL Full-Text Search)
-- ============================================================
-- FIXED: Uses employee_profiles instead of non-existent employees table
-- FIXED: Uses correct column names (contact_person not contact_name)
-- FIXED: Removed branch_id filter on products (column doesn't exist)

-- Add search vectors to key tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create search indexes using GIN
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_search ON employee_profiles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_suppliers_search ON suppliers USING gin(search_vector);

-- Update products search vector
CREATE OR REPLACE FUNCTION update_products_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.sku, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.brand, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_products_search_vector
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_search_vector();

-- Update customers search vector
CREATE OR REPLACE FUNCTION update_customers_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.phone, '') || ' ' ||
    coalesce(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customers_search_vector
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_search_vector();

-- Update employee_profiles search vector
CREATE OR REPLACE FUNCTION update_employee_profiles_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.employee_id, '') || ' ' ||
    coalesce(NEW.staff_number, '') || ' ' ||
    coalesce(NEW.position, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employee_profiles_search_vector
  BEFORE INSERT OR UPDATE ON employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_profiles_search_vector();

-- Update suppliers search vector
CREATE OR REPLACE FUNCTION update_suppliers_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.contact_person, '') || ' ' ||
    coalesce(NEW.email, '') || ' ' ||
    coalesce(NEW.phone, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_suppliers_search_vector
  BEFORE INSERT OR UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_search_vector();

-- ============================================================
-- Global Search RPC Function
-- ============================================================

CREATE OR REPLACE FUNCTION search_all(
  p_search_query TEXT,
  p_entity_types TEXT[] DEFAULT NULL,
  p_result_limit INT DEFAULT 50
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  title TEXT,
  subtitle TEXT,
  metadata JSONB,
  rank REAL
) AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  tsquery_val := plainto_tsquery('english', p_search_query);

  RETURN QUERY
  -- Products
  SELECT 
    'product'::TEXT,
    p.id,
    p.name,
    p.sku,
    jsonb_build_object(
      'selling_price', p.selling_price,
      'purchase_price', p.purchase_price,
      'category_id', p.category_id,
      'status', p.status
    ),
    ts_rank_cd(p.search_vector, tsquery_val)
  FROM products p
  WHERE p.search_vector @@ tsquery_val
    AND (p_entity_types IS NULL OR 'product' = ANY(p_entity_types))
  
  UNION ALL
  
  -- Customers
  SELECT 
    'customer'::TEXT,
    c.id,
    c.name,
    c.phone,
    jsonb_build_object(
      'email', c.email,
      'loyalty_points', c.loyalty_points,
      'tier', c.tier
    ),
    ts_rank_cd(c.search_vector, tsquery_val)
  FROM customers c
  WHERE c.search_vector @@ tsquery_val
    AND (p_entity_types IS NULL OR 'customer' = ANY(p_entity_types))
  
  UNION ALL
  
  -- Employees (from employee_profiles)
  SELECT 
    'employee'::TEXT,
    e.id,
    e.employee_id || ' ' || COALESCE(e.position, ''),
    e.staff_number,
    jsonb_build_object(
      'position', e.position,
      'employment_status', e.employment_status
    ),
    ts_rank_cd(e.search_vector, tsquery_val)
  FROM employee_profiles e
  WHERE e.search_vector @@ tsquery_val
    AND (p_entity_types IS NULL OR 'employee' = ANY(p_entity_types))
  
  UNION ALL
  
  -- Suppliers
  SELECT 
    'supplier'::TEXT,
    s.id,
    s.name,
    s.contact_person,
    jsonb_build_object(
      'email', s.email,
      'phone', s.phone,
      'status', s.status
    ),
    ts_rank_cd(s.search_vector, tsquery_val)
  FROM suppliers s
  WHERE s.search_vector @@ tsquery_val
    AND (p_entity_types IS NULL OR 'supplier' = ANY(p_entity_types))
  
  ORDER BY rank DESC
  LIMIT p_result_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Populate existing search vectors
-- ============================================================

UPDATE products SET search_vector = to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(sku, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(brand, '')
) WHERE search_vector IS NULL;

UPDATE customers SET search_vector = to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(phone, '') || ' ' ||
  coalesce(email, '')
) WHERE search_vector IS NULL;

UPDATE employee_profiles SET search_vector = to_tsvector('english',
  coalesce(employee_id, '') || ' ' ||
  coalesce(staff_number, '') || ' ' ||
  coalesce(position, '')
) WHERE search_vector IS NULL;

UPDATE suppliers SET search_vector = to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(contact_person, '') || ' ' ||
  coalesce(email, '') || ' ' ||
  coalesce(phone, '')
) WHERE search_vector IS NULL;
