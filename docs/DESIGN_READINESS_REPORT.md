# Product Intelligence — Design Readiness Report

**Date:** 2026-07-15
**Phase:** Sprint 11A (Foundation)
**Design Reference:** D-16 (`docs/16_PRODUCT_INTELLIGENCE.md`)
**@see** [16_PRODUCT_INTELLIGENCE.md](16_PRODUCT_INTELLIGENCE.md) · [04_MODULE_MAP.md](04_MODULE_MAP.md) · [19_ANALYTICS.md](19_ANALYTICS.md) · [10_AI_ARCHITECTURE.md](10_AI_ARCHITECTURE.md) · [17_SECURITY.md](17_SECURITY.md) · [11_EVENT_CATALOG.md](11_EVENT_CATALOG.md) · [16_PERFORMANCE.md](16_PERFORMANCE.md)

---

## Gate Summary

| Gate | Status | Notes |
|------|--------|-------|
| Module Boundaries | ✅ **PASS** | Single module; clean interface with 6 analytics services |
| Database Changes | ✅ **PASS** | 8 new tables planned, all with RLS + indexes |
| Event Integrations | ✅ **PASS** | 5 new event types; subscribes to 3 existing streams |
| AI Integrations | ✅ **PASS** | 3 new AI tools; 5 existing tools enhanced |
| Analytics Reuse | ✅ **PASS** | 6 of 6 analytics services consumed; ~4,200 lines reused |
| Security Implications | ✅ **PASS** | No new auth context; RLS on all tables; server-side only |
| Performance Implications | ✅ **PASS** | Pre-computed scores; scheduler-based; no real-time computation |

**Overall: READY** 🟢

---

## 1. Module Boundaries

### Architecture
Product Intelligence lives as a single new module: `lib/modules/product-intelligence/`. It follows the existing module adapter pattern:

```
lib/modules/product-intelligence/
├── index.ts              → Module adapter (re-exports public API)
├── types.ts              → All PI-specific TypeScript types & interfaces
├── scoring/              → Product/Customer/Supplier/Business scoring
├── forecasting/          → Demand/Revenue/Seasonality forecasting
├── recommendations/      → Cross-sell/Reorder/Pricing recommendations
├── kpi/                  → KPI computation, threshold tracking, target management
├── insights/             → Anomaly detection, trend analysis
├── repositories/         → Data access layer (kpi, forecast, scoring, recommendations)
├── events/               → Event definitions and subscriptions
└── __tests__/            → Test files (one per sub-module)
```

### Boundary Rules
- **Consumes** `lib/analytics/` (6 services) — does NOT duplicate analytics logic
- **Consumes** `lib/automation/` — for scheduled recomputation triggers
- **Consumed by** `lib/ai/` — AI tools read PI data for NL responses
- **Consumed by** `lib/modules/reports/` — PI data feeds into report builder
- **Does NOT replace** any existing module — creates new capability layer

### Conflicts Resolved
- C-003 (Module Layer): Follows existing adapter pattern; not blocked by TD-004 (4 bypass files)
- C-001 (Single Application): Stays within monolith; no new external services
- C-002 (Supabase): Uses existing Supabase connection; no new DB instances

### Gate Passes ✅
- [x] Module follows established adapter pattern
- [x] Clear consumption boundaries documented
- [x] No circular dependencies
- [x] No new external service dependencies

---

## 2. Database Changes

### New Tables (Milestone 1)

| Table | Purpose | Milestone |
|-------|---------|-----------|
| `kpi_snapshots` | KPI values with target comparison and status | M1 |
| `product_forecasts` | Pre-computed demand/revenue forecasts | M1 |
| `product_supplier_lead_times` | Lead time tracking per product-supplier | M1 |

### Future Tables (Milestones 2–4)

| Table | Purpose | Milestone |
|-------|---------|-----------|
| `product_intelligence_scores` | Product performance scores (velocity, margin, stability) | M2 |
| `customer_intelligence_scores` | Customer value/risk scores | M2 |
| `supplier_intelligence_scores` | Supplier quality scores | M2 |
| `product_affinities` | Cross-sell product-product affinity matrix | M4 |
| `reorder_suggestions` | Pre-computed reorder alerts | M4 |

