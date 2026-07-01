-- RECEIPT SETTINGS MIGRATION SQL
-- Run this in Supabase SQL Editor to set up receipt settings tables
-- 
-- Steps:
-- 1. Go to https://app.supabase.com
-- 2. Select "hohxhazfysfiuqizyvay" project  
-- 3. Click "SQL Editor" in left sidebar
-- 4. Click "New Query"
-- 5. Copy & paste ALL the SQL below
-- 6. Click "Run" button
-- 7. Verify: "Query executed successfully" message appears

CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL DEFAULT 'WINNMATT POS',
  phone_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  tax_pin VARCHAR(50),
  business_pin VARCHAR(50),
  receipt_footer_text TEXT,
  return_policy_text TEXT,
  thank_you_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_receipt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  receipt_header_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO business_settings (
  id,
  business_name,
  phone_number,
  email,
  address,
  tax_pin,
  business_pin,
  receipt_footer_text,
  return_policy_text,
  thank_you_message
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'WINNMATT POS',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'Thank you for your purchase!',
  NULL,
  'Your business matters to us!'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_receipt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON business_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON branch_receipt_settings
  FOR SELECT USING (auth.role() = 'authenticated');
