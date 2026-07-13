-- Migration: Add created_by & reference_type columns to stock_movements
-- The code in purchase-order-actions.ts and procurement-actions.ts already
-- inserts these columns, but they don't exist in the DB → runtime crash.

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Add an index for querying movements by reference type
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_type
  ON stock_movements(reference_type);

-- Add an index for querying movements by creator
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by
  ON stock_movements(created_by);
