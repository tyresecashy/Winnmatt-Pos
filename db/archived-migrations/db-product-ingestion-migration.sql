-- WINNMATT POS - PRODUCT INGESTION SYSTEM MIGRATION
-- Phase 2: Database Schema for Large-Scale Product Import & Pricing
-- Date: April 2026
-- WARNING: This is a NON-BREAKING migration. All existing operations preserved.

-- ============================================================================
-- SECTION 1: ENHANCE products TABLE (add new fields without breaking existing)
-- ============================================================================

-- Add new optional columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs';  
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
  CHECK (status IN ('active', 'discontinued', 'staging', 'archived'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_product_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS suggested_selling_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Index for non-breaking performance
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source_id, source_product_id) WHERE source_id IS NOT NULL;

-- ============================================================================
-- SECTION 2: PRODUCT SOURCES - Registry of External Data Sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,                    -- e.g., "Jumia Kenya", "Carrefour Online"
  description TEXT,
  source_type TEXT NOT NULL 
    CHECK (source_type IN ('csv_upload', 'api', 'web_scraper', 'manual_csv', 'other')),
  is_active BOOLEAN DEFAULT TRUE,
  config JSONB,                                 -- Source-specific config (API keys, URLs, etc)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_sources_active ON product_sources(is_active);

-- ============================================================================
-- SECTION 3: PRODUCT IMPORT BATCHES - Track Bulk Imports
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES product_sources(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'normalizing', 'deduplicating', 'reviewing', 'staged', 'approved', 'published', 'failed', 'cancelled')),
  total_records INTEGER NOT NULL,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,
  batch_hash TEXT UNIQUE,                      -- SHA256 to detect retries
  error_log JSONB,                             -- Capture errors for debugging
  imported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  published_at TIMESTAMP,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_source ON product_import_batches(source_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON product_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_created ON product_import_batches(created_at DESC);

-- ============================================================================
-- SECTION 4: RAW PRODUCT IMPORTS - Initial Staging
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  source_product_id TEXT NOT NULL,             -- External ID (URL slug, SKU, etc)
  raw_data JSONB NOT NULL,                     -- Full scraped data as-is
  source_name TEXT,
  source_brand TEXT,
  source_category TEXT,
  source_sku TEXT,
  source_barcode TEXT,
  source_unit TEXT,
  source_size_value DECIMAL(10, 2),
  source_size_unit TEXT,                       -- ml, g, kg, l, pcs, pack
  source_retail_price INTEGER,                 -- Retail price at source (before normalization)
  source_currency TEXT DEFAULT 'KES',
  source_url TEXT,
  source_image_url TEXT,
  fetched_at TIMESTAMP,
  processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'normalized', 'duplicate_flagged', 'merged', 'failed', 'skipped')),
  processing_error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_imports_batch ON product_imports(batch_id);
CREATE INDEX IF NOT EXISTS idx_product_imports_source_product ON product_imports(source_product_id);
CREATE INDEX IF NOT EXISTS idx_product_imports_status ON product_imports(processing_status);

-- ============================================================================
-- SECTION 5: NORMALIZED PRODUCT STAGING - Ready for Review/Dedup
-- ============================================================================

CREATE TABLE IF NOT EXISTS products_staging (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  import_ids UUID[] DEFAULT ARRAY[]::uuid[],  -- Track which raw imports created this
  
  -- Normalized product data
  normalized_sku TEXT,
  normalized_name TEXT NOT NULL,
  normalized_brand TEXT,
  normalized_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  normalized_unit TEXT,
  normalized_barcode TEXT,
  normalized_image_url TEXT,
  
  -- Pricing from sources
  min_seen_price INTEGER,
  max_seen_price INTEGER,
  avg_seen_price INTEGER,
  median_seen_price INTEGER,
  source_count INTEGER DEFAULT 1,
  
  -- Suggested selling price (calculated)
  suggested_selling_price INTEGER,
  suggested_purchase_price INTEGER,
  price_calculation_method TEXT,               -- e.g., '50% margin', 'competitor avg', etc
  
  -- Anomaly detection
  price_anomaly BOOLEAN DEFAULT FALSE,
  anomaly_reason TEXT,                         -- e.g., 'Price 3x median', 'Missing unit', etc
  confidence_score DECIMAL(3, 2),              -- 0-1, how confident is the normalization
  
  -- Deduplication hints
  possible_duplicate_of_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  duplicate_confidence DECIMAL(3, 2),
  fuzzy_match_reason TEXT,
  
  -- Review status
  review_status TEXT DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'needs_review', 'approved', 'rejected', 'merged')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_staging_batch ON products_staging(batch_id);
