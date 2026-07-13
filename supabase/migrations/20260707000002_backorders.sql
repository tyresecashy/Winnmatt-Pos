ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS backorder_parent_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS backorder_quantity INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_po_items_backorder_parent ON purchase_order_items(backorder_parent_item_id)
  WHERE backorder_parent_item_id IS NOT NULL;
