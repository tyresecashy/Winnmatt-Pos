-- ============================================================================
--  WINNMATT POS — COMPLETE DATABASE SETUP
--  Run ONCE in Supabase SQL Editor for a brand-new project.
--  Contains: core schema + all migrations + seed data in correct order.
-- ============================================================================

-- ============================================================================
--  PART 1: CORE SCHEMA
--  (from db-migrations.sql)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Branches table
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  location TEXT,
  is_main BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'cashier')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Role-branch constraint: owner must have NULL branch; others must have branch
ALTER TABLE users DROP CONSTRAINT IF EXISTS "role_branch_check";
ALTER TABLE users ADD CONSTRAINT "role_branch_check" CHECK (
  (role = 'owner' AND branch_id IS NULL) OR
  (role IN ('admin', 'manager', 'cashier') AND branch_id IS NOT NULL)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  purchase_price INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_counted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, branch_id)
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  type TEXT NOT NULL CHECK (type IN ('retail', 'wholesale', 'business')) DEFAULT 'retail',
  loyalty_points INTEGER DEFAULT 0,
  credit_limit INTEGER DEFAULT 0,
  credit_balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT,
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sales table (core + void columns added upfront)
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'cheque', 'credit', 'mpesa')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  receipt_number TEXT UNIQUE NOT NULL,
  notes TEXT,
  sale_status TEXT DEFAULT 'completed' CHECK (sale_status IN ('completed', 'voided', 'returned')),
  shift_id UUID,
  voided_at TIMESTAMP,
  void_reason TEXT,
  voided_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  returned_at TIMESTAMP,
  returned_qty INTEGER,
  return_reason TEXT,
  returned_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sale Items table
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stock Movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('sale', 'receipt', 'transfer', 'adjustment', 'damage', 'reversal')),
  quantity INTEGER NOT NULL,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'received', 'cancelled')) DEFAULT 'draft',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  expected_delivery TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Order Items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stock Transfers table
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  to_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock Transfer Items table
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
--  PART 1b: RECEIPT / BUSINESS SETTINGS
--  (from db-migrations.sql + RECEIPT_SETTINGS_MIGRATION.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL DEFAULT 'WINNMATT POS',
  phone_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  tax_pin VARCHAR(50),
  business_pin VARCHAR(50),
  receipt_footer_text TEXT,
  return_policy_text TEXT,
  thank_you_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_receipt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  receipt_header_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO business_settings (
  id, business_name, phone_number, email, address, tax_pin, business_pin,
  receipt_footer_text, return_policy_text, thank_you_message
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'WINNMATT POS', NULL, NULL, NULL, NULL, NULL,
  'Thank you for your purchase!', NULL, 'Your business matters to us!'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
--  PART 1c: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_sale_status ON sales(sale_status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- ============================================================================
--  PART 2: HELPER FUNCTION — updated_at trigger
--  (shared by several tables)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
--  PART 3: M-PESA TRANSACTIONS
--  (from mpesa-migration.sql + MPESA_MIGRATION.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
  merchant_request_id VARCHAR(255) NOT NULL,
  checkout_request_id VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled', 'timeout')),
  mpesa_receipt_number VARCHAR(100),
  callback_payload JSONB,
  result_code INTEGER,
  result_description TEXT,
  error_message TEXT,
  initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  callback_received_at TIMESTAMP,
  sale_finalized_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for M-Pesa
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request_id ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_merchant_request_id ON mpesa_transactions(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_sale_id ON mpesa_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_phone_number ON mpesa_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_created_at ON mpesa_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_pending ON mpesa_transactions(status) WHERE status = 'pending';

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS mpesa_transactions_updated_at_trigger ON mpesa_transactions;
CREATE TRIGGER mpesa_transactions_updated_at_trigger
  BEFORE UPDATE ON mpesa_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
--  PART 4: SALE VOID / AUDIT LOG
--  (from sales-void-migration.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sale_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'voided', 'returned', 'partial_return', 'unvoided')),
  reason TEXT,
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  details JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_audit_log_sale_id ON sale_audit_log(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_audit_log_action ON sale_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sale_audit_log_performed_by ON sale_audit_log(performed_by);

CREATE OR REPLACE VIEW sales_void_status AS
SELECT
  s.id, s.receipt_number, s.total_amount, s.payment_method, s.sale_status,
  s.voided_at, s.void_reason, u_voided.full_name AS voided_by_name,
  s.returned_at, s.returned_qty, s.return_reason, u_returned.full_name AS returned_by_name,
  s.created_at, COALESCE(s.voided_at, s.returned_at) AS modification_at
FROM sales s
LEFT JOIN users u_voided ON s.voided_by = u_voided.id
LEFT JOIN users u_returned ON s.returned_by = u_returned.id
WHERE s.sale_status IN ('voided', 'returned');

-- ============================================================================
--  PART 5: SHIFT MANAGEMENT
--  (from shift-management-migration.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift_number TEXT NOT NULL,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP DEFAULT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'reopened')) DEFAULT 'open',
  opening_float INTEGER NOT NULL,
  closing_notes TEXT DEFAULT NULL,
  reopened_by UUID REFERENCES users(id),
  reopened_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Link shifts to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS shift_ledgers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opening', 'closing', 'recount')),
  counted_cash INTEGER NOT NULL,
  expected_cash INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  payment_breakdown JSONB NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opened', 'closed', 'reopened', 'recount_added', 'adjusted')),
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Shift indexes
CREATE INDEX IF NOT EXISTS idx_shifts_branch_cashier ON shifts(branch_id, cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_branch_opened_at ON shifts(branch_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_shift_id ON shift_ledgers(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_action ON shift_ledgers(action);
CREATE INDEX IF NOT EXISTS idx_shift_audit_log_shift_id ON shift_audit_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_audit_log_action ON shift_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id);

-- Shift summary view
CREATE OR REPLACE VIEW shift_summaries AS
SELECT
  s.id, s.branch_id, s.cashier_id, s.shift_number,
  s.opened_at, s.closed_at, s.status, s.opening_float,
  u.full_name AS cashier_name, b.name AS branch_name,
  COUNT(DISTINCT sal.id) FILTER (WHERE sal.sale_status != 'voided') AS transaction_count,
  COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.sale_status != 'voided'), 0) AS total_sales,
  COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.payment_method = 'cash' AND sal.sale_status != 'voided'), 0) AS cash_sales,
  COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.payment_method = 'card' AND sal.sale_status != 'voided'), 0) AS card_sales,
  COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.payment_method = 'mpesa' AND sal.sale_status != 'voided'), 0) AS mpesa_sales,
  COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.payment_method IN ('cheque', 'bank_transfer', 'credit') AND sal.sale_status != 'voided'), 0) AS other_sales,
  COUNT(DISTINCT sal.id) FILTER (WHERE sal.sale_status = 'voided') AS voided_count,
  COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.sale_status = 'voided'), 0) AS voided_amount,
  (SELECT counted_cash FROM shift_ledgers WHERE shift_id = s.id AND action = 'closing' LIMIT 1) AS closing_counted_cash,
  (SELECT expected_cash FROM shift_ledgers WHERE shift_id = s.id AND action = 'closing' LIMIT 1) AS closing_expected_cash,
  (SELECT difference FROM shift_ledgers WHERE shift_id = s.id AND action = 'closing' LIMIT 1) AS closing_difference
