CREATE TABLE IF NOT EXISTS invoice_match_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  receipt_item_id UUID REFERENCES purchase_receipt_items(id) ON DELETE SET NULL,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  quantity_invoiced INTEGER NOT NULL DEFAULT 0,
  quantity_matched INTEGER NOT NULL DEFAULT 0,
  price_ordered INTEGER NOT NULL DEFAULT 0,
  price_received INTEGER NOT NULL DEFAULT 0,
  price_invoiced INTEGER NOT NULL DEFAULT 0,
  match_status TEXT NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending', 'matched', 'quantity_discrepancy', 'price_discrepancy', 'unmatched')),
  discrepancy_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_match_invoice ON invoice_match_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_match_po_item ON invoice_match_items(po_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_match_status ON invoice_match_items(match_status);

ALTER TABLE invoice_match_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read invoice_match_items"
  ON invoice_match_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and managers can manage invoice_match_items"
  ON invoice_match_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'manager')
      AND users.status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION update_invoice_match_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_match_updated_at
  BEFORE UPDATE ON invoice_match_items
  FOR EACH ROW EXECUTE FUNCTION update_invoice_match_updated_at();
