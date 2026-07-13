-- Migration: fix_bank_reconciliation
-- Ensures bank_reconciliations and bank_reconciliation_items tables exist
-- with the columns that lib/finance-actions.ts expects.

-- ── bank_reconciliations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  statement_balance INTEGER NOT NULL DEFAULT 0,
  books_balance INTEGER NOT NULL DEFAULT 0,
  difference INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account
  ON bank_reconciliations(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_status
  ON bank_reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_date
  ON bank_reconciliations(reconciliation_date);

-- ── bank_reconciliation_items ─────────────────────────────────────
-- Links bank transactions and journal entries to a reconciliation.
-- Note: Does NOT have a match_type column — the code's match_type field
-- has been removed to match this schema (see finance-actions.ts fix).
CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_rec_items_reconciliation
  ON bank_reconciliation_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_bank_rec_items_transaction
  ON bank_reconciliation_items(bank_transaction_id);
