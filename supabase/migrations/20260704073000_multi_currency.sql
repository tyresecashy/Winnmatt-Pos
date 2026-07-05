-- ============================================================
-- Multi-Currency Support
-- ============================================================

-- Exchange rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,        -- 'USD', 'EUR', 'GBP'
  to_currency TEXT NOT NULL,          -- 'KES'
  rate NUMERIC NOT NULL,              -- 1 USD = 150.50 KES
  source TEXT DEFAULT 'manual',       -- 'manual', 'api', 'central_bank'
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_to TIMESTAMPTZ,               -- NULL = currently valid
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(from_currency, to_currency, valid_from)
);

-- Add currency columns to relevant tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- RLS policies for exchange_rates
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_rates_select_auth" ON exchange_rates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "exchange_rates_insert_admin" ON exchange_rates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "exchange_rates_update_admin" ON exchange_rates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "exchange_rates_delete_admin" ON exchange_rates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Indexes
CREATE INDEX idx_exchange_rates_from_to ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_valid ON exchange_rates(valid_from, valid_to);

-- Function to get current exchange rate
CREATE OR REPLACE FUNCTION get_exchange_rate(
  from_curr TEXT,
  to_curr TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  current_rate NUMERIC;
BEGIN
  -- Same currency = 1:1
  IF from_curr = to_curr THEN
    RETURN 1.0;
  END IF;

  -- Get the most recent valid rate
  SELECT rate INTO current_rate
  FROM exchange_rates
  WHERE from_currency = from_curr
    AND to_currency = to_curr
    AND valid_from <= now()
    AND (valid_to IS NULL OR valid_to > now())
  ORDER BY valid_from DESC
  LIMIT 1;

  -- If no rate found, return NULL
  RETURN current_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert amount between currencies
CREATE OR REPLACE FUNCTION convert_currency(
  amount NUMERIC,
  from_curr TEXT,
  to_curr TEXT
)
RETURNS NUMERIC AS $$
DECLARE
  rate NUMERIC;
BEGIN
  rate := get_exchange_rate(from_curr, to_curr);
  IF rate IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN ROUND(amount * rate, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed some common exchange rates (as of example date)
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, valid_from) VALUES
  ('USD', 'KES', 150.50, 'manual', '2026-01-01'),
  ('EUR', 'KES', 163.25, 'manual', '2026-01-01'),
  ('GBP', 'KES', 190.75, 'manual', '2026-01-01'),
  ('UGX', 'KES', 0.39, 'manual', '2026-01-01'),
  ('TZS', 'KES', 0.58, 'manual', '2026-01-01'),
  ('RWF', 'KES', 1.15, 'manual', '2026-01-01'),
  ('NGN', 'KES', 0.095, 'manual', '2026-01-01'),
  ('ZAR', 'KES', 8.25, 'manual', '2026-01-01')
ON CONFLICT (from_currency, to_currency, valid_from) DO NOTHING;
