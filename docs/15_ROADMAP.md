# WINNMATT POS — Roadmap

author: OpenWork
verified_by: Repository Audit (Sprint 11A)
verification_status: Verified
last_verified: 2026-07-15
confidence: High
stable_id: D-15
**Freshness:** 90 days (living)

**@see** [INDEX.md](INDEX.md) · [14_CHANGELOG.md](14_CHANGELOG.md) · [13_DECISIONS.md](13_DECISIONS.md) · [22_RELEASE_PLAN.md](22_RELEASE_PLAN.md) · [16_PRODUCT_INTELLIGENCE.md](16_PRODUCT_INTELLIGENCE.md)

---

## Executive Summary

WINNMATT POS has completed its documentation foundation (Brain 23/23, 100%) and architecture recovery (82/100 health). The project now transitions from documentation to **Product Intelligence implementation** — a structured series of sprints building a scoring, forecasting, KPI, and recommendation system on top of the existing analytics and AI layers.

**Current Phase:** 🟢 Sprint 11B — Product Intelligence Scoring Engine (product, customer, supplier, business health scorers)

---

## Completed Phases

| Phase | Focus | Status | Key Outputs |
|-------|-------|--------|-------------|
| **Phase 0** | ADR corrections, METATRON deletion | ✅ Complete | D-13, D-14 updates, commit `7a11296` |
| **Phase 1A** | README rewrite, useIsMobile consolidation, procurement fix | ✅ Complete | ID_REGISTRY, INDEX, 7 brain docs |
| **Phase 1B** | Architecture documents (9), drift scan, brain sync | ✅ Complete | D-01, D-03, D-04, D-05, D-06, D-09, D-12, D-17, D-18 |
| **Phase 1C** | Brain completion, architecture consolidation, cleanup | ✅ Complete | D-10, D-15, D-22, + 4 supplemental |
| **Phase 2** | Full documentation (3 remaining docs), repo cleanup, audit corrections | ✅ Complete | D-11, D-19, D-20, ~622 KB freed |
| **Phase 3A** | Product Intelligence architecture design | ✅ Complete | D-16 (14-section blueprint, 777 lines) |
| **Sprints 1–10** | One Living System (Phase 3) — sync, devices, shifts, redis, quotes, notifications, modules, AI assistant, TS quality, zero `any` | ✅ Complete | All 10 sprints delivered |
| **Sprint 11A** | Product Intelligence Infrastructure | ✅ Complete | Types, repositories, KPI schema, event subscriptions, migration plan (~1,200 lines, 20 files) |
| **Sprint 11B** | Product Intelligence Scoring Engine | ✅ Complete | 4 scorers with real formulas, scoring repository, event wiring, 4 AI tools, migration, 39 tests (~1,700 lines) |

---

## Current Sprint: Sprint 11B — Product Intelligence Scoring Engine

| Task | Status | Dependencies |
|------|--------|-------------|
| Migration: scoring tables (4 tables) | 🟢 Done | — |
| Product scorer (velocity, margin, stability, seasonality) | 🟢 Done | salesAnalytics.getProductPerformance(), inventoryAnalytics.getStockTurnover(), getDeadStock() |
| Customer scorer (RFM, churn risk, LTV, segment) | 🟢 Done | customerAnalytics.getRFMSegments(), getCustomerLifetimeValue(), getChurnRisk() |
| Supplier scorer (quality, reliability, price, lead time) | 🟢 Done | inventoryAnalytics.getSupplierPerformance() |
| Business health scorer (6-dimension composite + trend) | 🟢 Done | All 5 analytics services |
| Scoring repository (full Supabase CRUD) | 🟢 Done | Replaced 71-line throw stub |
| Event subscriptions (`sale.completed`, `stock.changed`, `stock.low`) | 🟢 Done | Replace no-op handlers with real scoring triggers |
| AI tools: getBusinessHealth, getTopProducts, getTopCustomers, getTopSuppliers | 🟢 Done | lib/ai/tools/product-intelligence.ts |
| Tests (30+ new, 4 stubs mantled) | 🟢 Done | 562 total tests, 34 files, 100% passing |
| Build + typecheck verification | 🟢 Done | Turbopack compiled 88s |

**Output:** Products ranked by composite score with BCG categories. Customers classified by RFM segment with churn risk and LTV. Suppliers ranked by reliability/quality composite. Business health with 6-dimension breakdown and trend. AI answers "Which products are underperforming?", "Who are my best customers?", "How healthy is my business?"

---

## Upcoming Sprints

