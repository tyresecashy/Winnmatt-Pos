-- Tuma Payment Transactions
-- Stores payment records processed through Tuma Payments gateway
-- Provider-agnostic design supports extensibility to other payment providers

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider identification
  provider VARCHAR(50) NOT NULL DEFAULT 'tuma',
  merchant_request_id VARCHAR(255),
  checkout_request_id VARCHAR(255),
  mpesa_receipt_number VARCHAR(100),
  
  -- Financial
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'KES',
  
  -- Status lifecycle: pending → processing → completed | failed | cancelled | timeout
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'timeout')),
  
  -- Entity links
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  
  -- Callback data
  callback_payload JSONB,
  result_code VARCHAR(10),
  result_desc TEXT,
  failure_reason TEXT,
  
  -- Customer contact
  phone_number VARCHAR(20) NOT NULL,
  description TEXT,
  
  -- Idempotency key — prevents duplicate STK Push charges
  idempotency_key VARCHAR(64) UNIQUE,
  
  -- Timestamps
  initiated_at TIMESTAMPTZ DEFAULT now(),
  callback_received_at TIMESTAMPTZ,
  sale_finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_sale_id ON payment_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_merchant_request ON payment_transactions(merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_checkout_request ON payment_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_phone ON payment_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(provider);

-- Row-Level Security
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all payment transactions
CREATE POLICY "Authenticated users can view payment_transactions"
  ON payment_transactions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert payment transactions
CREATE POLICY "Authenticated users can insert payment_transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Service role can update (for callback processing)
CREATE POLICY "Service role can update payment_transactions"
  ON payment_transactions FOR UPDATE
  USING (auth.role() = 'service_role');
