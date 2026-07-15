# D-14: WINNMATT POS — Changelog

author: OpenWork
verified_by: User
verification_status: Verified (Phase 0)
last_verified: 2026-07-14
confidence: High
stable_id: D-14

**Freshness:** 90 days (living)  
**@see** [AGENTS.md](../AGENTS.md) · [D-00](00_VISION.md) (aspirational KPIs) · [D-21](21_WORKSPACE_STATE.md) (current sprint state) · [PROJECT_AUDIT_REPORT.md](PROJECT_AUDIT_REPORT.md) §7

---

## Phase 3 — One Living System → Sprint 11+ (Product Intelligence)

### Sprint 11B — Product Intelligence Scoring Engine (✅ Complete)

**Goal:** Implement product, customer, supplier, and business health scoring. Replace Sprint 11A stubs with real logic.

- **Migration:** `20260715000004_product_scores.sql` — 4 scoring tables (product_intelligence_scores, customer_intelligence_scores, supplier_intelligence_scores, business_health_scores) with RLS + indexes
- **Product Scorer:** velocityScore (sales volume), marginScore (profit margin), stabilityScore (turnover + days of supply), seasonalityScore (revenue consistency); classification Star (85+), Cash Cow (70-84), Question Mark (50-69), Dog (30-49), Dead (<30). Reuses `salesAnalyticsService.getProductPerformance()`, `inventoryAnalyticsService.getStockTurnover()`, `inventoryAnalyticsService.getDeadStock()`
- **Customer Scorer:** recencyScore, frequencyScore, monetaryScore, loyaltyScore + composite → segment (champions/loyal/at_risk/lost/etc.) + churnRisk + lifetimeValue. Reuses `customerAnalyticsService.getCustomerLifetimeValue()`, `getChurnRisk()`, `getRFMSegments()`
- **Supplier Scorer:** qualityScore, reliabilityScore, priceScore, leadTimeScore + composite. Reuses `inventoryAnalyticsService.getSupplierPerformance()`
- **Business Health Scorer:** 6-dimension composite (revenue, margin, inventory, customer, cash, workforce) + trend detection. Reuses 5 analytics services in parallel
- **Scoring Repository:** Replaced 71-line throw stub with full Supabase CRUD (upsert/get/query/batch operations for all 4 scoring tables)
- **Event Subscriptions:** `sale.completed` → triggers productScorer.scoreAllProducts() + customerScorer.scoreCustomer() + businessHealthScorer.computeHealthScore(); `stock.changed` → triggers productScorer.scoreProduct() + businessHealthScorer.computeHealthScore(); `stock.low` → logged (reorder check pending Sprint 11D)
- **AI Tools (4 new read-only):** `getBusinessHealth()` — composite health with 6-dimension breakdown + trend; `getTopProducts(limit?, category?)` — sorted by composite score with score category filter; `getTopCustomers(limit?, segment?)` — sorted with segment filter; `getTopSuppliers(limit?)` — sorted by composite score
- **Wired into AI tool barrel:** `lib/ai/tools/index.ts` now includes `productIntelligenceTools` (from Sprint 11A tools like `getKPIStatus` and 4 new Sprint 11B tools = 5 total)
- **Tests:** 17 new tests (21 total in scoring.test.ts) covering all scorers, batch operations, edge cases, repository delegation, trend detection. 45 total PI tests (6 files)
- **No forecasting, recommendations, or anomaly detection** — Sprint 11C boundaries preserved
- **Build:** ✅ Compiled (Turbopack 88s)
- **Suite:** 562 tests, 34 files, 100% passing

### Sprint 11A — Product Intelligence Infrastructure (✅ Complete)

**Goal:** Build the Product Intelligence module infrastructure — types, repositories, event subscriptions, KPI schema, migration plans.

- `lib/modules/product-intelligence/` created with 20 files across 8 subdirectories
- Types: KPI types (8 KPI definitions), scoring types (4 score models), forecasting types (6 methods), recommendation types (4 engines), insight types (anomaly/trend), event types (6 events), config, queries
- Repositories: KPI, forecast, scoring, recommendations data access (all throw until tables exist)
- Events: 6 event creators, 3 event subscriptions (sale.completed, stock.changed, stock.low)
- KPI: Tracker with `determineStatus()`, target manager, KPI_DEFINITIONS catalog
- AI tool: `getKPIStatus()` registered for NL queries ("How are we doing on revenue?")
- Migrations: 3 SQL files (kpi_snapshots, product_forecasts, product_supplier_lead_times)
- Registry: Added to `lib/modules/index.ts` as `productIntelligence` namespace
- Tests: 28 new tests across 5 test files (all passing)
- Build: ✅ Passes (Turbopack + TypeScript + static generation)
- Brain: D-16 promoted to Verified; D-03 (Module Map) updated with M-25
- Docs: INDEX, ID_REGISTRY, ROADMAP, AGENTS all refreshed

### Sprint 10 — Module Migration + Zero `any` (✅ Complete)

**Goal:** Migrate direct callers to module layer, eliminate all `any` positions.

**Progress:** ~110 files modified, ~861 lines added, ~2,183 lines deleted. All 25 modules now have adapters. Verified zero `as any` across entire codebase. 4 component-level bypass files remain (non-page code). 296 `as unknown` casts remain (Supabase type staleness — tracked as TD-001).

