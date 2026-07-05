-- ============================================================
-- White-label / Multi-tenant Support
-- ============================================================

-- Tenant configuration (per-organization branding)
CREATE TABLE IF NOT EXISTS tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT UNIQUE NOT NULL,      -- 'winnmatt', 'naivas', 'carrefour'
  name TEXT NOT NULL,                   -- Display name
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  accent_color TEXT DEFAULT '#f59e0b',
  background_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT 'Inter',
  custom_css TEXT,
  login_background_url TEXT,
  email_template_id UUID,
  receipt_template TEXT,
  footer_text TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  social_links JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',          -- Feature toggles per tenant
  limits JSONB DEFAULT '{}',            -- Usage limits
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tenant themes (pre-built themes)
CREATE TABLE IF NOT EXISTS tenant_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,           -- 'Modern Blue', 'Forest Green'
  description TEXT,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  background_color TEXT NOT NULL,
  card_background TEXT NOT NULL,
  text_color TEXT NOT NULL,
  border_color TEXT NOT NULL,
  font_family TEXT DEFAULT 'Inter',
  is_default BOOLEAN DEFAULT false,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tenant branding assets
CREATE TABLE IF NOT EXISTS tenant_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenant_configs(tenant_id),
  asset_type TEXT NOT NULL CHECK (asset_type IN (
    'logo', 'favicon', 'banner', 'email_header', 'email_footer',
    'receipt_header', 'receipt_footer', 'watermark', 'icon'
  )),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  width INT,
  height INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Custom domains (for white-label deployments)
CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenant_configs(tenant_id),
  domain TEXT UNIQUE NOT NULL,         -- 'pos.winnmatt.com'
  is_primary BOOLEAN DEFAULT false,
  ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;

-- Tenant configs policies (admin only)
CREATE POLICY "tenant_configs_select_auth" ON tenant_configs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tenant_configs_insert_super_admin" ON tenant_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "tenant_configs_update_super_admin" ON tenant_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Tenant themes policies
CREATE POLICY "tenant_themes_select_auth" ON tenant_themes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tenant_themes_insert_super_admin" ON tenant_themes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Tenant assets policies
CREATE POLICY "tenant_assets_select_auth" ON tenant_assets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tenant_assets_insert_admin" ON tenant_assets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "tenant_assets_delete_admin" ON tenant_assets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Tenant domains policies
CREATE POLICY "tenant_domains_select_auth" ON tenant_domains
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tenant_domains_insert_super_admin" ON tenant_domains
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Indexes
CREATE INDEX idx_tenant_configs_tenant_id ON tenant_configs(tenant_id);
CREATE INDEX idx_tenant_assets_tenant_id ON tenant_assets(tenant_id);
CREATE INDEX idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);
CREATE INDEX idx_tenant_domains_domain ON tenant_domains(domain);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_tenant_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenant_configs_updated_at
  BEFORE UPDATE ON tenant_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_configs_updated_at();

-- ============================================================
-- Seed Data: Default Themes
-- ============================================================

INSERT INTO tenant_themes (name, description, primary_color, secondary_color, accent_color, background_color, card_background, text_color, border_color, font_family, is_default) VALUES
  ('Modern Blue', 'Clean blue theme for retail', '#3b82f6', '#1e40af', '#f59e0b', '#f8fafc', '#ffffff', '#0f172a', '#e2e8f0', 'Inter', true),
  ('Forest Green', 'Natural green theme', '#10b981', '#047857', '#f59e0b', '#f0fdf4', '#ffffff', '#064e3b', '#d1fae5', 'Inter', false),
  ('Royal Purple', 'Elegant purple theme', '#8b5cf6', '#6d28d9', '#f59e0b', '#faf5ff', '#ffffff', '#3b0764', '#e9d5ff', 'Inter', false),
  ('Sunset Orange', 'Warm orange theme', '#f97316', '#ea580c', '#3b82f6', '#fff7ed', '#ffffff', '#7c2d12', '#fed7aa', 'Inter', false),
  ('Midnight Dark', 'Dark mode theme', '#3b82f6', '#1e40af', '#f59e0b', '#0f172a', '#1e293b', '#f8fafc', '#334155', 'Inter', false),
  ('Retail Red', 'Bold red for supermarkets', '#ef4444', '#dc2626', '#3b82f6', '#fef2f2', '#ffffff', '#7f1d1d', '#fecaca', 'Inter', false),
  ('Ocean Teal', 'Professional teal theme', '#14b8a6', '#0d9488', '#f59e0b', '#f0fdfa', '#ffffff', '#134e4a', '#99f6e4', 'Inter', false),
  ('Minimal Gray', 'Clean minimal theme', '#6b7280', '#4b5563', '#3b82f6', '#f9fafb', '#ffffff', '#111827', '#e5e7eb', 'Inter', false);

-- ============================================================
-- Seed Data: Default Tenant
-- ============================================================

INSERT INTO tenant_configs (tenant_id, name, primary_color, secondary_color, accent_color, contact_email, website_url) VALUES
  ('winnmatt', 'WinnMatt Supermarket', '#3b82f6', '#1e40af', '#f59e0b', 'info@winnmatt.com', 'https://winnmatt.com');

-- ============================================================
-- Functions for White-label
-- ============================================================

-- Function to get tenant config by domain
CREATE OR REPLACE FUNCTION get_tenant_by_domain(p_domain TEXT)
RETURNS TABLE (
  tenant_id TEXT,
  name TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  background_color TEXT,
  font_family TEXT,
  custom_css TEXT,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.tenant_id,
    tc.name,
    tc.logo_url,
    tc.primary_color,
    tc.secondary_color,
    tc.accent_color,
    tc.background_color,
    tc.font_family,
    tc.custom_css,
    tc.features
  FROM tenant_configs tc
  LEFT JOIN tenant_domains td ON tc.tenant_id = td.tenant_id
  WHERE td.domain = p_domain OR (td.is_primary = true AND tc.tenant_id = 'winnmatt')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tenant branding
CREATE OR REPLACE FUNCTION get_tenant_branding(p_tenant_id TEXT DEFAULT 'winnmatt')
RETURNS TABLE (
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  background_color TEXT,
  font_family TEXT,
  custom_css TEXT,
  receipt_template TEXT,
  footer_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.logo_url,
    tc.primary_color,
    tc.secondary_color,
    tc.accent_color,
    tc.background_color,
    tc.font_family,
    tc.custom_css,
    tc.receipt_template,
    tc.footer_text
  FROM tenant_configs tc
  WHERE tc.tenant_id = p_tenant_id AND tc.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
