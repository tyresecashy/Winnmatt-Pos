-- PRICING PROTECTION SCHEMA MIGRATION
-- Adds price audit tracking, trust levels, and review workflow
-- Protects manually curated prices from being overwritten by imports

-- =============================================================================
-- 1. EXTEND PRODUCTS TABLE WITH PRICE TRACKING
-- =============================================================================

-- Add columns to products table for price protection
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_source VARCHAR(50) DEFAULT 'seed'
  CHECK (price_source IN ('seed', 'manual', 'import')),
ADD COLUMN IF NOT EXISTS price_trust_level VARCHAR(50) DEFAULT 'low'
  CHECK (price_trust_level IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS price_review_status VARCHAR(50) DEFAULT 'needs_review'
  CHECK (price_review_status IN ('approved', 'flagged', 'needs_review', 'blocked')),
ADD COLUMN IF NOT EXISTS price_review_notes TEXT,
ADD COLUMN IF NOT EXISTS price_reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS price_reviewed_at TIMESTAMP;

-- Add indexes for review workflow queries
CREATE INDEX IF NOT EXISTS idx_products_price_review_status 
  ON products(price_review_status);
CREATE INDEX IF NOT EXISTS idx_products_price_trust_level 
  ON products(price_trust_level);
CREATE INDEX IF NOT EXISTS idx_products_price_source 
  ON products(price_source);

-- =============================================================================
-- 2. CREATE PRICE AUDIT LOG TABLE
-- =============================================================================

-- Tracks all price changes for audit trail
CREATE TABLE IF NOT EXISTS price_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES product_import_batches(id) ON DELETE SET NULL,
  
  -- Previous values
  previous_selling_price INTEGER,
  previous_purchase_price INTEGER,
  previous_price_source VARCHAR(50),
  previous_price_review_status VARCHAR(50),
  
  -- New values
  new_selling_price INTEGER,
  new_purchase_price INTEGER,
  new_price_source VARCHAR(50),
  new_price_review_status VARCHAR(50),
  
  -- Change metadata
  change_type VARCHAR(50) NOT NULL,  -- 'import', 'manual', 'approval', 'correction'
  change_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_audit_log_product_id 
  ON price_audit_log(product_id);
CREATE INDEX IF NOT EXISTS idx_price_audit_log_batch_id 
  ON price_audit_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_price_audit_log_created_at 
  ON price_audit_log(created_at);

-- =============================================================================
-- 3. CREATE PRICE ANOMALY FLAGS TABLE
-- =============================================================================

-- Tracks detected anomalies for admin review
CREATE TABLE IF NOT EXISTS price_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES product_import_batches(id) ON DELETE SET NULL,
  
  -- Anomaly metadata
  anomaly_type VARCHAR(100) NOT NULL,  -- See values below
  description TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL,  -- 'critical', 'high', 'medium', 'low'
  
  -- Current values
  current_selling_price INTEGER,
  current_purchase_price INTEGER,
  
  -- Suggested correction
  suggested_selling_price INTEGER,
  suggested_purchase_price INTEGER,
  suggestion_reason TEXT,
  
  -- Review status
  status VARCHAR(50) NOT NULL DEFAULT 'flagged',  -- 'flagged', 'approved', 'rejected', 'corrected'
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Anomaly type enum examples:
-- 'HIGH_RETAIL_PRICE' - selling_price > 5000 KES
-- 'HIGH_COST_PRICE' - purchase_price > 3000 KES
-- 'COST_GT_SELLING' - cost > selling (losing money)
-- 'EXCESSIVE_MARGIN' - margin > 300%
-- 'LOW_MARGIN' - margin < 10%
-- 'UNREALISTIC_COMBINATION' - suspicious price pair
-- 'SEED_PRODUCT' - likely seed/demo data
-- 'IMPORT_OVERWRITE_PROTECTED' - trying to overwrite high-trust price

CREATE INDEX IF NOT EXISTS idx_price_anomalies_product_id 
  ON price_anomalies(product_id);
CREATE INDEX IF NOT EXISTS idx_price_anomalies_status 
  ON price_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_price_anomalies_severity 
  ON price_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_price_anomalies_batch_id 
  ON price_anomalies(batch_id);
CREATE INDEX IF NOT EXISTS idx_price_anomalies_created_at 
  ON price_anomalies(created_at);

-- =============================================================================
-- 4. CREATE PRICE RULES TABLE
-- =============================================================================

-- Configurable anomaly detection rules
CREATE TABLE IF NOT EXISTS price_anomaly_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  rule_name VARCHAR(100) NOT NULL UNIQUE,
  rule_type VARCHAR(50) NOT NULL,  -- 'HIGH_RETAIL', 'HIGH_COST', 'MARGIN', 'RATIO'
  description TEXT,
  
  -- Rule parameters
  threshold_value INTEGER,
  threshold_type VARCHAR(50),  -- 'exact', 'percentage', 'ratio'
  
  -- Severity and blocking
  severity VARCHAR(50) NOT NULL,  -- 'critical', 'high', 'medium', 'low'
  blocks_approval BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Populate default rules
INSERT INTO price_anomaly_rules (rule_name, rule_type, description, threshold_value, threshold_type, severity, blocks_approval, is_active)
VALUES 
  ('HighRetailPrice', 'HIGH_RETAIL', 'Selling price > 5000 KES', 5000, 'exact', 'high', TRUE, TRUE),
  ('HighCostPrice', 'HIGH_COST', 'Purchase price > 3000 KES', 3000, 'exact', 'medium', FALSE, TRUE),
  ('CostGtSelling', 'RATIO', 'Cost > Selling price', 100, 'ratio', 'critical', TRUE, TRUE),
  ('ExcessiveMargin', 'MARGIN', 'Margin > 300%', 300, 'percentage', 'high', TRUE, TRUE),
  ('LowMargin', 'MARGIN', 'Margin < 10%', 10, 'percentage', 'medium', FALSE, TRUE),
  ('UnrealisticCombination', 'RATIO', 'Suspicious price pair', 0, 'exact', 'high', TRUE, TRUE)
ON CONFLICT (rule_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_price_anomaly_rules_active 
  ON price_anomaly_rules(is_active);

-- =============================================================================
-- 5. CREATE PRICE PROTECTION TABLE
-- =============================================================================

-- Tracks products that have high-trust manual curation
-- Imports cannot overwrite these without explicit admin approval
CREATE TABLE IF NOT EXISTS price_protections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  
  -- Protection level
  protection_level VARCHAR(50) NOT NULL,  -- 'high' = do not overwrite, 'medium' = warn before overwrite
  
  -- Protection reason
  reason VARCHAR(500),
  protected_because_of_text TEXT,  -- e.g., "Manually verified on 2026-01-15 by manager John"
  
  -- Who protected
  protected_by UUID NOT NULL REFERENCES users(id),
  protected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Expiration (protetion can be temporary)
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_protections_product_id 
  ON price_protections(product_id);
CREATE INDEX IF NOT EXISTS idx_price_protections_level 
  ON price_protections(protection_level);
CREATE INDEX IF NOT EXISTS idx_price_protections_expires_at 
  ON price_protections(expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- 6. ENABLE ROW LEVEL SECURITY FOR PRICE TABLES
-- =============================================================================

ALTER TABLE price_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_anomaly_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_protections ENABLE ROW LEVEL SECURITY;

-- Allow admins to see all, others see only their own reviews
CREATE POLICY "price_audit_log_admin_all" ON price_audit_log
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "price_anomalies_admin_all" ON price_anomalies
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "price_protections_admin_all" ON price_protections
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- =============================================================================
-- 7. SCHEMA VERSION TRACKING
-- =============================================================================

-- Track that this migration has been applied
INSERT INTO schema_versions (version, name, applied_at)
VALUES ('pricing_protection_v1', 'Add price audit, anomalies, protections, and trust levels', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 8. MARK ALL EXISTING PRODUCTS AS NEEDING REVIEW
-- =============================================================================

-- Update existing products to flag for review
UPDATE products
SET 
  price_review_status = 'needs_review',
  price_source = 'seed'
WHERE price_source IS NULL OR price_review_status IS NULL;

-- Mark obviously incorrect prices as 'blocked' until reviewed
UPDATE products
SET 
  price_review_status = 'blocked',
  price_trust_level = 'low'
WHERE 
  purchase_price > selling_price  -- cost > selling
  OR selling_price > 5000  -- very high retail
  OR purchase_price > 3000;  -- very high cost

COMMIT;
