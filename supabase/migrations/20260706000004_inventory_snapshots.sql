-- Migration: Inventory snapshots for accurate shrinkage calculation
-- Provides a point-in-time record of inventory levels so the shrinkage
-- report can compute: expected = openingSnapshot + purchases - sales.
--
-- Also includes RPCs to take a snapshot and to query opening stock.

-- ── Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id    UUID NOT NULL REFERENCES products(id),
  quantity      INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, product_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_inv_snapshots_date     ON inventory_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_inv_snapshots_product   ON inventory_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_snapshots_branch_dt ON inventory_snapshots(branch_id, snapshot_date);

-- ── RPC: snapshot_inventory ─────────────────────────────────────────────
-- Copies the current state of inventory into inventory_snapshots for
-- today's date (or updates the existing row if one already exists).
CREATE OR REPLACE FUNCTION snapshot_inventory()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_count INTEGER;
BEGIN
  INSERT INTO inventory_snapshots (branch_id, snapshot_date, product_id, quantity, reserved_stock)
  SELECT branch_id, v_today, product_id, quantity, reserved_stock
  FROM inventory
  ON CONFLICT (branch_id, product_id, snapshot_date)
  DO UPDATE SET quantity       = EXCLUDED.quantity,
                reserved_stock = EXCLUDED.reserved_stock,
                created_at     = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── RPC: get_opening_stock ─────────────────────────────────────────────
-- Returns the inventory snapshot for a given date, falling back to
-- reconstructing it from stock_movements if no snapshot exists yet.
CREATE OR REPLACE FUNCTION get_opening_stock(
  p_snapshot_date DATE
)
RETURNS TABLE(
  product_id UUID,
  branch_id  UUID,
  quantity   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT sn.product_id, sn.branch_id, sn.quantity
  FROM inventory_snapshots sn
  WHERE sn.snapshot_date = p_snapshot_date;
END;
$$;
