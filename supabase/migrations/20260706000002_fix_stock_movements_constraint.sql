-- Migration: Add 'reversal' to stock_movements type CHECK constraint
-- Void sale and return workflows need this movement type for inventory reversals.

-- First try to find and drop the existing CHECK constraint on the type column
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'stock_movements'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%type%IN%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE stock_movements DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END IF;
END $$;

-- Re-add the constraint with 'reversal' included (if the type column still exists)
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN ('sale', 'receipt', 'transfer', 'adjustment', 'damage', 'reversal'));
