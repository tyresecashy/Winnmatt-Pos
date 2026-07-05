-- ============================================================
-- Phase 5.2: Automation Engine — Core Tables
-- ============================================================

-- 1. Automation Rules (master table)
CREATE TABLE IF NOT EXISTS automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  priority      INT DEFAULT 0,
  cooldown_ms   INT DEFAULT 0,
  max_daily     INT,
  trigger_event TEXT NOT NULL,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rules_event ON automation_rules(trigger_event, is_active);
CREATE INDEX idx_rules_priority ON automation_rules(priority DESC);

-- 2. Automation Conditions (tree-based AND/OR/NOT)
CREATE TABLE IF NOT EXISTS automation_conditions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES automation_conditions(id) ON DELETE CASCADE,
  logic_gate    TEXT DEFAULT 'AND' CHECK (logic_gate IN ('AND','OR','NOT','LEAF')),
  field         TEXT,
  operator      TEXT CHECK (operator IN ('=','!=','>','<','>=','<=','IN','NOT_IN','CONTAINS','NOT_CONTAINS','EXISTS','NOT_EXISTS')),
  value         TEXT,
  sort_order    INT DEFAULT 0
);

CREATE INDEX idx_conditions_rule ON automation_conditions(rule_id);

-- 3. Automation Actions (ordered per rule)
CREATE TABLE IF NOT EXISTS automation_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  action_type   TEXT NOT NULL,
  params        JSONB DEFAULT '{}',
  sort_order    INT DEFAULT 0,
  is_async      BOOLEAN DEFAULT false
);

CREATE INDEX idx_actions_rule ON automation_actions(rule_id);

-- 4. Automation Events (append-only event log)
CREATE TABLE IF NOT EXISTS automation_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'app',
  entity_type   TEXT,
  entity_id     UUID,
  payload       JSONB NOT NULL DEFAULT '{}',
  processed     BOOLEAN DEFAULT false,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_type ON automation_events(event_type, processed, created_at DESC);
CREATE INDEX idx_events_entity ON automation_events(entity_type, entity_id);

-- 5. Automation Logs (action execution audit trail)
CREATE TABLE IF NOT EXISTS automation_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  event_id      UUID REFERENCES automation_events(id) ON DELETE SET NULL,
  action_type   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('success','failed','skipped')),
  error_msg     TEXT,
  duration_ms   INT,
  input         JSONB,
  output        JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_rule ON automation_logs(rule_id, created_at DESC);
CREATE INDEX idx_logs_status ON automation_logs(status, created_at DESC);

-- 6. Automation Schedules (cron/scheduled tasks)
CREATE TABLE IF NOT EXISTS automation_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily','weekly','monthly','cron')),
  schedule_expr TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  last_run      TIMESTAMPTZ,
  next_run      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_schedules_active ON automation_schedules(is_active, next_run);

