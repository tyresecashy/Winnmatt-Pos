-- Create health_check table for the /api/health endpoint
-- This table was missing from the database, causing the health endpoint to return 503.
-- Created manually via Supabase Management API on 2026-07-13.

CREATE TABLE IF NOT EXISTS public.health_check (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant access to service_role (supabaseAdmin)
GRANT ALL ON public.health_check TO service_role;
GRANT ALL ON public.health_check TO authenticated;
GRANT USAGE ON SEQUENCE public.health_check_id_seq TO service_role;

-- Enable RLS with a policy that allows service_role and authenticated users
ALTER TABLE public.health_check ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can do everything" ON public.health_check
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated can select" ON public.health_check
  FOR SELECT
  TO authenticated
  USING (true);
