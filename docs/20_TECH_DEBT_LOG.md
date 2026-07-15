# WINNMATT POS — Technical Debt Log

**ID:** D-20
**author:** OpenWork
**verified_by:** User
**verification_status:** Verified (Phase 2)
**last_verified:** 2026-07-15
**confidence:** High
**stable_id:** D-20

**@see** [19_ACTIVE_BUGS.md](19_ACTIVE_BUGS.md) (bug-adjacent debt) · [18_TESTING.md](18_TESTING.md) (test coverage gaps) · [17_SECURITY.md](17_SECURITY.md) (security gaps) · [15_ROADMAP.md](15_ROADMAP.md) (debt reduction phases)

---

## Purpose

This document tracks all known technical debt in the WINNMATT POS system. Items are categorized by domain, severity, and estimated effort.

**Rules:**
- Append-only — never delete entries; resolved items become tombstones
- Each item has a unique prefix: TD-### (range 001–999)
- Effort: S (≤2h), M (2h–1d), L (1–3d), XL (3–5d), XXL (1–2w)

---

## Tech Debt Inventory

### TD-001: 296 `as unknown` Double-Casts Across 100+ Files

| Field | Value |
|-------|-------|
| **Domain** | TypeScript / Supabase |
| **Severity** | 🟡 Medium |
| **Effort** | L (1–3 days) |
| **Status** | Open |
| **File count** | ~100 files |
| **Root cause** | Supabase types (`lib/database.types.ts`) are stale — generated from an older schema. The actual DB has ~147 tables, but the types file reflects an earlier state. Developers work around mismatches with `as unknown as T`. |
| **Impact** | Type safety is compromised. Refactoring database queries is riskier than it should be. New developers are confused by the pattern. |
| **Fix** | `supabase gen types typescript --local > lib/database.types.ts` then fix any new type errors. Repeat after every migration. |
| **Automated prevention** | Add `supabase gen types` to the migration workflow in `package.json` or a git hook |
| **@see** | B-005 (same root cause) |

---

### TD-002: 18 Silent `.catch(() => {})` Without Logging

| Field | Value |
|-------|-------|
| **Domain** | Error Handling |
| **Severity** | 🟡 Medium |
| **Effort** | M (2h–1d) |
| **Status** | Open |
| **Locations** | `repository.ts` (6x), `lock-manager.ts` (1x), `_redis.ts` (3x), `scheduler.ts` (1x), auth-context (1x), payment-panel (1x), branch-switcher (1x), accounts-receivable (2x), loyalty (1x), pos/page.tsx (1x) |
| **Impact** | Critical async failures in lock management, Redis, and scheduler are silently discarded. When things break, there is no diagnostic trail. |
| **Fix** | Replace with `logger.error(...)` at minimum; consider error propagation for lock/release mismatches |
| **@see** | B-006 |

---

### TD-003: 14 `console.*` Calls Instead of Structured Logger

| Field | Value |
|-------|-------|
| **Domain** | Logging |
| **Severity** | 🔵 Low |
| **Effort** | S (≤2h) |
| **Status** | Open |
| **Locations** | 14 files including PWA, mobile receipt, global search, AI actions, enterprise test data |
| **Impact** | PII not redacted through these paths; inconsistent format; missing structured context |
| **Fix** | Replace `console.error`/`console.warn` with `logger.error`/`logger.warn` |
| **@see** | B-007 |

---

### TD-004: 4 Module Bypass Files Still Direct-Importing Actions

| Field | Value |
|-------|-------|
| **Domain** | Architecture / Module Boundary |
| **Severity** | 🟡 Medium |
| **Effort** | M (2h–1d) |
| **Status** | Open |
| **Files** | `app/(dashboard)/branch-dashboard/page.tsx`, `app/(dashboard)/product-intelligence/page.tsx`, `app/(dashboard)/supplier-portal/page.tsx`, `app/(dashboard)/webhooks/page.tsx` |
| **Impact** | These components bypass the module adapter layer, importing directly from `@/lib/multi-branch/branch-service`, `@/lib/product-intelligence-actions`, `@/lib/supplier-portal/supplier-service`, `@/lib/webhook-service`. Violates the C-003 module migration ADR. |
| **Fix** | Create adapters or integrate into existing modules; rewire imports |
| **@see** | C-003, D-03 §Adapter Status |

