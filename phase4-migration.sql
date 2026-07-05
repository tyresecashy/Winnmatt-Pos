-- ================================================================
-- PHASE 4: EMPLOYEES, CASH, HARDWARE, OFFLINE & ENTERPRISE
-- Combined migration — run ONCE in Supabase SQL Editor
-- ================================================================

-- ############################################################
-- 1. EMPLOYEE WORKFORCE MANAGEMENT
-- ############################################################

-- 1a. Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_branch ON departments(branch_id);

-- 1b. Employee profiles (extends users table without changing it)
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  employee_id TEXT UNIQUE, -- visible staff number e.g. EMP-001
  staff_number TEXT UNIQUE,
  national_id TEXT,
  kra_pin TEXT,
  nhif_number TEXT,
  nssf_number TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  position TEXT,
  hire_date DATE,
  employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern','casual')),
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  photo_url TEXT,
  digital_signature_url TEXT,
  employment_status TEXT DEFAULT 'active' CHECK (employment_status IN ('active','suspended','terminated','resigned')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_user ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_dept ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_status ON employee_profiles(employment_status);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_profiles_select_branch" ON employee_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = employee_profiles.user_id AND users.branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid())));
CREATE POLICY "employee_profiles_insert_admin" ON employee_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND role IN ('super_admin','admin')));
CREATE POLICY "employee_profiles_update_admin" ON employee_profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND role IN ('super_admin','admin')));

-- 1c. Employee documents
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT,
  file_url TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_profile ON employee_documents(employee_profile_id);

-- 1d. Employee goals (performance)
CREATE TABLE IF NOT EXISTS employee_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  metric TEXT, -- sales_count, revenue, items_per_sale, etc
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_goals_profile ON employee_goals(employee_profile_id);

-- ############################################################
-- 2. PERMISSION SYSTEM 2.0 (Granular Permissions)
-- ############################################################

