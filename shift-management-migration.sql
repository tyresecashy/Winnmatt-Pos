-- Shift Management System Migration
-- Enables cashier shift tracking and end-of-day reconciliation

-- Step 1: Create shifts table (tracks each cashier's shift session)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift_number TEXT NOT NULL, -- Format: BRANCH-YYYY-MM-DD-SEQ (e.g., HQ-2026-04-06-01)
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP DEFAULT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'reopened')) DEFAULT 'open',
  opening_float INTEGER NOT NULL, -- Cash in drawer at start (in cents, e.g., 50000 = 500 KShs)
  closing_notes TEXT DEFAULT NULL,
  reopened_by UUID REFERENCES users(id), -- Who reopened this shift (if applicable)
  reopened_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Create shift_ledger table (records opening and closing cash counts)
CREATE TABLE IF NOT EXISTS shift_ledgers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opening', 'closing', 'recount')), -- What this ledger records
  counted_cash INTEGER NOT NULL, -- Actual cash counted (in cents)
  expected_cash INTEGER NOT NULL, -- System calculated expected cash
  difference INTEGER NOT NULL, -- counted_cash - expected_cash (positive = over, negative = short)
  payment_breakdown JSONB NOT NULL, -- Breakdown by payment method at this point
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Add shift_id to shifts table relationships (link sales to shifts)
-- Note: We'll add shift_id to sales table incrementally without breaking existing sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

-- Step 4: Create shift_summary view (easy access to key metrics)
CREATE OR REPLACE VIEW shift_summaries AS
SELECT 
  s.id,
  s.branch_id,
  s.cashier_id,
  s.shift_number,
  s.opened_at,
  s.closed_at,
  s.status,
  s.opening_float,
  u.full_name as cashier_name,
  b.name as branch_name,
  
  -- Sales metrics
  COUNT(DISTINCT sal.id) FILTER (WHERE sal.sale_status != 'voided') as transaction_count,
  SUM(sal.total_amount) FILTER (WHERE sal.sale_status != 'voided') as total_sales,
  
  -- Cash sales
  SUM(sal.total_amount) FILTER (WHERE sal.payment_method = 'cash' AND sal.sale_status != 'voided') as cash_sales,
  
  -- Card sales
  SUM(sal.total_amount) FILTER (WHERE sal.payment_method = 'card' AND sal.sale_status != 'voided') as card_sales,
  
  -- M-Pesa sales
  SUM(sal.total_amount) FILTER (WHERE sal.payment_method = 'mpesa' AND sal.sale_status != 'voided') as mpesa_sales,
  
  -- Other payment methods
  SUM(sal.total_amount) FILTER (WHERE sal.payment_method IN ('cheque', 'bank_transfer', 'credit') AND sal.sale_status != 'voided') as other_sales,
  
  -- Voided sales
  COUNT(DISTINCT sal.id) FILTER (WHERE sal.sale_status = 'voided') as voided_count,
  SUM(sal.total_amount) FILTER (WHERE sal.sale_status = 'voided') as voided_amount,
  
  -- Closing reconciliation
  (SELECT counted_cash FROM shift_ledgers WHERE shift_id = s.id AND action = 'closing' LIMIT 1) as closing_counted_cash,
  (SELECT expected_cash FROM shift_ledgers WHERE shift_id = s.id AND action = 'closing' LIMIT 1) as closing_expected_cash,
  (SELECT difference FROM shift_ledgers WHERE shift_id = s.id AND action = 'closing' LIMIT 1) as closing_difference
  
FROM shifts s
LEFT JOIN users u ON s.cashier_id = u.id
LEFT JOIN branches b ON s.branch_id = b.id
LEFT JOIN sales sal ON sal.shift_id = s.id AND sal.closed_at >= s.opened_at AND sal.closed_at <= COALESCE(s.closed_at, NOW())
GROUP BY s.id, u.full_name, b.name;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shifts_branch_cashier ON shifts(branch_id, cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_branch_opened_at ON shifts(branch_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_shift_id ON shift_ledgers(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_action ON shift_ledgers(action);
CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id);

-- Step 6: Create audit log for shift operations (tracks reopen/manual adjustments)
CREATE TABLE IF NOT EXISTS shift_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opened', 'closed', 'reopened', 'recount_added', 'adjusted')),
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_audit_log_shift_id ON shift_audit_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_audit_log_action ON shift_audit_log(action);

-- Applied: April 6, 2026
-- Purpose: Enable cashier shift tracking and end-of-day reconciliation for POS operations
-- Safety: All shifts tied to branch_id; RLS policies must restrict to user's branch
