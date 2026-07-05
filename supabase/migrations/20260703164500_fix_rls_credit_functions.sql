-- ============================================================================
-- Fix RLS bypass for credit_payment trigger and add update_customer_balance RPC
-- The customers table has RLS with only SELECT policy, so trigger functions
-- must use SECURITY DEFINER to UPDATE customers.
-- ============================================================================

-- ── 1. Recreate trigger function with SECURITY DEFINER ─────────────────────

CREATE OR REPLACE FUNCTION update_credit_balance_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.customers
  SET credit_balance = GREATEST(0, credit_balance - NEW.amount_cents)
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

-- ── 2. RPC: update customer credit balance (used as fallback from server actions) ──

CREATE OR REPLACE FUNCTION update_customer_credit_balance(
  p_customer_id UUID,
  p_amount_cents INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.customers
  SET credit_balance = GREATEST(0, credit_balance - p_amount_cents)
  WHERE id = p_customer_id;
END;
$$;
