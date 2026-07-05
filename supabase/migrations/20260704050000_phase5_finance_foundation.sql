-- ============================================================
-- PHASE 5.1: Finance Foundation — Chart of Accounts & General Ledger
-- ============================================================

-- ─── Account Types ─────────────────────────────────────────
CREATE TYPE account_type AS ENUM (
  'asset', 'liability', 'equity', 'revenue', 'expense', 'cogs'
);

CREATE TYPE account_subtype AS ENUM (
  -- Assets
  'current_asset', 'fixed_asset', 'bank', 'cash', 'accounts_receivable', 'inventory_asset',
  -- Liabilities
  'current_liability', 'long_term_liability', 'accounts_payable', 'tax_liability',
  -- Equity
  'owner_equity', 'retained_earnings',
  -- Revenue
  'sales_revenue', 'other_revenue', 'interest_income',
  -- Expenses
  'operating_expense', 'payroll_expense', 'marketing_expense', 'utilities_expense',
  'rent_expense', 'insurance_expense', 'depreciation_expense', 'interest_expense',
  -- COGS
  'cost_of_goods_sold'
);

-- ─── Chart of Accounts ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_number TEXT NOT NULL UNIQUE,        -- e.g. "1000", "1010", "2000"
  name TEXT NOT NULL,                          -- e.g. "Cash", "Accounts Receivable"
  description TEXT,
  account_type account_type NOT NULL,
  account_subtype account_subtype,
  parent_id UUID REFERENCES accounts(id),      -- For sub-accounts
  currency TEXT DEFAULT 'KES',
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE,             -- System accounts can't be deleted
  normal_balance TEXT CHECK (normal_balance IN ('debit', 'credit')),
  branch_id UUID REFERENCES branches(id),      -- NULL = company-wide
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_number ON accounts(account_number);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);
CREATE INDEX idx_accounts_branch ON accounts(branch_id);

-- ─── Financial Periods ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                          -- "FY 2026", "Q1 2026", "July 2026"
  period_type TEXT CHECK (period_type IN ('year', 'quarter', 'month')) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT CHECK (status IN ('open', 'closed', 'locked')) DEFAULT 'open',
  branch_id UUID REFERENCES branches(id),
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_financial_periods_dates ON financial_periods(start_date, end_date);

-- ─── Journal Entries ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number TEXT NOT NULL UNIQUE,           -- "JE-2026-000001"
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,                         -- 'sale', 'purchase', 'expense', 'payment', 'adjustment'
  reference_id UUID,                           -- FK to the source record
  period_id UUID REFERENCES financial_periods(id),
  branch_id UUID REFERENCES branches(id),
  status TEXT CHECK (status IN ('draft', 'posted', 'voided')) DEFAULT 'draft',
  is_adjusting BOOLEAN DEFAULT FALSE,
  total_debit NUMERIC DEFAULT 0,
  total_credit NUMERIC DEFAULT 0,
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMP,
  voided_by UUID REFERENCES users(id),
  voided_at TIMESTAMP,
  void_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entries_period ON journal_entries(period_id);
CREATE INDEX idx_journal_entries_branch ON journal_entries(branch_id);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

-- ─── Journal Entry Lines ───────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  description TEXT,
  line_number INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_id);

-- ─── Bank / Cash Accounts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id),  -- Links to chart of accounts
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT,
  account_type TEXT CHECK (account_type IN ('current', 'savings', 'petty_cash', 'float', 'loan')) DEFAULT 'current',
  current_balance NUMERIC DEFAULT 0,
  opening_balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'KES',
  branch_id UUID REFERENCES branches(id),
  is_active BOOLEAN DEFAULT TRUE,
  last_reconciled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_branch ON bank_accounts(branch_id);

-- ─── Bank Transactions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'fee', 'interest', 'reconciliation')) NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC,
  reference_number TEXT,
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP,
  journal_entry_id UUID REFERENCES journal_entries(id),
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_reconciled ON bank_transactions(is_reconciled);

-- ─── Auto Journal Entry Number Sequence ────────────────────
CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq START 1;