CREATE TABLE IF NOT EXISTS permission_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL, -- sales, inventory, employees, reports, admin, etc
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed all base permissions
INSERT INTO permission_definitions (code, label, category, description, is_system) VALUES
  ('sales.create', 'Create Sale', 'sales', 'Ability to process sales at POS', true),
  ('sales.refund', 'Process Refund', 'sales', 'Ability to process customer returns/refunds', true),
  ('sales.void', 'Void Sale', 'sales', 'Ability to void completed sales', true),
  ('sales.discount', 'Apply Discount', 'sales', 'Ability to apply discounts to sales', true),
  ('sales.discount.max_5', 'Discount up to 5%', 'sales', 'Maximum discount percentage: 5%', true),
  ('sales.discount.max_10', 'Discount up to 10%', 'sales', 'Maximum discount percentage: 10%', true),
  ('sales.discount.max_25', 'Discount up to 25%', 'sales', 'Maximum discount percentage: 25%', true),
  ('sales.discount.unlimited', 'Unlimited Discount', 'sales', 'Can apply any discount percentage', true),
  ('sales.open_drawer', 'Open Cash Drawer', 'sales', 'Ability to open cash drawer without sale', true),
  ('sales.close_drawer', 'Close Cash Drawer', 'sales', 'Ability to close/count drawer', true),
  ('sales.change_price', 'Change Price', 'sales', 'Ability to override product price at POS', true),
  ('inventory.view', 'View Inventory', 'inventory', 'View product inventory levels', true),
  ('inventory.edit', 'Edit Inventory', 'inventory', 'Edit inventory quantities', true),
  ('inventory.delete_product', 'Delete Product', 'inventory', 'Delete products from catalog', true),
  ('inventory.bulk_edit', 'Bulk Edit Products', 'inventory', 'Bulk update product prices/categories', true),
  ('inventory.stock_count', 'Stock Count', 'inventory', 'Perform stock counts', true),
  ('inventory.transfer', 'Transfer Stock', 'inventory', 'Create branch transfers', true),
  ('employees.view', 'View Employees', 'employees', 'View employee profiles', true),
  ('employees.create', 'Create Employee', 'employees', 'Create new employee profiles', true),
  ('employees.edit', 'Edit Employee', 'employees', 'Edit existing employee profiles', true),
  ('employees.delete', 'Delete Employee', 'employees', 'Delete/terminate employees', true),
  ('employees.schedule', 'Manage Schedules', 'employees', 'Create/edit employee schedules', true),
  ('employees.attendance', 'View Attendance', 'employees', 'View attendance records', true),
  ('reports.view', 'View Reports', 'reports', 'Access reports and analytics', true),
  ('reports.view_profit', 'View Profit Data', 'reports', 'Access profit/margin reports', true),
  ('reports.export', 'Export Data', 'reports', 'Export reports to CSV/PDF', true),
  ('purchases.create', 'Create Purchase Order', 'purchases', 'Create purchase orders', true),
  ('purchases.approve', 'Approve Purchase', 'purchases', 'Approve purchase orders', true),
  ('purchases.receive', 'Receive Purchase', 'purchases', 'Receive goods against POs', true),
  ('customers.view', 'View Customers', 'customers', 'View customer database', true),
  ('customers.edit', 'Edit Customer', 'customers', 'Edit customer profiles', true),
  ('customers.delete', 'Delete Customer', 'customers', 'Delete customer records', true),
  ('promotions.manage', 'Manage Promotions', 'promotions', 'Create/edit promotions and coupons', true),
  ('admin.users', 'Manage Users', 'admin', 'Create/edit system users', true),
  ('admin.branches', 'Manage Branches', 'admin', 'Create/edit branches', true),
  ('admin.settings', 'System Settings', 'admin', 'Modify system settings', true),
  ('admin.permissions', 'Manage Permissions', 'admin', 'Edit role/permission assignments', true),
  ('admin.audit_log', 'View Audit Logs', 'admin', 'View system audit trail', true),
  ('admin.loyalty', 'Modify Loyalty Rules', 'admin', 'Edit loyalty program configuration', true),
  ('admin.backup', 'Backup & Restore', 'admin', 'Manage system backups', true),
  ('admin.integrations', 'Manage Integrations', 'admin', 'Configure third-party integrations', true),
  ('admin.developer', 'Developer Console', 'admin', 'Access developer tools', true),
  ('admin.monitoring', 'System Monitoring', 'admin', 'View system health and monitoring', true),
  ('admin.emergency', 'Emergency Override', 'admin', 'Emergency system override', true),
  ('cash.view', 'View Cash Records', 'cash', 'View cash management records', true),
  ('cash.float', 'Set Opening Float', 'cash', 'Set opening cash float', true),
  ('cash.paid_in', 'Cash Paid In', 'cash', 'Record cash paid in', true),
  ('cash.paid_out', 'Cash Paid Out', 'cash', 'Record cash paid out', true),
  ('cash.safe_drop', 'Safe Drop', 'cash', 'Perform safe drops', true),
  ('cash.pickup', 'Cash Pickup', 'cash', 'Cash pickup from register', true),
  ('cash.variance', 'Approve Variance', 'cash', 'Approve cash variances', true),
  ('notifications.manage', 'Manage Notifications', 'notifications', 'Configure notification rules', true),
  ('hardware.view', 'View Hardware', 'hardware', 'View hardware device status', true),
  ('hardware.manage', 'Manage Hardware', 'hardware', 'Add/edit hardware devices', true),
  ('launch.readiness', 'Launch Readiness', 'launch', 'Access branch launch checklists', true)
ON CONFLICT (code) DO NOTHING;

