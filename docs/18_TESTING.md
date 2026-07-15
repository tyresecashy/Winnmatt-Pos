# WINNMATT POS — Testing Strategy

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: High
stable_id: D-12
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) · [04_MODULE_MAP.md](04_MODULE_MAP.md) (module test coverage) · `AGENTS.md` (Sprint 7 test additions) · `PRODUCTION_READINESS_CHECKLIST.md`

---

## Executive Summary

WINNMATT POS uses **Vitest** with **jsdom** for unit and module-level testing. The test suite has grown from initial Sprint-level tests (59 tests) to **29 test files with 517+ tests** covering modules, CSV utilities, tax calculations, and API schemas. No integration, E2E, or visual regression tests exist.

**Test command:** `npm run test` / `npm run test:run`  
**CI:** Tests run as part of Vercel build pipeline (pre-deploy)

---

## Test Inventory

### Module Tests (17 files, 14 modules)

| Test File | Module | Approx. Tests |
|-----------|--------|--------------|
| `tests/modules/automation.test.ts` | M-01 | ~30 |
| `tests/modules/branches/` | M-02 | ~20 |
| `tests/modules/customers/` | M-06 | ~35 |
| `tests/modules/devices/` | M-08 | ~15 |
| `tests/modules/expenses.test.ts` + `expenses/` | M-10 | ~30 |
| `tests/modules/finance/` | M-11 | ~40 |
| `tests/modules/inventory/` | M-12 | ~50 |
| `tests/modules/purchases.test.ts` + `purchases/` | M-13, M-15 | ~40 |
| `tests/modules/sales/` | M-17 | ~50 |
| `tests/modules/security/` | M-18 | ~20 |
| `tests/modules/suppliers.test.ts` + `suppliers/` | M-19 | ~30 |
| `tests/modules/tax.test.ts` + `tax/` | M-21 | ~30 |
| `tests/modules/transfers/` | M-22 | ~25 |
| `tests/modules/warehouse/` | M-23 | ~20 |
| `tests/modules/workforce.test.ts` | M-24 | ~25 |

### Standalone Tests (7 files)

| Test File | Purpose | Approx. Tests |
|-----------|---------|--------------|
| `tests/api-schemas.test.ts` | API input validation schemas | ~20 |
| `tests/csv-escape.test.ts` | CSV export escaping | ~15 |
| `tests/currency.test.ts` | Currency formatting/calculation | ~20 |
| `tests/purchase-order-actions.test.ts` | PO action integration | ~30 |
| `tests/setup.ts` | Test bootstrap (Vitest config) | — |
| `tests/tax-utils.test.ts` | Tax calculation utilities | ~15 |
| `tests/procurement.test.ts` | Procurement module | ~15 |

### Additional Verification

| File | Type | Purpose |
|------|------|---------|
| `tests/pilot-verification.mjs` | Node.js script | Manual environment verification |

---

## Testing Patterns

### Test Setup
- Vitest configuration in `vitest.config.ts` (or equivalent)
- jsdom environment for DOM-dependent tests
- Mocked Supabase client for module tests
- Isolated tests — no shared state between test files

### What's Tested
- Module adapter functions at the unit level
- Domain logic (tax calc, currency, CSV escape)
- API input schema validation
- CRUD operations per module (with mocked DB)
- Edge cases (empty results, invalid input, boundary values)

### What's NOT Tested
- **Integration tests** — No tests that exercise the full stack (UI → action → DB)
- **E2E tests** — No Playwright, Cypress, or browser-level tests
- **Visual regression tests** — No Chromatic/Percy snapshots
- **API route tests** — No tests for `app/api/**/route.ts` handlers
- **UI component tests** — No React Testing Library component tests
- **Performance tests** — No load/stress tests
- **Security tests** — No auth bypass, XSS, or injection tests

---

## Module Test Coverage Gap

| Module | Has Tests? | Priority for Coverage |
|--------|-----------|----------------------|
| M-00 AI | ❌ | Medium |
| M-01 Automation | ✅ | — |
| M-02 Branches | ✅ | — |
| M-03 Cash | ❌ | Medium |
| M-05 CRM | ❌ | Low |
| M-06 Customers | ✅ | — |
| M-07 Dashboard | ❌ | Low |
| M-08 Devices | ✅ | — |
| M-09 Enterprise | ❌ | Low (12 sub-modules, zero tests) |
| M-10 Expenses | ✅ | — |
| M-11 Finance | ✅ | — |
| M-12 Inventory | ✅ | — |
| M-13 Procurement | ✅ | — |
| M-14 Promotions | ❌ | Low |
| M-15 Purchases | ✅ | — |
| M-16 Reports | ❌ | Low |
| M-17 Sales | ✅ | — |
| M-18 Security | ✅ | — |
| M-19 Suppliers | ✅ | — |
| M-20 System | ❌ | Low |
| M-21 Tax | ✅ | — |
| M-22 Transfers | ✅ | — |
| M-23 Warehouse | ✅ | — |
| M-24 Workforce | ✅ | — |

---

## Known Limitations

1. **No E2E tests** — The biggest gap. No browser-level test covers critical flows (sale completion, shift open/close, product CRUD).
2. **No integration tests** — Tests mock the DB layer, so real DB interactions are untested.
3. **14 modules tested / 11 untested** — AI, Cash, CRM, Dashboard, Enterprise, Promotions, Reports, Security, System need coverage.
4. **No test for Stripe/M-Pesa webhooks** — Payment callback handlers have zero tests.
5. **No test for SSE/event bus** — Real-time event streaming untested.
6. **No CI integration** — Tests run manually; not enforced in CI pre-merge.
7. **Enterprise module gap** — 12 sub-directories with zero test files.

---

## Future Direction

1. Add E2E tests with Playwright for critical flows (sale + payment + shift close)
2. Add integration tests with test Supabase instance
3. Add tests for remaining 11 untested modules
4. Add webhook handler tests (Stripe, M-Pesa callbacks)
5. Add CI gate — `npm run test` must pass before merge
6. Add component tests with React Testing Library
7. Add API route tests (`app/api/**` handlers)
