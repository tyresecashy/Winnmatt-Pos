-- ============================================================
-- E-commerce Engine
-- ============================================================

-- Online store configuration
CREATE TABLE IF NOT EXISTS ecommerce_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                   -- 'WinnMatt Online'
  slug TEXT UNIQUE NOT NULL,            -- 'winnmatt-online'
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Online orders
CREATE TABLE IF NOT EXISTS ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,    -- 'ORD-2026-000001'
  store_id UUID REFERENCES ecommerce_stores(id),
  customer_id UUID REFERENCES customers(id),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'processing', 'shipped', 
    'delivered', 'cancelled', 'refunded'
  )),
  subtotal NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  shipping_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'KES',
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'paid', 'failed', 'refunded'
  )),
  payment_reference TEXT,
  shipping_address JSONB,
  billing_address JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Order items
CREATE TABLE IF NOT EXISTS ecommerce_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Product sync (POS to online store)
CREATE TABLE IF NOT EXISTS ecommerce_product_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  store_id UUID REFERENCES ecommerce_stores(id),
  online_product_id TEXT,               -- ID in external platform
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN (
    'pending', 'synced', 'error', 'deleted'
  )),
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  online_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, store_id)
);

-- Shopping cart (persistent)
CREATE TABLE IF NOT EXISTS ecommerce_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cart items
CREATE TABLE IF NOT EXISTS ecommerce_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES ecommerce_cart(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cart_id, product_id)
);

-- Shipping methods
CREATE TABLE IF NOT EXISTS ecommerce_shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                   -- 'Standard Delivery', 'Express Delivery'
  description TEXT,
  base_price NUMERIC NOT NULL,
  price_per_km NUMERIC DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  max_order_amount NUMERIC,
  estimated_days INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Discount codes
CREATE TABLE IF NOT EXISTS ecommerce_discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,            -- 'SUMMER2026'
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  usage_limit INT,
  used_count INT DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE ecommerce_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_product_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_discount_codes ENABLE ROW LEVEL SECURITY;

-- Store policies
CREATE POLICY "ecommerce_stores_select_public" ON ecommerce_stores
  FOR SELECT USING (status = 'active');

CREATE POLICY "ecommerce_stores_select_auth" ON ecommerce_stores
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ecommerce_stores_insert_admin" ON ecommerce_stores
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ecommerce_stores_update_admin" ON ecommerce_stores
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Order policies
CREATE POLICY "ecommerce_orders_select_auth" ON ecommerce_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ecommerce_orders_insert_auth" ON ecommerce_orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ecommerce_orders_update_auth" ON ecommerce_orders
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Order items policies
CREATE POLICY "ecommerce_order_items_select_auth" ON ecommerce_order_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ecommerce_order_items_insert_auth" ON ecommerce_order_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Product sync policies
CREATE POLICY "ecommerce_product_sync_select_auth" ON ecommerce_product_sync
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ecommerce_product_sync_insert_admin" ON ecommerce_product_sync
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ecommerce_product_sync_update_admin" ON ecommerce_product_sync
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Cart policies (public access for anonymous users)
CREATE POLICY "ecommerce_cart_select_public" ON ecommerce_cart
  FOR SELECT USING (true);

CREATE POLICY "ecommerce_cart_insert_public" ON ecommerce_cart
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ecommerce_cart_update_public" ON ecommerce_cart
  FOR UPDATE USING (true);

CREATE POLICY "ecommerce_cart_delete_public" ON ecommerce_cart
  FOR DELETE USING (true);

-- Cart items policies
CREATE POLICY "ecommerce_cart_items_select_public" ON ecommerce_cart_items
  FOR SELECT USING (true);

CREATE POLICY "ecommerce_cart_items_insert_public" ON ecommerce_cart_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ecommerce_cart_items_update_public" ON ecommerce_cart_items
  FOR UPDATE USING (true);

CREATE POLICY "ecommerce_cart_items_delete_public" ON ecommerce_cart_items
  FOR DELETE USING (true);

-- Shipping methods policies
CREATE POLICY "ecommerce_shipping_methods_select_public" ON ecommerce_shipping_methods
  FOR SELECT USING (is_active = true);

CREATE POLICY "ecommerce_shipping_methods_select_auth" ON ecommerce_shipping_methods
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ecommerce_shipping_methods_insert_admin" ON ecommerce_shipping_methods
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ecommerce_shipping_methods_update_admin" ON ecommerce_shipping_methods
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Discount codes policies
CREATE POLICY "ecommerce_discount_codes_select_public" ON ecommerce_discount_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "ecommerce_discount_codes_select_auth" ON ecommerce_discount_codes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ecommerce_discount_codes_insert_admin" ON ecommerce_discount_codes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "ecommerce_discount_codes_update_admin" ON ecommerce_discount_codes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Indexes
CREATE INDEX idx_ecommerce_orders_store_id ON ecommerce_orders(store_id);
CREATE INDEX idx_ecommerce_orders_customer_id ON ecommerce_orders(customer_id);
CREATE INDEX idx_ecommerce_orders_status ON ecommerce_orders(status);
CREATE INDEX idx_ecommerce_orders_created_at ON ecommerce_orders(created_at);
CREATE INDEX idx_ecommerce_order_items_order_id ON ecommerce_order_items(order_id);
CREATE INDEX idx_ecommerce_order_items_product_id ON ecommerce_order_items(product_id);
CREATE INDEX idx_ecommerce_product_sync_product_id ON ecommerce_product_sync(product_id);
CREATE INDEX idx_ecommerce_cart_session_id ON ecommerce_cart(session_id);
CREATE INDEX idx_ecommerce_cart_items_cart_id ON ecommerce_cart_items(cart_id);
CREATE INDEX idx_ecommerce_discount_codes_code ON ecommerce_discount_codes(code);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_ecommerce_stores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ecommerce_stores_updated_at
  BEFORE UPDATE ON ecommerce_stores
  FOR EACH ROW
  EXECUTE FUNCTION update_ecommerce_stores_updated_at();

CREATE OR REPLACE FUNCTION update_ecommerce_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ecommerce_orders_updated_at
  BEFORE UPDATE ON ecommerce_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_ecommerce_orders_updated_at();

CREATE OR REPLACE FUNCTION update_ecommerce_product_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ecommerce_product_sync_updated_at
  BEFORE UPDATE ON ecommerce_product_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_ecommerce_product_sync_updated_at();

CREATE OR REPLACE FUNCTION update_ecommerce_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ecommerce_cart_updated_at
  BEFORE UPDATE ON ecommerce_cart
  FOR EACH ROW
  EXECUTE FUNCTION update_ecommerce_cart_updated_at();

-- Order number sequence
CREATE SEQUENCE order_number_seq START 1;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON ecommerce_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();
