-- ============================================================
-- Workforce Task Management System
-- ============================================================
-- This system manages supermarket workers beyond cashiers:
-- - Shelf stockers (placing stock, removing expired items)
-- - Cleaners (mopping, wiping shelves, sanitizing)
-- - Floor managers (supervising, quality checks)
-- - Inventory handlers (receiving, counting, organizing)
-- ============================================================

-- Worker roles (extends employee_profiles with operational roles)
CREATE TABLE IF NOT EXISTS worker_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                   -- 'Shelf Stocker', 'Floor Cleaner', 'Inventory Handler'
  code TEXT UNIQUE NOT NULL,            -- 'SHELF_STOCKER', 'CLEANER', 'INVENTORY_HANDLER'
  description TEXT,
  department TEXT,                      -- 'Sales Floor', 'Warehouse', 'Checkout'
  color TEXT DEFAULT '#3b82f6',         -- For UI display
  icon TEXT DEFAULT 'briefcase',        -- Icon name
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task categories
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                   -- 'Shelf Maintenance', 'Floor Cleaning', 'Stock Receiving'
  code TEXT UNIQUE NOT NULL,            -- 'SHELF_MAINTENANCE', 'FLOOR_CLEANING'
  description TEXT,
  department TEXT,
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'check-circle',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task templates (reusable task definitions)
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES task_categories(id),
  name TEXT NOT NULL,                   -- 'Restock Aisle 5', 'Mop Checkout Area'
  description TEXT,
  instructions TEXT,                    -- Detailed instructions
  estimated_minutes INT,                -- Estimated time to complete
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  recurrence TEXT DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  recurrence_days INT[],                -- [1,2,3,4,5] for weekdays
  requires_photo BOOLEAN DEFAULT false, -- Must upload completion photo
  requires_signature BOOLEAN DEFAULT false,
  applicable_roles TEXT[],              -- Which roles can do this task
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Worker assignments (who does what role)
CREATE TABLE IF NOT EXISTS worker_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_profiles(id),
  role_id UUID NOT NULL REFERENCES worker_roles(id),
  branch_id UUID NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,                        -- NULL = ongoing
  is_primary BOOLEAN DEFAULT false,     -- Primary role vs secondary
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, role_id, branch_id, start_date)
);

-- Tasks (individual task instances)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES task_templates(id),
  category_id UUID REFERENCES task_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  branch_id UUID NOT NULL,
  assigned_to UUID REFERENCES employee_profiles(id),
  assigned_by UUID REFERENCES employee_profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'blocked'
  )),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_minutes INT,
  actual_minutes INT,
  location TEXT,                        -- 'Aisle 5', 'Checkout 3', 'Warehouse B'
  area TEXT,                            -- 'Sales Floor', 'Warehouse', 'Restroom'
  notes TEXT,
  completion_notes TEXT,
  photo_url TEXT,                       -- Completion photo
  signature_url TEXT,                   -- Customer/manager signature
  blocked_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task checklist items (for tasks with multiple steps)
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  template_id UUID REFERENCES task_templates(id),
  title TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES employee_profiles(id),
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task comments/updates
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES employee_profiles(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,    -- Manager-only comments
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task time tracking
CREATE TABLE IF NOT EXISTS task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES employee_profiles(id),
  action TEXT NOT NULL CHECK (action IN ('start', 'pause', 'resume', 'end', 'break_start', 'break_end')),
  timestamp TIMESTAMPTZ DEFAULT now(),
  duration_minutes INT,                 -- For completed entries
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Worker shift schedules
CREATE TABLE IF NOT EXISTS worker_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_profiles(id),
  branch_id UUID NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_id UUID REFERENCES worker_roles(id),
  area TEXT,                            -- Assigned area for the shift
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, branch_id, shift_date)
);

-- Worker attendance (clock in/out for task workers)
CREATE TABLE IF NOT EXISTS worker_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_profiles(id),
  branch_id UUID NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_break', 'completed')),
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  total_break_minutes INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Worker performance metrics (daily aggregation)
CREATE TABLE IF NOT EXISTS worker_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_profiles(id),
  branch_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  tasks_assigned INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_on_time INT DEFAULT 0,
  tasks_late INT DEFAULT 0,
  avg_completion_minutes NUMERIC,
  total_work_minutes INT DEFAULT 0,
  total_break_minutes INT DEFAULT 0,
  efficiency_score NUMERIC,             -- 0-100 score
  quality_score NUMERIC,                -- Based on photos, signatures
  attendance_score NUMERIC,             -- Based on punctuality
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, branch_id, metric_date)
);