---

### TD-005: 14 Modules Without Unit Test Coverage

| Field | Value |
|-------|-------|
| **Domain** | Testing |
| **Severity** | 🟡 Medium |
| **Effort** | XL (3–5 days) |
| **Status** | Open |
| **Untested modules** | M-01 Automation, M-02 Branches, M-03 Cash, M-04 Core, M-05 CRM, M-07 Dashboard, M-08 Devices, M-09 Enterprise, M-13 Procurement, M-16 Reports, M-18 Security, M-20 System, M-22 Transfers, M-24 Warehouse |
| **Impact** | 14 of 25 modules have zero module-level test coverage. Changes to these modules rely entirely on build-time TypeScript validation. |
| **Fix** | Add Vitest test suites following patterns in `tests/modules/sales.test.ts` |
| **@see** | D-12 §Coverage Gaps |

---

### TD-006: 18 `as any` Casts in Test Files

| Field | Value |
|-------|-------|
| **Domain** | Testing / TypeScript |
| **Severity** | 🔵 Low |
| **Effort** | S (≤2h) |
| **Status** | Open |
| **Locations** | `tests/modules/purchases.test.ts` (4), `tests/modules/expenses.test.ts` (4), `tests/modules/suppliers/repository.test.ts` (3), `tests/modules/tax.test.ts` (2), `tests/modules/purchases/repository.test.ts` (2), `tests/modules/expenses/repository.test.ts` (2), `tests/modules/tax/repository.test.ts` (1) |
| **Impact** | Test type assertions are not type-safe. If interfaces change, tests may compile but test wrong things. |
| **Fix** | Replace `as any` with proper type-assertion helpers or factory functions |

---

### TD-007: 14 `eslint-disable` Comments

| Field | Value |
|-------|-------|
| **Domain** | Code Quality |
| **Severity** | 🔵 Low |
| **Effort** | S (≤2h) |
| **Status** | Open |
| **By rule** | `react-hooks/exhaustive-deps` (8x), `@typescript-eslint/no-explicit-any` (4x), `no-console` (2x: 1 justified in logger.ts, 1 in archived mobile app) |
| **Impact** | Disabled eslint rules represent code that may have subtle bugs (missing deps) or type safety gaps (`no-explicit-any`). |
| **Fix** | Fix the underlying issues: add missing deps, type the `any` values properly |

---

### TD-008: No Root-Level Middleware (C-011)

| Field | Value |
|-------|-------|
| **Domain** | Auth / Architecture |
| **Severity** | 🟠 High |
| **Effort** | M (2h–1d) |
| **Status** | Open |
| **Impact** | No centralized auth redirect, session refresh, or route protection at the Next.js middleware level. Each route must independently handle auth. |
| **Fix** | Implement `middleware.ts` at project root (C-011 Proposed → Accepted) |
| **@see** | C-011, D-01 §2.2 |

---

### TD-009: No React Suspense Boundaries

| Field | Value |
|-------|-------|
| **Domain** | UX / Performance |
| **Severity** | 🟡 Medium |
| **Effort** | M (2h–1d) |
| **Status** | Open |
| **Impact** | Data-fetching pages block rendering without fallback UI. Users may see blank/loading screens when data is slow. |
| **Fix** | Wrap data-fetching page sections in `<Suspense>` with meaningful fallbacks |
| **@see** | D-18 §Caching Gaps |

---

### TD-010: Event Definitions Drift — 26 Declared But Never Emitted

