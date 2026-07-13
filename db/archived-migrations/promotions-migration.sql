-- WINNMATT Retail OS: Promotions Engine Migration
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================================================
-- Step 1: Promotions definition table
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  name TEXT NOT NULL,
  description TEXT,

  -- Type: fixed_amount (KSh off), percentage (% off), bonus_points (multiplier)
  type TEXT NOT NULL CHECK (type IN ('fixed_amount', 'percentage', 'bonus_points')),
  value NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Scope: cart (entire cart), product (specific products), category (specific categories)
  scope TEXT NOT NULL CHECK (scope IN ('cart', 'product', 'category')) DEFAULT 'cart',

  -- Which products/categories this applies to (JSON arrays, relevant when scope ≠ cart)
  applicable_product_ids UUID[] DEFAULT '{}',
  applicable_category_ids UUID[] DEFAULT '{}',

  -- Thresholds
  min_purchase_cents INTEGER DEFAULT 0,
  max_discount_cents INTEGER DEFAULT 0,   -- 0 = unlimited

  -- Scheduling
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,

  -- Behaviour
  is_active BOOLEAN DEFAULT TRUE,
  auto_apply BOOLEAN DEFAULT FALSE,       -- auto-applied to qualifying carts
  stackable BOOLEAN DEFAULT FALSE,         -- can combine with other promos
  requires_coupon BOOLEAN DEFAULT FALSE,   -- must enter a coupon code to activate

  -- Bonus points (only for type = 'bonus_points')
  bonus_multiplier NUMERIC(4, 1) DEFAULT 1.0,

  -- Usage tracking
  usage_limit INTEGER DEFAULT 0,   -- 0 = unlimited
  current_usage INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 2: Coupon codes per promotion
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotion_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  usage_limit INTEGER DEFAULT 0,    -- 0 = unlimited per coupon
  current_usage INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code)
);

-- ============================================================================
-- Step 3: Promotion usage log (for tracking + preventing overshoot)
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotion_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  coupon_id UUID REFERENCES promotion_coupons(id) ON DELETE SET NULL,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  bonus_multiplier_applied NUMERIC(4, 1),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 4: Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_auto_apply ON promotions(auto_apply) WHERE auto_apply = TRUE;
CREATE INDEX IF NOT EXISTS idx_coupons_code ON promotion_coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_promotion ON promotion_coupons(promotion_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_sale ON promotion_usage_log(sale_id);

-- ============================================================================
-- Step 5: updated_at trigger for promotions
-- ============================================================================
CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS promotions_updated_at_trigger ON promotions;
CREATE TRIGGER promotions_updated_at_trigger
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotions_updated_at();

COMMIT;
