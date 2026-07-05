-- ============================================================================
-- Customer Credit Transactions & Invoicing Migration
-- Tables: credit_payments, invoices, invoice_items
-- Safe for repeated execution (IF NOT EXISTS / IF EXISTS patterns)
-- ============================================================================

-- ── 1. Credit Payments ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'credit_card', 'mpesa', 'other')) DEFAULT 'cash',
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_payments_customer ON credit_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_date ON credit_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_credit_payments_method ON credit_payments(payment_method);

-- ── 2. Invoices ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
  paid_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid')) DEFAULT 'draft',
  due_date DATE NOT NULL,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_date DATE,
  notes TEXT,
  terms TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- ── 3. Invoice Items ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

-- ── 4. Invoice Sequences (per branch) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'INV',
  last_number INTEGER NOT NULL DEFAULT 0,
  fiscal_year TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, prefix)
);

-- ── 5. Views ────────────────────────────────────────────────────────────────

-- Customer credit summary view
CREATE OR REPLACE VIEW customer_credit_summary AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone,
  c.credit_limit,
  c.credit_balance,
  ROUND((c.credit_balance::numeric / NULLIF(c.credit_limit, 0)) * 100, 1) AS credit_usage_pct,
  CASE
    WHEN c.credit_balance >= c.credit_limit AND c.credit_limit > 0 THEN 'maxed'
    WHEN c.credit_balance >= c.credit_limit * 0.8 AND c.credit_limit > 0 THEN 'high'
    WHEN c.credit_balance > 0 THEN 'active'
    ELSE 'clear'
  END AS credit_status,
  COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_method = 'credit' AND s.sale_status = 'completed'), 0)::BIGINT AS total_credit_sales,
  COALESCE(
    (SELECT SUM(cp.amount_cents) FROM credit_payments cp WHERE cp.customer_id = c.id),
    0
  )::BIGINT AS total_payments,
  COALESCE(
    (SELECT MAX(cp.payment_date) FROM credit_payments cp WHERE cp.customer_id = c.id),
    NULL
  ) AS last_payment_date,
  COALESCE(
    (SELECT MAX(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.payment_method = 'credit' AND s.sale_status = 'completed'),
    NULL
  ) AS last_credit_sale_date
FROM customers c
LEFT JOIN sales s ON s.customer_id = c.id AND s.payment_method = 'credit'
GROUP BY c.id, c.name, c.phone, c.credit_limit, c.credit_balance;

-- Invoice summary view
CREATE OR REPLACE VIEW invoice_summary AS
SELECT
  i.id,
  i.invoice_number,
  i.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  i.branch_id,
  b.name AS branch_name,
  i.total_amount_cents,
  i.paid_amount_cents,
  i.total_amount_cents - i.paid_amount_cents AS balance_due_cents,
  i.status,
  i.due_date,
  i.issued_date,
  i.paid_date,
  i.notes,
  b.name AS branch_name_alias,
  CASE
    WHEN i.status = 'paid' THEN 'paid'
    WHEN i.status = 'cancelled' THEN 'cancelled'
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'
    WHEN i.status = 'sent' THEN 'sent'
    WHEN i.status = 'draft' THEN 'draft'
    ELSE i.status
  END AS display_status,
  COUNT(ii.id) AS item_count,
  u.full_name AS created_by_name,
  i.created_at
FROM invoices i
LEFT JOIN customers c ON c.id = i.customer_id
LEFT JOIN branches b ON b.id = i.branch_id
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN users u ON u.id = i.created_by
GROUP BY i.id, i.invoice_number, i.customer_id, c.name, c.phone,
         i.branch_id, b.name, i.total_amount_cents, i.paid_amount_cents,
         i.status, i.due_date, i.issued_date, i.paid_date, i.notes,
         u.full_name, i.created_at;

-- ── 6. Auto-invoice number function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_invoice_number(p_branch_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT;
  v_next_number INTEGER;
  v_invoice_number TEXT;
BEGIN
  -- Get or create sequence for this branch
  INSERT INTO invoice_sequences (branch_id, prefix, last_number)
  VALUES (p_branch_id, 'INV', 0)
  ON CONFLICT (branch_id, prefix) DO NOTHING;

  -- Lock and increment
  UPDATE invoice_sequences
  SET last_number = last_number + 1,
      updated_at = now()
  WHERE branch_id = p_branch_id
  RETURNING prefix, last_number INTO v_prefix, v_next_number;

  v_invoice_number := v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(v_next_number::TEXT, 4, '0');

  RETURN v_invoice_number;
END;
$$;

-- ── 7. Trigger: update customer credit_balance on credit_payment ────────────
-- SECURITY DEFINER so it bypasses RLS on customers (which only has SELECT policy)

CREATE OR REPLACE FUNCTION update_credit_balance_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.customers
  SET credit_balance = GREATEST(0, credit_balance - NEW.amount_cents)
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_payment_update_balance ON credit_payments;
CREATE TRIGGER trg_credit_payment_update_balance
  AFTER INSERT ON credit_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_balance_on_payment();

-- ── 7b. RPC: update customer credit balance (called from server actions as fallback) ──

CREATE OR REPLACE FUNCTION update_customer_credit_balance(
  p_customer_id UUID,
  p_amount_cents INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE customers
  SET credit_balance = GREATEST(0, credit_balance - p_amount_cents)
  WHERE id = p_customer_id;
END;
$$;

-- ── 8. Trigger: update invoice paid_amount and status on payment ────────────

-- Note: This is handled at the application layer for now, since payments
-- against invoices require more complex logic (partial payments, etc.)
