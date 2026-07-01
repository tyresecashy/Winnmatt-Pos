-- Shift Management Tables
-- Comprehensive setup for tracking cashier shifts, cash reconciliation, and audit trails

-- 1. SHIFTS TABLE - Main shift records
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_number VARCHAR(50) NOT NULL, -- Format: BRANCH-YYYY-MM-DD-SEQ
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  opening_float BIGINT NOT NULL DEFAULT 0, -- in cents
  closing_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reopened')),
  reopened_by UUID REFERENCES users(id),
  reopened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints and indexes
  UNIQUE(branch_id, shift_number),
  INDEX idx_shift_date (branch_id, opened_at),
  INDEX idx_cashier_shifts (cashier_id, opened_at),
  INDEX idx_shift_status (status),
  INDEX idx_shift_date_range (branch_id, opened_at DESC)
);

-- 2. SHIFT LEDGERS TABLE - Records opening/closing with reconciliation details
-- Tracks cash counts and payment breakdowns at shift start and end
CREATE TABLE IF NOT EXISTS shift_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('opening', 'closing')), -- opening or closing count
  counted_cash BIGINT NOT NULL, -- Actual cash counted (in cents)
  expected_cash BIGINT NOT NULL, -- Expected based on sales (in cents)
  difference BIGINT NOT NULL, -- counted - expected (positive = over, negative = short)
  
  -- Payment breakdown (JSON) - tracks all payment methods for the shift
  payment_breakdown JSONB NOT NULL DEFAULT '{}', -- Includes cash_sales, card_sales, mpesa_sales, etc.
  
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  INDEX idx_shift_ledger (shift_id),
  INDEX idx_ledger_action (action)
);

-- 3. SHIFT AUDIT LOG TABLE - Trail of all shift-related actions
-- For detecting modifications and maintaining compliance
CREATE TABLE IF NOT EXISTS shift_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'opened', 'closed', 'reopened', 'modified', etc.
  performed_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  details JSONB DEFAULT '{}', -- Additional context as needed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  INDEX idx_shift_audit (shift_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_user (performed_by),
  INDEX idx_audit_date (created_at DESC)
);

-- 4. SHIFT SUMMARIES VIEW - Comprehensive view combining shifts with payment and reconciliation data
CREATE OR REPLACE VIEW shift_summaries AS
SELECT
  s.id,
  s.branch_id,
  s.cashier_id,
  s.shift_number,
  s.opened_at,
  s.closed_at,
  s.opening_float,
  s.status,
  EXTRACT(EPOCH FROM (COALESCE(s.closed_at, NOW()) - s.opened_at)) / 3600 AS duration_hours,
  
  -- Get latest ledger entry (opening or closing)
  (SELECT payment_breakdown FROM shift_ledgers 
   WHERE shift_id = s.id 
   ORDER BY created_at DESC 
   LIMIT 1) AS payment_breakdown,
   
  (SELECT difference FROM shift_ledgers 
   WHERE shift_id = s.id AND action = 'closing' 
   LIMIT 1) AS over_short_amount,
   
  -- Count transactions if available
  (SELECT COUNT(*) FROM sales 
   WHERE cashier_id = s.cashier_id 
   AND branch_id = s.branch_id
   AND created_at >= s.opened_at 
   AND created_at <= COALESCE(s.closed_at, NOW())
   AND sale_status != 'voided') AS transaction_count,
   
  s.created_at,
  s.updated_at
FROM shifts s;

-- 5. DAILY RECONCILIATION SUMMARY VIEW - For management reporting
CREATE OR REPLACE VIEW daily_reconciliation_summary AS
SELECT
  s.branch_id,
  DATE(s.opened_at) AS day,
  COUNT(*) AS total_shifts,
  SUM(CASE WHEN s.status = 'open' THEN 1 ELSE 0 END) AS open_shifts,
  SUM(CASE WHEN s.status IN ('closed', 'reopened') THEN 1 ELSE 0 END) AS closed_shifts,
  SUM(s.opening_float) AS total_opening_float,
  
  -- Payment totals
  SUM((sl.payment_breakdown->>'cash_sales')::BIGINT) AS total_cash_sales,
  SUM((sl.payment_breakdown->>'card_sales')::BIGINT) AS total_card_sales,
  SUM((sl.payment_breakdown->>'mpesa_sales')::BIGINT) AS total_mpesa_sales,
  SUM((sl.payment_breakdown->>'cheque_sales')::BIGINT) AS total_cheque_sales,
  SUM((sl.payment_breakdown->>'bank_transfer_sales')::BIGINT) AS total_bank_transfer_sales,
  SUM((sl.payment_breakdown->>'credit_sales')::BIGINT) AS total_credit_sales,
  
  -- Reconciliation totals
  SUM(sl.difference) AS total_difference,
  SUM(CASE WHEN sl.difference > 0 THEN sl.difference ELSE 0 END) AS total_over,
  SUM(CASE WHEN sl.difference < 0 THEN ABS(sl.difference) ELSE 0 END) AS total_short
  
FROM shifts s
LEFT JOIN shift_ledgers sl ON s.id = sl.shift_id AND sl.action = 'closing'
GROUP BY s.branch_id, DATE(s.opened_at)
ORDER BY s.branch_id, DATE(s.opened_at) DESC;

-- Permissions (if using RLS)
-- These should be configured based on your security requirements
-- For now, assumes authenticated users with appropriate roles

-- Insert initial test data (optional - remove for production)
-- INSERT INTO shifts (branch_id, cashier_id, shift_number, opening_float, status)
-- VALUES (UUID HERE, UUID HERE, 'TEST-2024-01-15-01', 500000, 'open');

-- Grant appropriate permissions to authenticated users
-- GRANT SELECT ON shifts TO authenticated;
-- GRANT SELECT ON shift_ledgers TO authenticated;
-- GRANT SELECT ON shift_audit_log TO authenticated;
-- GRANT SELECT ON shift_summaries TO authenticated;
-- GRANT SELECT ON daily_reconciliation_summary TO authenticated;
