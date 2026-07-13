CREATE TABLE IF NOT EXISTS warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone TEXT NOT NULL DEFAULT 'default',
  aisle TEXT,
  "row" TEXT,
  shelf TEXT,
  bin TEXT,
  barcode TEXT UNIQUE,
  capacity INTEGER DEFAULT 0,
  is_pickable BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'full', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_warehouse_locations_warehouse ON warehouse_locations(warehouse_id);
CREATE INDEX idx_warehouse_locations_zone ON warehouse_locations(zone);
CREATE INDEX idx_warehouse_locations_barcode ON warehouse_locations(barcode) WHERE barcode IS NOT NULL;

ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read warehouse_locations"
  ON warehouse_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Inventory controllers can manage warehouse_locations"
  ON warehouse_locations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'manager')
      AND users.status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION update_warehouse_location_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_warehouse_location_updated_at
  BEFORE UPDATE ON warehouse_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_location_updated_at();
