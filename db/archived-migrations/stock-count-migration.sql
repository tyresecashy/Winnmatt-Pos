-- ================================================================
-- STOCK COUNT / AUDIT MIGRATION
-- Physical inventory counting workflow
-- ================================================================

-- 1. Stock counts (headers)
CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'approved', 'cancelled')),
  notes TEXT,
  total_items INTEGER DEFAULT 0,
  total_discrepancies INTEGER DEFAULT 0,
  net_variance INTEGER DEFAULT 0,          -- positive = stock gain, negative = stock loss
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Stock count items (individual product counts)
CREATE TABLE IF NOT EXISTS stock_count_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  expected_quantity INTEGER NOT NULL DEFAULT 0,   -- current system quantity
  physical_quantity INTEGER NOT NULL DEFAULT 0,   -- counted quantity
  variance INTEGER NOT NULL DEFAULT 0,             -- physical - expected
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_stock_counts_branch_id ON stock_counts(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_status ON stock_counts(status);
CREATE INDEX IF NOT EXISTS idx_stock_counts_count_date ON stock_counts(count_date);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_count_id ON stock_count_items(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_product_id ON stock_count_items(product_id);

-- 4. Auto-update trigger for stock_counts.updated_at
CREATE OR REPLACE FUNCTION update_stock_counts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_counts_updated_at ON stock_counts;
CREATE TRIGGER trg_stock_counts_updated_at
  BEFORE UPDATE ON stock_counts
  FOR EACH ROW EXECUTE FUNCTION update_stock_counts_updated_at();

-- 5. RLS
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items ENABLE ROW LEVEL SECURITY;

-- Stock counts policies
CREATE POLICY "stock_counts_select_own_branch" ON stock_counts
  FOR SELECT TO authenticated
  USING (
    branch_id IN (
      SELECT branch_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "stock_counts_insert_own_branch" ON stock_counts
  FOR INSERT TO authenticated
  WITH CHECK (
    branch_id IN (
      SELECT branch_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "stock_counts_update_own_branch" ON stock_counts
  FOR UPDATE TO authenticated
  USING (
    branch_id IN (
      SELECT branch_id FROM users WHERE users.id = auth.uid()
    )
  );

-- Stock count items policies
CREATE POLICY "stock_count_items_select" ON stock_count_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stock_counts sc
      WHERE sc.id = stock_count_items.stock_count_id
      AND sc.branch_id IN (
        SELECT branch_id FROM users WHERE users.id = auth.uid()
      )
    )
  );

CREATE POLICY "stock_count_items_insert" ON stock_count_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock_counts sc
      WHERE sc.id = stock_count_items.stock_count_id
      AND sc.branch_id IN (
        SELECT branch_id FROM users WHERE users.id = auth.uid()
      )
    )
  );

CREATE POLICY "stock_count_items_update" ON stock_count_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stock_counts sc
      WHERE sc.id = stock_count_items.stock_count_id
      AND sc.branch_id IN (
        SELECT branch_id FROM users WHERE users.id = auth.uid()
      )
    )
  );

-- 6. Grant permissions
GRANT ALL ON stock_counts TO authenticated;
GRANT ALL ON stock_counts TO service_role;
GRANT ALL ON stock_count_items TO authenticated;
GRANT ALL ON stock_count_items TO service_role;
