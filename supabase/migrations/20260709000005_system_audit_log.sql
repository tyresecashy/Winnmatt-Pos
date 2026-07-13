-- Sprint 2: Managed migration for system_audit_log table
-- Already exists in live DB from inline scripts; ensure it's in managed migrations.

CREATE TABLE IF NOT EXISTS system_audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  branch_id   UUID REFERENCES branches(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  ip_address  TEXT,
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_log_created_at ON system_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_severity   ON system_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_entity     ON system_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_log_user       ON system_audit_log(user_id);

ALTER TABLE system_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins and super_admins can view the audit log
CREATE POLICY "Admins can read audit log"
  ON system_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  );

-- Server-side (service_role) can insert
CREATE POLICY "Service role can insert audit log"
  ON system_audit_log FOR INSERT
  WITH CHECK (true);
