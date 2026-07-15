# WINNMATT POS — Central ID Registry

**Purpose:** Single source of truth for every stable identifier in the project. No document defines IDs independently — all must reference this registry.

**Rules:**
- IDs are **append-only**. Never modify or reassign an existing ID.
- IDs are **never reused**. If an entity is removed, its ID becomes a **tombstone** (marked `🗑️ REMOVED`).
- **Range-based** allocation: each prefix reserves a range. New IDs increment from the highest used.
- If you need a new ID, append to the end of the relevant table — do not reorder existing entries.

**Last Updated:** 2026-07-15 (Sprint 11E — Insights Engine complete, Brain synced)  
**@see** [INDEX.md](INDEX.md) (navigation map) · [13_DECISIONS.md](13_DECISIONS.md) (decision log)

---

## D- Documents (Range: 00–22) — 23 total (all written)

| ID | Path | Status | Notes |
|----|------|--------|-------|
| D-00 | `docs/00_VISION.md` | ✅ Written | Project identity, north star, core beliefs |
| D-01 | `docs/03_ARCHITECTURE.md` | ✅ Written | Architecture overview, layers, external services |
| D-02 | `docs/02_PRINCIPLES.md` | ✅ Written | Engineering principles, coding conventions |
| D-03 | `docs/04_MODULE_MAP.md` | ✅ Written | Module inventory, adapter pattern, test coverage |
| D-04 | `docs/05_DATABASE.md` | ✅ Written | Migration inventory, major table groups, RLS |
| D-05 | `docs/06_DESIGN_SYSTEM.md` | ✅ Written | UI primitives, visual identity, component guide |
| D-06 | `docs/17_SECURITY.md` | ✅ Written | Auth, RBAC, RLS, security headers, known gaps |
| D-07 | `docs/07_MOTION.md` | ✅ Written | Animation design system |
| D-08 | `docs/08_COPYWRITING.md` | ✅ Written | UX copywriting guide |
| D-09 | `docs/10_AI_ARCHITECTURE.md` | ✅ Written | AI assistant spec, tools, LLM integration |
| D-10 | `docs/10_PROMPT_LIBRARY.md` | ✅ Written | AI prompting patterns, tool schemas, response formats |
| D-11 | `docs/11_EVENT_CATALOG.md` | ✅ Written | All event types, emitters, payloads, subsystems |
| D-12 | `docs/18_TESTING.md` | ✅ Written | Testing strategy, test inventory, coverage gaps |
| D-13 | `docs/13_DECISIONS.md` | ✅ Written | Architecture Decision Records |
| D-14 | `docs/14_CHANGELOG.md` | ✅ Written | Release history, sprint summaries |
| D-15 | `docs/15_ROADMAP.md` | ✅ Written | Phased plan with task breakdown, milestones |
| D-16 | `docs/16_PRODUCT_INTELLIGENCE.md` | ✅ Written | Product Intelligence architecture & blueprint |
| D-17 | `docs/19_ANALYTICS.md` | ✅ Written | Analytics services, metrics, report builder |
| D-18 | `docs/16_PERFORMANCE.md` | ✅ Written | Performance guide, bundle analysis, recommendations |
| D-19 | `docs/19_ACTIVE_BUGS.md` | ✅ Written | Bug tracker with B- IDs, severity, env var gaps |
| D-20 | `docs/20_TECH_DEBT_LOG.md` | ✅ Written | Tech debt inventory with TD- IDs, effort estimates |
| D-21 | `docs/21_WORKSPACE_STATE.md` | ✅ Written | Current sprint, blockers, next actions |
| D-22 | `docs/22_RELEASE_PLAN.md` | ✅ Written | Release candidates, milestones, rollback plan |
| D-23+ | — | 🔲 Available | Extends beyond 22 if needed |

---

## M- Modules (Range: 00–25)

| ID | Directory | Description |
|----|-----------|-------------|
| M-00 | `lib/modules/ai/` | AI assistant tool integrations |
| M-01 | `lib/modules/automation/` | Automation rules engine |
| M-02 | `lib/modules/branches/` | Branch management |
| M-03 | `lib/modules/cash/` | Cash register management |
| M-04 | `lib/modules/core/` | Shared infrastructure (7 files) |
| M-05 | `lib/modules/crm/` | CRM features |
| M-06 | `lib/modules/customers/` | Customer management |
| M-07 | `lib/modules/dashboard/` | Dashboard widgets |
| M-08 | `lib/modules/devices/` | POS device management |
| M-09 | `lib/modules/enterprise/` | Enterprise feature orchestration |
| M-10 | `lib/modules/expenses/` | Expense tracking |
| M-11 | `lib/modules/finance/` | Financial management |
| M-12 | `lib/modules/inventory/` | Inventory management |
| M-13 | `lib/modules/procurement/` | Procurement (POs, receipts, backorders) |
| M-14 | `lib/modules/promotions/` | Promotions & discounts |
| M-15 | `lib/modules/purchases/` | Purchase orders |
| M-16 | `lib/modules/reports/` | Report generation |
| M-17 | `lib/modules/sales/` | Sales & POS |
| M-18 | `lib/modules/security/` | Security & permissions |
| M-19 | `lib/modules/suppliers/` | Supplier management |
| M-20 | `lib/modules/system/` | System configuration |
| M-21 | `lib/modules/tax/` | Tax configuration |
| M-22 | `lib/modules/transfers/` | Branch-to-branch transfers |
| M-23 | `lib/modules/warehouse/` | Warehouse locations |
| M-24 | `lib/modules/workforce/` | HR, payroll, attendance |
| M-25 | `lib/modules/product-intelligence/` | Product Intelligence (scoring, forecasting, KPI, recommendations, insights) |
| M-26+ | — | 🔲 Available |