FROM shifts s
LEFT JOIN users u ON s.cashier_id = u.id
LEFT JOIN branches b ON s.branch_id = b.id
LEFT JOIN sales sal ON sal.shift_id = s.id
  AND sal.created_at >= s.opened_at
  AND sal.created_at <= COALESCE(s.closed_at, NOW())
GROUP BY s.id, u.full_name, b.name;

-- Daily reconciliation view
CREATE OR REPLACE VIEW daily_reconciliation_summary AS
SELECT
  s.branch_id,
  DATE(s.opened_at) AS day,
  COUNT(*) AS total_shifts,
  SUM(CASE WHEN s.status = 'open' THEN 1 ELSE 0 END) AS open_shifts,
  SUM(CASE WHEN s.status IN ('closed', 'reopened') THEN 1 ELSE 0 END) AS closed_shifts,
  SUM(s.opening_float) AS total_opening_float,
  SUM((sl.payment_breakdown->>'cash_sales')::BIGINT) AS total_cash_sales,
  SUM((sl.payment_breakdown->>'card_sales')::BIGINT) AS total_card_sales,
  SUM((sl.payment_breakdown->>'mpesa_sales')::BIGINT) AS total_mpesa_sales,
  SUM((sl.payment_breakdown->>'cheque_sales')::BIGINT) AS total_cheque_sales,
  SUM((sl.payment_breakdown->>'bank_transfer_sales')::BIGINT) AS total_bank_transfer_sales,
  SUM((sl.payment_breakdown->>'credit_sales')::BIGINT) AS total_credit_sales,
  SUM(sl.difference) AS total_difference,
  SUM(CASE WHEN sl.difference > 0 THEN sl.difference ELSE 0 END) AS total_over,
  SUM(CASE WHEN sl.difference < 0 THEN ABS(sl.difference) ELSE 0 END) AS total_short
