# WINNMATT POS — Module Map

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: High
stable_id: D-03
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) (navigation map) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) (system architecture) · [ID_REGISTRY.md](ID_REGISTRY.md) (full ID registry)

---

## Executive Summary

The module layer (`lib/modules/*/`) is the domain isolation boundary for WINNMATT POS. Each module encapsulates a business domain with an `index.ts` adapter entry point, an optional `repository.ts` for data access, and optional `types.ts` for domain types. The module layer sits between the server actions and the Supabase client, providing a consistent interface for 26 modules (25 domain + 1 core).

**Status:** 🟡 26 modules defined, 10 with repository.ts, 16 with index.ts-only. Product Intelligence (M-25) added in Sprint 11A with full infrastructure but no business logic yet. Migration from direct `lib/*-actions.ts` calls to module adapter calls is in progress.

---

## Module Catalog

### Core Module (M-04)

| File | Purpose | Status |
|------|---------|--------|
| `index.ts` | Re-exports all core services | ✅ |
| `audit-engine.ts` | Audit log service | ✅ |
| `business-clock.ts` | Business date/time provider | ✅ |
| `correlation-id.ts` | Request tracing IDs | ✅ |
| `idempotency-manager.ts` | Idempotency guard for payments | ✅ |
| `identity-context.ts` | User/role context provider | ✅ |
| `lock-manager.ts` | Distributed lock (DB-based) | ✅ |
| `repository.ts` | Base repository with audit logging | ✅ |

The core module is the most mature — all 7 infrastructure files are implemented with proper interfaces.

### Domain Modules

| M-ID | Module | Directory | index.ts | repository.ts | types.ts | Test Coverage |
|------|--------|-----------|----------|---------------|----------|---------------|
| M-00 | AI | `lib/modules/ai/` | ✅ | — | — | ❌ |
| M-01 | Automation | `lib/modules/automation/` | ✅ | — | — | ❌ |
| M-02 | Branches | `lib/modules/branches/` | ✅ | ✅ | — | ✅ |
| M-03 | Cash | `lib/modules/cash/` | ✅ | — | — | ❌ |
| M-05 | CRM | `lib/modules/crm/` | ✅ | — | — | ❌ |
| M-06 | Customers | `lib/modules/customers/` | ✅ | ✅ | — | ✅ |
| M-07 | Dashboard | `lib/modules/dashboard/` | ✅ | — | — | ❌ |
| M-08 | Devices | `lib/modules/devices/` | ✅ | ✅ | — | ❌ |
| M-09 | Enterprise | `lib/modules/enterprise/` | ✅ | — | — | ❌ |
| M-10 | Expenses | `lib/modules/expenses/` | ✅ | ✅ | — | ✅ |
| M-11 | Finance | `lib/modules/finance/` | ✅ | ✅ | — | ✅ |
| M-12 | Inventory | `lib/modules/inventory/` | ✅ | ✅ | — | ✅ |
| M-13 | Procurement | `lib/modules/procurement/` | ✅ | — | — | ✅ |
| M-14 | Promotions | `lib/modules/promotions/` | ✅ | — | — | ❌ |
| M-15 | Purchases | `lib/modules/purchases/` | ✅ | ✅ | — | ✅ |
| M-16 | Reports | `lib/modules/reports/` | ✅ | — | — | ❌ |
| M-17 | Sales | `lib/modules/sales/` | ✅ | ✅ | — | ✅ |
| M-18 | Security | `lib/modules/security/` | ✅ | ✅ | — | ❌ |
| M-19 | Suppliers | `lib/modules/suppliers/` | ✅ | ✅ | — | ✅ |
| M-20 | System | `lib/modules/system/` | ✅ | — | — | ❌ |
| M-21 | Tax | `lib/modules/tax/` | ✅ | ✅ | ✅ | ✅ |
| M-22 | Transfers | `lib/modules/transfers/` | ✅ | ✅ | — | ✅ |
| M-23 | Warehouse | `lib/modules/warehouse/` | ✅ | ✅ | — | ✅ |
| M-24 | Workforce | `lib/modules/workforce/` | ✅ | — | — | ✅ |
| M-25 | Product Intelligence | `lib/modules/product-intelligence/` | ✅ | ✅ | ✅ | ✅ |

