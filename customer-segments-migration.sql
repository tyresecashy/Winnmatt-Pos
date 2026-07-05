-- WINNMATT Retail OS: Customer Segments Migration
-- Run this in Supabase SQL Editor
-- Adds segment definitions and customer membership tables

BEGIN;

-- ============================================================================
-- Step 1: Customer segments definition table
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 2: Many-to-many join: customers ↔ segments
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_segment_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(customer_id, segment_id)
);

-- ============================================================================
-- Step 3: Indexes for fast lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_csm_customer ON customer_segment_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_csm_segment ON customer_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_slug ON customer_segments(slug);

-- ============================================================================
-- Step 4: updated_at trigger for customer_segments
-- ============================================================================
CREATE OR REPLACE FUNCTION update_customer_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_segments_updated_at_trigger ON customer_segments;
CREATE TRIGGER customer_segments_updated_at_trigger
  BEFORE UPDATE ON customer_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_segments_updated_at();

-- ============================================================================
-- Step 5: Seed default segments
-- ============================================================================
INSERT INTO customer_segments (name, slug, description, color) VALUES
  ('VIP', 'vip', 'High-value customers with premium status', '#8B5CF6'),
  ('Wholesale', 'wholesale', 'Wholesale / bulk-buying customers', '#F59E0B'),
  ('Loyal', 'loyal', 'Frequent repeat customers', '#10B981'),
  ('New', 'new', 'First-time or recently acquired customers', '#3B82F6'),
  ('At Risk', 'at-risk', 'Haven''t purchased in a while — re-engage', '#EF4444'),
  ('Staff', 'staff', 'Company staff / employee accounts', '#EC4899')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
