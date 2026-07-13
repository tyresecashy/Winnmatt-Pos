-- ============================================================================
-- Expenses Module Migration
-- Tables: expense_categories, expenses, recurring_expenses
-- Safe for repeated execution (IF NOT EXISTS / IF EXISTS patterns)
-- ============================================================================

-- ── 1. Expense Categories ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'Receipt',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default expense categories
INSERT INTO expense_categories (name, description, color, icon, sort_order)
SELECT * FROM (VALUES
  ('Utilities', 'Electricity, water, gas, internet', '#3b82f6', 'Zap', 1),
  ('Rent & Lease', 'Store rent, equipment lease', '#8b5cf6', 'Building2', 2),
  ('Salaries & Wages', 'Employee salaries, casual wages', '#10b981', 'Users', 3),
  ('Supplies', 'Cleaning supplies, packaging, office supplies', '#f59e0b', 'Package', 4),
  ('Maintenance', 'Equipment repair, building maintenance', '#ef4444', 'Wrench', 5),
  ('Marketing', 'Advertising, promotions, printing', '#ec4899', 'Megaphone', 6),
  ('Transport & Logistics', 'Delivery, fuel, vehicle maintenance', '#06b6d4', 'Truck', 7),
  ('Insurance', 'Business insurance, health insurance', '#84cc16', 'Shield', 8),
  ('Licenses & Permits', 'Business permits, health certificates', '#f97316', 'FileBadge', 9),
  ('Bank Charges', 'Transaction fees, monthly charges', '#64748b', 'Banknote', 10),
  ('Software & Subscriptions', 'POS, accounting, SaaS', '#6366f1', 'Monitor', 11),
  ('Miscellaneous', 'Other operational expenses', '#94a3b8', 'MoreHorizontal', 12)
) AS v(name, description, color, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = v.name);

-- Add column for receipt_url if not exists
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ── 2. Expenses ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  description TEXT NOT NULL,
  vendor TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'credit_card', 'mpesa', 'other')) DEFAULT 'cash',
  reference_number TEXT,
  receipt_url TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  is_recurring BOOLEAN DEFAULT false,
  recurring_id UUID, -- references recurring_expenses if generated from one
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- ── 3. Recurring Expenses ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  description TEXT NOT NULL,
  vendor TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  next_date DATE NOT NULL,
  end_date DATE,
  payment_method TEXT DEFAULT 'bank_transfer',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_branch_id ON recurring_expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_date ON recurring_expenses(next_date);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_is_active ON recurring_expenses(is_active);

-- ── 4. View: expense summaries ──────────────────────────────────────────────

CREATE OR REPLACE VIEW expense_summary_view AS
SELECT
  e.branch_id,
  e.category_id,
  ec.name AS category_name,
  ec.color AS category_color,
  ec.icon AS category_icon,
  e.status,
  COUNT(*) AS expense_count,
  SUM(e.amount_cents) AS total_cents,
  AVG(e.amount_cents) AS avg_cents,
  MIN(e.expense_date) AS first_date,
  MAX(e.expense_date) AS last_date
FROM expenses e
JOIN expense_categories ec ON ec.id = e.category_id
GROUP BY e.branch_id, e.category_id, ec.name, ec.color, ec.icon, e.status;

-- ── 5. RPC: monthly expense totals ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_monthly_expenses(
  p_branch_id UUID,
  p_months INT DEFAULT 12
)
RETURNS TABLE (
  year INT,
  month INT,
  month_name TEXT,
  total_cents BIGINT,
  expense_count BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT
    EXTRACT(YEAR FROM expense_date)::INT AS year,
    EXTRACT(MONTH FROM expense_date)::INT AS month,
    TO_CHAR(expense_date, 'Mon') AS month_name,
    SUM(amount_cents)::BIGINT AS total_cents,
    COUNT(*)::BIGINT AS expense_count
  FROM expenses
  WHERE branch_id = p_branch_id
    AND status = 'approved'
    AND expense_date >= (CURRENT_DATE - INTERVAL '1 month' * p_months)
  GROUP BY year, month, month_name
  ORDER BY year DESC, month DESC;
$$;
