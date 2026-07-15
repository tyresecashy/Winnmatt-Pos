-- Sprint 11D — Product Recommendations Engine
-- Adds product_affinities + reorder_suggestions tables for cross-sell and smart reorder.
--
-- Tables:
--   product_affinities: Pre-computed lift/confidence/support for product pairs
--   reorder_suggestions: Per-product reorder recommendations with EOQ/ROP/safety stock
--
-- @see docs/16_PRODUCT_INTELLIGENCE.md (Section 9)
-- @see 20260715000004_product_scores.sql (Sprint 11B)
-- @see 20260715000005_product_forecasts.sql (Sprint 11C)

-- ─── 1. Product Affinities ──────────────────────────────────────────
-- Stores lift, confidence, and support for product pairs (A → B).
-- Pre-computed via batch job; read at POS checkout for cross-sell suggestions.

CREATE TABLE IF NOT EXISTS product_affinities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_a UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_b UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lift NUMERIC NOT NULL CHECK (lift >= 0),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  support NUMERIC NOT NULL CHECK (support >= 0 AND support <= 1),
  occurrences INT NOT NULL CHECK (occurrences >= 0),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure each pair is unique (order-independent enforced by application)
  UNIQUE(product_a, product_b, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_affinities_product_a
  ON product_affinities (product_a);

CREATE INDEX IF NOT EXISTS idx_affinities_product_b
  ON product_affinities (product_b);

CREATE INDEX IF NOT EXISTS idx_affinities_lift
  ON product_affinities (lift DESC);

CREATE INDEX IF NOT EXISTS idx_affinities_branch
  ON product_affinities (branch_id);

-- ─── 2. Reorder Suggestions ────────────────────────────────────────
-- Per-product reorder recommendations with EOQ, ROP, safety stock, urgency.

CREATE TABLE IF NOT EXISTS reorder_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  forecast_daily_demand NUMERIC NOT NULL DEFAULT 0,
  demand_stddev NUMERIC NOT NULL DEFAULT 0,
  lead_time_days INT NOT NULL DEFAULT 7,
  service_level NUMERIC NOT NULL DEFAULT 0.95,
  safety_stock NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  economic_order_qty NUMERIC NOT NULL DEFAULT 0,
  suggested_order_qty NUMERIC NOT NULL DEFAULT 0,
  days_until_stockout NUMERIC,
  urgency TEXT NOT NULL CHECK (urgency IN ('immediate', 'soon', 'normal', 'sufficient')),
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  preferred_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_reorder_urgency
  ON reorder_suggestions (urgency);

CREATE INDEX IF NOT EXISTS idx_reorder_product
  ON reorder_suggestions (product_id);

CREATE INDEX IF NOT EXISTS idx_reorder_branch
  ON reorder_suggestions (branch_id);

-- ─── 3. RLS Policies ──────────────────────────────────────────────

ALTER TABLE product_affinities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_suggestions ENABLE ROW LEVEL SECURITY;

-- Service role: full management
CREATE POLICY "service_role can manage affinities"
  ON product_affinities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role can manage reorder_suggestions"
  ON reorder_suggestions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: read-only
CREATE POLICY "authenticated can view affinities"
  ON product_affinities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated can view reorder_suggestions"
  ON reorder_suggestions
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── 4. Grants ────────────────────────────────────────────────────

GRANT ALL ON product_affinities TO service_role;
GRANT ALL ON reorder_suggestions TO service_role;
GRANT SELECT ON product_affinities TO authenticated;
GRANT SELECT ON reorder_suggestions TO authenticated;