-- RLS policies
ALTER TABLE worker_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_performance ENABLE ROW LEVEL SECURITY;

-- Worker roles policies
CREATE POLICY "worker_roles_select_auth" ON worker_roles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "worker_roles_insert_admin" ON worker_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "worker_roles_update_admin" ON worker_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Task categories policies
CREATE POLICY "task_categories_select_auth" ON task_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "task_categories_insert_admin" ON task_categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Task templates policies
CREATE POLICY "task_templates_select_auth" ON task_templates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "task_templates_insert_admin" ON task_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Worker assignments policies
CREATE POLICY "worker_assignments_select_auth" ON worker_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "worker_assignments_insert_admin" ON worker_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Tasks policies (workers see their own tasks, managers see all)
CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "tasks_insert_admin" ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Task checklist items policies
CREATE POLICY "task_checklist_items_select_auth" ON task_checklist_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "task_checklist_items_update_auth" ON task_checklist_items
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Task comments policies
CREATE POLICY "task_comments_select_auth" ON task_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "task_comments_insert_auth" ON task_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Task time logs policies
CREATE POLICY "task_time_logs_select_auth" ON task_time_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "task_time_logs_insert_auth" ON task_time_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Worker shifts policies
CREATE POLICY "worker_shifts_select_auth" ON worker_shifts
  FOR SELECT USING (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "worker_shifts_insert_admin" ON worker_shifts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "worker_shifts_update_auth" ON worker_shifts
  FOR UPDATE USING (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Worker attendance policies
CREATE POLICY "worker_attendance_select_auth" ON worker_attendance
  FOR SELECT USING (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "worker_attendance_insert_auth" ON worker_attendance
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "worker_attendance_update_auth" ON worker_attendance
  FOR UPDATE USING (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

-- Worker performance policies
CREATE POLICY "worker_performance_select_auth" ON worker_performance
  FOR SELECT USING (
    auth.uid() = employee_id OR
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "worker_performance_insert_system" ON worker_performance
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_worker_roles_code ON worker_roles(code);
CREATE INDEX idx_task_categories_code ON task_categories(code);
CREATE INDEX idx_task_templates_category_id ON task_templates(category_id);
CREATE INDEX idx_worker_assignments_employee_id ON worker_assignments(employee_id);
CREATE INDEX idx_worker_assignments_branch_id ON worker_assignments(branch_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_branch_id ON tasks(branch_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_category_id ON tasks(category_id);
CREATE INDEX idx_task_checklist_items_task_id ON task_checklist_items(task_id);
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_time_logs_task_id ON task_time_logs(task_id);
CREATE INDEX idx_worker_shifts_employee_id ON worker_shifts(employee_id);
CREATE INDEX idx_worker_shifts_shift_date ON worker_shifts(shift_date);
CREATE INDEX idx_worker_attendance_employee_id ON worker_attendance(employee_id);
CREATE INDEX idx_worker_performance_employee_id ON worker_performance(employee_id);
CREATE INDEX idx_worker_performance_metric_date ON worker_performance(metric_date);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_worker_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_worker_roles_updated_at
  BEFORE UPDATE ON worker_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_roles_updated_at();

CREATE OR REPLACE FUNCTION update_task_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_task_categories_updated_at
  BEFORE UPDATE ON task_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_task_categories_updated_at();

CREATE OR REPLACE FUNCTION update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_task_templates_updated_at();

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

CREATE OR REPLACE FUNCTION update_worker_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_worker_shifts_updated_at
  BEFORE UPDATE ON worker_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_shifts_updated_at();

-- ============================================================
-- Seed Data: Default Worker Roles
-- ============================================================

INSERT INTO worker_roles (name, code, description, department, color, icon) VALUES
  ('Cashier', 'CASHIER', 'Handles POS transactions and customer service', 'Checkout', '#3b82f6', 'cash-register'),
  ('Shelf Stocker', 'SHELF_STOCKER', 'Places products on shelves, restocks, rotates stock', 'Sales Floor', '#10b981', 'package'),
  ('Floor Cleaner', 'FLOOR_CLEANER', 'Mops floors, cleans spills, maintains cleanliness', 'Facilities', '#f59e0b', 'sparkles'),
  ('Inventory Handler', 'INVENTORY_HANDLER', 'Receives deliveries, counts stock, manages warehouse', 'Warehouse', '#8b5cf6', 'truck'),
  ('Expired Stock Handler', 'EXPIRED_STOCK_HANDLER', 'Checks and removes expired products from shelves', 'Sales Floor', '#ef4444', 'alert-triangle'),
  ('Supervisor', 'SUPERVISOR', 'Oversees floor operations, handles escalations', 'Management', '#06b6d4', 'crown'),
  ('Receiving Clerk', 'RECEIVING_CLERK', 'Unloads deliveries, checks invoices, stores products', 'Warehouse', '#ec4899', 'inbox'),
  ('Display Merchandiser', 'DISPLAY_MERCHANDISER', 'Creates product displays, promotional setups', 'Sales Floor', '#14b8a6', 'layout'),
  ('Sanitation Worker', 'SANITATION_WORKER', 'Deep cleaning, sanitizing equipment, restrooms', 'Facilities', '#f97316', 'droplets'),
  ('Night Shift Worker', 'NIGHT_SHIFT_WORKER', 'Overnight restocking, cleaning, preparation', 'Operations', '#6366f1', 'moon')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Seed Data: Default Task Categories
-- ============================================================

INSERT INTO task_categories (name, code, description, department, color, icon) VALUES
  ('Shelf Maintenance', 'SHELF_MAINTENANCE', 'Restocking, organizing, face-up products', 'Sales Floor', '#10b981', 'package'),
  ('Floor Cleaning', 'FLOOR_CLEANING', 'Mopping, sweeping, spill cleanup', 'Facilities', '#f59e0b', 'sparkles'),
  ('Stock Receiving', 'STOCK_RECEIVING', 'Unloading, checking, storing deliveries', 'Warehouse', '#8b5cf6', 'truck'),
  ('Expired Stock Check', 'EXPIRED_STOCK_CHECK', 'Checking dates, removing expired items', 'Sales Floor', '#ef4444', 'alert-triangle'),
  ('Bathroom Cleaning', 'BATHROOM_CLEANING', 'Restroom sanitation and supplies', 'Facilities', '#06b6d4', 'droplets'),
  ('Display Setup', 'DISPLAY_SETUP', 'Creating promotional displays', 'Sales Floor', '#ec4899', 'layout'),
  ('Waste Management', 'WASTE_MANAGEMENT', 'Collecting trash, recycling, disposal', 'Facilities', '#6366f1', 'trash'),
  ('Equipment Maintenance', 'EQUIPMENT_MAINTENANCE', 'Checking and maintaining store equipment', 'Operations', '#14b8a6', 'settings'),
  ('Customer Assistance', 'CUSTOMER_ASSISTANCE', 'Helping customers, finding products', 'Sales Floor', '#f97316', 'users'),
  ('Opening/Closing', 'OPENING_CLOSING', 'Store opening and closing procedures', 'Operations', '#a855f7', 'clock')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Seed Data: Default Task Templates
-- ============================================================

INSERT INTO task_templates (category_id, name, description, instructions, estimated_minutes, priority, recurrence, recurrence_days, requires_photo, applicable_roles) VALUES
  -- Shelf Maintenance
  (SELECT id FROM task_categories WHERE code = 'SHELF_MAINTENANCE', 'Restock Aisle 1-5', 'Restock shelves in aisles 1-5', '1. Check shelf labels\n2. Pull stock forward\n3. Add new stock from back\n4. Face up products\n5. Report low stock', 60, 'normal', 'daily', '{1,2,3,4,5,6}', true, '{SHELF_STOCKER}'),
  (SELECT id FROM task_categories WHERE code = 'SHELF_MAINTENANCE', 'Restock Aisle 6-10', 'Restock shelves in aisles 6-10', '1. Check shelf labels\n2. Pull stock forward\n3. Add new stock from back\n4. Face up products\n5. Report low stock', 60, 'normal', 'daily', '{1,2,3,4,5,6}', true, '{SHELF_STOCKER}'),
  (SELECT id FROM task_categories WHERE code = 'SHELF_MAINTENANCE', 'Face-Up Products', 'Ensure all products are front-facing', '1. Pull products to front\n2. Align labels\n3. Check for damage\n4. Remove empty boxes', 30, 'low', 'daily', '{1,2,3,4,5,6}', false, '{SHELF_STOCKER}'),
  
  -- Floor Cleaning
  (SELECT id FROM task_categories WHERE code = 'FLOOR_CLEANING', 'Morning Mop - Sales Floor', 'Mop all sales floor areas', '1. Put up wet floor signs\n2. Sweep first\n3. Mop in sections\n4. Allow to dry\n5. Remove signs', 45, 'high', 'daily', '{1,2,3,4,5,6}', false, '{FLOOR_CLEANER}'),
  (SELECT id FROM task_categories WHERE code = 'FLOOR_CLEANING', 'Evening Mop - Sales Floor', 'End of day mopping', '1. Put up wet floor signs\n2. Sweep debris\n3. Mop thoroughly\n4. Check checkout area\n5. Clean entrance', 45, 'high', 'daily', '{1,2,3,4,5,6}', false, '{FLOOR_CLEANER}'),
  (SELECT id FROM task_categories WHERE code = 'FLOOR_CLEANING', 'Spill Cleanup', 'Immediate spill response', '1. Get spill kit\n2. Block area\n3. Clean spill\n4. Dry floor\n5. Remove signs', 15, 'urgent', 'none', NULL, false, '{FLOOR_CLEANER,SUPERVISOR}'),
  
  -- Expired Stock
  (SELECT id FROM task_categories WHERE code = 'EXPIRED_STOCK_CHECK', 'Daily Expiry Check - Dairy', 'Check dairy products for expiry', '1. Check all dairy sections\n2. Remove items expiring today\n3. Move near-expiry forward\n4. Log removed items\n5. Report to manager', 30, 'high', 'daily', '{1,2,3,4,5,6}', true, '{EXPIRED_STOCK_HANDLER,SHELF_STOCKER}'),
  (SELECT id FROM task_categories WHERE code = 'EXPIRED_STOCK_CHECK', 'Weekly Full Expiry Audit', 'Complete store expiry audit', '1. Check every aisle\n2. Check backroom\n3. Document all findings\n4. Remove expired items\n5. Submit report', 120, 'high', 'weekly', '{1}', true, '{EXPIRED_STOCK_HANDLER,INVENTORY_HANDLER}'),
  
  -- Stock Receiving
  (SELECT id FROM task_categories WHERE code = 'STOCK_RECEIVING', 'Receive Morning Delivery', 'Process morning delivery truck', '1. Check delivery note\n2. Count items\n3. Check quality\n4. Sign invoice\n5. Store products', 90, 'high', 'daily', '{1,2,3,4,5,6}', true, '{RECEIVING_CLERK,INVENTORY_HANDLER}'),
  (SELECT id FROM task_categories WHERE code = 'STOCK_RECEIVING', 'Warehouse Organization', 'Organize warehouse storage', '1. Sort by category\n2. Check FIFO dates\n3. Label shelves\n4. Clear pathways\n5. Update inventory', 60, 'normal', 'weekly', '{1,5}', false, '{INVENTORY_HANDLER}'),
  
  -- Bathroom Cleaning
  (SELECT id FROM task_categories WHERE code = 'BATHROOM_CLEANING', 'Hourly Bathroom Check', 'Check and clean restrooms', '1. Check supplies\n2. Clean mirrors\n3. Mop floor\n4. Empty trash\n5. Log completion', 15, 'normal', 'daily', '{1,2,3,4,5,6}', false, '{SANITATION_WORKER,FLOOR_CLEANER}'),
  (SELECT id FROM task_categories WHERE code = 'BATHROOM_CLEANING', 'Deep Clean Restrooms', 'Thorough restroom cleaning', '1. Clean all surfaces\n2. Descale fixtures\n3. Sanitize dispensers\n4. Deep mop\n5. Restock supplies', 45, 'high', 'weekly', '{1}', true, '{SANITATION_WORKER}'),
  
  -- Opening/Closing
  (SELECT id FROM task_categories WHERE code = 'OPENING_CLOSING', 'Store Opening', 'Opening procedures', '1. Disarm alarm\n2. Turn on lights\n3. Check temperatures\n4. Turn on POS\n5. Brief team', 30, 'urgent', 'daily', '{1,2,3,4,5,6,7}', false, '{SUPERVISOR,CASHIER}'),
  (SELECT id FROM task_categories WHERE code = 'OPENING_CLOSING', 'Store Closing', 'Closing procedures', '1. Final cleanup\n2. Count registers\n3. Run reports\n4. Secure stock\n5. Arm alarm', 45, 'urgent', 'daily', '{1,2,3,4,5,6,7}', false, '{SUPERVISOR,CASHIER}');

-- ============================================================
-- Functions for Task Management
-- ============================================================

-- Function to get tasks for a worker
CREATE OR REPLACE FUNCTION get_worker_tasks(
  p_employee_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  task_id UUID,
  title TEXT,
  description TEXT,
  category_name TEXT,
  priority TEXT,
  status TEXT,
  due_date TIMESTAMPTZ,
  estimated_minutes INT,
  location TEXT,
  checklist_items JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    tc.name as category_name,
    t.priority,
    t.status,
    t.due_date,
    t.estimated_minutes,
    t.location,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', tci.id,
        'title', tci.title,
        'is_required', tci.is_required,
        'is_completed', tci.is_completed
      ))
      FROM task_checklist_items tci
      WHERE tci.task_id = t.id),
      '[]'::jsonb
    ) as checklist_items
  FROM tasks t
  LEFT JOIN task_categories tc ON t.category_id = tc.id
  WHERE t.assigned_to = p_employee_id
    AND (t.due_date::date = p_date OR t.due_date IS NULL)
    AND t.status IN ('pending', 'in_progress')
  ORDER BY 
    CASE t.priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      WHEN 'low' THEN 4 
    END,
    t.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get worker performance summary
CREATE OR REPLACE FUNCTION get_worker_performance(
  p_employee_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_assigned BIGINT,
  total_completed BIGINT,
  completion_rate NUMERIC,
  avg_completion_minutes NUMERIC,
  tasks_on_time BIGINT,
  on_time_rate NUMERIC,
  efficiency_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_assigned,
    COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
    ROUND(COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as completion_rate,
    ROUND(AVG(actual_minutes) FILTER (WHERE status = 'completed'), 1) as avg_completion_minutes,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at <= due_date) as tasks_on_time,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'completed' AND completed_at <= due_date)::numeric / 
      NULLIF(COUNT(*) FILTER (WHERE status = 'completed'), 0) * 100, 
      1
    ) as on_time_rate,
    -- Calculate efficiency score (0-100)
    LEAST(100, GREATEST(0,
      ROUND(
        (COUNT(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(COUNT(*), 0) * 40) +
        (COUNT(*) FILTER (WHERE status = 'completed' AND completed_at <= due_date)::numeric / 
         NULLIF(COUNT(*) FILTER (WHERE status = 'completed'), 0) * 30) +
        (CASE 
          WHEN AVG(actual_minutes) FILTER (WHERE status = 'completed') <= AVG(estimated_minutes) FILTER (WHERE status = 'completed') THEN 30
          ELSE 30 * (AVG(estimated_minutes) FILTER (WHERE status = 'completed') / AVG(actual_minutes) FILTER (WHERE status = 'completed'))
        END),
        1
      )
    )) as efficiency_score
  FROM tasks
  WHERE assigned_to = p_employee_id
    AND created_at::date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-assign tasks based on role and availability
CREATE OR REPLACE FUNCTION auto_assign_task(
  p_task_id UUID,
  p_branch_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_task RECORD;
  v_worker RECORD;
  v_assigned_to UUID;
BEGIN
  -- Get task details
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  
  -- Find available worker with matching role
  SELECT wa.employee_id INTO v_assigned_to
  FROM worker_assignments wa
  WHERE wa.branch_id = p_branch_id
    AND wa.end_date IS NULL
    AND wa.role_id IN (
      SELECT id FROM worker_roles 
      WHERE code = ANY(v_task.applicable_roles)
    )
    AND NOT EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.assigned_to = wa.employee_id
        AND t.status IN ('pending', 'in_progress')
        AND t.due_date::date = v_task.due_date::date
    )
  ORDER BY RANDOM()
  LIMIT 1;
  
  -- Update task with assignment
  IF v_assigned_to IS NOT NULL THEN
    UPDATE tasks 
    SET assigned_to = v_assigned_to,
        status = 'pending'
    WHERE id = p_task_id;
  END IF;
  
  RETURN v_assigned_to;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
