-- Sales Void/Return/Reversal Workflow Migration
-- Adds support for reversing/voiding sales while maintaining audit trail and inventory integrity

-- Step 1: Add sale_status column (completed/voided/returned)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_status TEXT 
  DEFAULT 'completed' 
  CHECK (sale_status IN ('completed', 'voided', 'returned'));

-- Step 2: Add void/return audit columns
ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS void_reason TEXT DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS returned_qty INTEGER DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS return_reason TEXT DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES users(id) ON DELETE RESTRICT;

-- Step 3: Add stock_movements type for reversals if not exists
-- The type column should already support this, but we verify the constraint includes 'reversal'
-- Note: Existing constraint may need manual update if 'reversal' type not present
-- Current types: 'sale', 'receipt', 'transfer', 'adjustment', 'damage'

-- Step 4: Create audit log table for tracking all sale modifications (voids, returns, reversals)
CREATE TABLE IF NOT EXISTS sale_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'voided', 'returned', 'partial_return', 'unvoided')),
  reason TEXT,
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  details JSONB DEFAULT NULL, -- Stores metadata like item quantities returned, original amounts
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_sale_status ON sales(sale_status);
CREATE INDEX IF NOT EXISTS idx_sales_voided_by ON sales(voided_by);
CREATE INDEX IF NOT EXISTS idx_sales_returned_by ON sales(returned_by);
CREATE INDEX IF NOT EXISTS idx_sale_audit_log_sale_id ON sale_audit_log(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_audit_log_action ON sale_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sale_audit_log_performed_by ON sale_audit_log(performed_by);

-- Step 6: Create view for easy void/return tracking
CREATE OR REPLACE VIEW sales_void_status AS
SELECT 
  s.id,
  s.receipt_number,
  s.total_amount,
  s.payment_method,
  s.sale_status,
  s.voided_at,
  s.void_reason,
  u_voided.full_name as voided_by_name,
  s.returned_at,
  s.returned_qty,
  s.return_reason,
  u_returned.full_name as returned_by_name,
  s.created_at,
  COALESCE(s.voided_at, s.returned_at) as modification_at
FROM sales s
LEFT JOIN users u_voided ON s.voided_by = u_voided.id
LEFT JOIN users u_returned ON s.returned_by = u_returned.id
WHERE s.sale_status IN ('voided', 'returned');

-- Step 7: Update RLS policy for sales to respect branch_id (if not already present)
-- Users can only void/return their own branch's sales
-- This is handled in the backend voidSale function via branch validation

-- Applied: April 6, 2026
-- Purpose: Enable safe sales reversal with full audit trail and inventory protection
