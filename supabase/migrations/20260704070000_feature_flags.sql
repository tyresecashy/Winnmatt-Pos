-- ============================================================
-- Feature Flags System
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,            -- 'pos.offline_mode', 'finance.advanced_reporting'
  name TEXT NOT NULL,                   -- Display name
  description TEXT,                     -- What this flag controls
  enabled BOOLEAN DEFAULT false,        -- Master toggle
  rollout_percentage INT DEFAULT 100,   -- 0-100 for gradual rollout
  target_branches UUID[],               -- NULL = all branches
  target_roles TEXT[],                  -- NULL = all roles (admin, manager, cashier, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_select_auth" ON feature_flags
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "feature_flags_insert_admin" ON feature_flags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "feature_flags_update_admin" ON feature_flags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "feature_flags_delete_admin" ON feature_flags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Index for fast lookups by key
CREATE INDEX idx_feature_flags_key ON feature_flags(key);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- Seed some default feature flags
INSERT INTO feature_flags (key, name, description, enabled) VALUES
  ('pos.offline_mode', 'Offline Mode', 'Enable POS to work without internet connection', false),
  ('pos.receipt_printing', 'Receipt Printing', 'Enable automatic receipt printing', true),
  ('inventory.low_stock_alerts', 'Low Stock Alerts', 'Send notifications when stock is low', true),
  ('inventory.batch_tracking', 'Batch Tracking', 'Track products by batch number', false),
  ('finance.advanced_reporting', 'Advanced Reporting', 'Enable advanced financial reports', false),
  ('finance.multi_currency', 'Multi-Currency', 'Enable multi-currency support', false),
  ('customers.loyalty_program', 'Loyalty Program', 'Enable customer loyalty points system', true),
  ('workforce.biometric_attendance', 'Biometric Attendance', 'Enable biometric clock-in/out', false),
  ('notifications.sms_alerts', 'SMS Alerts', 'Enable SMS notifications', false),
  ('notifications.email_alerts', 'Email Alerts', 'Enable email notifications', false),
  ('automation.scheduler', 'Automation Scheduler', 'Enable scheduled automation tasks', true),
  ('integrations.mpesa', 'M-Pesa Integration', 'Enable M-Pesa payment processing', true),
  ('integrations.quickbooks', 'QuickBooks Sync', 'Enable QuickBooks accounting sync', false),
  ('integrations.kra_etims', 'KRA eTIMS', 'Enable KRA eTIMS compliance integration', false)
ON CONFLICT (key) DO NOTHING;
