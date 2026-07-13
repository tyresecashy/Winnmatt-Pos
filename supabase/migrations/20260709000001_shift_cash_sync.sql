-- Shift-Cash Sync
-- Links shifts to physical registers/drawers for end-to-end cash tracking

-- Add register_id and drawer_id to shifts (optional FK — a shift can exist without a physical register)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS register_id UUID REFERENCES registers(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS drawer_id UUID REFERENCES cash_drawers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_register ON shifts(register_id);
CREATE INDEX IF NOT EXISTS idx_shifts_drawer ON shifts(drawer_id);
