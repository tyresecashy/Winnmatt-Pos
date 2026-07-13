-- WINNMATT Retail OS: Super Admin Role Migration
-- Run this in Supabase SQL Editor
-- Adds super_admin role support, extends branches with rich profile fields

BEGIN;

-- ============================================================================
-- Step 1: Drop the old owner role check constraint if it exists
-- ============================================================================
-- The users table likely doesn't have a CHECK constraint on role column
-- since it was set by application logic. We just need to ensure the DB
-- accepts the new role value. If there IS a check constraint, drop and recreate:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    -- Check if there's a check constraint on the role column
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'users'
        AND cc.check_clause LIKE '%role%'
    ) THEN
      -- Drop the constraint (PostgreSQL generates names like users_role_check)
      EXECUTE (
        SELECT 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(c.constraint_name)
        FROM information_schema.table_constraints c
        JOIN information_schema.check_constraints cc ON c.constraint_name = cc.constraint_name
        WHERE c.table_name = 'users' AND c.constraint_schema = 'public'
          AND cc.check_clause LIKE '%role%'
        LIMIT 1
      );
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Step 2: Add extended columns to branches table
-- ============================================================================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS open_time TEXT DEFAULT '08:00';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS close_time TEXT DEFAULT '20:00';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Nairobi';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'branch'
  CHECK (type IN ('main', 'branch', 'warehouse'));
ALTER TABLE branches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));
ALTER TABLE branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- Step 3: Add updated_at trigger for branches
-- ============================================================================
CREATE OR REPLACE FUNCTION update_branches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS branches_updated_at_trigger ON branches;
CREATE TRIGGER branches_updated_at_trigger
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branches_updated_at();

-- ============================================================================
-- Step 4: Ensure super_admin role values work in existing data
-- Note: If users already have 'super_admin' set, this preserves them.
-- If they have 'owner', we optionally migrate them:
-- ============================================================================
-- Uncomment the following to migrate existing 'owner' users to 'super_admin':
-- UPDATE users SET role = 'super_admin' WHERE role = 'owner';

-- ============================================================================
-- Step 5: Add index for faster role-based queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);
CREATE INDEX IF NOT EXISTS idx_branches_manager ON branches(manager_id);

COMMIT;
