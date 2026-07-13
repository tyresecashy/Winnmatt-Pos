-- WINNMATT POS Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Branches table (must be created BEFORE users for foreign key)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  location TEXT,
  is_main BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users table (may already exist from Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  purchase_price INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory table (per product per branch)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_counted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, branch_id)
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  type TEXT NOT NULL CHECK (type IN ('retail', 'wholesale', 'business')) DEFAULT 'retail',
  loyalty_points INTEGER DEFAULT 0,
  credit_limit INTEGER DEFAULT 0,
  credit_balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT,
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'cheque', 'credit')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  receipt_number TEXT UNIQUE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sale Items table
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stock Movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('sale', 'receipt', 'transfer', 'adjustment', 'damage')),
  quantity INTEGER NOT NULL,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'received', 'cancelled')) DEFAULT 'draft',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  expected_delivery TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Order Items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stock Transfers table
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  to_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock Transfer Items table
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies (allow authenticated users to access data)
-- In production, implement more restrictive policies per user role and branch

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON branches;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON products;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON inventory;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON suppliers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON sales;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON sale_items;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stock_movements;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON purchase_orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON purchase_order_items;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stock_transfers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON stock_transfer_items;

-- Create policies
CREATE POLICY "Enable read access for authenticated users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON branches
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON inventory
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON customers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON suppliers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON sales
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON sale_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON stock_movements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON purchase_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON purchase_order_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON stock_transfers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON stock_transfer_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- RECEIPT SETTINGS TABLES
-- ============================================================================

-- Business Settings (Singleton): Global receipt and business details
-- Only one row exists (seeded with hardcoded ID)
-- Only admins can update via app. Reads allowed for all authenticated users.
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

-- Branch Receipt Settings (Overrides): Per-branch overrides of global settings
-- One row per branch (optional). Null fields mean "use global default".
-- Only admins can update via app. Reads allowed for all authenticated users.
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

-- Seed the singleton business_settings row (if it doesn't exist)
-- ID is hardcoded for singleton pattern
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

-- Enable RLS on new tables
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_receipt_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all authenticated users to read business_settings
CREATE POLICY "Enable read access for authenticated users" ON business_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policy: Allow all authenticated users to read branch_receipt_settings
CREATE POLICY "Enable read access for authenticated users" ON branch_receipt_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- MIGRATION: Add status column to users table for existing databases
-- ============================================================================
-- If your users table was created before this migration, the status column
-- may not exist. Run this to add it:

DO $$ 
BEGIN
  -- Check if status column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'status'
  ) THEN
    -- Add status column with default 'active' for all existing users
    ALTER TABLE users
    ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive'));
    
    -- Update constraint name for clarity
    ALTER TABLE users
    RENAME CONSTRAINT users_status_check TO users_status_enum_check;
    
    RAISE NOTICE 'Status column added to users table';
  ELSE
    RAISE NOTICE 'Status column already exists on users table';
  END IF;
END $$;

-- ============================================================================
-- FIX FOR EXISTING DATABASES: Add missing foreign key on users.branch_id
-- ============================================================================
-- If your users table was created before branches table or without the FK,
-- run this to add it:

DO $$ 
BEGIN
  -- Check if the foreign key constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_branch_id_fkey' 
    AND table_name = 'users'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE users
    ADD CONSTRAINT users_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
    
    RAISE NOTICE 'Foreign key constraint added to users.branch_id';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists on users.branch_id';
  END IF;
END $$;