### Sprint 9 — TypeScript Quality + Notification Hardening (✅ 2026-07)

- FCM push + webhook dispatch in `lib/notification-service.ts`
- Payslip dialog with Approve/Paid lifecycle
- AI command palette (Cmd+K)
- Phase F cleanup (dead code removal, attendance bug fix)
- 10 `useState<any>` → typed interfaces across 7 pages
- Env schema additions for FCM + webhook

### Sprint 8 — AI Functional Assistant (✅ 2026-07)

- `lib/ai/*` — types, prompts, executor, tool-registry, 8 tool files
- `components/ai/` — floating FAB, chat, command palette, action cards
- `hooks/use-ai-chat.ts`
- `lib/ai-actions.ts` server actions
- Page-specific suggestions for 10 routes
- OpenRouter free-tier integration with JSON prompting

### Sprint 7 — Module Layer + API Consolidation (✅ 2026-07)

- 6 `lib/modules/*/index.ts` adapters (sales, inventory, finance, customers, workforce, automation)
- 6 test suites in `tests/modules/` (117 tests total)
- `createSale()` consolidated — eliminated 280 duplicated lines
- 53 `as any` casts eliminated
- Stripe integration via `lib/stripe-actions.ts` (note: `lib/payments/gateway.ts` referenced in earlier design docs does not exist)
- Enterprise overview page at `/enterprise` with 6 health stat cards

### Sprint 6 — Notifications + Sales Search + Mobile POS + Performance (✅ 2026-07)

- Real email (Resend) + SMS (Africa's Talking)
- Sales History server-side ILIKE search + date range picker + pagination
- Mobile POS with `useIsMobile()` hook
- Dynamic imports for heavy components (PaymentPanel, PromotionPanel, MobilePOSWrapper)
- PWA icon generation via sharp
- 33 loose SQL files archived to `db/archived-migrations/`

### Sprint 5 — Quote/Receipt Features + Analytics Hardening (✅ 2026-07)

- Convert cart to quote (draft invoice, 30-day due date)
- Email/SMS sale receipt
- Analytics type hardening: 29 `useState<any>` → typed interfaces

### Sprint 4 — Redis Event Bus (✅ 2026-07)

- Factory pattern: `_in-memory.ts` + `_redis.ts` selected at load time
- Redis Pub/Sub on `pos:events`, graceful in-memory fallback
- `/api/health` reports `eventBus.mode`

### Sprint 3 — Shift-Enforced POS (✅ 2026-07)

- `useShiftGuard()` polling, `quick-shift-dialog.tsx`
- Shift status dot + payment guard
- `shiftId` flow through `AuthorizedSaleContext` → sale insert

### Sprint 2 — Device Management (✅ 2026-07)

- `devices`, `shifts` tables
- POS terminals auto-register on mount, 30s heartbeat
- Device UI at `/devices`

### Sprint 1 — Real-Time Sync Engine (✅ 2026-07)

- Generic SSE at `/api/events/stream`
- Event bus types and factory
- `/api/health` health check endpoint
- M-Pesa events refactored for backward compatibility

---

## Pre-Phase 3

### Phase 11 — Logger Migration (Commit: `6a63a01`)

Migrate all `console.*` to `logger.*` across codebase.

### Phase 10 — ESLint Fixes (Commit: `2304f53`)

Fix all 32 ESLint errors across the codebase.

### Phase 9 — Code Quality Cleanup (Commit: `5d707d7`)

Code quality cleanup pass.

### Phase 8 — Build Fixes + Zod Validation (Commits: `454be0f`, `86b8706`)

- Fix build errors
- Apply Zod validation to API payloads and env vars
- Production hardening sprint

### Phase 7 — Auto-Dismiss Alerts + POS Shortcuts (Commit: `faa2d69`)

- Auto-dismiss alerts
- Confirm reset flows
- POS keyboard shortcuts

### Phase 1 — Dead Code Removal (Commit: `9fad2cb`)

- Remove dead code
- Archive React Native mobile app to `db/archived/`
- Fix directive issues

### Initial Commits (Commit: `71564a2`, `8c28e5d`)

First commit — project bootstrap with Next.js + Supabase + basic POS structure.

---

## Git History (Active Branch: `all-fixes-and-features-20260705`)

```
6b24443  feat: production signoff + health_check table migration
49f5cd1  fix: Recharts Tooltip formatter type for Vercel build compatibility
9fad2cb  Phase 1: remove dead code, fix directive, archive mobile app
c34cd5c  chore: increase CodeRabbit max_files to 500
4f5e1e7  feat: complete POS system overhaul - all bug fixes and features
8c28e5d  first commit
d89f5b8  Remove hardcoded Supabase token from verify-db.mjs
71564a2  first commit
6a63a01  Phase 11: migrate all console.* to logger.* across codebase
2304f53  Phase 10: fix all 32 ESLint errors across the codebase
5d707d7  Phase 9: code quality cleanup ...
454be0f  Phase 8: fix build errors, apply Zod validation ...
86b8706  Phase 8 production hardening sprint
faa2d69  Phase 7 finale: auto-dismiss alerts, confirm reset, POS shortcuts ...
```

---

*D-14 Changelog — last updated 2026-07-14. 10 sprints documented.*
