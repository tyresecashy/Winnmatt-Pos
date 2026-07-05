-- ============================================================
-- Notification Platform
-- ============================================================

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,           -- 'sale.completed', 'stock.low'
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'sales', 'inventory', 'finance', 'workforce', 'system', 'marketing', 'general'
  )),
  channels TEXT[] DEFAULT '{in_app}' CHECK (channels <@ '{in_app,sms,email,push,webhook}'),
  subject_template TEXT,               -- For email
  body_template TEXT NOT NULL,         -- Supports {{variable}} placeholders
  sms_template TEXT,                   -- For SMS
  push_template TEXT,                  -- For push notifications
  variables JSONB DEFAULT '[]',        -- List of available variables
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'sms', 'email', 'push')),
  category TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel, category)
);

-- Notification log (all sent notifications)
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES notification_templates(id),
  user_id UUID REFERENCES auth.users(id),
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'sms', 'email', 'push', 'webhook')),
  recipient TEXT,                      -- Phone number, email, or user ID
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  error_message TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- In-app notifications (for notification center)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  category TEXT DEFAULT 'general',
  link TEXT,                           -- Deep link to relevant page
  data JSONB,                         -- Additional data
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Template policies (admin only)
CREATE POLICY "notification_templates_select_auth" ON notification_templates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "notification_templates_insert_admin" ON notification_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "notification_templates_update_admin" ON notification_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "notification_templates_delete_admin" ON notification_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Preferences policies (users can manage their own)
CREATE POLICY "notification_preferences_select_own" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_preferences_insert_own" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_preferences_update_own" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notification_preferences_delete_own" ON notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Log policies (admin can see all, users see their own)
CREATE POLICY "notification_log_select_admin" ON notification_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employee_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "notification_log_select_own" ON notification_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_log_insert_auth" ON notification_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notification_log_update_auth" ON notification_log
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Notifications policies (users see their own)
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_auth" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_notification_templates_name ON notification_templates(name);
CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX idx_notification_log_user_id ON notification_log(user_id);
CREATE INDEX idx_notification_log_status ON notification_log(status);
CREATE INDEX idx_notification_log_created_at ON notification_log(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_notification_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_templates_updated_at();

CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Seed default templates
INSERT INTO notification_templates (name, description, category, channels, subject_template, body_template, variables) VALUES
  ('sale.completed', 'Sale completed successfully', 'sales', '{in_app,push}', 'Sale Completed', 'Sale {{order_number}} completed for {{amount}}', '["order_number", "amount", "items", "cashier"]'),
  ('sale.voided', 'Sale was voided', 'sales', '{in_app,push}', 'Sale Voided', 'Sale {{order_number}} was voided by {{cashier}}', '["order_number", "cashier", "reason"]'),
  ('stock.low', 'Low stock alert', 'inventory', '{in_app,email,push}', 'Low Stock Alert', 'Product {{product_name}} is running low. Current stock: {{current_stock}}', '["product_name", "current_stock", "reorder_level", "branch"]'),
  ('stock.out', 'Out of stock alert', 'inventory', '{in_app,email,push}', 'Out of Stock', 'Product {{product_name}} is out of stock', '["product_name", "branch"]'),
  ('expense.approved', 'Expense approved', 'finance', '{in_app,push}', 'Expense Approved', 'Expense of {{amount}} has been approved', '["amount", "description", "approved_by"]'),
  ('expense.rejected', 'Expense rejected', 'finance', '{in_app,push}', 'Expense Rejected', 'Expense of {{amount}} has been rejected', '["amount", "description", "reason"]'),
  ('payroll.processed', 'Payroll processed', 'workforce', '{in_app,email}', 'Payroll Processed', 'Your payslip for {{period}} is ready', '["period", "net_pay"]'),
  ('order.created', 'New online order', 'sales', '{in_app,email,push}', 'New Order', 'New order {{order_number}} for {{amount}}', '["order_number", "amount", "customer"]'),
  ('shift.reminder', 'Shift reminder', 'workforce', '{in_app,push}', 'Shift Reminder', 'Your shift starts in {{minutes}} minutes', '["minutes", "shift_time"]'),
  ('backup.completed', 'Backup completed', 'system', '{in_app}', 'Backup Complete', 'System backup completed successfully', '["timestamp", "size"]');
