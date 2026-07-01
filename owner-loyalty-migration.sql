-- WINNMATT POS: Owner Role + Loyalty System Migration
-- Run this AFTER db-migrations.sql in Supabase

BEGIN;

-- ============================================================================
-- PART 1: OWNER ROLE SUPPORT
-- ============================================================================

-- 1.1 Update users table: Make branch_id nullable for Owner accounts
ALTER TABLE users 
ALTER COLUMN branch_id DROP NOT NULL;

-- 1.2 Update role constraint to include 'owner'
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS "users_role_check";

ALTER TABLE users 
ADD CONSTRAINT "users_role_check" 
CHECK (role IN ('owner', 'admin', 'manager', 'cashier'));

-- 1.3 Add constraint: owner must have NULL branch_id, others must have branch
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS "role_branch_check";

ALTER TABLE users 
ADD CONSTRAINT "role_branch_check" 
CHECK (
  (role = 'owner' AND branch_id IS NULL) OR 
  (role IN ('admin', 'manager', 'cashier') AND branch_id IS NOT NULL)
);

-- ============================================================================
-- PART 2: LOYALTY SYSTEM TABLES
-- ============================================================================

-- 2.1 Create Loyalty Settings table (singleton - exactly one row)
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id UUID PRIMARY KEY DEFAULT 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,
  
  -- Phase 1: Earn Rules
  earn_enabled BOOLEAN DEFAULT TRUE,
  earn_threshold_cents INTEGER DEFAULT 10000,
  -- earn_threshold_cents examples:
  --   10000 = 1 point per 100 KSh (Safaricom benchmark)
  --   20000 = 1 point per 200 KSh
  --   50000 = 1 point per 500 KSh
  --  100000 = 1 point per 1000 KSh
  
  earn_minimum_basket_cents INTEGER DEFAULT 0,
  -- Minimum basket total to earn points (0 = no minimum)
  
  earn_on_discounted BOOLEAN DEFAULT TRUE,
  -- If TRUE: earn on full price before discount
  -- If FALSE: earn only on discounted price
  
  -- Phase 2: Redeem Rules (designed but not yet enabled)
  redeem_enabled BOOLEAN DEFAULT FALSE,
  redeem_value_cents INTEGER,
  -- 1 point = X cents (e.g., 50 = half KSh per point)
  
  redeem_max_percent_per_sale NUMERIC(3,1) DEFAULT 50.0,
  -- Max percentage of sale total that can be redeemed
  
  -- Expiry Rules
  expiry_enabled BOOLEAN DEFAULT FALSE,
  expiry_days INTEGER,
  -- Points expire after X days (NULL = never expire)
  
  -- Metadata
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_settings_single_row ON loyalty_settings((id));

-- 2.2 Create Loyalty Transactions table (immutable audit trail)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  
  -- Transaction type
  type TEXT NOT NULL CHECK (type IN (
    'earn_sale',           -- Points earned from completed sale
    'earn_admin',          -- Admin manually awarded points (future)
    'redeem_sale',         -- Customer redeemed points at checkout (future)
    'reverse_void',        -- Points reversed due to sale void
    'reverse_return',      -- Points reversed due to return (future)
    'expire',              -- Points expired (future)
    'admin_adjust'         -- Owner/Admin adjustment (future)
  )),
  
  -- Link to the transaction that triggered this (nullable for manual operations)
  sale_id UUID REFERENCES sales(id) ON DELETE RESTRICT,
  
  -- Points movement (negative = deduction)
  points_delta INTEGER NOT NULL,
  
  -- State before/after
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  
  -- Context and audit trail
  reason TEXT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer 
  ON loyalty_transactions(customer_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_sale 
  ON loyalty_transactions(sale_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at 
  ON loyalty_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type 
  ON loyalty_transactions(type);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_branch 
  ON loyalty_transactions(branch_id);

-- 2.3 Ensure customers table has loyalty_points indexed
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_points 
  ON customers(loyalty_points);

-- ============================================================================
-- PART 3: AUDIT LOGGING TABLE (for owner actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  -- Examples: 'create_user', 'void_sale', 'update_loyalty_settings', 'create_branch'
  
  resource_type TEXT,
  -- Examples: 'user', 'sale', 'loyalty_settings', 'branch'
  
  resource_id TEXT,
  -- ID of the resource being modified
  
  old_value JSONB,
  new_value JSONB,
  
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  -- NULL for enterprise-wide actions
  
  details TEXT,
  -- Human-readable description
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
  ON audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
  ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
  ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
  ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- PART 4: INSERT DEFAULT LOYALTY SETTINGS
-- ============================================================================

INSERT INTO loyalty_settings (
  id,
  earn_enabled,
  earn_threshold_cents,
  earn_minimum_basket_cents,
  earn_on_discounted,
  redeem_enabled,
  redeem_value_cents,
  redeem_max_percent_per_sale,
  expiry_enabled,
  expiry_days,
  created_at
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID,
  TRUE,
  10000,
  0,
  TRUE,
  FALSE,
  NULL,
  50.0,
  FALSE,
  NULL,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 5: ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Simple policies: authenticated users can select
-- (tighten these in production if needed)

DROP POLICY IF EXISTS "Enable read for authenticated" ON loyalty_settings;
CREATE POLICY "Enable read for authenticated" ON loyalty_settings
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable read for authenticated" ON loyalty_transactions;
CREATE POLICY "Enable read for authenticated" ON loyalty_transactions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable read for authenticated" ON audit_logs;
CREATE POLICY "Enable read for authenticated" ON audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

COMMIT;
