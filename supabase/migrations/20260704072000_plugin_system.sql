-- ============================================================
-- Plugin System
-- ============================================================

-- Installed plugins
CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT UNIQUE NOT NULL,      -- '@winnmatt/plugin-mpesa'
  name TEXT NOT NULL,                   -- 'M-Pesa Integration'
  description TEXT,
  version TEXT NOT NULL,                -- '1.0.0'
  author TEXT,                          -- 'WinnMatt'
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'uninstalled')),
  config JSONB DEFAULT '{}',
  installed_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  uninstalled_at TIMESTAMPTZ
);

-- Plugin configurations (key-value store per plugin)
CREATE TABLE IF NOT EXISTS plugin_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT NOT NULL REFERENCES plugins(plugin_id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plugin_id, key)
);

-- Plugin logs
CREATE TABLE IF NOT EXISTS plugin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT NOT NULL REFERENCES plugins(plugin_id) ON DELETE CASCADE,
  level TEXT DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plugin hooks (what events/actions a plugin handles)
CREATE TABLE IF NOT EXISTS plugin_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT NOT NULL REFERENCES plugins(plugin_id) ON DELETE CASCADE,
  hook_type TEXT NOT NULL CHECK (hook_type IN ('event', 'action', 'route', 'ui')),
  hook_key TEXT NOT NULL,               -- 'sale.completed', 'dashboard.widget', etc.
  handler_name TEXT NOT NULL,           -- Function name in plugin
  priority INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plugin_id, hook_type, hook_key)
);

-- RLS policies
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plugins_select_auth" ON plugins
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "plugins_insert_admin" ON plugins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugins_update_admin" ON plugins
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugins_delete_admin" ON plugins
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugin_configs_select_auth" ON plugin_configs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "plugin_configs_insert_admin" ON plugin_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugin_configs_update_admin" ON plugin_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugin_configs_delete_admin" ON plugin_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugin_logs_select_auth" ON plugin_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "plugin_logs_insert_auth" ON plugin_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "plugin_hooks_select_auth" ON plugin_hooks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "plugin_hooks_insert_admin" ON plugin_hooks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugin_hooks_update_admin" ON plugin_hooks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "plugin_hooks_delete_admin" ON plugin_hooks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Indexes
CREATE INDEX idx_plugins_plugin_id ON plugins(plugin_id);
CREATE INDEX idx_plugin_configs_plugin_id ON plugin_configs(plugin_id);
CREATE INDEX idx_plugin_logs_plugin_id ON plugin_logs(plugin_id);
CREATE INDEX idx_plugin_hooks_plugin_id ON plugin_hooks(plugin_id);
CREATE INDEX idx_plugin_hooks_hook_type_key ON plugin_hooks(hook_type, hook_key);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_plugins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_plugins_updated_at
  BEFORE UPDATE ON plugins
  FOR EACH ROW
  EXECUTE FUNCTION update_plugins_updated_at();

CREATE OR REPLACE FUNCTION update_plugin_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_plugin_configs_updated_at
  BEFORE UPDATE ON plugin_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_plugin_configs_updated_at();

-- Log cleanup function (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_plugin_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM plugin_logs
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
