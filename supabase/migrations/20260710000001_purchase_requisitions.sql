-- Wave 1.1: Purchase Requisitions
-- Enables a formal request→approval workflow before Purchase Orders are created

-- requester_id → who created the requisition
-- approver_id  → who approved/rejected it
-- supplier_id  → optional preferred supplier suggestion

CREATE SEQUENCE IF NOT EXISTS seq_purchase_requisitions START 1;

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_number    TEXT NOT NULL UNIQUE DEFAULT ('REQ-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('seq_purchase_requisitions')::TEXT, 4, '0')),
  branch_id             UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id           UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  requester_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
  rejection_reason      TEXT,
  notes                 TEXT,
  expected_date         DATE,
  urgency               TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_requisition_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id    UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_requested NUMERIC(12,2) NOT NULL CHECK (quantity_requested > 0),
  quantity_approved  NUMERIC(12,2),
  unit_price_estimate NUMERIC(12,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_req_branch      ON purchase_requisitions(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_req_status       ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_purchase_req_requester    ON purchase_requisitions(requester_id);
CREATE INDEX IF NOT EXISTS idx_purchase_req_supplier     ON purchase_requisitions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_req_items_req    ON purchase_requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_purchase_req_items_product ON purchase_requisition_items(product_id);

-- RLS
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisition_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own branch requisitions"
  ON purchase_requisitions FOR SELECT
  USING (
    branch_id IN (SELECT branch_id FROM users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Service role can manage requisitions"
  ON purchase_requisitions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update requisitions"
  ON purchase_requisitions FOR UPDATE
  USING (true);

CREATE POLICY "Users can view own requisition items"
  ON purchase_requisition_items FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage requisition items"
  ON purchase_requisition_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update requisition items"
  ON purchase_requisition_items FOR UPDATE
  USING (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_purchase_requisitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_requisitions_updated_at
  BEFORE UPDATE ON purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION update_purchase_requisitions_updated_at();