---

## API- Routes (Range: 001–999)

| ID | Method | Route | Purpose |
|----|--------|-------|---------|
| API-001 | GET | `/api/auth/profile` | Get authenticated user profile |
| API-002 | POST | `/api/devices/heartbeat` | POS device heartbeat (30s) |
| API-003 | GET | `/api/events/stream` | SSE real-time event stream |
| API-004 | GET | `/api/health` | Health check (DB + event bus) |
| API-005 | POST | `/api/import/csv` | CSV data import |
| API-006 | POST | `/api/mpesa/callback` | M-Pesa STK Push callback |
| API-007 | GET | `/api/mpesa/status` | M-Pesa transaction status |
| API-008 | POST | `/api/mpesa/stk-push` | Initiate M-Pesa STK Push |
| API-009 | GET | `/api/mpesa/stream` | M-Pesa event stream |
| API-010 | POST | `/api/prices/approve` | Approve pending price changes |
| API-011 | POST | `/api/prices/review` | Review price changes |
| API-012 | POST | `/api/stripe/create-payment-intent` | Create Stripe payment intent |
| API-013 | POST | `/api/stripe/webhook` | Stripe webhook receiver |
| API-014 | GET | `/api/v1` | API v1 index/health |
| API-015 | GET/POST | `/api/v1/customers` | Customer CRUD |
| API-016 | GET | `/api/v1/products` | Product listing |
| API-017 | GET/PUT/DELETE | `/api/v1/products/[id]` | Single product CRUD |
| API-018 | POST | `/api/v1/sales` | Create sale |
| API-019 | GET | `/api/v1/search` | Global search |
| API-020+ | — | — | 🔲 Available |

---

## T- Database Tables

**Status:** 🟡 Pending full catalog. ~147 tables exist across 40+ managed migrations in `supabase/migrations/`. A complete table inventory is tracked as a future task.

---

## E- Events (Range: 001–999)

| ID | Event Type | Domain | Emitted By |
|----|-----------|--------|------------|
| E-001 | `sale.completed` | Sales | `completePaymentAction()` |
| E-002 | `sale.voided` | Sales | `voidSale()` |
| E-003 | `sale.returned` | Sales | `processReturn()` |
| E-004 | `sale.high_value` | Sales | `completePaymentAction()` |
| E-005 | `product.created` | Inventory | `createProduct()` |
| E-006 | `product.updated` | Inventory | `updateProduct()` |
| E-007 | `product.price_changed` | Inventory | `updateProduct()` |
| E-008 | `stock.changed` | Inventory | `adjustStock()` |
| E-009 | `stock.low` | Inventory | `adjustStock()` |
| E-010 | `stock.out` | Inventory | `adjustStock()` |
| E-011 | `stock.received` | Inventory | `receiveStockTransfer()` |
| E-012 | `stock.transferred` | Inventory | `createStockTransfer()` |
| E-013 | `stock.counted` | Inventory | `submitStockCount()` |
| E-014 | `customer.created` | Customers | `createCustomer()` |
| E-015 | `customer.updated` | Customers | `updateCustomer()` |
| E-016 | `customer.tier_changed` | Customers | `awardLoyaltyPoints()` |
| E-017 | `shift.opened` | Shifts | `openShift()` |
| E-018 | `shift.closed` | Shifts | `closeShift()` |
| E-019 | `shift.cash_variance` | Shifts | `closeShift()` |
| E-020 | `journal_entry.posted` | Finance | `createJournalEntry()` |
| E-021 | `period.closed` | Finance | `closeFinancialPeriod()` |
| E-022 | `invoice.created` | Finance | `createInvoice()` |
| E-023 | `invoice.paid` | Finance | `payInvoice()` |
| E-024 | `invoice.overdue` | Finance | Scheduler |
| E-025 | `expense.approved` | Finance | `approveExpense()` |
| E-026 | `expense.rejected` | Finance | `approveExpense()` |
| E-027 | `employee.created` | Workforce | `createEmployee()` |
| E-028 | `employee.clock_in` | Workforce | `clockIn()` |
| E-029 | `employee.clock_out` | Workforce | `clockOut()` |
| E-030 | `payroll.processed` | Workforce | `processPayrollRun()` |
| E-031 | `user.login` | System | Auth system |
| E-032 | `user.logout` | System | Auth system |
| E-033 | `settings.changed` | System | `updateSettings()` |
| E-034 | `scheduler.daily_close` | Scheduler | Scheduler cron |
| E-035 | `scheduler.inventory_check` | Scheduler | Scheduler cron |
| E-036 | `scheduler.loyalty_expiry` | Scheduler | Scheduler cron |
| E-037 | `scheduler.promo_expiry` | Scheduler | Scheduler cron |
| E-038 | `scheduler.batch_expiry` | Scheduler | Scheduler cron |
| E-039 | `kpi.status_changed` | Product Intelligence | KPI tracker |
| E-040 | `kpi.threshold_breached` | Product Intelligence | KPI tracker |
| E-041 | `scoring.completed` | Product Intelligence | Scoring engine |
| E-042 | `forecast.updated` | Product Intelligence | Forecasting engine |
| E-043 | `reorder.alert` | Product Intelligence | Recommendation engine |
| E-044 | `recommendation.generated` | Product Intelligence | Recommendation engine (cross-sell/pricing/reorder) |
| E-045 | `anomaly.detected` | Product Intelligence | Insight engine (sales/kpi/inventory) |
| E-046+ | — | — | 🔲 Available |

