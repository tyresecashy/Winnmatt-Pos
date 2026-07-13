-- WINNMATT POS: Loyalty Engine Migration (Phase 3)
-- Run this in Supabase after redemption-migration.sql
-- Adds tier multipliers, bonus multipliers, expiry config, and customer fields

BEGIN;

-- ============================================================================
-- Step 1: Add new columns to loyalty_settings
-- ============================================================================
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS earn_rate_cents_per_point INTEGER DEFAULT 15000;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS point_value_cents INTEGER DEFAULT 50;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS tier_bronze_multiplier NUMERIC DEFAULT 1.0;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS tier_silver_multiplier NUMERIC DEFAULT 1.25;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS tier_gold_multiplier NUMERIC DEFAULT 1.5;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS tier_platinum_multiplier NUMERIC DEFAULT 2.0;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS holiday_multiplier NUMERIC DEFAULT 2.0;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS birthday_multiplier NUMERIC DEFAULT 3.0;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS weekend_multiplier NUMERIC DEFAULT 1.5;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS campaign_multiplier NUMERIC DEFAULT 2.0;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS expiry_days INTEGER DEFAULT 365;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS enable_tiers BOOLEAN DEFAULT true;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS enable_birthday_bonus BOOLEAN DEFAULT true;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS enable_holiday_bonus BOOLEAN DEFAULT true;
ALTER TABLE loyalty_settings ADD COLUMN IF NOT EXISTS enable_weekend_bonus BOOLEAN DEFAULT true;

-- ============================================================================
-- Step 2: Add customer tier and profile fields
-- ============================================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze'
  CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'vip'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_lifetime_spend_cents BIGINT DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[];

-- ============================================================================
-- Step 3: Update existing default singleton row to new values
-- ============================================================================
UPDATE loyalty_settings SET
  earn_threshold_cents = 15000,
  redeem_value_cents = 50,
  earn_minimum_basket_cents = 15000,
  redeem_minimum_points = 25,
  redeem_max_percent_per_sale = 20,
  redeem_minimum_basket_cents = 0
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

COMMIT;
