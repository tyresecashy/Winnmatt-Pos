-- Migration: fix_purchase_receipts
-- Ensures purchase_receipts + purchase_receipt_items have the correct columns
-- that the server actions expect. The phase2-migration.sql created an older
-- version missing received_by, status, purchase_receipt_id, batch_number, etc.

-- ── purchase_receipts ──────────────────────────────────────────────
-- Ensure the table exists with all columns the code needs
CREATE TABLE IF NOT EXISTS purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  received_by UUID,                                          -- MISSING from phase2
  notes TEXT,
  status TEXT DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed', 'cancelled')),   -- MISSING from phase2
  received_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns idempotently if table already existed
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS received_by UUID;
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Add the CHECK constraint idempotently if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_receipts_status_check'
      AND conrelid = 'purchase_receipts'::regclass
  ) THEN
    ALTER TABLE purchase_receipts
      ADD CONSTRAINT purchase_receipts_status_check
      CHECK (status IN ('draft', 'completed', 'cancelled'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_order_id
  ON purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_supplier_id
  ON purchase_receipts(supplier_id);

-- ── purchase_receipt_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_receipt_id UUID NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE, -- phase2 used 'receipt_id'
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity_received INTEGER NOT NULL DEFAULT 0,                -- phase2 used 'quantity'
  unit_cost INTEGER DEFAULT 0,
  batch_number TEXT,                                            -- MISSING from phase2
  expiry_date DATE,                                            -- MISSING from phase2
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If the table already existed with the old column name, add the correct one
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS purchase_receipt_id UUID
  REFERENCES purchase_receipts(id) ON DELETE CASCADE;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quantity_received INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Drop the old 'receipt_id' column if it exists (safely renaming data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_receipt_items' AND column_name = 'receipt_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_receipt_items' AND column_name = 'purchase_receipt_id'
  ) THEN
    ALTER TABLE purchase_receipt_items RENAME COLUMN receipt_id TO purchase_receipt_id;
  END IF;
END $$;

-- Drop old 'quantity' column if it exists (data migrated to quantity_received)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_receipt_items' AND column_name = 'quantity'
      AND column_name != 'quantity_received'
  ) THEN
    ALTER TABLE purchase_receipt_items DROP COLUMN IF EXISTS quantity;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt_id
  ON purchase_receipt_items(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_product_id
  ON purchase_receipt_items(product_id);

-- ── purchase_orders status constraint ─────────────────────────────
-- The original CHECK only allowed 'draft', 'pending', 'received', 'cancelled'
-- We need to add 'approved' and 'partially_received'
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'partially_received', 'received', 'cancelled'));
