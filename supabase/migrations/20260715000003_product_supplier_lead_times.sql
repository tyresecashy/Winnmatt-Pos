-- Sprint 11A: Product-supplier lead times table
-- Tracks lead time data per product-supplier pair for EOQ/ROP calculations.
-- @see docs/16_PRODUCT_INTELLIGENCE.md (Section 9.4)

CREATE TABLE IF NOT EXISTS product_supplier_lead_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  lead_time_days INT NOT NULL CHECK (lead_time_days > 0),
  lead_time_stddev NUMERIC CHECK (lead_time_stddev >= 0),
  last_order_date TIMESTAMPTZ,
  sample_size INT DEFAULT 1 CHECK (sample_size > 0),
  UNIQUE(product_id, supplier_id)
);

-- Lookup by product (for reorder evaluation)
CREATE INDEX IF NOT EXISTS idx_lead_times_product
  ON product_supplier_lead_times (product_id);

-- Lookup by supplier (for supplier scoring)
CREATE INDEX IF NOT EXISTS idx_lead_times_supplier
  ON product_supplier_lead_times (supplier_id);

-- RLS
ALTER TABLE product_supplier_lead_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can manage lead_times"
  ON product_supplier_lead_times
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated can view lead_times"
  ON product_supplier_lead_times
  FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT ALL ON product_supplier_lead_times TO service_role;
GRANT SELECT ON product_supplier_lead_times TO authenticated;
