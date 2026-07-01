-- M-Pesa Transactions Table
-- Stores all M-Pesa STK Push requests and callback results
-- Source: Safaricom Daraja API integration

CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  merchant_request_id VARCHAR(255),
  checkout_request_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled', 'timeout')) DEFAULT 'pending',
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

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request_id ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_sale_id ON mpesa_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_phone_number ON mpesa_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_mpesa_created_at ON mpesa_transactions(created_at DESC);

-- Update trigger to set updated_at timestamp
CREATE OR REPLACE FUNCTION update_mpesa_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mpesa_transactions_update_timestamp ON mpesa_transactions;
CREATE TRIGGER mpesa_transactions_update_timestamp
  BEFORE UPDATE ON mpesa_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_mpesa_transactions_updated_at();

-- Add RLS policies (if RLS is enabled on this table)
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see M-Pesa transactions for sales in their branch
CREATE POLICY "mpesa_transactions_branch_access" ON mpesa_transactions
  FOR SELECT
  USING (
    sale_id IN (
      SELECT id FROM sales 
      WHERE branch_id IN (
        SELECT branch_id FROM users WHERE id = auth.uid()
      )
    )
  );