-- 2b. Role-permission assignments
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('super_admin','admin','manager','cashier','custom')),
  permission_code TEXT NOT NULL REFERENCES permission_definitions(code) ON DELETE CASCADE,
  grant_type TEXT DEFAULT 'allow' CHECK (grant_type IN ('allow','deny')),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL = all branches
  max_value NUMERIC, -- e.g. max discount %
  time_restriction TEXT, -- JSON: {days:[], start_time, end_time}
  expires_at TIMESTAMP,
  requires_approval BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, permission_code, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_code ON role_permissions(permission_code);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_select_admin" ON role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_insert_admin" ON role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin','admin')));

-- 2c. User-specific permission overrides
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permission_definitions(code) ON DELETE CASCADE,
  grant_type TEXT DEFAULT 'allow' CHECK (grant_type IN ('allow','deny')),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  max_value NUMERIC,
  expires_at TIMESTAMP,
  requires_approval BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, permission_code, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- ############################################################
-- 3. REGISTER MANAGEMENT
-- ############################################################

CREATE TABLE IF NOT EXISTS registers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  register_name TEXT NOT NULL,
  serial_number TEXT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  register_type TEXT DEFAULT 'stationary' CHECK (register_type IN ('stationary','mobile','self_service')),
  status TEXT DEFAULT 'offline' CHECK (status IN ('online','offline','maintenance','disabled')),
  current_cashier_id UUID REFERENCES users(id) ON DELETE SET NULL,
  current_drawer_id UUID, -- fkey to cash_drawers after table created
  last_login TIMESTAMP,
  printer_status TEXT DEFAULT 'unknown' CHECK (printer_status IN ('connected','disconnected','error','unknown')),
  scanner_status TEXT DEFAULT 'unknown' CHECK (scanner_status IN ('connected','disconnected','error','unknown')),
  customer_display_status TEXT DEFAULT 'unknown',
  network_status TEXT DEFAULT 'unknown',
  battery_level NUMERIC DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
  app_version TEXT,
  health_score NUMERIC DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registers_branch ON registers(branch_id);
CREATE INDEX IF NOT EXISTS idx_registers_status ON registers(status);

ALTER TABLE registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registers_select_branch" ON registers FOR SELECT TO authenticated
  USING (branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid()));
CREATE POLICY "registers_insert_admin" ON registers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin','admin')));
CREATE POLICY "registers_update_admin" ON registers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin','admin')));

-- ############################################################
-- 4. CASH MANAGEMENT
-- ############################################################

-- 4a. Cash Drawers
CREATE TABLE IF NOT EXISTS cash_drawers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drawer_name TEXT NOT NULL,
  register_id UUID REFERENCES registers(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'closed' CHECK (status IN ('open','closed','counted')),
  current_balance INTEGER DEFAULT 0, -- in KSh cents
  expected_balance INTEGER DEFAULT 0,
  last_variance INTEGER DEFAULT 0,
  last_counted_at TIMESTAMP,
  last_counted_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE cash_drawers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_drawers_select_branch" ON cash_drawers FOR SELECT TO authenticated
  USING (branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid()));
CREATE POLICY "cash_drawers_insert_admin" ON cash_drawers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin','admin')));
CREATE POLICY "cash_drawers_update" ON cash_drawers FOR UPDATE TO authenticated
  USING (branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid()));

-- Fix registers FK to cash_drawers
ALTER TABLE registers ADD CONSTRAINT fk_registers_current_drawer
  FOREIGN KEY (current_drawer_id) REFERENCES cash_drawers(id) ON DELETE SET NULL;

-- 4b. Cash Events (the full audit trail)
CREATE TABLE IF NOT EXISTS cash_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  register_id UUID REFERENCES registers(id) ON DELETE SET NULL,
  drawer_id UUID REFERENCES cash_drawers(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'opening_float', 'cash_sale', 'cash_refund', 'paid_out', 'paid_in',
    'drawer_open', 'no_sale_open', 'safe_drop', 'cash_pickup',
    'drawer_transfer', 'drawer_close', 'cash_count', 'variance_approval',
    'manager_override'
  )),
  amount INTEGER NOT NULL DEFAULT 0, -- in KSh cents, positive = in, negative = out
  balance_before INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  reference_type TEXT, -- 'sale', 'refund', 'transfer', etc
  reference_id TEXT,   -- UUID of the related record
  reason TEXT,
  performed_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  photo_url TEXT,
  notes TEXT,
  device_info TEXT,    -- JSON with device details
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_events_branch ON cash_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_events_drawer ON cash_events(drawer_id);
CREATE INDEX IF NOT EXISTS idx_cash_events_type ON cash_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cash_events_created ON cash_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cash_events_performed_by ON cash_events(performed_by);