-- RPC: Process an automation event (called from app code)
CREATE OR REPLACE FUNCTION process_automation_event(
  p_event_type TEXT,
  p_source TEXT DEFAULT 'app',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
  v_rule RECORD;
  v_condition RECORD;
  v_action RECORD;
  v_match BOOLEAN;
  v_cooldown_ok BOOLEAN;
  v_daily_count INT;
  v_start TIMESTAMPTZ;
BEGIN
  -- 1. Log the event
  INSERT INTO public.automation_events (event_type, source, entity_type, entity_id, payload)
  VALUES (p_event_type, p_source, p_entity_type, p_entity_id, p_payload)
  RETURNING id INTO v_event_id;

  -- 2. Find matching active rules
  FOR v_rule IN
    SELECT * FROM public.automation_rules
    WHERE trigger_event = p_event_type AND is_active = true
    ORDER BY priority DESC
  LOOP
    -- Check cooldown
    v_cooldown_ok := true;
    IF v_rule.cooldown_ms > 0 THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.automation_logs
        WHERE rule_id = v_rule.id AND status = 'success'
          AND created_at > now() - (v_rule.cooldown_ms || ' milliseconds')::interval
      ) INTO v_cooldown_ok;
    END IF;
    IF NOT v_cooldown_ok THEN CONTINUE; END IF;

    -- Check daily limit
    IF v_rule.max_daily IS NOT NULL THEN
      SELECT COUNT(*) INTO v_daily_count
      FROM public.automation_logs
      WHERE rule_id = v_rule.id AND status = 'success'
        AND created_at > date_trunc('day', now());
      IF v_daily_count >= v_rule.max_daily THEN CONTINUE; END IF;
    END IF;

    -- Evaluate conditions (simplified: all LEAF conditions ANDed at root)
    v_match := true;
    FOR v_condition IN
      SELECT * FROM public.automation_conditions
      WHERE rule_id = v_rule.id AND parent_id IS NULL
      ORDER BY sort_order
    LOOP
      IF v_condition.logic_gate = 'LEAF' THEN
        -- Simple field comparison against payload
        IF v_condition.field IS NOT NULL THEN
          DECLARE
            v_actual TEXT;
            v_expected TEXT := v_condition.value;
          BEGIN
            v_actual := p_payload ->> v_condition.field;
            IF v_condition.operator = '=' AND v_actual IS DISTINCT FROM v_expected THEN v_match := false; END IF;
            IF v_condition.operator = '!=' AND v_actual IS NOT DISTINCT FROM v_expected THEN v_match := false; END IF;
            IF v_condition.operator = '>' AND (v_actual::numeric) <= (v_expected::numeric) THEN v_match := false; END IF;
            IF v_condition.operator = '<' AND (v_actual::numeric) >= (v_expected::numeric) THEN v_match := false; END IF;
            IF v_condition.operator = '>=' AND (v_actual::numeric) < (v_expected::numeric) THEN v_match := false; END IF;
            IF v_condition.operator = '<=' AND (v_actual::numeric) > (v_expected::numeric) THEN v_match := false; END IF;
            IF v_condition.operator = 'EXISTS' AND v_actual IS NULL THEN v_match := false; END IF;
            IF v_condition.operator = 'NOT_EXISTS' AND v_actual IS NOT NULL THEN v_match := false; END IF;
          EXCEPTION WHEN OTHERS THEN
            v_match := false;
          END;
        END IF;
      END IF;
      EXIT WHEN NOT v_match;
    END LOOP;

    -- Execute actions if conditions matched
    IF v_match THEN
      v_start := clock_timestamp();
      FOR v_action IN
        SELECT * FROM public.automation_actions
        WHERE rule_id = v_rule.id
        ORDER BY sort_order
      LOOP
        -- Log action execution
        INSERT INTO public.automation_logs (rule_id, event_id, action_type, status, duration_ms, input)
        VALUES (
          v_rule.id, v_event_id, v_action.action_type, 'success',
          EXTRACT(EPOCH FROM clock_timestamp() - v_start)::int * 1000,
          jsonb_build_object('params', v_action.params, 'payload', p_payload)
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Mark event as processed
  UPDATE public.automation_events SET processed = true, processed_at = now() WHERE id = v_event_id;

  RETURN v_event_id;
END;
$$;

-- RPC: Emit event from application code (lightweight wrapper)
CREATE OR REPLACE FUNCTION emit_automation_event(
  p_event_type TEXT,
  p_source TEXT DEFAULT 'app',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Fire and forget: insert event, trigger will process it async
  RETURN public.process_automation_event(p_event_type, p_source, p_entity_type, p_entity_id, p_payload);
END;
$$;

-- Seed 10 pre-built automation rules
INSERT INTO automation_rules (name, description, trigger_event, priority, cooldown_ms, is_active) VALUES
  ('Low Stock Alert', 'Notify manager when product stock is at or below reorder level', 'stock.low', 10, 3600000, true),
  ('Out of Stock Emergency', 'Critical alert when product is completely out of stock', 'stock.out', 20, 7200000, true),
  ('High-Value Sale Review', 'Flag sales over KSh 50,000 for admin review', 'sale.completed', 5, 0, true),
  ('Cash Variance Alert', 'Alert when cash drawer variance exceeds KSh 500', 'shift.closed', 15, 0, true),
  ('New Customer Welcome', 'Welcome new loyalty members with 100 bonus points', 'customer.created', 1, 0, true),
  ('Sale Completed Log', 'Log every completed sale for audit trail', 'sale.completed', 0, 0, true),
  ('Shift Opened Log', 'Log every shift open event', 'shift.opened', 0, 0, true),
  ('Shift Closed Log', 'Log every shift close event', 'shift.closed', 0, 0, true),
  ('Return Processed', 'Log and alert on every return/refund', 'sale.returned', 5, 0, true),
  ('Product Price Changed', 'Log price changes for audit', 'price.changed', 0, 0, true);

-- Seed conditions for High-Value Sale Review (rule 3)
DO $$
DECLARE
  v_rule_id UUID;
BEGIN
  SELECT id INTO v_rule_id FROM automation_rules WHERE name = 'High-Value Sale Review';
  IF v_rule_id IS NOT NULL THEN
    INSERT INTO automation_conditions (rule_id, logic_gate, field, operator, value, sort_order)
    VALUES (v_rule_id, 'LEAF', 'total', '>', '50000', 1);
  END IF;

  -- Cash Variance: ABS(variance) > 500
  SELECT id INTO v_rule_id FROM automation_rules WHERE name = 'Cash Variance Alert';
  IF v_rule_id IS NOT NULL THEN
    INSERT INTO automation_conditions (rule_id, logic_gate, field, operator, value, sort_order)
    VALUES (v_rule_id, 'LEAF', 'variance', '>', '500', 1);
  END IF;
END $$;

-- Seed actions for each rule
DO $$
DECLARE
  v_rule RECORD;
BEGIN
  FOR v_rule IN SELECT id, name FROM automation_rules LOOP
    CASE v_rule.name
      WHEN 'Low Stock Alert' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'notify', '{"target":"role:admin","title":"Low Stock Alert","body":"Product {{product_name}} has only {{quantity}} units left at {{branch_name}}","severity":"warning","url":"/inventory"}', 1);
      WHEN 'Out of Stock Emergency' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'notify', '{"target":"role:admin","title":"OUT OF STOCK","body":"Product {{product_name}} is completely out of stock!","severity":"critical","url":"/inventory"}', 1);
      WHEN 'High-Value Sale Review' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'notify', '{"target":"role:admin","title":"High-Value Sale","body":"Sale {{receipt_no}} for KSh {{total}} requires review","severity":"warning","url":"/sales-history"}', 1),
          (v_rule.id, 'audit', '{"action":"flag_high_value_sale","entity_type":"sale"}', 2);
      WHEN 'Cash Variance Alert' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'notify', '{"target":"role:admin","title":"Cash Drawer Variance","body":"Shift at {{branch_name}} has variance of KSh {{variance}}","severity":"critical","url":"/registers"}', 1),
          (v_rule.id, 'audit', '{"action":"cash_variance_detected","entity_type":"shift"}', 2);
      WHEN 'New Customer Welcome' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'notify', '{"target":"customer","title":"Welcome to WINNMATT!","body":"Your loyalty account is active. Earn points with every purchase!","severity":"success"}', 1),
          (v_rule.id, 'audit', '{"action":"customer_registered","entity_type":"customer"}', 2);
      WHEN 'Sale Completed Log' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'audit', '{"action":"sale_completed","entity_type":"sale"}', 1);
      WHEN 'Shift Opened Log' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'audit', '{"action":"shift_opened","entity_type":"shift"}', 1);
      WHEN 'Shift Closed Log' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'audit', '{"action":"shift_closed","entity_type":"shift"}', 1);
      WHEN 'Return Processed' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'notify', '{"target":"role:manager","title":"Return Processed","body":"Return {{receipt_no}} for KSh {{refund_amount}}","severity":"warning","url":"/returns"}', 1),
          (v_rule.id, 'audit', '{"action":"return_processed","entity_type":"sale"}', 2);
      WHEN 'Product Price Changed' THEN
        INSERT INTO automation_actions (rule_id, action_type, params, sort_order) VALUES
          (v_rule.id, 'audit', '{"action":"price_changed","entity_type":"product"}', 1);
    END CASE;
  END LOOP;
END $$;

-- RLS policies
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_rules" ON automation_rules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_manage_conditions" ON automation_conditions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_manage_actions" ON automation_actions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "read_events" ON automation_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_events" ON automation_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "read_logs" ON automation_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_logs" ON automation_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "admin_manage_schedules" ON automation_schedules FOR ALL USING (auth.role() = 'authenticated');