**Totals:** 26 modules · 11 with repository.ts · 2 with types.ts · 18 with test coverage

### Module Test Coverage

Located in `tests/modules/` (17 test files covering 14 modules):

| Test File | Module(s) Covered | Status |
|-----------|------------------|--------|
| `tests/modules/automation.test.ts` | M-01 | ✅ |
| `tests/modules/customers/` | M-06 | ✅ |
| `tests/modules/devices/` | M-08 | ✅ |
| `tests/modules/expenses.test.ts` + `expenses/` | M-10 | ✅ |
| `tests/modules/finance/` | M-11 | ✅ |
| `tests/modules/inventory/` | M-12 | ✅ |
| `tests/modules/purchases.test.ts` + `purchases/` | M-13, M-15 | ✅ |
| `tests/modules/sales/` | M-17 | ✅ |
| `tests/modules/security/` | M-18 | ✅ |
| `tests/modules/suppliers.test.ts` + `suppliers/` | M-19 | ✅ |
| `tests/modules/tax.test.ts` + `tax/` | M-21 | ✅ |
| `tests/modules/transfers/` | M-22 | ✅ |
| `tests/modules/warehouse/` | M-23 | ✅ |
| `tests/modules/branches/` | M-02 | ✅ |
| `tests/modules/workforce.test.ts` | M-24 | ✅ |
| `lib/modules/product-intelligence/__tests__/` | M-25 | ✅ |

---

## Module Adapter Pattern

Each module's `index.ts` follows a consistent adapter pattern:

```typescript
// lib/modules/sales/index.ts
import { completePaymentAction } from '@/lib/sales-actions'
import { createSaleWithContext } from '@/lib/sales-actions'

export async function createSale(params: CreateSaleParams, context: SaleContext) {
  // Delegate to underlying action, potentially with wrapper logic
  return createSaleWithContext(params, context)
}

export async function completePayment(saleId: string, paymentMethod: string) {
  return completePaymentAction(saleId, paymentMethod)
}
```

This pattern was established in Sprint 7 and expanded across all 25 modules in Sprint 10.

---

## Dependencies Between Modules

```
core (M-04) ──► all modules (audit, identity, correlation, locking)
  │
  ├──► sales (M-17) ──► inventory (M-12) ──► warehouse (M-23)
  │                  ──► customers (M-06)
  │                  ──► cash (M-03)
  │
  ├──► procurement (M-13) ──► suppliers (M-19)
  │                       ──► inventory (M-12)
  │                       ──► warehouse (M-23)
  │
  ├──► finance (M-11) ──► expenses (M-10)
  │                   ──► tax (M-21)
  │
  ├──► workforce (M-24) ──► attendance (via actions)
  │
  └──► enterprise (M-09) ──► all modules (read-cross-domain)
```

---

## Known Limitations

1. **Module bypass** — Some UI pages still import directly from `lib/*-actions.ts` instead of `lib/modules/*`. Phase 0/1A resolved the confirmed bypass in purchases; remaining ~41 files flagged.
2. **Thin adapters** — Most `index.ts` files are one-line delegations with no added business logic. The pattern is structural; business logic consolidation is deferred.
3. **No module-level error boundaries** — Errors are caught at the server action level, not the module adapter level.
4. **Event emission** — Not all module adapters emit events via the event bus. Event emission happens at the action file level.
5. **11 modules lack test coverage** — AI, Automation, Cash, CRM, Dashboard, Devices, Enterprise, Promotions, Reports, Security, System need test files.

---

## Future Direction

1. Complete module migration: all UI pages import from `lib/modules/*` (Phase 1C)
2. Consolidate business logic from action files into module adapters
3. Add module-level error boundaries and event emission
4. Add test coverage for remaining 11 modules
5. Extract shared validation and authorization into core module
