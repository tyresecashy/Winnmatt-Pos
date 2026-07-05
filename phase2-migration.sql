-- ============================================================================
-- WINNMATT POS — PHASE 2: INVENTORY, WAREHOUSES & PROCUREMENT
-- Enterprise Operational Upgrade
-- ============================================================================
-- This migration upgrades the existing inventory system to an enterprise-grade
-- operational ecosystem with full product lifecycle, supplier CRM, warehouse ops,
-- receiving/transfer workflows, expiry/batch tracking, and analytics.
-- ============================================================================

-- ── 0. PREREQUISITE TABLES (create base tables if they don't exist) ──

-- Branches (base - referenced by many FKs)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  location TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users (base - public users/employees table, referenced by many FKs)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'cashier',
  pin TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories (base - used in inventory views)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory (base - stock levels by branch/product)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products (base - needed for FK refs)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category_id UUID,
  purchase_price INTEGER DEFAULT 0,
  selling_price INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pieces',
  barcode TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'active',
  reorder_level INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers (base)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase orders (base)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft',
  total_amount INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase order items (base)
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  line_total INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase receipts (base)
CREATE TABLE IF NOT EXISTS purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  received_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase receipt items (base)
CREATE TABLE IF NOT EXISTS purchase_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock transfers (base)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock transfer items (base)
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock movements (base)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID,
  quantity INTEGER NOT NULL,
  movement_type TEXT,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock counts (base)
CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counted_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock count items (base)
CREATE TABLE IF NOT EXISTS stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  expected_quantity INTEGER DEFAULT 0,
  actual_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 0b. ENSURE EXISTING TABLES HAVE COLUMNS NEEDED BY VIEWS ──
-- Inventory: views need reserved_stock
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;

-- Products: views reference these columns - ensure they exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- ── 1. ENHANCE products TABLE ──
ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_aliases TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promotion_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS staff_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vip_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_inclusive_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_exclusive_price INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_margin_percent NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS safety_stock INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg';
ALTER TABLE products ADD COLUMN IF NOT EXISTS dimensions TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_batch_tracked BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_expirable BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS avg_monthly_sales INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS avg_weekly_sales INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS avg_daily_sales NUMERIC(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_internal_code ON products(internal_code) WHERE internal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_search_aliases ON products USING GIN(search_aliases);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products(manufacturer) WHERE manufacturer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_department ON products(department) WHERE department IS NOT NULL;

-- ── 2. PRODUCT PRICE HISTORY (multi-tier pricing with branch specificity) ──
CREATE TABLE IF NOT EXISTS product_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN (
    'cost', 'selling', 'wholesale', 'promotion', 'staff', 'vip', 'branch_specific'
  )),
  price INTEGER NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  effective_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  source_batch_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_price_history_product ON product_price_history(product_id, price_type);
CREATE INDEX IF NOT EXISTS idx_product_price_history_branch ON product_price_history(branch_id) WHERE branch_id IS NOT NULL;

-- ── 3. PRODUCT ACTIVITY LOG (timeline feed for every product) ──
CREATE TABLE IF NOT EXISTS product_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'created', 'price_changed', 'purchased', 'received', 'transferred',
    'sold', 'returned', 'adjusted', 'cycle_counted', 'expired',
    'archived', 'batch_added', 'recalled', 'quarantined', 'disposed',
    'supplier_changed', 'status_changed', 'image_updated', 'reorder_level_changed'
  )),
  description TEXT NOT NULL,
  changes_json JSONB,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_activity_product ON product_activity_log(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_activity_type ON product_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_product_activity_created ON product_activity_log(created_at DESC);

-- ── 4. PRODUCT SUPPLIERS (preferred + negotiated prices per supplier) ──
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_code TEXT,
  negotiated_price INTEGER,
  min_order_qty INTEGER DEFAULT 1,
  lead_time_days INTEGER,
  is_preferred BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_supplied_date TIMESTAMP,
  quality_rating NUMERIC(3,1),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_preferred ON product_suppliers(is_preferred) WHERE is_preferred = TRUE;

-- ── 5. ENHANCE suppliers TABLE (Enterprise CRM) ──
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_number TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bank_code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_limit INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 30;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivery_days TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS performance_score NUMERIC(5,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS late_delivery_pct NUMERIC(5,2) DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rejected_deliveries INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS total_purchase_amount INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS outstanding_orders INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted'));
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_performance ON suppliers(performance_score DESC);

-- ── 6. SUPPLIER CONTACTS (multiple contacts per supplier) ──
CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON supplier_contacts(supplier_id);

-- ── 7. SUPPLIER DOCUMENTS ──
CREATE TABLE IF NOT EXISTS supplier_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'contract', 'certificate', 'invoice', 'license', 'tax_form',
    'insurance', 'catalog', 'nda', 'other'
  )),
  document_name TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  expiry_date TIMESTAMP,
  notes TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON supplier_documents(supplier_id);

