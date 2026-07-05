-- ============================================================================
-- Tax Configuration Module Migration
-- Tables: tax_rates, tax_groups, tax_group_items, category_tax_assignments
-- Safe for repeated execution (IF NOT EXISTS / IF EXISTS patterns)
-- ============================================================================

-- ── 1. Tax Rates ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  tax_type TEXT NOT NULL CHECK (tax_type IN ('vat', 'excise', 'service', 'other')) DEFAULT 'vat',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Kenya standard tax rates
INSERT INTO tax_rates (name, percentage, tax_type, description, is_default, is_active, effective_from)
SELECT * FROM (VALUES
  ('VAT 16%', 16.00, 'vat', 'Standard Value Added Tax', true, true, '2024-01-01'::DATE),
  ('VAT 8%', 8.00, 'vat', 'Reduced VAT rate (fuel, electricity)', false, true, '2024-01-01'::DATE),
  ('VAT 0%', 0.00, 'vat', 'Zero-rated supplies', false, true, '2024-01-01'::DATE),
  ('Exempt', 0.00, 'vat', 'VAT exempt supplies', false, true, '2024-01-01'::DATE),
  ('Excise Duty', 10.00, 'excise', 'Excise duty on specific goods', false, true, '2024-01-01'::DATE),
  ('Service Charge', 2.00, 'service', 'Service charge / catering levy', false, true, '2024-01-01'::DATE)
) AS v(name, percentage, tax_type, description, is_default, is_active, effective_from)
WHERE NOT EXISTS (SELECT 1 FROM tax_rates WHERE name = v.name);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_rates_active ON tax_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_tax_rates_type ON tax_rates(tax_type);
CREATE INDEX IF NOT EXISTS idx_tax_rates_default ON tax_rates(is_default) WHERE is_default = true;

-- ── 2. Tax Groups ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default tax groups
INSERT INTO tax_groups (name, description)
SELECT * FROM (VALUES
  ('Standard VAT (16%)', 'Standard 16% VAT rate'),
  ('Reduced VAT (8%)', 'Reduced VAT rate for fuel, electricity'),
  ('Zero-Rated', 'Zero-rated supplies'),
  ('VAT Exempt', 'VAT exempt items'),
  ('With Excise Duty', 'Goods subject to excise duty + standard VAT'),
  ('Mixed', 'Mixed tax treatment')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM tax_groups WHERE name = v.name);

CREATE INDEX IF NOT EXISTS idx_tax_groups_active ON tax_groups(is_active);

-- ── 3. Tax Group Items ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES tax_groups(id) ON DELETE CASCADE,
  rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE RESTRICT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, rate_id)
);

CREATE INDEX IF NOT EXISTS idx_tax_group_items_group ON tax_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_tax_group_items_rate ON tax_group_items(rate_id);

-- Seed group-to-rate mappings
INSERT INTO tax_group_items (group_id, rate_id, sort_order)
SELECT g.id, r.id, 1
FROM tax_groups g, tax_rates r
WHERE g.name = 'Standard VAT (16%)' AND r.name = 'VAT 16%'
  AND NOT EXISTS (SELECT 1 FROM tax_group_items tgi WHERE tgi.group_id = g.id AND tgi.rate_id = r.id);

INSERT INTO tax_group_items (group_id, rate_id, sort_order)
SELECT g.id, r.id, 1
FROM tax_groups g, tax_rates r
WHERE g.name = 'Reduced VAT (8%)' AND r.name = 'VAT 8%'
  AND NOT EXISTS (SELECT 1 FROM tax_group_items tgi WHERE tgi.group_id = g.id AND tgi.rate_id = r.id);

INSERT INTO tax_group_items (group_id, rate_id, sort_order)
SELECT g.id, r.id, 1
FROM tax_groups g, tax_rates r
WHERE g.name = 'Zero-Rated' AND r.name = 'VAT 0%'
  AND NOT EXISTS (SELECT 1 FROM tax_group_items tgi WHERE tgi.group_id = g.id AND tgi.rate_id = r.id);

