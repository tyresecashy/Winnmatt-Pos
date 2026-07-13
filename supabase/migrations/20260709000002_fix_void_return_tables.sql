-- Migration: fix_void_return_tables
-- Ensures sale_audit_log and return_items tables exist with the columns
-- that the void sale and return workflows expect.

-- ── sale_audit_log ────────────────────────────────────────────────
-- Used by voidSale() and returnSale() in lib/sales-actions.ts
CREATE TABLE IF NOT EXISTS sale_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  action TEXT NOT NULL,          -- 'voided', 'returned', 'partial_return', etc.
  reason TEXT,
  performed_by UUID REFERENCES users(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_audit_log_sale_id ON sale_audit_log(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_audit_log_action ON sale_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sale_audit_log_created_at ON sale_audit_log(created_at);

-- ── return_items ──────────────────────────────────────────────────
-- Used by returnSale() in lib/sales-actions.ts
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_refund INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  returned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  returned_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_items_sale_id ON return_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_return_items_returned_at ON return_items(returned_at);
