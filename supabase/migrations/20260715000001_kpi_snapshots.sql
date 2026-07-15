-- Sprint 11A: KPI snapshots table
-- Stores computed KPI values with target comparison and status.
-- @see docs/16_PRODUCT_INTELLIGENCE.md (Section 5.2)

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id),
  value NUMERIC NOT NULL,
  target NUMERIC,
  status TEXT CHECK (status IN ('on_track', 'at_risk', 'behind', 'no_target')) NOT NULL DEFAULT 'no_target',
  metadata JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Branch-scoped lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_branch_kpi
  ON kpi_snapshots (branch_id, kpi_id, computed_at DESC);

-- Status-based filtering for dashboard widgets
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_status
  ON kpi_snapshots (status, computed_at DESC)
  WHERE status IN ('at_risk', 'behind');

-- Pruning queries
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_computed_at
  ON kpi_snapshots (computed_at);

-- RLS
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can manage kpi_snapshots"
  ON kpi_snapshots
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated can view kpi_snapshots"
  ON kpi_snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT ALL ON kpi_snapshots TO service_role;
GRANT SELECT ON kpi_snapshots TO authenticated;
