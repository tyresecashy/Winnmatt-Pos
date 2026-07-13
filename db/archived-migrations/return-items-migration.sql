-- ================================================================
-- RETURN ITEMS MIGRATION
-- Structured per-item return tracking for better reporting
-- ================================================================

-- 1. Create return_items table
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity_returned INTEGER NOT NULL CHECK (quantity_returned > 0),
  unit_refund_amount INTEGER NOT NULL DEFAULT 0, -- refund amount per unit in KSh
  total_refund INTEGER NOT NULL DEFAULT 0,       -- total refund for this line
  reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_return_items_sale_id ON return_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_return_items_created_at ON return_items(created_at);
CREATE INDEX IF NOT EXISTS idx_return_items_created_by ON return_items(created_by);

-- 3. Enable RLS
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "return_items_insert_own_branch" ON return_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.branch_id = (
        SELECT branch_id FROM sales WHERE sales.id = return_items.sale_id
      )
    )
  );

CREATE POLICY "return_items_select_own_branch" ON return_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.branch_id = (
        SELECT branch_id FROM sales WHERE sales.id = return_items.sale_id
      )
    )
  );

-- 5. Grant access
GRANT ALL ON return_items TO authenticated;
GRANT ALL ON return_items TO service_role;

-- ================================================================
-- ADD reverse_return loyalty transaction type support
-- Note: 'reverse_return' already exists in db.types.ts type enum
-- but was never used in practice. The returnSale() function will
-- now call reverseLoyaltyPoints() to handle this.
-- ================================================================

-- 6. Add returned_amount to sales for tracking total refund value
ALTER TABLE sales ADD COLUMN IF NOT EXISTS returned_amount INTEGER DEFAULT 0;
