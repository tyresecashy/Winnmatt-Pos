-- Add Stripe payment intent ID column to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Create payment_logs table for Stripe/M-Pesa payment logging
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  transaction_id TEXT,
  amount INTEGER,
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS but allow service_role access
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
