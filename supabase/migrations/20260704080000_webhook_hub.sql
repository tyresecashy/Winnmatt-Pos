-- ============================================================
-- Webhook / Integration Hub
-- ============================================================

-- Webhook endpoints (where to send webhooks)
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                   -- 'QuickBooks Sync', 'Inventory Alert'
  url TEXT NOT NULL,                    -- 'https://api.example.com/webhook'
  secret TEXT,                          -- For HMAC signature verification
  events TEXT[] NOT NULL,               -- ['sale.completed', 'stock.low']
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  description TEXT,
  headers JSONB DEFAULT '{}',           -- Custom headers to send
  retry_count INT DEFAULT 3,            -- Max retries on failure
  timeout_ms INT DEFAULT 5000,          -- Request timeout
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_triggered_at TIMESTAMPTZ,
  error_message TEXT
);

-- Webhook deliveries (log of each attempt)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL,                   -- 'sale.completed'
  payload JSONB NOT NULL,               -- Event data
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempt INT DEFAULT 1,
  max_attempts INT DEFAULT 3,
  request_url TEXT,
  request_headers JSONB,
  request_body TEXT,
  response_status INT,
  response_headers JSONB,
  response_body TEXT,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Integration configs (stored credentials/settings)
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id TEXT UNIQUE NOT NULL,  -- 'mpesa', 'quickbooks', 'twilio'
  name TEXT NOT NULL,                   -- 'M-Pesa API'
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN ('payment', 'accounting', 'sms', 'email', 'shipping', 'general')),
  config JSONB DEFAULT '{}',            -- Encrypted config values
  credentials JSONB DEFAULT '{}',       -- Encrypted credentials
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Integration logs
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id TEXT NOT NULL REFERENCES integration_configs(integration_id) ON DELETE CASCADE,
  level TEXT DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warn', 'error')),
  action TEXT NOT NULL,                  -- 'sync_products', 'process_payment'
  message TEXT NOT NULL,
  metadata JSONB,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Webhook endpoints policies
CREATE POLICY "webhook_endpoints_select_auth" ON webhook_endpoints
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "webhook_endpoints_insert_admin" ON webhook_endpoints
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "webhook_endpoints_update_admin" ON webhook_endpoints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "webhook_endpoints_delete_admin" ON webhook_endpoints
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Webhook deliveries policies
CREATE POLICY "webhook_deliveries_select_auth" ON webhook_deliveries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "webhook_deliveries_insert_auth" ON webhook_deliveries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "webhook_deliveries_update_auth" ON webhook_deliveries
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Integration configs policies
CREATE POLICY "integration_configs_select_auth" ON integration_configs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "integration_configs_insert_admin" ON integration_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "integration_configs_update_admin" ON integration_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "integration_configs_delete_admin" ON integration_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Integration logs policies
CREATE POLICY "integration_logs_select_auth" ON integration_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "integration_logs_insert_auth" ON integration_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_webhook_endpoints_status ON webhook_endpoints(status);
CREATE INDEX idx_webhook_endpoints_events ON webhook_endpoints USING gin(events);
CREATE INDEX idx_webhook_deliveries_endpoint_id ON webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
CREATE INDEX idx_integration_configs_status ON integration_configs(status);
CREATE INDEX idx_integration_logs_integration_id ON integration_logs(integration_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_webhook_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_endpoints_updated_at();

CREATE OR REPLACE FUNCTION update_integration_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_integration_configs_updated_at
  BEFORE UPDATE ON integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_configs_updated_at();

-- Cleanup function (keep 30 days of deliveries)
CREATE OR REPLACE FUNCTION cleanup_webhook_deliveries()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_deliveries
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for integration logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_integration_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM integration_logs
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