FROM shifts s
LEFT JOIN shift_ledgers sl ON s.id = sl.shift_id AND sl.action = 'closing'
GROUP BY s.branch_id, DATE(s.opened_at)
ORDER BY s.branch_id, DATE(s.opened_at) DESC;

-- ============================================================================
--  PART 6: OWNER ROLE + LOYALTY SYSTEM
--  (from owner-loyalty-migration.sql)
-- ============================================================================

-- Loyalty Settings (singleton)
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id UUID PRIMARY KEY DEFAULT 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,
  earn_enabled BOOLEAN DEFAULT TRUE,
  earn_threshold_cents INTEGER DEFAULT 10000,
  earn_minimum_basket_cents INTEGER DEFAULT 0,
  earn_on_discounted BOOLEAN DEFAULT TRUE,
  redeem_enabled BOOLEAN DEFAULT FALSE,
  redeem_value_cents INTEGER,
  redeem_max_percent_per_sale NUMERIC(3,1) DEFAULT 50.0,
  redeem_minimum_points INTEGER DEFAULT 25,
  redeem_minimum_basket_cents INTEGER DEFAULT 5000,
  expiry_enabled BOOLEAN DEFAULT FALSE,
  expiry_days INTEGER,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_settings_single_row ON loyalty_settings((id));

-- Loyalty Transactions (immutable audit trail)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN (
    'earn_sale', 'earn_admin', 'redeem_sale',
    'reverse_void', 'reverse_return', 'expire', 'admin_adjust'
  )),
  sale_id UUID REFERENCES sales(id) ON DELETE RESTRICT,
  points_delta INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_sale ON loyalty_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at ON loyalty_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(type);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_branch ON loyalty_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_points ON customers(loyalty_points);