ALTER TABLE cash_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_events_select_branch" ON cash_events FOR SELECT TO authenticated
  USING (branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid()));
CREATE POLICY "cash_events_insert" ON cash_events FOR INSERT TO authenticated
  WITH CHECK (branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid()));

-- ############################################################
-- 5. ATTENDANCE & SCHEDULING
-- ############################################################

-- 5a. Shifts (templates)
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 30, -- minutes
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  is_overnight BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5b. Employee schedules
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 30,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_emp_schedule_date ON employee_schedules(date);
CREATE INDEX IF NOT EXISTS idx_emp_schedule_employee ON employee_schedules(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_emp_schedule_branch ON employee_schedules(branch_id);

-- 5c. Clock events (attendance)
CREATE TABLE IF NOT EXISTS clock_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('clock_in','clock_out','break_start','break_end')),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  method TEXT DEFAULT 'manual' CHECK (method IN ('manual','gps','face','qr')),
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  device_info TEXT,     -- JSON
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clock_events_user ON clock_events(user_id);
CREATE INDEX IF NOT EXISTS idx_clock_events_date ON clock_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_clock_events_branch ON clock_events(branch_id);

-- 5d. Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_profile_id UUID NOT NULL REFERENCES employee_profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual','sick','personal','maternity','paternity','bereavement','other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_profile_id);

-- ############################################################
-- 6. NOTIFICATIONS CENTER
-- ############################################################

-- 6a. Notification rules
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- 'low_stock','purchase_approved','cash_variance','employee_late', etc
  label TEXT NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'in_app' CHECK (delivery_method IN ('in_app','email','sms','push')),
  recipient_role TEXT, -- role to notify
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- specific user
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  threshold_value NUMERIC, -- for threshold-based events
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6b. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  event_type TEXT,
  reference_type TEXT,
  reference_id TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','critical','success')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  action_url TEXT,     -- deep link
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ############################################################
-- 7. SYSTEM AUDIT TRAIL (centralized)
-- ############################################################

CREATE TABLE IF NOT EXISTS system_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'user','sale','product','inventory','settings', etc
  entity_id TEXT,            -- UUID of the affected record
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON system_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON system_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON system_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON system_audit_log(created_at);

ALTER TABLE system_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_select_admin" ON system_audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin','admin')));

-- ############################################################
-- 8. LAUNCH READINESS
-- ############################################################

CREATE TABLE IF NOT EXISTS launch_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE UNIQUE,
  status TEXT DEFAULT 'incomplete' CHECK (status IN ('incomplete','in_progress','passed','failed')),
  items JSONB DEFAULT '{}', -- {"products_imported": true, "taxes_configured": false, ...}
  last_checked_at TIMESTAMP,
  checked_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE launch_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "launch_checklists_select" ON launch_checklists FOR SELECT TO authenticated
  USING (branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid()));
CREATE POLICY "launch_checklists_insert" ON launch_checklists FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin','admin')));

-- ############################################################
-- 9. AUTO-UPDATE TRIGGERS
-- ############################################################

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employee_profiles_updated_at BEFORE UPDATE ON employee_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_registers_updated_at BEFORE UPDATE ON registers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_cash_drawers_updated_at BEFORE UPDATE ON cash_drawers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_launch_checklists_updated_at BEFORE UPDATE ON launch_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ############################################################
-- 10. GRANTS
-- ############################################################

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
