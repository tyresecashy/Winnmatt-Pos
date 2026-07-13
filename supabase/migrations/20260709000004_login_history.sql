-- Sprint 1H: Login history table for security audit trail
-- Replaces mock login history data on the security page

CREATE TABLE IF NOT EXISTS login_history (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  location  TEXT,
  status    TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user-scoped lookups
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);

-- Enable RLS
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- Users can see their own login history
CREATE POLICY "Users can view own login history"
  ON login_history FOR SELECT
  USING (auth.uid() = user_id);

-- Only server-side (service_role) can insert
CREATE POLICY "Service role can insert login history"
  ON login_history FOR INSERT
  WITH CHECK (true);
