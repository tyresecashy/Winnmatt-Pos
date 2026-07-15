# WINNMATT POS — Active Bug Tracker

**ID:** D-19
**author:** OpenWork
**verified_by:** User
**verification_status:** Verified (Phase 2)
**last_verified:** 2026-07-15
**confidence:** High
**stable_id:** D-19

**@see** [17_SECURITY.md](17_SECURITY.md) (security gaps) · [22_RELEASE_PLAN.md](22_RELEASE_PLAN.md) (release gates) · [FINAL_PRODUCTION_SIGNOFF.md](../docs/FINAL_PRODUCTION_SIGNOFF.md) (production readiness) · [ID_REGISTRY.md](ID_REGISTRY.md) (B- bug IDs)

---

## Purpose

This document tracks all confirmed active bugs in the WINNMATT POS system. Bugs are filed here only after reproduction — transient build/CI issues go to the issue tracker, not here.

**Bug ID prefix:** B- (range 001–999)  
**@see** [ID_REGISTRY.md](ID_REGISTRY.md) §B-

---

## Bug Tracking Rules

1. **Confirm before filing** — reproduce the issue, document the steps
2. **One bug per entry** — if a single root cause affects multiple areas, file one entry with all affected components listed
3. **Never delete** — resolved bugs become tombstones with resolution notes
4. **Severity levels:**
   - 🔴 **Critical** — blocks production, data loss, security vulnerability
   - 🟠 **High** — major feature broken, significant UX degradation
   - 🟡 **Medium** — minor feature broken, edge case, cosmetic
   - 🔵 **Low** — nice-to-fix, enhancement-wrapped bug

---

## Active Bugs

### B-001: M-Pesa Sandbox Credentials Prevent Real Transactions

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Status** | Open |
| **Reported** | 2026-07-14 (Production Signoff) |
| **Affects** | Payment processing, POS checkout |
| **Root cause** | `.env.local` contains `MPESA_CONSUMER_KEY`/`MPESA_CONSUMER_SECRET` from sandbox only; `MPESA_PASSKEY` and `MPESA_CALLBACK_URL` are empty |
| **Impact** | All M-Pesa STK Push payments are simulated — no real money transactions possible |
| **Fix** | Obtain production M-Pesa API credentials from Safaricom; set `MPESA_PASSKEY`; configure `MPESA_CALLBACK_URL` to a publicly accessible HTTPS endpoint |
| **Workaround** | None — sandbox transactions are always accepted |
| **@see** | D-22 RC-1 Gate, FINAL_PRODUCTION_SIGNOFF.md |

---

### B-002: Stripe Test Keys Prevent Real Card Payments

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Status** | Open |
| **Reported** | 2026-07-14 (Production Signoff) |
| **Affects** | Payment processing, POS checkout |
| **Root cause** | `.env.local` contains `sk_test_...` Stripe keys; `STRIPE_WEBHOOK_SECRET` is empty |
| **Impact** | All Stripe card payments are simulated — no real charges possible; webhook verification fails |
| **Fix** | Obtain production Stripe API keys; set `STRIPE_WEBHOOK_SECRET` |
| **Workaround** | None |
| **@see** | D-22 RC-2 Gate |

---

### B-003: No Production Error Monitoring (Sentry DSN Not Set)

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Status** | Open |
| **Reported** | 2026-07-14 (Production Signoff) |
| **Affects** | All production deployments |
| **Root cause** | `SENTRY_DSN` environment variable is not configured |
| **Impact** | Zero visibility into production errors, crashes, and performance issues. When the app fails, there is no diagnostic data. |
| **Fix** | Set `SENTRY_DSN` from a Sentry project; also set `SENTRY_AUTH_TOKEN` for source map uploads |
| **Workaround** | None — no monitoring means blind production |
| **@see** | D-22 RC-3 Gate |

---

### B-004: `NEXT_PUBLIC_API_URL` Points to localhost

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Status** | Open |
| **Reported** | 2026-07-14 (Production Signoff) |
| **Affects** | All API calls in production |
| **Root cause** | `NEXT_PUBLIC_API_URL=http://localhost:3000` in `.env.local` |
| **Impact** | In production, API calls will attempt to reach `localhost:3000` instead of the deployed URL, breaking all client-server communication |
| **Fix** | Set `NEXT_PUBLIC_API_URL` to the production Vercel URL before deployment |
| **Workaround** | Override in Vercel project environment variables |
| **@see** | D-22 env var checklist |

---

