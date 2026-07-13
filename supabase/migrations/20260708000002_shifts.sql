-- Shift Management System
-- Enables cashier shift tracking and end-of-day reconciliation

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift_number TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ DEFAULT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'reopened')) DEFAULT 'open',
  opening_float INTEGER NOT NULL DEFAULT 0,
  closing_notes TEXT DEFAULT NULL,
  reopened_by UUID REFERENCES users(id),
  reopened_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, shift_number)
);

CREATE TABLE IF NOT EXISTS shift_ledgers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opening', 'closing', 'recount')),
  counted_cash INTEGER NOT NULL,
  expected_cash INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  payment_breakdown JSONB NOT NULL DEFAULT '{}',
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opened', 'closed', 'reopened', 'recount_added', 'adjusted')),
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_branch_cashier ON shifts(branch_id, cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at ON shifts(branch_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_shift ON shift_ledgers(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_action ON shift_ledgers(action);
CREATE INDEX IF NOT EXISTS idx_shift_audit_shift ON shift_audit_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_audit_action ON shift_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_select ON shifts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY shifts_insert ON shifts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY shifts_update ON shifts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'manager'))
);
CREATE POLICY shift_ledgers_select ON shift_ledgers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY shift_ledgers_insert ON shift_ledgers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY shift_audit_select ON shift_audit_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY shift_audit_insert ON shift_audit_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