-- ─── Seed Default Chart of Accounts ────────────────────────
-- Only insert if no accounts exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts LIMIT 1) THEN
    INSERT INTO accounts (account_number, name, description, account_type, account_subtype, normal_balance, is_system) VALUES
      -- ASSETS (1xxx)
      ('1000', 'Cash', 'Cash on hand and in registers', 'asset'::account_type, 'cash'::account_subtype, 'debit', true),
      ('1010', 'Petty Cash', 'Petty cash fund', 'asset'::account_type, 'cash'::account_subtype, 'debit', false),
      ('1020', 'M-Pesa Account', 'M-Pesa mobile money account', 'asset'::account_type, 'bank'::account_subtype, 'debit', false),
      ('1030', 'Bank Account - Main', 'Primary business bank account', 'asset'::account_type, 'bank'::account_subtype, 'debit', false),
      ('1100', 'Accounts Receivable', 'Amounts owed by customers', 'asset'::account_type, 'accounts_receivable'::account_subtype, 'debit', true),
      ('1200', 'Inventory', 'Products held for resale', 'asset'::account_type, 'inventory_asset'::account_subtype, 'debit', true),
      ('1500', 'Fixed Assets', 'Long-term tangible assets', 'asset'::account_type, 'fixed_asset'::account_subtype, 'debit', false),
      ('1510', 'Accumulated Depreciation', 'Total depreciation of fixed assets', 'asset'::account_type, 'fixed_asset'::account_subtype, 'credit', false),

      -- LIABILITIES (2xxx)
      ('2000', 'Accounts Payable', 'Amounts owed to suppliers', 'liability'::account_type, 'accounts_payable'::account_subtype, 'credit', true),
      ('2100', 'Tax Payable - VAT', 'VAT collected and owed to government', 'liability'::account_type, 'tax_liability'::account_subtype, 'credit', true),
      ('2200', 'Employee Payable', 'Salaries and wages owed', 'liability'::account_type, 'current_liability'::account_subtype, 'credit', false),
      ('2300', 'NHIF Payable', 'NHIF contributions owed', 'liability'::account_type, 'current_liability'::account_subtype, 'credit', false),
      ('2400', 'NSSF Payable', 'NSSF contributions owed', 'liability'::account_type, 'current_liability'::account_subtype, 'credit', false),
      ('2500', 'Loan Payable', 'Outstanding loan balances', 'liability'::account_type, 'long_term_liability'::account_subtype, 'credit', false),

      -- EQUITY (3xxx)
      ('3000', 'Owner Equity', 'Owner investment in the business', 'equity'::account_type, 'owner_equity'::account_subtype, 'credit', true),
      ('3100', 'Retained Earnings', 'Accumulated profits/losses', 'equity'::account_type, 'retained_earnings'::account_subtype, 'credit', true),

      -- REVENUE (4xxx)
      ('4000', 'Sales Revenue', 'Revenue from product sales', 'revenue'::account_type, 'sales_revenue'::account_subtype, 'credit', true),
      ('4100', 'Wholesale Revenue', 'Revenue from wholesale sales', 'revenue'::account_type, 'sales_revenue'::account_subtype, 'credit', false),
      ('4200', 'Loyalty Points Redeemed', 'Revenue from loyalty redemptions', 'revenue'::account_type, 'other_revenue'::account_subtype, 'credit', false),
      ('4300', 'Interest Income', 'Interest earned on bank deposits', 'revenue'::account_type, 'interest_income'::account_subtype, 'credit', false),

      -- COGS (5xxx)
      ('5000', 'Cost of Goods Sold', 'Direct cost of products sold', 'expense'::account_type, 'cost_of_goods_sold'::account_subtype, 'debit', true),
      ('5100', 'Inventory Adjustments', 'Write-offs and shrinkage', 'expense'::account_type, 'cost_of_goods_sold'::account_subtype, 'debit', false),

      -- EXPENSES (6xxx)
      ('6000', 'Salaries & Wages', 'Employee compensation', 'expense'::account_type, 'payroll_expense'::account_subtype, 'debit', false),
      ('6100', 'NHIF Contributions', 'Employer NHIF contributions', 'expense'::account_type, 'payroll_expense'::account_subtype, 'debit', false),
      ('6200', 'NSSF Contributions', 'Employer NSSF contributions', 'expense'::account_type, 'payroll_expense'::account_subtype, 'debit', false),
      ('6300', 'Rent Expense', 'Office/store rent', 'expense'::account_type, 'rent_expense'::account_subtype, 'debit', false),
      ('6400', 'Utilities - Electricity', 'Electricity bills', 'expense'::account_type, 'utilities_expense'::account_subtype, 'debit', false),
      ('6500', 'Utilities - Water', 'Water bills', 'expense'::account_type, 'utilities_expense'::account_subtype, 'debit', false),
      ('6600', 'Internet & Phone', 'Communication costs', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('6700', 'Marketing & Advertising', 'Promotional expenses', 'expense'::account_type, 'marketing_expense'::account_subtype, 'debit', false),
      ('6800', 'Office Supplies', 'Stationery and supplies', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('6900', 'Repairs & Maintenance', 'Equipment and building repairs', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('7000', 'Insurance', 'Business insurance premiums', 'expense'::account_type, 'insurance_expense'::account_subtype, 'debit', false),
      ('7100', 'Depreciation', 'Asset depreciation expense', 'expense'::account_type, 'depreciation_expense'::account_subtype, 'debit', false),
      ('7200', 'Bank Charges', 'Bank fees and charges', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('7300', 'Transport & Fuel', 'Delivery and fuel costs', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('7400', 'Cleaning', 'Cleaning and sanitation', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('7500', 'Professional Fees', 'Legal, accounting, consulting', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('7600', 'Bad Debts', 'Uncollectible receivables', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false),
      ('7700', 'Miscellaneous', 'Other expenses', 'expense'::account_type, 'operating_expense'::account_subtype, 'debit', false);
  END IF;
END $$;

-- ─── Auto-create journal entries from sales ────────────────
-- This function is called after a sale is completed
CREATE OR REPLACE FUNCTION create_sale_journal_entries()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_number TEXT;
  v_period_id UUID;
  v_cash_account UUID;
  v_sales_account UUID;
  v_cogs_account UUID;
  v_inventory_account UUID;
  v_tax_account UUID;
  v_receivable_account UUID;
  v_total_tax NUMERIC;
  v_total_cogs NUMERIC;
BEGIN
  -- Only create entries for completed sales
  IF NEW.payment_status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get or create period
  SELECT id INTO v_period_id FROM financial_periods
  WHERE start_date <= NEW.created_at::date AND end_date >= NEW.created_at::date
  AND (branch_id = NEW.branch_id OR branch_id IS NULL)
  LIMIT 1;

  -- Get account IDs
  SELECT id INTO v_cash_account FROM accounts WHERE account_number = '1000' AND is_system = true LIMIT 1;
  SELECT id INTO v_sales_account FROM accounts WHERE account_number = '4000' AND is_system = true LIMIT 1;
  SELECT id INTO v_cogs_account FROM accounts WHERE account_number = '5000' AND is_system = true LIMIT 1;
  SELECT id INTO v_inventory_account FROM accounts WHERE account_number = '1200' AND is_system = true LIMIT 1;
  SELECT id INTO v_tax_account FROM accounts WHERE account_number = '2100' AND is_system = true LIMIT 1;
  SELECT id INTO v_receivable_account FROM accounts WHERE account_number = '1100' AND is_system = true LIMIT 1;

  -- Generate entry number
  v_entry_number := 'JE-' || TO_CHAR(NEW.created_at, 'YYYY-MM') || '-' || LPAD(nextval('journal_entry_number_seq')::TEXT, 6, '0');

  -- Determine payment account based on method
  IF NEW.payment_method = 'mpesa' THEN
    SELECT id INTO v_cash_account FROM accounts WHERE account_number = '1020' LIMIT 1;
  ELSIF NEW.payment_method = 'card' THEN
    SELECT id INTO v_cash_account FROM accounts WHERE account_number = '1030' LIMIT 1;
  END IF;

  -- Calculate tax and COGS from sale items
  SELECT COALESCE(SUM(si.unit_price * si.quantity * 0.16 / 1.16), 0) INTO v_total_tax
  FROM sale_items si WHERE si.sale_id = NEW.id;

  SELECT COALESCE(SUM(p.purchase_price * si.quantity), 0) INTO v_total_cogs
  FROM sale_items si
  JOIN products p ON p.id = si.product_id
  WHERE si.sale_id = NEW.id;

  -- Create journal entry
  INSERT INTO journal_entries (entry_number, entry_date, description, reference_type, reference_id, period_id, branch_id, status, total_debit, total_credit, created_by)
  VALUES (v_entry_number, NEW.created_at::date, 'Sale ' || NEW.receipt_number, 'sale', NEW.id, v_period_id, NEW.branch_id, 'posted', NEW.total_amount, NEW.total_amount, NEW.cashier_id)
  RETURNING id INTO v_entry_number;

  -- Debit: Cash/Bank (increase asset)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES (v_entry_number, v_cash_account, NEW.total_amount, 0, 1);

  -- Credit: Sales Revenue (increase revenue)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
  VALUES (v_entry_number, v_sales_account, 0, NEW.total_amount - v_total_tax, 2);

  -- Credit: Tax Payable (increase liability) if tax exists
  IF v_total_tax > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
    VALUES (v_entry_number, v_tax_account, 0, v_total_tax, 3);
  END IF;

  -- Debit: COGS (increase expense)
  IF v_total_cogs > 0 THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
    VALUES (v_entry_number, v_cogs_account, v_total_cogs, 0, 4);

    -- Credit: Inventory (decrease asset)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
    VALUES (v_entry_number, v_inventory_account, 0, v_total_cogs, 5);
  END IF;

  -- If credit sale, also create receivable entry
  IF NEW.payment_method = 'credit' AND NEW.customer_id IS NOT NULL THEN
    -- For credit sales, debit Accounts Receivable instead of Cash
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_number)
    VALUES (v_entry_number, v_receivable_account, NEW.total_amount, 0, 6);
    -- Remove the cash debit (replace with receivable)
    DELETE FROM journal_entry_lines WHERE journal_entry_id = v_entry_number AND account_id = v_cash_account;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: create journal entries after sale completion
DROP TRIGGER IF EXISTS trg_sale_journal_entries ON sales;
CREATE TRIGGER trg_sale_journal_entries
  AFTER INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.payment_status = 'completed')
  EXECUTE FUNCTION create_sale_journal_entries();
