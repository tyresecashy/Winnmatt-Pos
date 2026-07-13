-- PO Attachments: file metadata for documents linked to purchase orders
CREATE TABLE IF NOT EXISTS po_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_attachments_po ON po_attachments(purchase_order_id);

ALTER TABLE po_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read po_attachments"
  ON po_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and managers can insert po_attachments"
  ON po_attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'manager')
      AND users.status = 'active'
    )
  );

CREATE POLICY "Admin and managers can delete po_attachments"
  ON po_attachments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'manager')
      AND users.status = 'active'
    )
  );