### B-005: 296 `as unknown` Casts Mask Stale Supabase Types

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Status** | Open |
| **Reported** | 2026-07-15 (Phase 2 Audit) |
| **Affects** | 100+ files across all modules |
| **Root cause** | Supabase-generated TypeScript types are stale and do not match the actual database schema (~147 tables). The codebase works around this with the `as unknown as T` double-cast pattern. |
| **Impact** | Type safety is compromised — a type mismatch between the DB schema and TypeScript types will not be caught at compile time |
| **Fix** | Run `supabase gen types typescript --local > lib/database.types.ts` after every migration to regenerate types |
| **Workaround** | No runtime impact, but type-safe refactoring is impossible |
| **@see** | D-20 B-005 (Tech Debt) |

---

### B-006: 18 Silent `.catch(() => {})` Handlers

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Status** | Open |
| **Reported** | 2026-07-15 (Phase 2 Audit) |
| **Affects** | Lock management, Redis events, scheduler, JSON parsing in auth/pos/components |
| **Root cause** | `.catch(() => {})`, `.catch(() => null)`, `.catch(() => ({}))` patterns that swallow errors without logging |
| **Impact** | Failures in lock release, Redis connections, scheduler jobs, and JSON parsing are invisible — no logs, no diagnostics |
| **Affected files** | `lib/modules/core/repository.ts` (6x), `lib/modules/core/lock-manager.ts` (1x), `lib/realtime/_redis.ts` (3x), `lib/automation/scheduler.ts` (1x), `contexts/auth-context.tsx` (1x), `components/pos/payment-panel.tsx` (1x), `components/branch-switcher.tsx` (1x), `app/(dashboard)/accounts-receivable/[id]/page.tsx` (2x), `app/(dashboard)/loyalty/page.tsx` (1x), `app/(dashboard)/pos/page.tsx` (1x), `lib/supplier-invoices-actions.ts` (2x) |
| **Fix** | Replace each silent catch with `logger.error(...)` at minimum; propagate errors where appropriate |
| **Workaround** | None — failures are invisible |

---

### B-007: 14 `console.*` Calls Instead of `logger.*`

| Field | Value |
|-------|-------|
| **Severity** | 🔵 Low |
| **Status** | Open |
| **Reported** | 2026-07-15 (Phase 2 Audit) |
| **Affects** | PWA registration, mobile receipt, global search, AI actions, enterprise test data |
| **Root cause** | Some code paths still use `console.error`/`console.warn` directly instead of the structured `logger.*` API |
| **Impact** | PII not redacted in these paths; log format inconsistent; missing structured context |
| **Fix** | Replace `console.error`/`console.warn` with `logger.error`/`logger.warn` across 14 locations |
| **@see** | D-02 (Principles — structured logging) |

---

### B-008: Multiple `useIsMobile` Hook Definitions (Resolved — Phase 1A)

| Field | Value |
|-------|-------|
| **Severity** | 🟢 Resolved |
| **Status** | **Resolved** (Phase 1A — 2026-07-14) |
| **Affects** | All responsive components |
| **Root cause** | Three separate `useIsMobile`-named hooks existed in different locations |
| **Impact** | Inconsistent breakpoint behavior; maintenance confusion |
| **Resolution** | Consolidated to `hooks/use-mobile.ts` as canonical; deprecated re-exports created at other locations (pending cleanup) |
| **@see** | CLEANUP_REPORT.md §Deprecated hooks |

---

## Environment Configuration Status

| Variable | Value | Status | Bug |
|----------|-------|--------|-----|
| `MPESA_CONSUMER_KEY` | Sandbox only | ❌ Needs production | B-001 |
| `MPESA_CONSUMER_SECRET` | Sandbox only | ❌ Needs production | B-001 |
| `MPESA_PASSKEY` | Empty | ❌ Missing | B-001 |
| `MPESA_CALLBACK_URL` | Empty | ❌ Missing | B-001 |
| `STRIPE_SECRET_KEY` | `sk_test_...` | ❌ Needs production | B-002 |
| `STRIPE_WEBHOOK_SECRET` | Empty | ❌ Missing | B-002 |
| `SENTRY_DSN` | Empty | ❌ Missing | B-003 |
| `NEXT_PUBLIC_API_URL` | `localhost:3000` | ❌ Needs production | B-004 |
| `REDIS_URL` | Empty | ⚠️ Falls back to in-memory | B-009 |
| `RESEND_API_KEY` | Empty | ⚠️ Email log-only | — |
| `AFRICASTALKING_API_KEY` | Empty | ⚠️ SMS log-only | — |
| `AFRICASTALKING_USERNAME` | Empty | ⚠️ SMS log-only | — |
| `SENTRY_AUTH_TOKEN` | Empty | ⚠️ No source maps | B-003 |

---

## Bug Statistics

| Category | Count |
|----------|-------|
| 🔴 Critical (open) | 3 |
| 🟠 High (open) | 1 |
| 🟡 Medium (open) | 2 |
| 🔵 Low (open) | 1 |
| 🟢 Resolved | 1 |
| **Total active** | **7** |
| **Total resolved** | **1** |

---

*D-19 — Phase 2 — 2026-07-15*
