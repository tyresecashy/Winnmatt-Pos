-- Sprint 11A: Product forecasts table
-- Stores pre-computed demand and revenue forecasts.
-- @see docs/16_PRODUCT_INTELLIGENCE.md (Section 6.4)

CREATE TABLE IF NOT EXISTS product_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  branch_id UUID REFERENCES branches(id),
  forecast_period TSTZRANGE NOT NULL,
  method TEXT NOT NULL CHECK (method IN (
    'simple_moving_average',
    'weighted_moving_average',
    'exponential_smoothing',
    'linear_regression',
    'seasonal_decomposition',
    'holt_winters'
  )),
  values NUMERIC[] NOT NULL,
  confidence_upper NUMERIC[],
  confidence_lower NUMERIC[],
  mape NUMERIC,
  mase NUMERIC,
  seasonality_pattern TEXT CHECK (seasonality_pattern IN ('daily', 'weekly', 'monthly', 'quarterly', 'none')),
  seasonality_factors NUMERIC[],
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Product-scoped lookup
CREATE INDEX IF NOT EXISTS idx_product_forecasts_product
  ON product_forecasts (product_id, branch_id, computed_at DESC);

-- Stale forecast detection
CREATE INDEX IF NOT EXISTS idx_product_forecasts_expires
  ON product_forecasts (expires_at)
  WHERE expires_at < now();

-- RLS
ALTER TABLE product_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can manage product_forecasts"
  ON product_forecasts
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated can view product_forecasts"
  ON product_forecasts
  FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT ALL ON product_forecasts TO service_role;
GRANT SELECT ON product_forecasts TO authenticated;
