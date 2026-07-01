-- ============================================================================
-- M-Pesa Transactions Schema Migration
-- Adds support for M-Pesa STK Push payments
-- ============================================================================

-- Update sales table to add mpesa payment method
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS payment_method varchar(50);

-- Update payment_method check to include 'mpesa'
-- If constraint exists, we may need to drop and recreate
-- For safety, use a trigger or application-level validation

-- Create mpesa_transactions table
CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  sale_id UUID NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
  
  -- Daraja Request IDs (for matching callback)
  merchant_request_id VARCHAR(255) NOT NULL,
  checkout_request_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Payment details
  phone_number VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  
  -- Payment status
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled', 'timeout')),
  
  -- M-Pesa receipt (if payment successful)
  mpesa_receipt_number VARCHAR(50),
  
  -- Callback data (store full payload for audit trail)
  callback_payload JSONB,
  
  -- Error message (if payment failed)
  error_message TEXT,
  
  -- Timing information
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  callback_received_at TIMESTAMP WITH TIME ZONE,
  sale_finalized_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_sale_id 
  ON mpesa_transactions(sale_id);

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_checkout_request_id 
  ON mpesa_transactions(checkout_request_id);

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_merchant_request_id 
  ON mpesa_transactions(merchant_request_id);

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_status 
  ON mpesa_transactions(status);

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_phone_number 
  ON mpesa_transactions(phone_number);

CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_created_at 
  ON mpesa_transactions(created_at);

-- Create index for pending transactions (reconciliation queries)
CREATE INDEX IF NOT EXISTS idx_mpesa_transactions_pending 
  ON mpesa_transactions(status) 
  WHERE status = 'pending';

-- Set up automatic updated_at trigger if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'mpesa_transactions_updated_at_trigger'
  ) THEN
    CREATE TRIGGER mpesa_transactions_updated_at_trigger
    BEFORE UPDATE ON mpesa_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Row Level Security: Allow users to access only their branch's transactions
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users (view own branch transactions)
CREATE POLICY "Users can view M-Pesa transactions for their sales"
ON mpesa_transactions
FOR SELECT
TO authenticated
USING (
  sale_id IN (
    SELECT id FROM sales 
    WHERE branch_id IN (
      SELECT DISTINCT branch_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Staff can insert M-Pesa transactions for their branch
CREATE POLICY "Staff can create M-Pesa transactions"
ON mpesa_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  sale_id IN (
    SELECT id FROM sales
    WHERE branch_id IN (
      SELECT DISTINCT branch_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Staff can update M-Pesa transactions for their branch
CREATE POLICY "Staff can update M-Pesa transactions"
ON mpesa_transactions
FOR UPDATE
TO authenticated
USING (
  sale_id IN (
    SELECT id FROM sales
    WHERE branch_id IN (
      SELECT DISTINCT branch_id FROM users WHERE id = auth.uid()
    )
  )
)
WITH CHECK (
  sale_id IN (
    SELECT id FROM sales
    WHERE branch_id IN (
      SELECT DISTINCT branch_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Update sales table to support 'mpesa' payment method
DO $$
BEGIN
  -- Check if we can add mpesa to the payment_method enum
  -- For now, we'll rely on application-level validation
  -- Since payment_method didn't have constraints originally
  
  -- Ensure sales table has payment_status with 'pending' option
  -- Original payment_status should be 'pending' | 'completed' | 'failed'
  -- This is already the case per the schema
  
  -- Add comment documenting the changes
  COMMENT ON TABLE mpesa_transactions IS 
    'Stores M-Pesa payment attempts and results. Payment_status in sales table should be "pending" during STK Push, then "completed" after callback confirms.';
END $$;

-- ============================================================================
-- Notes for POS Integration
-- ============================================================================
-- 
-- 1. When cashier selects M-Pesa as payment method:
--    - Create sale with payment_status = 'pending'
--    - Call POST /api/mpesa/stk-push with saleId, phone, amount
--
-- 2. STK Push endpoint:
--    - Validates sale is in pending state
--    - Calls Daraja STK Push API
--    - Creates mpesa_transactions record with status='pending'
--
-- 3. Customer sees M-Pesa prompt on their phone
--    - Can confirm (success) or cancel/timeout
--
-- 4. Safaricom calls callback endpoint with result:
--    - Updates mpesa_transactions.status to 'confirmed','failed','cancelled','timeout'
--    - If confirmed: updates sales.payment_status = 'completed'
--    - If failed/cancelled/timeout: updates sales.payment_status = 'failed'
--
-- 5. POS polls GET /api/mpesa/status?checkoutRequestId=... 
--    - Shows waiting UI until status changes from 'pending'
--    - Shows success if status='confirmed' and sale.payment_status='completed'
--    - Shows failure if status='failed' or sale.payment_status='failed'
--    - Allows retry or switch payment method if failed
--
-- 6. Reconciliation:
--    - Query pending transactions older than X minutes
--    - Query failed transactions for analysis
--    - M-Pesa receipt number stored for bank reconciliation