---

## C- Decisions (Range: 001–999)

| ID | Title | Status | Date |
|----|-------|--------|------|
| C-001 | Single Application for All Domains | Accepted | Undated (earliest commit `71564a2`) |
| C-002 | Supabase as Full-Stack Backend | Accepted | 2026-07 (inferred) |
| C-003 | Module Layer with Gradual Migration | Accepted | 2026-07 (Sprint 7) |
| C-004 | Event Bus Factory: Redis or In-Memory | Accepted | 2026-07 (Sprint 4) |
| C-005 | Shift-Enforced POS | Accepted | 2026-07 (Sprint 3) |
| C-006 | Dynamic Imports for Heavy Components | Accepted | 2026-07 (Sprint 6) |
| C-007 | Direct M-Pesa Integration (No Aggregator) | Accepted | 2026-07 (inferred) |
| C-008 | OpenRouter for AI Assistant (Not Local LLM) | Accepted | 2026-07 (Sprint 8) |
| C-009 | Code-Only Graph (No Semantic Extraction) | Proposed | 2026-07-14 |
| C-010 | Flat docs/ Layout (No docs/brain/ Subdirectory) | Accepted | 2026-07-14 |
| C-011 | Root Middleware for Auth | Proposed | 2026-07-14 |
| C-012+ | — | 🔲 Available | — |

---

## F- Features (Range: 001–999)

**Status:** 🟡 Pending full catalog. Features are currently tracked in AGENTS.md (Sprint implementations) and the dashboard route list (77 directories, 96 `page.tsx` files).

---

## B- Bugs (Range: 001–999)

| ID | Title | Severity | Status | Document |
|----|-------|----------|--------|----------|
| B-001 | M-Pesa sandbox credentials prevent real transactions | 🔴 Critical | Open | D-19 |
| B-002 | Stripe test keys prevent real card payments | 🔴 Critical | Open | D-19 |
| B-003 | No production error monitoring (Sentry DSN not set) | 🔴 Critical | Open | D-19 |
| B-004 | NEXT_PUBLIC_API_URL points to localhost | 🟠 High | Open | D-19 |
| B-005 | 296 `as unknown` casts mask stale Supabase types | 🟡 Medium | Open | D-19/D-20 |
| B-006 | 18 silent `.catch(() => {})` handlers | 🟡 Medium | Open | D-19/D-20 |
| B-007 | 14 `console.*` calls instead of `logger.*` | 🔵 Low | Open | D-19/D-20 |
| B-008 | Multiple `useIsMobile` hook definitions | 🟢 Resolved | Resolved | D-19 |

**Rules:** Bugs are filed here after reproduction, never before. This is a permanent record — transient build/CI issues go to the issue tracker, not here.  
**@see** [docs/19_ACTIVE_BUGS.md](../docs/19_ACTIVE_BUGS.md) for full details.

---

## K- KPIs (Range: 001–999)

| ID | Name | Target | Predefined? |
|----|------|--------|-------------|
| K-001 | Daily Active Cashiers | — | ✅ In Vision doc |
| K-002 | Transaction Completion Rate | — | ✅ In Vision doc |
| K-003 | Offline Transaction Sync Success | — | ✅ In Vision doc |
| K-004 | Shift Close Accuracy | — | ✅ In Vision doc |
| K-005 | Inventory Accuracy (count vs system) | — | ✅ In Vision doc |
| K-006 | AI Assistant Resolution Rate | — | ✅ In Vision doc |
| K-007 | Uptime (Vercel + Supabase) | — | ✅ In Vision doc |
| K-008+ | — | 🔲 Available | — |

---

## W- Workflows (Range: 001–999)

**Status:** 🟡 Pending catalog. Key workflows (sale lifecycle, purchase order lifecycle, shift open/close, returns, stock transfer) are described in AGENTS.md.

---

## Tombstones

No entities have been removed or deprecated yet. This section will document tombstones as they occur.

---

*ID_REGISTRY v1.1.1 — last updated 2026-07-15 (Sprint 11E — Insights Engine complete). 8 prefixes active (E-045, B- populated), 3 pending catalog (T-, F-, W-).*