-- ── 8. SUPPLIER PERFORMANCE SNAPSHOTS (auto-calculated monthly) ──
CREATE TABLE IF NOT EXISTS supplier_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  total_orders INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  rejected_items INTEGER DEFAULT 0,
  accepted_items INTEGER DEFAULT 0,
  total_value INTEGER DEFAULT 0,
  avg_delivery_days NUMERIC(5,1),
  avg_order_value NUMERIC(10,0),
  reliability_score NUMERIC(5,2),
  quality_score NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(supplier_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_supplier_performance_lookup ON supplier_performance_snapshots(supplier_id, period_year DESC, period_month DESC);

-- ── 8b. CREATE warehouses TABLE (if not already present) ──
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  location TEXT,
  manager_id UUID,
  type TEXT NOT NULL DEFAULT 'branch' CHECK (type IN ('central', 'branch', 'regional')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 9. ENHANCE warehouses TABLE ──
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS capacity NUMERIC(10,2);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS capacity_unit TEXT DEFAULT 'cubic_meters';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS current_utilization NUMERIC(5,2) DEFAULT 0;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS temperature_min NUMERIC(5,1);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS temperature_max NUMERIC(5,1);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS temperature_notes TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS access_permissions TEXT[];
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS receiving_performance NUMERIC(5,2);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS dispatch_performance NUMERIC(5,2);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS stock_accuracy NUMERIC(5,2);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_temperature_controlled BOOLEAN DEFAULT FALSE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_secure BOOLEAN DEFAULT FALSE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_type_check;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_type_check
  CHECK (type IN ('central', 'branch', 'regional', 'receiving', 'damaged',
                  'returns', 'quarantine', 'expired', 'transfer_zone'));

CREATE INDEX IF NOT EXISTS idx_warehouses_type ON warehouses(type);

-- ── 10. ENHANCE purchase_orders TABLE ──
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS actual_delivery_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS actual_cost INTEGER;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipping_cost INTEGER DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
  CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal'
  CHECK (urgency IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add new statuses to PO status check
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'ordered',
                    'partially_received', 'received', 'closed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment ON purchase_orders(payment_status);

-- ── 11. ENHANCE purchase_order_items ──
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit_price INTEGER;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- ── 12. ENHANCE purchase_receipts ──
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS documents JSONB;

-- ── 13. ENHANCE purchase_receipt_items ──
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quantity_ordered INTEGER;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quantity_accepted INTEGER;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quantity_rejected INTEGER DEFAULT 0;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS condition_notes TEXT;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS is_damaged BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS manufacture_date DATE;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS warehouse_location TEXT;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quality_checked BOOLEAN DEFAULT FALSE;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quality_checked_by UUID REFERENCES users(id);
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMP;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS quality_notes TEXT;

-- ── 14. ENHANCE stock_transfers (Full Transfer Wizard) ──
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS transfer_number TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS from_warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS to_warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES users(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS vehicle_number TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS expected_arrival TIMESTAMP;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS actual_arrival TIMESTAMP;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMP;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS photos TEXT[];
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS variance_report JSONB;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add new statuses
ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_status_check;
ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_status_check
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'dispatched',
                    'in_transit', 'arrived', 'verified', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_stock_transfers_number ON stock_transfers(transfer_number);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON stock_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to ON stock_transfers(to_warehouse_id);

-- ── 15. ENHANCE stock_transfer_items ──
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS quantity_requested INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS quantity_dispatched INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS quantity_received INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS quantity_damaged INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS variance INTEGER DEFAULT 0;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS variance_notes TEXT;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS unit_cost INTEGER;

-- ── 16. BATCH / LOT TRACKING ──
CREATE TABLE IF NOT EXISTS batch_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_number TEXT NOT NULL,
  lot_number TEXT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  manufacture_date DATE,
  expiry_date DATE,
  received_date TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'quarantined', 'recalled', 'expired', 'disposed', 'depleted')),
  recall_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_tracking_number ON batch_tracking(batch_number);
CREATE INDEX IF NOT EXISTS idx_batch_tracking_product ON batch_tracking(product_id);
CREATE INDEX IF NOT EXISTS idx_batch_tracking_expiry ON batch_tracking(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_batch_tracking_status ON batch_tracking(status);

-- ── 17. REORDER SUGGESTIONS (Auto-Reorder Engine) ──
CREATE TABLE IF NOT EXISTS reorder_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  current_stock INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  available_stock INTEGER GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
  avg_daily_sales NUMERIC(10,2) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  suggested_order_qty INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'ordered', 'dismissed')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  preferred_supplier_id UUID REFERENCES suppliers(id),
  estimated_cost INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_status ON reorder_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_product ON reorder_suggestions(product_id);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_priority ON reorder_suggestions(priority);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_branch ON reorder_suggestions(branch_id);

-- ── 18. STOCK ADJUSTMENT REASONS (categorized for analytics) ──
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason_category TEXT
  CHECK (reason_category IN (
    'damage', 'theft', 'expiry', 'counting_error', 'receiving_error',
    'transfer_error', 'write_off', 'found', 'return', 'quality_issue',
    'other'
  ));
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- ── 19. ENHANCE stock_counts ──
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS count_type TEXT DEFAULT 'full'
  CHECK (count_type IN ('cycle', 'full', 'blind', 'spot', 'annual'));
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES users(id);
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS total_variance INTEGER DEFAULT 0;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS shrinkage_amount INTEGER DEFAULT 0;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS shrinkage_value INTEGER DEFAULT 0;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS approval_threshold INTEGER DEFAULT 0;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS recounted BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS recounted_at TIMESTAMP;

-- ── 20. ENHANCE stock_count_items ──
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS recount_quantity INTEGER;
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS recount_needed BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS is_blind BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS variance_pct NUMERIC(5,2);

-- ── 21. INVENTORY ANALYTICS VIEW (computed KPIs) ──
CREATE OR REPLACE VIEW inventory_analytics AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name,
  p.brand,
  p.category_id,
  c.name AS category_name,
  p.department,
  p.selling_price,
  p.purchase_price,
  p.wholesale_price,
  (p.selling_price - p.purchase_price) AS margin_cents,
  CASE WHEN p.purchase_price > 0
    THEN ROUND(((p.selling_price - p.purchase_price)::NUMERIC / p.purchase_price) * 100, 2)
    ELSE 0
  END AS margin_pct,
  COALESCE(i.total_stock, 0) AS total_stock,
  COALESCE(i.total_reserved, 0) AS total_reserved,
  COALESCE(i.total_stock, 0) - COALESCE(i.total_reserved, 0) AS available_stock,
  p.reorder_level,
  p.safety_stock,
  p.avg_monthly_sales,
  p.avg_weekly_sales,
  p.lead_time_days,
  p.status,
  CASE WHEN COALESCE(i.total_stock, 0) <= p.reorder_level THEN 'reorder'
       WHEN COALESCE(i.total_stock, 0) <= p.safety_stock THEN 'critical'
       ELSE 'ok'
  END AS stock_status,
  COALESCE(i.branch_count, 0) AS branch_count,
  COALESCE(i.total_stock * p.purchase_price, 0) AS stock_value_cents,
  ps.preferred_supplier_name,
  ps.preferred_supplier_id
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN (
  SELECT
    product_id,
    SUM(quantity) AS total_stock,
    SUM(reserved_stock) AS total_reserved,
    COUNT(DISTINCT branch_id) AS branch_count
  FROM inventory
  GROUP BY product_id
) i ON p.id = i.product_id
LEFT JOIN (
  SELECT DISTINCT ON (product_id)
    product_id,
    s.name AS preferred_supplier_name,
    s.id AS preferred_supplier_id
  FROM product_suppliers ps
  JOIN suppliers s ON ps.supplier_id = s.id
  WHERE ps.is_preferred = TRUE
) ps ON p.id = ps.product_id;

-- ── 22. SUPPLIER PERFORMANCE VIEW ──
CREATE OR REPLACE VIEW supplier_performance_view AS
SELECT
  s.id AS supplier_id,
  s.name,
  s.code,
  s.rating,
  s.performance_score,
  s.quality_score,
  s.late_delivery_pct,
  s.rejected_deliveries,
  s.total_orders,
  s.outstanding_orders,
  s.total_purchase_amount,
  s.credit_days,
  s.credit_limit,
  s.status,
  COALESCE(ps.product_count, 0) AS product_count,
  COALESCE(ps.active_products, 0) AS active_products,
  COALESCE(rcv.last_receipt_date, s.updated_at) AS last_activity
FROM suppliers s
LEFT JOIN (
  SELECT
    supplier_id,
    COUNT(*) AS product_count,
    COUNT(*) FILTER (WHERE is_active = TRUE) AS active_products
  FROM product_suppliers
  GROUP BY supplier_id
) ps ON s.id = ps.supplier_id
LEFT JOIN (
  SELECT
    supplier_id,
    MAX(created_at) AS last_receipt_date
  FROM purchase_receipts
  GROUP BY supplier_id
) rcv ON s.id = rcv.supplier_id;

-- ── 23. REORDER ENGINE VIEW ──
CREATE OR REPLACE VIEW reorder_engine_view AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name,
  p.brand,
  p.category_id,
  c.name AS category_name,
  COALESCE(i.total_stock, 0) AS current_stock,
  COALESCE(i.total_reserved, 0) AS reserved_stock,
  COALESCE(i.total_stock, 0) - COALESCE(i.total_reserved, 0) AS available_stock,
  p.reorder_level,
  p.safety_stock,
  p.lead_time_days,
  p.avg_daily_sales,
  p.avg_weekly_sales,
  p.avg_monthly_sales,
  p.purchase_price,
  p.preferred_supplier_id,
  s.name AS preferred_supplier_name,
  -- Calculate suggested reorder qty
  GREATEST(
    COALESCE(p.reorder_level, 0) - (COALESCE(i.total_stock, 0) - COALESCE(i.total_reserved, 0)),
    0
  ) AS suggested_order_qty,
  -- Days until stockout
  CASE WHEN COALESCE(p.avg_daily_sales, 0) > 0
    THEN FLOOR((COALESCE(i.total_stock, 0) - COALESCE(i.total_reserved, 0))::NUMERIC / p.avg_daily_sales)
    ELSE 999
  END AS days_until_stockout,
  -- Priority
  CASE
    WHEN (COALESCE(i.total_stock, 0) - COALESCE(i.total_reserved, 0)) <= COALESCE(p.safety_stock, 0) THEN 'critical'
    WHEN (COALESCE(i.total_stock, 0) - COALESCE(i.total_reserved, 0)) <= COALESCE(p.reorder_level, 0) THEN 'high'
    ELSE 'normal'
  END AS priority
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN (
  SELECT
    product_id,
    SUM(quantity) AS total_stock,
    SUM(reserved_stock) AS total_reserved
  FROM inventory
  GROUP BY product_id
) i ON p.id = i.product_id
LEFT JOIN suppliers s ON p.preferred_supplier_id = s.id
WHERE p.status = 'active';

-- ── 24. AUTO-GENERATE PO NUMBER ──
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1001;

-- ── 25. HELPER: Trigger to auto-set po_number ──
CREATE OR REPLACE FUNCTION set_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL THEN
    NEW.po_number := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('po_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_po_number ON purchase_orders;
CREATE TRIGGER trg_set_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_po_number();

-- ── 26. HELPER: Auto-update updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
DROP TRIGGER IF EXISTS trg_product_suppliers_updated_at ON product_suppliers;
CREATE TRIGGER trg_product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_supplier_contacts_updated_at ON supplier_contacts;
CREATE TRIGGER trg_supplier_contacts_updated_at
  BEFORE UPDATE ON supplier_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_batch_tracking_updated_at ON batch_tracking;
CREATE TRIGGER trg_batch_tracking_updated_at
  BEFORE UPDATE ON batch_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_reorder_suggestions_updated_at ON reorder_suggestions;
CREATE TRIGGER trg_reorder_suggestions_updated_at
  BEFORE UPDATE ON reorder_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