INSERT INTO tax_group_items (group_id, rate_id, sort_order)
SELECT g.id, r.id, 1
FROM tax_groups g, tax_rates r
WHERE g.name = 'VAT Exempt' AND r.name = 'Exempt'
  AND NOT EXISTS (SELECT 1 FROM tax_group_items tgi WHERE tgi.group_id = g.id AND tgi.rate_id = r.id);

INSERT INTO tax_group_items (group_id, rate_id, sort_order)
SELECT g.id, r.id, 1
FROM tax_groups g, tax_rates r
WHERE g.name = 'With Excise Duty' AND r.name = 'VAT 16%'
  AND NOT EXISTS (SELECT 1 FROM tax_group_items tgi WHERE tgi.group_id = g.id AND tgi.rate_id = r.id);

INSERT INTO tax_group_items (group_id, rate_id, sort_order)
SELECT g.id, r.id, 2
FROM tax_groups g, tax_rates r
WHERE g.name = 'With Excise Duty' AND r.name = 'Excise Duty'
  AND NOT EXISTS (SELECT 1 FROM tax_group_items tgi WHERE tgi.group_id = g.id AND tgi.rate_id = r.id);

-- ── 4. Category Tax Assignments ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS category_tax_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  tax_group_id UUID NOT NULL REFERENCES tax_groups(id) ON DELETE RESTRICT,
  is_tax_inclusive BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, tax_group_id)
);

CREATE INDEX IF NOT EXISTS idx_cat_tax_category ON category_tax_assignments(category_id);
CREATE INDEX IF NOT EXISTS idx_cat_tax_group ON category_tax_assignments(tax_group_id);

-- ── 5. Helper Views ─────────────────────────────────────────────────────────

-- Resolved tax info per category
CREATE OR REPLACE VIEW category_tax_view AS
SELECT
  cta.category_id,
  c.name AS category_name,
  tg.id AS group_id,
  tg.name AS group_name,
  cta.is_tax_inclusive,
  jsonb_agg(
    jsonb_build_object(
      'rate_id', tr.id,
      'rate_name', tr.name,
      'percentage', tr.percentage,
      'tax_type', tr.tax_type
    ) ORDER BY tgi.sort_order
  ) AS tax_rates
FROM category_tax_assignments cta
JOIN categories c ON c.id = cta.category_id
JOIN tax_groups tg ON tg.id = cta.tax_group_id
LEFT JOIN tax_group_items tgi ON tgi.group_id = tg.id
LEFT JOIN tax_rates tr ON tr.id = tgi.rate_id AND tr.is_active = true
WHERE cta.effective_to IS NULL OR cta.effective_to >= CURRENT_DATE
GROUP BY cta.category_id, c.name, tg.id, tg.name, cta.is_tax_inclusive;

-- Combined tax rate per group (sum of percentages)
CREATE OR REPLACE VIEW tax_group_combined_view AS
SELECT
  tg.id AS group_id,
  tg.name AS group_name,
  tg.description,
  tg.is_active,
  COALESCE(SUM(tr.percentage), 0) AS combined_percentage,
  COUNT(tgi.id) AS rate_count,
  jsonb_agg(
    jsonb_build_object(
      'rate_id', tr.id,
      'rate_name', tr.name,
      'percentage', tr.percentage,
      'tax_type', tr.tax_type
    ) ORDER BY tgi.sort_order
  ) FILTER (WHERE tr.id IS NOT NULL) AS rates
FROM tax_groups tg
LEFT JOIN tax_group_items tgi ON tgi.group_id = tg.id
LEFT JOIN tax_rates tr ON tr.id = tgi.rate_id AND tr.is_active = true
GROUP BY tg.id, tg.name, tg.description, tg.is_active;
