-- WINNMATT POS: Loyalty Redemption Migration (Phase 2)
-- Run this in Supabase after owner-loyalty-migration.sql

BEGIN;

-- Add missing redemption configuration columns to loyalty_settings
ALTER TABLE loyalty_settings
ADD COLUMN IF NOT EXISTS redeem_minimum_points INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS redeem_minimum_basket_cents INTEGER DEFAULT 5000;

-- Update comments for clarity
COMMENT ON COLUMN loyalty_settings.redeem_enabled IS 'Enable/disable loyalty point redemption at checkout';
COMMENT ON COLUMN loyalty_settings.redeem_value_cents IS 'Value of 1 point in cents (e.g., 50 = 0.5 KSh per point)';
COMMENT ON COLUMN loyalty_settings.redeem_minimum_points IS 'Minimum points required to redeem (e.g., 25)';
COMMENT ON COLUMN loyalty_settings.redeem_minimum_basket_cents IS 'Minimum basket total to allow redemption (e.g., 5000 cents = 50 KSh)';
COMMENT ON COLUMN loyalty_settings.redeem_max_percent_per_sale IS 'Maximum percentage of sale total that can be redeemed (0-100)';

-- Update default loyalty settings with redemption defaults
UPDATE loyalty_settings 
SET 
  redeem_value_cents = COALESCE(redeem_value_cents, 50),
  redeem_minimum_points = COALESCE(redeem_minimum_points, 25),
  redeem_minimum_basket_cents = COALESCE(redeem_minimum_basket_cents, 5000)
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID;

COMMIT;