| Field | Value |
|-------|-------|
| **Domain** | Events / Automation |
| **Severity** | 🔵 Low |
| **Effort** | M (2h–1d) |
| **Status** | Open |
| **Impact** | 26 of 43 declared bus events are never actively emitted. The `ALL_EVENTS` array in `lib/modules/automation/index.ts` contains event types that cannot trigger any rule. Dead logic. |
| **Fix** | Audit `ALL_EVENTS`; remove dead event types; wire emit calls for useful ones (especially stock events) |
| **@see** | D-11 §Known Issues |

---

### TD-011: Duplicate Event Name — `price.changed` / `product.price_changed`

| Field | Value |
|-------|-------|
| **Domain** | Events / Automation |
| **Severity** | 🔵 Low |
| **Effort** | S (≤2h) |
| **Status** | Open |
| **Impact** | Two different event type strings represent the same concept. Automation rules using one will not trigger when the other is emitted (though neither is currently emitted). |
| **Fix** | Pick one (`product.price_changed`) and remove the other |
| **@see** | D-11 §Known Issues |

---

### TD-012: Archived Mobile App — 11 `@ts-nocheck` Files

| Field | Value |
|-------|-------|
| **Domain** | Archive |
| **Severity** | 🔵 Low |
| **Effort** | S (≤2h) |
| **Status** | Open |
| **Impact** | The archived mobile app at `db/archived/mobile-app/` contains 11 TypeScript files with `@ts-nocheck`. These files are excluded from the build but consume disk space and confuse code search. |
| **Fix** | Consider removing entirely (they're safely archived in git history at commit `9fad2cb`) |

---

### TD-013: No GitHub CI/CD Templates

| Field | Value |
|-------|-------|
| **Domain** | DevOps |
| **Severity** | 🟡 Medium |
| **Effort** | M (2h–1d) |
| **Status** | Open |
| **Impact** | No `.github/` directory — no issue templates, PR templates, CI workflows, or automated checks on disk. CI references exist only in commit history. |
| **Fix** | Create `.github/` with issue templates, PR template, and CI workflow matching the patterns in Vercel docs |

---

### TD-014: Stale README.md Content

| Field | Value |
|-------|-------|
| **Domain** | Documentation |
| **Severity** | 🔵 Low |
| **Effort** | S (≤2h) |
| **Status** | Open |
| **Impact** | README.md says "12 core tables" (actual: ~147 tables across 40+ migrations). Outdated project structure description. |
| **Fix** | Regenerate README.md content to reflect actual schema size |

---

## Debt by Domain

| Domain | Items | Total Effort |
|--------|-------|-------------|
| TypeScript / Supabase | 2 (TD-001, TD-006) | L + S |
| Error Handling | 2 (TD-002, TD-003) | M + S |
| Architecture | 2 (TD-004, TD-008) | M + M |
| Testing | 1 (TD-005) | XL |
| Code Quality | 1 (TD-007) | S |
| Performance | 1 (TD-009) | M |
| Events / Automation | 2 (TD-010, TD-011) | M + S |
| Archive | 1 (TD-012) | S |
| DevOps | 1 (TD-013) | M |
| Documentation | 1 (TD-014) | S |

## Debt Summary

| Metric | Value |
|--------|-------|
| Total items | 14 |
| 🟠 High | 1 (TD-008) |
| 🟡 Medium | 8 |
| 🔵 Low | 5 |
| Estimated total effort | ~8–15 days |
| Files affected | ~140+ files |
| Cost of delay (weekly) | Compound — each week the `as unknown` pattern spreads and middleware delay deepens |

## Priority Order

1. **TD-008** (Root middleware) — architecture gap, security risk
2. **TD-004** (Module bypasses) — architecture drift, 4 files
3. **TD-001** (Supabase types) — highest line count, enables safe refactoring
4. **TD-002** (Silent catches) — invisible production risk
5. **TD-005** (Test gaps) — risk mitigation for 14 modules
6. Remaining low-priority items

---

*D-20 — Phase 2 — 2026-07-15*
