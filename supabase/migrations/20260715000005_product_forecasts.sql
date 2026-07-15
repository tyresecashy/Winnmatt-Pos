-- Sprint 11C: Product Intelligence forecasting tables
-- Stores pre-computed forecasts for product demand, revenue, and seasonality patterns.
-- @see docs/16_PRODUCT_INTELLIGENCE.md (Section 6.2)

-- ─── Product Forecasts ─────────────────────────────────────────────
-- Per-product demand forecasts with method, accuracy, confidence intervals.
CREATE TABLE IF NOT EXISTS product_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  branch_id TEXT,
  period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month')),
  forecast_values JSONB NOT NULL,
  confidence_interval JSONB NOT NULL,
  method TEXT NOT NULL CHECK (method IN (
    'simple_moving_average',
    'weighted_moving_average',
    'exponential_smoothing',
    'linear_regression',
    'seasonal_decomposition',
    'holt_winters'
  )),
  accuracy JSONB,
  seasonality JSONB,
  prediction_horizon INT NOT NULL DEFAULT 7,
  data_points INT NOT NULL DEFAULT 0,
  last_sale_date TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(product_id, branch_id, method)
);

CREATE INDEX IF NOT EXISTS idx_product_forecasts_product ON product_forecasts(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_product_forecasts_expires ON product_forecasts(expires_at);
CREATE INDEX IF NOT EXISTS idx_product_forecasts_method ON product_forecasts(method);
CREATE INDEX IF NOT EXISTS idx_product_forecasts_computed ON product_forecasts(computed_at DESC);

ALTER TABLE product_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role all product_forecasts"
  ON product_forecasts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read product_forecasts"
  ON product_forecasts
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── Revenue Forecasts ─────────────────────────────────────────────
-- Branch-level revenue forecasts.
CREATE TABLE IF NOT EXISTS revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT,
  period TEXT NOT NULL CHECK (period IN ('day', 'week', 'month')),
  forecast_values JSONB NOT NULL,
  confidence_interval JSONB NOT NULL,
  method TEXT NOT NULL CHECK (method IN (
    'simple_moving_average',
    'weighted_moving_average',
    'exponential_smoothing',
    'linear_regression',
    'seasonal_decomposition',
    'holt_winters'
  )),
  accuracy JSONB,
  seasonality JSONB,
  projected_total NUMERIC NOT NULL DEFAULT 0,
  current_period_total NUMERIC NOT NULL DEFAULT 0,
  growth_rate NUMERIC,
  prediction_horizon INT NOT NULL DEFAULT 30,
  data_points INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(branch_id, method)
);

CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_branch ON revenue_forecasts(branch_id);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_expires ON revenue_forecasts(expires_at);
CREATE INDEX IF NOT EXISTS idx_revenue_forecasts_computed ON revenue_forecasts(computed_at DESC);

ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role all revenue_forecasts"
  ON revenue_forecasts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read revenue_forecasts"
  ON revenue_forecasts
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── Seasonality Patterns ──────────────────────────────────────────
-- Detected seasonal patterns per product.
CREATE TABLE IF NOT EXISTS seasonality_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  branch_id TEXT,
  pattern TEXT NOT NULL CHECK (pattern IN ('daily', 'weekly', 'monthly', 'quarterly', 'none')),
  factors JSONB NOT NULL,
  strength REAL NOT NULL DEFAULT 0 CHECK (strength >= 0 AND strength <= 1),
  period INT NOT NULL DEFAULT 7,
  confidence REAL NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_seasonality_patterns_product ON seasonality_patterns(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_seasonality_patterns_strength ON seasonality_patterns(strength DESC);

ALTER TABLE seasonality_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role all seasonality_patterns"
  ON seasonality_patterns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read seasonality_patterns"
  ON seasonality_patterns
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── Forecast Accuracy Log ─────────────────────────────────────────
-- Tracks accuracy of historical forecasts for method comparison.
CREATE TABLE IF NOT EXISTS forecast_accuracy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT,
  branch_id TEXT,
  method TEXT NOT NULL CHECK (method IN (
    'simple_moving_average',
    'weighted_moving_average',
    'exponential_smoothing',
    'linear_regression',
    'seasonal_decomposition',
    'holt_winters'
  )),
  mape REAL NOT NULL,
  mase REAL,
  actual_values JSONB NOT NULL,
  predicted_values JSONB NOT NULL,
  data_points INT NOT NULL DEFAULT 0,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_product ON forecast_accuracy_log(product_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_method ON forecast_accuracy_log(method);

ALTER TABLE forecast_accuracy_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role all forecast_accuracy_log"
  ON forecast_accuracy_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated read forecast_accuracy_log"
  ON forecast_accuracy_log
  FOR SELECT
  TO authenticated
  USING (true);
