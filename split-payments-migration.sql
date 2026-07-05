-- WINNMATT Retail OS: Split Payments Migration
-- Run this in Supabase SQL Editor
-- Enables allocating a sale across multiple payment methods

BEGIN;

-- ============================================================================
-- Step 1: Payment splits table
-- Each row = one payment allocation on a sale
-- Example: Sale #100 → split $500 cash, $300 M-Pesa
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash','card','bank_transfer','cheque','credit','mpesa')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 2: Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payment_splits_sale ON payment_splits(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_method ON payment_splits(method);

COMMIT;