### Migration Conventions
- All tables: `CREATE TABLE IF NOT EXISTS`
- All tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- All tables: Indexes on `(kpi_id, branch_id, computed_at)`, `(product_id, branch_id)`, etc.
- RLS policies: `service_role` full access, `authenticated` SELECT only
- Timestamps: `TIMESTAMPTZ NOT NULL DEFAULT now()`
- IDs: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`

### Gate Passes ✅
- [x] All 8 tables scoped and documented
- [x] RLS + indexes planned for each table
- [x] No schema conflicts with existing 147+ tables
- [x] Migration sequence defined

---

## 3. Event Integrations

### New Event Types (from PI to event bus)

| Event Type | Emitter | Payload | Purpose |
|-----------|---------|---------|---------|
| `kpi.status_changed` | KPI tracker | `{ kpiId, branchId, oldStatus, newStatus, value, target }` | Notify on KPI status transitions |
| `kpi.threshold_breached` | KPI tracker | `{ kpiId, branchId, value, threshold, direction }` | Alert on threshold violations |
| `scoring.completed` | Scoring engine | `{ scoreType, count, timestamp }` | Signal scoring batch complete |
| `forecast.updated` | Forecasting engine | `{ productId, branchId, method, accuracy }` | Signal forecast recomputation |
| `reorder.alert` | Recommendation engine | `{ productId, branchId, urgency, currentStock, reorderPoint }` | Real-time reorder alert |

### Subscribed Events (PI listens to existing events)

| Event Type | Consumer | Reaction |
|-----------|----------|----------|
| `sale.completed` (E-001) | KPI tracker | Recompute revenue velocity, margin KPIs |
| `stock.changed` (E-008) | Forecast engine | Invalidate relevant product forecasts |
| `stock.low` (E-009) | Recommendation engine | Trigger reorder check for the product |

### Event Bus Integration
- Uses existing `lib/realtime/event-bus.ts` `publish()` API
- Uses existing `lib/automation/events.ts` for scheduled recomputation
- New events follow existing `RealtimeEvent` interface with `source: 'product-intelligence'`
- No new subscription mechanism needed — uses existing `subscribe()` API

### Gate Passes ✅
- [x] Clean event types defined
- [x] Follows existing `RealtimeEvent` contract
- [x] No new event infrastructure needed
- [x] Scheduled recomposition via existing automation engine

---

## 4. AI Integrations

### New AI Tools (read-only, no user confirmation needed)

| Tool | Description | Data Source | Sprint |
|------|-------------|-------------|--------|
| `getKPIStatus()` | Returns KPI attainment vs targets with trend arrows | `kpi_snapshots` table | 11A |
| `getBusinessHealthScore()` | Returns composite business health score | `product_intelligence_scores` + KPIs | 11B |
| `getProductRecommendations(productId)` | Cross-sell + upsell for a product | `product_affinities` table | 11D |

### Existing AI Tool Enhancements

| Tool | Enhancement | Sprint |
|------|-------------|--------|
| `getProductDetails` | Add `score`, `velocity`, `forecast`, `margin_rank` | 11B |
| `searchProducts` | Add sort by `score` (velocity × margin) | 11B |
| `getSalesSummary` | Add `trend_direction`, `anomaly_flag`, `forecast_next_period` | 11C |
| `getCustomerHistory` | Add `churn_risk_score`, `segment`, `lifetime_value` | 11B |
| `getLowStockAlerts` | Replace with PI reorder engine | 11D |
| `getRevenueReport` | Add `forecast`, `confidence_interval`, `year_over_year` | 11C |

### NL Query Patterns Supported

| Query | Resolved By | Sprint |
|-------|-------------|--------|
| "How are we doing on revenue?" | `getKPIStatus()` | 11A |
| "Which products are underperforming?" | Product scorer | 11B |
| "Who are my best customers?" | Customer scorer | 11B |
| "Should I restock this item?" | Reorder engine | 11C |
| "How is the business doing?" | `getBusinessHealthScore()` | 11B |
| "Are we going to hit our target?" | Revenue forecast | 11C |
| "What should I cross-sell?" | `getProductRecommendations()` | 11D |

### Gate Passes ✅
- [x] 3 new AI tools follow existing `ToolDefinition` pattern
- [x] 5 existing tools enhanced — no new tool infrastructure
- [x] All tools are read-only (auto-execute)
- [x] All NL patterns documented and mapped to PI data sources

---

## 5. Analytics Reuse

### Consumed Analytics Services

| Service | Methods Used | PI Consumer |
|---------|-------------|-------------|
| `salesAnalyticsService` | `getSalesMetrics()`, `getProductPerformance()`, `getPeakHours()`, `getPaymentMethodDistribution()`, `getSalesTrend()`, `getSlowMovingProducts()` | Forecasting, KPI, Scoring |
| `inventoryAnalyticsService` | `getInventoryMetrics()`, `getStockTurnover()`, `getReorderPredictions()`, `getDeadStock()`, `getSupplierPerformance()` | KPI, Scoring, Reorder |
| `customerAnalyticsService` | `getCustomerMetrics()`, `getRFMSegments()`, `getCustomerLifetimeValue()`, `getChurnRisk()` | KPI, Customer scoring |
| `financialAnalyticsService` | `getFinancialMetrics()`, `getPLTrend()`, `getCashFlowForecast()` | KPI, Business health, Forecasting |
| `workforceAnalyticsService` | Labor efficiency methods | Business health |
| `reportBuilderService` | Report templates | PI dashboard widgets |

### Consumed Action Files

| File | Usage | Pattern |
|------|-------|---------|
| `inventoryAnalyticsActions.getReorderSuggestions()` | Baseline for smart reorder (to be replaced) | Milestone 4 |
| `executiveDashboardActions.getAIInsights()` | Extended with PI-powered insights | Milestone 5 |
| `posSuggestionsActions.getSmartSuggestions()` | Co-occurrence foundation for cross-sell | Milestone 4 |

### Reuse Metrics

| Category | Count | Lines Reused |
|----------|-------|-------------|
| Analytics services | 6 of 6 | ~2,800 |
| AI tools enhanced | 5 of 31 | ~400 |
| Action files reused | 3 | ~600 |
| Infrastructure (event bus, automation, notifications, SSE) | 4 | ~400 |
| **Total reuse** | **18 items** | **~4,200 lines** |

### Gate Passes ✅
- [x] All 6 analytics services consumed — zero duplication
- [x] All reuse patterns documented in D-16
- [x] No new analytics aggregation code needed
- [x] Replaces inferior existing implementations (reorder) rather than duplicating

---

## 6. Security Implications

### Threat Model

| Concern | Assessment | Mitigation |
|---------|-----------|------------|
| Data exfiltration via PI queries | Low — all data already in Supabase | RLS on all PI tables |
| Insecure AI tool access | Low — AI already authenticated | Tools use existing `ToolContext.profile` |
| Unauthorized KPI modification | Low — KPI snapshots are insert-only | `authenticated` has SELECT only |
| Injection via analytics services | Low — analytics param types are safe | Existing type validation |
| Cross-module data leakage | Low — PI consumes from same DB | Same RLS context as rest of app |

### RLS Policies (planned for all tables)

| Role | Permission | Rationale |
|------|-----------|-----------|
| `service_role` | ALL | Admin operations, scheduled recomputation |
| `authenticated` | SELECT | Read-only for dashboard widgets and AI tools |
| `anon` | No access | No public PI data |

### Auth Context
- PI data is always accessed server-side (server actions or direct Supabase queries)
- No new auth endpoints needed
- AI tool authentication uses existing `authenticateServerAction` pattern

### Gate Passes ✅
- [x] All new tables have RLS policies
- [x] No new auth infrastructure needed
- [x] No sensitive data stored in PI tables (aggregates only, no PII)
- [x] Props to TD-001 (as unknown casts) — PI types independently defined in `types.ts`

---

## 7. Performance Implications

### Computational Model
- **Pre-compute on schedule**: Scores, forecasts, affinities computed in batch
- **Cache on read**: Frequently-read PI data uses Redis (optional)
- **Never compute on read**: All read paths are simple DB queries

### Performance Budgets

| Operation | Expected Latency | Frequency | Notes |
|-----------|-----------------|-----------|-------|
| KPI snapshot write | <100ms | Per-sale + daily | Single row insert, indexed |
| Score read (product) | <50ms | On dashboard load | Pre-computed, single-row SELECT |
| Score read (customer) | <50ms | On customer detail | Pre-computed, single-row SELECT |
| Forecast read | <100ms | On product detail | Array column, single-row SELECT |
| Reorder alert | <200ms | On stock change | Pre-computed, index scan on urgency |
| Full product scoring (10k products) | <30s | Daily schedule | Batch processing, non-blocking |
| Full forecasting (10k products) | <60s | Daily schedule | Batch processing, non-blocking |
| Affinity matrix rebuild | <5min | Daily schedule | Heavy computation, off-peak |

### Scalability
- All tables indexed on `(branch_id, computed_at)` for branch-scoped queries
- Forecast storage as `NUMERIC[]` (array column) — single row per product, no join explosion
- Scheduler has configurable timeout (default: 5 minutes per batch)
- Cold-start handled: products with <30 days data fall back to category averages

### Risk Mitigation
- **Risk:** Forecast computation for 10k+ products causes DB contention
  - **Mitigation:** Run during off-peak hours; use `batch_size` parameter; add row-level locking
- **Risk:** KPI snapshots table grows unbounded
  - **Mitigation:** `kpi_snapshots` has retention policy (90 days granular, 2 years aggregated)
- **Risk:** Redis cache miss causes slow dashboard
  - **Mitigation:** Pre-computed scores in DB serve as fallback; cache is optional optimization

### Gate Passes ✅
- [x] Pre-compute on schedule, never on read
- [x] All query paths are index-backed
- [x] Batch processing has timeout and error handling
- [x] Cold-start strategy defined for new products/customers
- [x] Data retention policy for KPI snapshots

---

## Readiness Decision

All 7 readiness gates pass. The Product Intelligence design is ready for implementation.

**Next action:** Create the Sprint 11A infrastructure (module structure, types, repositories, event subscriptions, migration plans, KPI schema). No business logic in this sprint.

---

## Reference

| Resource | Link |
|----------|------|
| D-16 Full Design | `docs/16_PRODUCT_INTELLIGENCE.md` |
| Module Map | `docs/04_MODULE_MAP.md` |
| Analytics Services | `docs/19_ANALYTICS.md` (D-17) |
| AI Architecture | `docs/10_AI_ARCHITECTURE.md` (D-09) |
| Event Catalog | `docs/11_EVENT_CATALOG.md` (D-11) |
| Security | `docs/17_SECURITY.md` (D-06) |
| Performance | `docs/16_PERFORMANCE.md` (D-18) |
| Module Pattern | `lib/modules/sales/index.ts` (reference implementation) |

---

*Design Readiness Report — Sprint 11A — 2026-07-15*