CREATE INDEX IF NOT EXISTS idx_products_staging_status ON products_staging(review_status);
CREATE INDEX IF NOT EXISTS idx_products_staging_barcode ON products_staging(normalized_barcode) WHERE normalized_barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_staging_sku ON products_staging(normalized_sku) WHERE normalized_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_staging_anomaly ON products_staging(price_anomaly) WHERE price_anomaly = TRUE;

-- ============================================================================
-- SECTION 6: PRODUCT DEDUPLICATION RECORDS - Track Merged Products
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_deduplications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  duplicate_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  dedup_method TEXT NOT NULL CHECK (dedup_method IN ('exact_match', 'fuzzy_match', 'manual', 'barcode')),
  confidence DECIMAL(3, 2),
  match_reason TEXT,
  merged_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  merged_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dedup_canonical ON product_deduplications(canonical_product_id);
CREATE INDEX IF NOT EXISTS idx_dedup_duplicate ON product_deduplications(duplicate_product_id);

-- ============================================================================
-- SECTION 7: PRODUCT PRICE HISTORY - Audit Trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  previous_selling_price INTEGER,
  new_selling_price INTEGER,
  previous_purchase_price INTEGER,
  new_purchase_price INTEGER,
  change_reason TEXT NOT NULL CHECK (change_reason IN ('import', 'manual_edit', 'price_refresh', 'approval', 'system_adjustment')),
  source_batch_id UUID REFERENCES product_import_batches(id) ON DELETE SET NULL,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  change_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON product_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_batch ON product_price_history(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created ON product_price_history(created_at DESC);

-- ============================================================================
-- SECTION 8: PRICING SUGGESTIONS - Min/Max/Avg from Sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES product_sources(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  observed_retail_price INTEGER,
  min_price INTEGER,
  max_price INTEGER,
  avg_price INTEGER,
  median_price INTEGER,
  observation_count INTEGER DEFAULT 1,
  suggested_margin_percent INTEGER DEFAULT 50,  -- Default 50% margin
  suggested_selling_price INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_suggestions_product ON pricing_suggestions(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_suggestions_source ON pricing_suggestions(source_id);
CREATE INDEX IF NOT EXISTS idx_pricing_suggestions_batch ON pricing_suggestions(batch_id);

-- ============================================================================
-- SECTION 9: PRICE ANOMALIES - Flagged Suspicious Prices
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  staging_product_id UUID REFERENCES products_staging(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('outlier', 'missing_data', 'unit_mismatch', 'extreme_margin', 'non_numeric', 'category_unknown')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT NOT NULL,
  flagged_value TEXT,
  expected_range TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_batch ON price_anomalies(batch_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON price_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON price_anomalies(resolved);

-- ============================================================================
-- SECTION 10: PRODUCT NORMALIZATION UNITS REFERENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS normalization_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_category TEXT NOT NULL,                 -- volume, weight, count, length, etc
  standard_unit TEXT NOT NULL UNIQUE,          -- ml, g, pcs, etc
  conversions JSONB,                           -- {"ml": 1, "l": 1000, "dl": 100}
  display_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with common units
INSERT INTO normalization_units (unit_category, standard_unit, conversions, display_name) 
VALUES 
  ('volume', 'ml', '{"ml": 1, "l": 1000, "dl": 100, "cl": 10}'::jsonb, 'Milliliters'),
  ('weight', 'g', '{"g": 1, "kg": 1000, "mg": 0.001}'::jsonb, 'Grams'),
  ('count', 'pcs', '{"pcs": 1, "piece": 1, "unit": 1}'::jsonb, 'Pieces'),
  ('count', 'pack', '{"pack": 1, "box": 1}'::jsonb, 'Packs')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 11: REFINE EXISTING INDEXES FOR IMPORT PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_sku_lower ON products(LOWER(sku));
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity) WHERE quantity > 0;

-- ============================================================================
-- SECTION 12: ENABLE RLS ON NEW TABLES (Staging & History)
-- ============================================================================

ALTER TABLE product_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_deduplications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE normalization_units ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 13: SAFETY - VERIFY NO DATA LOSS
-- ============================================================================

-- Verify that existing products are untouched
-- This query should return 0 if all products still have their prices
SELECT COUNT(*) as products_with_null_selling_price 
FROM products 
WHERE selling_price IS NULL AND status = 'active' AND created_at < NOW() - INTERVAL '1 hour';

-- Verify that existing inventory is untouched
SELECT COUNT(*) as inventory_records 
FROM inventory 
WHERE created_at < NOW() - INTERVAL '1 hour';

-- ============================================================================
-- SCHEMA MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Verify: SELECT * FROM information_schema.tables WHERE table_schema='public'
-- 3. Deploy application with new TypeScript types
-- 4. Begin Phase 3: Admin UI for import staging and approval