-- Audit Logs (for owner/manager actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_value JSONB,
  new_value JSONB,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Seed default loyalty settings
INSERT INTO loyalty_settings (
  id, earn_enabled, earn_threshold_cents, earn_minimum_basket_cents,
  earn_on_discounted, redeem_enabled, redeem_value_cents,
  redeem_max_percent_per_sale, redeem_minimum_points, redeem_minimum_basket_cents,
  expiry_enabled, expiry_days
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,
  TRUE, 10000, 0, TRUE,
  FALSE, NULL, 50.0, 25, 5000,
  FALSE, NULL
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
--  PART 7: CASH SALE RPC FUNCTION
--  (from cash-sale-transaction-migration.sql)
-- ============================================================================

CREATE OR REPLACE FUNCTION save_cash_sale_transaction(
  p_sale_id UUID,
  p_branch_id UUID,
  p_cashier_id UUID,
  p_customer_id UUID,
  p_subtotal INTEGER,
  p_discount_amount INTEGER,
  p_total_amount INTEGER,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_receipt_number TEXT,
  p_notes TEXT,
  p_written_at TIMESTAMP,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_requested_count INTEGER;
  v_locked_count INTEGER;
  v_missing_product_id UUID;
  v_insufficient_product_name TEXT;
  v_insufficient_available INTEGER;
  v_insufficient_requested INTEGER;
  v_sale JSONB;
  v_items JSONB;
BEGIN
  IF p_payment_method <> 'cash' THEN
    RAISE EXCEPTION 'save_cash_sale_transaction only supports cash sales';
  END IF;
  IF p_payment_status <> 'completed' THEN
    RAISE EXCEPTION 'save_cash_sale_transaction only supports completed cash sales';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sale must include at least one item';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS item(
      id UUID, product_id UUID, quantity INTEGER, unit_price INTEGER,
      discount_percent INTEGER, line_total INTEGER, created_at TIMESTAMP
    )
    WHERE item.quantity <= 0 OR item.unit_price < 0 OR item.line_total < 0
  ) THEN
    RAISE EXCEPTION 'Sale items contain invalid quantity or pricing values';
  END IF;

  -- Lock inventory rows
  WITH requested AS (
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS requested_quantity
    FROM jsonb_to_recordset(p_items) AS item(
      id UUID, product_id UUID, quantity INTEGER, unit_price INTEGER,
      discount_percent INTEGER, line_total INTEGER, created_at TIMESTAMP
    ) GROUP BY item.product_id
  ),
  locked_inventory AS (
    SELECT i.id, i.product_id, i.quantity
    FROM inventory i JOIN requested r ON r.product_id = i.product_id
    WHERE i.branch_id = p_branch_id
    FOR UPDATE
  )
  SELECT (SELECT COUNT(*) FROM requested), (SELECT COUNT(*) FROM locked_inventory)
  INTO v_requested_count, v_locked_count;

  IF v_requested_count <> v_locked_count THEN
    SELECT r.product_id INTO v_missing_product_id
    FROM (SELECT item.product_id FROM jsonb_to_recordset(p_items) AS item(
      product_id UUID) GROUP BY item.product_id) r
    LEFT JOIN (SELECT i.product_id FROM inventory i WHERE i.branch_id = p_branch_id FOR UPDATE) li
      ON li.product_id = r.product_id
    WHERE li.product_id IS NULL LIMIT 1;
    RAISE EXCEPTION 'Inventory not found for product % at branch %', v_missing_product_id, p_branch_id;
  END IF;

  -- Check stock sufficiency
  SELECT p.name, i.quantity, r.requested_quantity
  INTO v_insufficient_product_name, v_insufficient_available, v_insufficient_requested
  FROM (
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS requested_quantity
    FROM jsonb_to_recordset(p_items) AS item(
      id UUID, product_id UUID, quantity INTEGER, unit_price INTEGER,
      discount_percent INTEGER, line_total INTEGER, created_at TIMESTAMP
    ) GROUP BY item.product_id
  ) r
  JOIN inventory i ON i.product_id = r.product_id AND i.branch_id = p_branch_id
  JOIN products p ON p.id = r.product_id
  WHERE i.quantity < r.requested_quantity
  LIMIT 1;

  IF v_insufficient_product_name IS NOT NULL THEN
    RAISE EXCEPTION 'Insufficient stock for %: only % available for requested quantity %',
      v_insufficient_product_name, v_insufficient_available, v_insufficient_requested;
  END IF;

  -- Insert sale
  INSERT INTO sales (id, branch_id, cashier_id, customer_id, subtotal,
    discount_amount, tax_amount, total_amount, payment_method, payment_status,
    receipt_number, notes, created_at, updated_at)
  VALUES (p_sale_id, p_branch_id, p_cashier_id, p_customer_id, p_subtotal,
    p_discount_amount, 0, p_total_amount, p_payment_method, p_payment_status,
    p_receipt_number, p_notes, p_written_at, p_written_at);

  -- Insert sale items
  INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price,
    discount_percent, line_total, created_at)
  SELECT item.id, p_sale_id, item.product_id, item.quantity, item.unit_price,
    item.discount_percent, item.line_total, COALESCE(item.created_at, p_written_at)
  FROM jsonb_to_recordset(p_items) AS item(
    id UUID, product_id UUID, quantity INTEGER, unit_price INTEGER,
    discount_percent INTEGER, line_total INTEGER, created_at TIMESTAMP
  );

  -- Deduct inventory
  UPDATE inventory AS i
  SET quantity = i.quantity - r.requested_quantity, updated_at = p_written_at
  FROM (
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS requested_quantity
    FROM jsonb_to_recordset(p_items) AS item(
      id UUID, product_id UUID, quantity INTEGER, unit_price INTEGER,
      discount_percent INTEGER, line_total INTEGER, created_at TIMESTAMP
    ) GROUP BY item.product_id
  ) r
  WHERE i.branch_id = p_branch_id AND i.product_id = r.product_id;

  -- Record stock movements
  INSERT INTO stock_movements (product_id, branch_id, type, quantity, reference_id, notes, created_at)
  SELECT item.product_id, p_branch_id, 'sale', -item.quantity,
    p_sale_id::TEXT, NULL, COALESCE(item.created_at, p_written_at)
  FROM jsonb_to_recordset(p_items) AS item(
    id UUID, product_id UUID, quantity INTEGER, unit_price INTEGER,
    discount_percent INTEGER, line_total INTEGER, created_at TIMESTAMP
  );

  -- Build response
  SELECT jsonb_build_object(
    'id', p_sale_id, 'branch_id', p_branch_id, 'cashier_id', p_cashier_id,
    'customer_id', p_customer_id, 'subtotal', p_subtotal,
    'discount_amount', p_discount_amount, 'tax_amount', 0,
    'total_amount', p_total_amount, 'payment_method', p_payment_method,
    'payment_status', p_payment_status, 'receipt_number', p_receipt_number,
    'notes', p_notes, 'created_at', p_written_at, 'updated_at', p_written_at
  ) INTO v_sale;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', item.id, 'sale_id', p_sale_id, 'product_id', item.product_id,
    'quantity', item.quantity, 'unit_price', item.unit_price,
    'discount_percent', item.discount_percent, 'line_total', item.line_total,
    'created_at', COALESCE(item.created_at, p_written_at),
    'product', jsonb_build_object('id', p.id, 'sku', p.sku, 'name', p.name)
  )), '[]'::JSONB) INTO v_items
  FROM jsonb_to_recordset(p_items) AS item(
    id UUID, product_id UUID, quantity INTEGER, unit_price INTEGER,
    discount_percent INTEGER, line_total INTEGER, created_at TIMESTAMP
  ) JOIN products p ON p.id = item.product_id;

  RETURN jsonb_build_object('sale', v_sale, 'items', v_items);
