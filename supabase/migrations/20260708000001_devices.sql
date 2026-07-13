-- Devices & Register Management
-- Tracks every POS terminal/tablet/device across all branches

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('pos_terminal', 'tablet', 'mobile', 'kiosk', 'other')),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  register_id UUID,
  app_version TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'idle')),
  last_seen_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_branch ON devices(branch_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY devices_select ON devices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY devices_insert ON devices FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY devices_update ON devices FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'manager'))
  );

-- Add register_id FK after creation (self-reference to devices)
ALTER TABLE devices ADD CONSTRAINT fk_device_register
  FOREIGN KEY (register_id) REFERENCES devices(id) ON DELETE SET NULL;
