-- Sprint 11B: Product Intelligence scoring tables
-- Stores pre-computed scores for products, customers, suppliers, and business health.
-- @see docs/16_PRODUCT_INTELLIGENCE.md (Section 7)

-- ─── Product Intelligence Scores ──────────────────────────────────
-- Per-product performance scores with velocity, margin, stability, seasonality components.
CREATE TABLE IF NOT EXISTS product_intelligence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  product_category TEXT NOT NULL DEFAULT '',
  velocity_score NUMERIC NOT NULL CHECK (velocity_score >= 0 AND velocity_score <= 100),
  margin_score NUMERIC NOT NULL CHECK (margin_score >= 0 AND margin_score <= 100),
  stability_score NUMERIC NOT NULL CHECK (stability_score >= 0 AND stability_score <= 100),
  seasonality_score NUMERIC NOT NULL CHECK (seasonality_score >= 0 AND seasonality_score <= 100),
  composite_score NUMERIC NOT NULL CHECK (composite_score >= 0 AND composite_score <= 100),
  score_category TEXT NOT NULL CHECK (score_category IN ('star', 'cash_cow', 'question_mark', 'dog', 'dead')),
  rank INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_scores_composite
  ON product_intelligence_scores (composite_score DESC);

CREATE INDEX IF NOT EXISTS idx_product_scores_category
  ON product_intelligence_scores (score_category);

CREATE INDEX IF NOT EXISTS idx_product_scores_category_rank
  ON product_intelligence_scores (product_category, rank);

-- ─── Customer Intelligence Scores ─────────────────────────────────
-- Per-customer value scores with RFM + loyalty components.
CREATE TABLE IF NOT EXISTS customer_intelligence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  recency_score NUMERIC NOT NULL CHECK (recency_score >= 0 AND recency_score <= 100),
  frequency_score NUMERIC NOT NULL CHECK (frequency_score >= 0 AND frequency_score <= 100),
  monetary_score NUMERIC NOT NULL CHECK (monetary_score >= 0 AND monetary_score <= 100),
  loyalty_score NUMERIC NOT NULL CHECK (loyalty_score >= 0 AND loyalty_score <= 100),
  composite_score NUMERIC NOT NULL CHECK (composite_score >= 0 AND composite_score <= 100),
  segment TEXT NOT NULL CHECK (segment IN ('champions', 'loyal', 'new', 'at_risk', 'lost', 'promising', 'need_attention')),
  churn_risk NUMERIC NOT NULL CHECK (churn_risk >= 0 AND churn_risk <= 1),
  lifetime_value NUMERIC NOT NULL DEFAULT 0,
  rank INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_scores_composite
  ON customer_intelligence_scores (composite_score DESC);

CREATE INDEX IF NOT EXISTS idx_customer_scores_segment
  ON customer_intelligence_scores (segment);

CREATE INDEX IF NOT EXISTS idx_customer_scores_churn_risk
  ON customer_intelligence_scores (churn_risk DESC);

-- ─── Supplier Intelligence Scores ─────────────────────────────────
-- Per-supplier performance scores with quality, reliability, price, lead-time components.
CREATE TABLE IF NOT EXISTS supplier_intelligence_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  quality_score NUMERIC NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  reliability_score NUMERIC NOT NULL CHECK (reliability_score >= 0 AND reliability_score <= 100),
  price_score NUMERIC NOT NULL CHECK (price_score >= 0 AND price_score <= 100),
  lead_time_score NUMERIC NOT NULL CHECK (lead_time_score >= 0 AND lead_time_score <= 100),
  composite_score NUMERIC NOT NULL CHECK (composite_score >= 0 AND composite_score <= 100),
  rank INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_scores_composite
  ON supplier_intelligence_scores (composite_score DESC);

-- ─── Business Health Scores ───────────────────────────────────────
-- Composite business health snapshot with 6 dimensions + trend.
CREATE TABLE IF NOT EXISTS business_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  revenue_health NUMERIC NOT NULL CHECK (revenue_health >= 0 AND revenue_health <= 100),
  margin_health NUMERIC NOT NULL CHECK (margin_health >= 0 AND margin_health <= 100),
  inventory_health NUMERIC NOT NULL CHECK (inventory_health >= 0 AND inventory_health <= 100),
  customer_health NUMERIC NOT NULL CHECK (customer_health >= 0 AND customer_health <= 100),
  cash_health NUMERIC NOT NULL CHECK (cash_health >= 0 AND cash_health <= 100),
  workforce_health NUMERIC NOT NULL CHECK (workforce_health >= 0 AND workforce_health <= 100),
  composite_score NUMERIC NOT NULL CHECK (composite_score >= 0 AND composite_score <= 100),
  trend TEXT NOT NULL CHECK (trend IN ('improving', 'stable', 'declining')),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_health_branch
  ON business_health_scores (branch_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_health_composite
  ON business_health_scores (composite_score DESC);

-- RLS for all four tables
ALTER TABLE product_intelligence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_intelligence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_intelligence_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can manage product_intelligence_scores"
  ON product_intelligence_scores USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can view product_intelligence_scores"
  ON product_intelligence_scores FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_role can manage customer_intelligence_scores"
  ON customer_intelligence_scores USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can view customer_intelligence_scores"
  ON customer_intelligence_scores FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_role can manage supplier_intelligence_scores"
  ON supplier_intelligence_scores USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can view supplier_intelligence_scores"
  ON supplier_intelligence_scores FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_role can manage business_health_scores"
  ON business_health_scores USING (true) WITH CHECK (true);
CREATE POLICY "authenticated can view business_health_scores"
  ON business_health_scores FOR SELECT USING (auth.role() = 'authenticated');

GRANT ALL ON product_intelligence_scores TO service_role;
GRANT SELECT ON product_intelligence_scores TO authenticated;

GRANT ALL ON customer_intelligence_scores TO service_role;
GRANT SELECT ON customer_intelligence_scores TO authenticated;

GRANT ALL ON supplier_intelligence_scores TO service_role;
GRANT SELECT ON supplier_intelligence_scores TO authenticated;

GRANT ALL ON business_health_scores TO service_role;
GRANT SELECT ON business_health_scores TO authenticated;