### Sprint 11C — Forecasting Engine (Milestone 3)

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Simple Moving Average + WMA | `forecasting/demand-forecast.ts` | `salesAnalytics.getSalesTrend()` | ~150 lines |
| Exponential Smoothing | `forecasting/demand-forecast.ts` | — | ~80 lines |
| Linear Regression (time series) | `forecasting/demand-forecast.ts` | — | ~100 lines |
| Seasonal Decomposition | `forecasting/seasonality.ts` | — | ~120 lines |
| Holt-Winters (Triple ES) | `forecasting/seasonality.ts` | — | ~100 lines |
| Revenue forecast | `forecasting/revenue-forecast.ts` | `financialAnalytics.getPLTrend()` | ~100 lines |
| Model auto-selection | Heuristic: best method by accuracy | — | ~80 lines |
| Forecast pre-compute scheduler | Automation engine integration | — | ~60 lines |
| AI tool enhancement: `getSalesSummary` | `lib/ai/tools/sales.ts` (extend) | Forecast engine | ~40 lines |

**Output:** 7-day/30-day demand forecasts. Revenue projection for current month.

**Go-livable gate** — KPI tracking + forecasting alone provide value.

---

### Sprint 11D — Recommendation Engine (Milestone 4)

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Market basket / affinity matrix | `recommendations/cross-sell.ts` | `posSuggestionsActions.getSmartSuggestions()` | ~200 lines |
| Co-occurrence pre-compute | Cached product-product affinity table | — | ~60 lines SQL + ~80 lines |
| Smart reorder (EOQ + ROP + safety stock) | `recommendations/reorder.ts` | Forecast engine, `inventoryAnalytics.getReorderPredictions()` | ~250 lines |
| Price signal engine (basic) | `recommendations/pricing.ts` | Product scorer, margin data | ~100 lines |
| Reorder suggestion table | Migration for `reorder_suggestions` | — | ~30 lines SQL |
| AI tool: `getProductRecommendations(productId)` | `lib/ai/tools/product-intelligence.ts` | Cross-sell engine | ~60 lines |

**Output:** POS suggests cross-sell items. Reorder alerts use forecast + lead time.

---

### Sprint 11E — Insights + Dashboard (Milestone 5)

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Statistical anomaly detection | `insights/anomaly-detector.ts` | Forecast engine | ~150 lines |
| Trend analyzer | `insights/trend-analyzer.ts` | KPI tracker, forecast engine | ~100 lines |
| Extend `getAIInsights()` | Add PI-powered insights | All PI engines | ~100 lines |
| Intelligence dashboard page | `app/(dashboard)/intelligence/page.tsx` | All PI services | ~300 lines |
| Wire all AI tools | `lib/ai/tools/product-intelligence.ts` | All PI engines | ~80 lines |
| Scheduled insight report | Automation engine + email | `notification-service.ts` | ~100 lines |

**Output:** Full intelligence dashboard. AI answers all 7 NL query patterns.

---

### Sprint 11F — Hardening (Milestone 6)

| Task | Description |
|------|-------------|
| Query optimization | Add DB indexes for forecast/KPI queries |
| Cache layer | Optional Redis caching for frequently-read scores |
| Cold-start handling | Graceful degradation for products/customers with <30 days data |
| D-16 doc update | Promote from Draft → Verified |
| PI module test suite | Target: >80% coverage on all math functions |
| Capacity testing | Verify forecast engine handles 10,000+ products |

---

## Production Hardening (Parallel Track)

These tasks are independent of Product Intelligence and can be done in parallel:

| Task | Priority | Dependencies |
|------|----------|-------------|
| M-Pesa production keys (B-001) | 🔴 Critical | Safaricom approval |
| Stripe live keys (B-002) | 🔴 Critical | Stripe account verification |
| Sentry DSN configuration (B-003) | 🔴 Critical | Sentry account |
| Root middleware.ts (C-011) | 🟠 High | None |
| Suspense boundaries | 🟠 High | None |
| E2E tests (Playwright) | 🟠 High | None |
| Rate limiting in Redis | 🟡 Medium | Production Redis |
| CSP upgrade to nonce | 🟡 Medium | None |
| Load testing (k6) | 🟡 Medium | Test environment |

---

## Known Gaps

1. **No hard deadlines** — Phases are sequential but not time-boxed
2. **No dedicated QA** — Testing is developer-driven
3. **Production key dependencies** — M-Pesa/Sentry/Redis require vendor coordination
4. **UI/UX gap** — No designer on the team; UI is functional-first
5. **No user feedback loop** — Feature prioritization is intuition-driven

---

## Future Direction (Post-PI)

- Phase 4: AI+POS Integration (voice commands, auto-pricing, churn prediction)
- Phase 5: Autonomous BI (scheduled reports, OLAP warehouse)
- Phase 6: Multi-store analytics + enterprise dashboards

---

*D-15 — Sprint 11B Refresh — 2026-07-15. Living document — update as sprints progress.*