END;
$$;

COMMENT ON FUNCTION save_cash_sale_transaction(UUID, UUID, UUID, UUID, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TIMESTAMP, JSONB)
  IS 'Atomically persists a completed cash sale, sale_items, inventory decrements, and stock movements in one transaction.';

-- ============================================================================
--  PART 8: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_receipt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_audit_log ENABLE ROW LEVEL SECURITY;

-- Unified RLS policies: all authenticated users can SELECT
-- (tighten per-role in production)
DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'branches', 'products', 'inventory', 'customers', 'suppliers',
      'sales', 'sale_items', 'stock_movements', 'purchase_orders',
      'purchase_order_items', 'stock_transfers', 'stock_transfer_items',
      'business_settings', 'branch_receipt_settings',
      'loyalty_settings', 'loyalty_transactions', 'audit_logs',
      'sale_audit_log', 'shifts', 'shift_ledgers', 'shift_audit_log'
    ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "enable_select_authenticated" ON %I;', tbl
    );
    EXECUTE format(
      'CREATE POLICY "enable_select_authenticated" ON %I FOR SELECT USING (auth.role() = ''authenticated'');', tbl
    );
  END LOOP;
END $$;

-- M-Pesa specific policies (INSERT + UPDATE based on branch)
DROP POLICY IF EXISTS "mpesa_select" ON mpesa_transactions;
CREATE POLICY "mpesa_select" ON mpesa_transactions
  FOR SELECT USING (
    sale_id IN (SELECT id FROM sales WHERE branch_id IN (
      SELECT DISTINCT branch_id FROM users WHERE id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "mpesa_insert" ON mpesa_transactions;
CREATE POLICY "mpesa_insert" ON mpesa_transactions
  FOR INSERT WITH CHECK (
    sale_id IN (SELECT id FROM sales WHERE branch_id IN (
      SELECT DISTINCT branch_id FROM users WHERE id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "mpesa_update" ON mpesa_transactions;
CREATE POLICY "mpesa_update" ON mpesa_transactions
  FOR UPDATE USING (
    sale_id IN (SELECT id FROM sales WHERE branch_id IN (
      SELECT DISTINCT branch_id FROM users WHERE id = auth.uid()
    ))
  );

-- ============================================================================
--  PART 9: SEED DATA
--  (from db-seed.sql)
-- ============================================================================

-- Branches
INSERT INTO branches (name, code, location, is_main) VALUES
  ('Main Store', 'MAIN-001', 'Nairobi CBD', TRUE),
  ('Westlands Branch', 'WEST-001', 'Westlands', FALSE),
  ('Karen Branch', 'KAREN-001', 'Karen', FALSE)
ON CONFLICT DO NOTHING;

-- Categories
INSERT INTO categories (name, description, icon) VALUES
  ('Beverages', 'All drinks including soft drinks, juice, water', '🥤'),
  ('Dairy', 'Milk, cheese, yogurt and other dairy products', '🥛'),
  ('Snacks', 'Chips, biscuits, and packaged snacks', '🍿'),
  ('Confectionery', 'Candy, chocolate, and sweets', '🍬'),
  ('Bakery', 'Bread, cakes, and baked goods', '🍞'),
  ('Frozen', 'Ice cream and frozen foods', '🧊'),
  ('Grains & Cereals', 'Rice, flour, pasta, and cereals', '🌾'),
  ('Oils & Condiments', 'Cooking oils, spices, and sauces', '🫙'),
  ('Cleaning', 'Detergent, soap, and cleaning supplies', '🧹'),
  ('Personal Care', 'Soap, toothpaste, shampoo, and hygiene', '🧴')
ON CONFLICT DO NOTHING;

-- Products (prices in KSh cents: 6000 = KSh 60)
INSERT INTO products (sku, name, description, category_id, purchase_price, selling_price, reorder_level) VALUES
  ('BEV001', 'Coca Cola 500ml', 'Carbonated soft drink',
    (SELECT id FROM categories WHERE name = 'Beverages'), 4000, 6000, 20),
  ('BEV002', 'Sprite 500ml', 'Lemon-lime flavor soft drink',
    (SELECT id FROM categories WHERE name = 'Beverages'), 4000, 6000, 20),
  ('BEV003', 'Fanta Orange 500ml', 'Orange flavor soft drink',
    (SELECT id FROM categories WHERE name = 'Beverages'), 3500, 5500, 25),
  ('BEV004', 'Water 500ml', 'Purified drinking water',
    (SELECT id FROM categories WHERE name = 'Beverages'), 2000, 3500, 30),
  ('DAI001', 'Milk 1L', 'Fresh whole milk',
    (SELECT id FROM categories WHERE name = 'Dairy'), 10000, 14500, 15),
  ('DAI002', 'Yogurt 500ml', 'Plain yogurt',
    (SELECT id FROM categories WHERE name = 'Dairy'), 8000, 12000, 20),
  ('SNK001', 'Lay''s Classic 50g', 'Potato chips classic flavor',
    (SELECT id FROM categories WHERE name = 'Snacks'), 3500, 5500, 30),
  ('SNK002', 'Doritos 50g', 'Nacho cheese flavor chips',
    (SELECT id FROM categories WHERE name = 'Snacks'), 3500, 5500, 25),
  ('CON001', 'Mentos 25g', 'Mint candies',
    (SELECT id FROM categories WHERE name = 'Confectionery'), 1500, 2500, 40),
  ('CON002', 'Cadbury Dairy Milk 45g', 'Chocolate bar',
    (SELECT id FROM categories WHERE name = 'Confectionery'), 5000, 7500, 20),
  ('BAK001', 'Bread White 700g', 'Sliced white bread',
    (SELECT id FROM categories WHERE name = 'Bakery'), 8000, 12000, 10),
  ('BAK002', 'Bread Brown 700g', 'Sliced brown bread',
    (SELECT id FROM categories WHERE name = 'Bakery'), 9000, 13500, 8),
  ('FRZ001', 'Ice Cream 500ml', 'Vanilla ice cream',
    (SELECT id FROM categories WHERE name = 'Frozen'), 15000, 22000, 10),
  ('GRA001', 'Rice 10kg', 'Long grain white rice',
    (SELECT id FROM categories WHERE name = 'Grains & Cereals'), 80000, 110000, 5),
  ('OIL001', 'Cooking Oil 2L', 'Vegetable cooking oil',
    (SELECT id FROM categories WHERE name = 'Oils & Condiments'), 25000, 35000, 8),
  ('CLE001', 'Detergent Powder 1kg', 'Washing powder',
    (SELECT id FROM categories WHERE name = 'Cleaning'), 12000, 17500, 10),
  ('PER001', 'Soap Bar 150g', 'Bathing soap',
    (SELECT id FROM categories WHERE name = 'Personal Care'), 3000, 4500, 30),
  ('PER002', 'Toothpaste 120g', 'Fluoride toothpaste',
    (SELECT id FROM categories WHERE name = 'Personal Care'), 5000, 7500, 15)
ON CONFLICT (sku) DO NOTHING;

-- Inventory per branch
INSERT INTO inventory (product_id, branch_id, quantity)
SELECT p.id, b.id, floor(random() * 100 + 20)::INT
FROM products p CROSS JOIN branches b
WHERE b.code = 'MAIN-001'
ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO inventory (product_id, branch_id, quantity)
SELECT p.id, b.id, floor(random() * 80 + 15)::INT
FROM products p CROSS JOIN branches b
WHERE b.code = 'WEST-001'
ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO inventory (product_id, branch_id, quantity)
SELECT p.id, b.id, floor(random() * 60 + 10)::INT
FROM products p CROSS JOIN branches b
WHERE b.code = 'KAREN-001'
ON CONFLICT (product_id, branch_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Customers
INSERT INTO customers (name, phone, email, type, loyalty_points, credit_limit, credit_balance) VALUES
  ('John Mwangi', '0712345678', 'john@email.com', 'retail', 5000, 0, 0),
  ('Mary Kipchoge', '0798765432', 'mary@email.com', 'retail', 12000, 0, 0),
  ('ABC Supermarket', '0714567890', 'abc@supermarket.co.ke', 'wholesale', 0, 500000, 250000),
  ('XYZ Restaurant', '0723456789', 'xyz@restaurant.co.ke', 'business', 0, 1000000, 450000),
  ('Sarah Kariuki', '0734567890', 'sarah@email.com', 'retail', 3500, 0, 0),
  ('Tech Solutions Ltd', '0745678901', 'tech@company.co.ke', 'business', 0, 750000, 600000)
ON CONFLICT DO NOTHING;

-- Suppliers
INSERT INTO suppliers (name, contact_person, phone, email, payment_terms, balance) VALUES
  ('Fresh Beverages Ltd', 'Mr. Kiprop', '0701234567', 'sales@freshbevs.co.ke', 'Net 30', 150000),
  ('Dairy Farms Kenya', 'Ms. Wanjiru', '0712345678', 'orders@dairyfarms.co.ke', 'Net 15', 200000),
  ('Snacks Wholesale', 'Mr. Ochieng', '0723456789', 'sales@snackswhale.co.ke', 'Net 45', 350000),
  ('Bakery Supplies', 'Ms. Nyambura', '0734567890', 'supply@bakery.co.ke', 'COD', 0),
  ('Commodity Trading', 'Mr. Kamau', '0745678901', 'trade@commodity.co.ke', 'Net 30', 500000)
ON CONFLICT DO NOTHING;

-- ============================================================================
--  PART 10: CREATE APP USERS (after Supabase Auth is set up)
--  ⚠️  RUN THIS SEPARATELY after creating Auth users in the dashboard
--  ⚠️  Or run it twice — it will silently skip rows with NULL id
-- ============================================================================
-- Step 1: Go to Authentication → Users → "Add User" for each:
--   admin@winnmatt.com / admin123
--   cashier@winnmatt.com / cashier123
--   demo@winnmatt.com / demo123
--
-- Step 2: Run this INSERT to link them:

INSERT INTO users (id, email, full_name, branch_id, role, status)
SELECT au.id, au.email,
  CASE
    WHEN au.email = 'admin@winnmatt.com'  THEN 'Admin User'
    WHEN au.email = 'cashier@winnmatt.com' THEN 'Cashier User'
    WHEN au.email = 'demo@winnmatt.com'    THEN 'Demo Cashier'
    ELSE 'Staff Member'
  END,
  (SELECT id FROM branches WHERE code = 'MAIN-001'),
  CASE
    WHEN au.email = 'admin@winnmatt.com'  THEN 'admin'
    WHEN au.email = 'cashier@winnmatt.com' THEN 'cashier'
    WHEN au.email = 'demo@winnmatt.com'    THEN 'cashier'
    ELSE 'cashier'
  END,
  'active'
FROM auth.users au
WHERE au.email IN ('admin@winnmatt.com', 'cashier@winnmatt.com', 'demo@winnmatt.com')
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = au.email);

-- ============================================================================
--  DONE
--  Verify by checking that all tables exist in Table Editor.
-- ============================================================================
