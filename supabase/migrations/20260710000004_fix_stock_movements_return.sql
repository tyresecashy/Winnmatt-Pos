-- Add 'return' to stock_movements type check constraint
-- The supplier returns flow creates stock movements with type 'return'

DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_movements_type_check'
    AND conrelid = 'stock_movements'::regclass
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_type_check;
  END IF;
END $$;

-- Re-add with 'return' included
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('sale', 'receipt', 'transfer', 'adjustment', 'damage', 'reversal', 'return'));
