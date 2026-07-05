ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_sale_status_check CHECK (sale_status IN ('completed', 'voided', 'returned', 'on_hold'));
CREATE INDEX IF NOT EXISTS idx_sales_held_sales ON sales(branch_id, cashier_id) WHERE sale_status = 'on_hold';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS hold_notes TEXT;

