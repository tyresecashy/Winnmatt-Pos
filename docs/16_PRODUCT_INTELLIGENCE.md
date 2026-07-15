# WINNMATT POS — Product Intelligence (D-16)

**ID:** D-16
**author:** OpenWork
**verified_by:** Repository Audit (Sprint 11B)
**verification_status:** Verified (Sprint 11B)
**last_verified:** 2026-07-15
**confidence:** High (design + implementation)
**stable_id:** D-16

**Freshness:** 90 days (living)
**@see** [INDEX.md](INDEX.md) · [00_VISION.md](00_VISION.md) (core belief #5: data drives decisions) · [15_ROADMAP.md](15_ROADMAP.md) (Phase 5/6 context) · [10_AI_ARCHITECTURE.md](10_AI_ARCHITECTURE.md) (AI tool foundation) · [19_ANALYTICS.md](19_ANALYTICS.md) (existing BI) · [11_EVENT_CATALOG.md](11_EVENT_CATALOG.md) (event sources) · [04_MODULE_MAP.md](04_MODULE_MAP.md) (existing modules)

---

## Executive Summary

Product Intelligence is the system that transforms raw transaction data into actionable business insights. It sits **between** the existing analytics layer (which answers "what happened") and the AI assistant (which answers "what do you want me to do"). Product Intelligence answers **"what should I do?"** — it predicts, scores, recommends, and alerts.

**Design philosophy:** Prioritize reuse of existing analytics services, AI tools, event bus, and automation engine. New code only where genuinely needed. Every model must have a measurable business outcome.

**Status:** 🟢 Sprint 11B complete — Scoring engine implemented (product, customer, supplier, business health). Forecasting/recommendations/insights in Sprints 11C–11F.

---

## 1. Product Intelligence Architecture

### 1.1 Logical Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        UI LAYER                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │ Intelligence  │ │  Executive   │ │  AI Assistant           │  │
│  │ Dashboard     │ │  Insights    │ │  (enhanced with PI      │  │
│  │ (new)         │ │  Page        │ │   data sources)         │  │
│  └──────┬───────┘ └──────┬───────┘ └───────────┬─────────────┘  │
│         │                │                     │                │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
┌─────────▼────────────────▼─────────────────────▼────────────────┐
│                    PRODUCT INTELLIGENCE ENGINE                    │
│                                                                   │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐   │
│  │ Scoring Engine  │ │ Forecasting    │ │ Recommendation     │   │
│  │ (product,       │ │ Engine         │ │ Engine             │   │
│  │  customer,      │ │ (demand,       │ │ (cross-sell,       │   │
│  │  supplier,      │ │  revenue,      │ │  reorder,          │   │
│  │  business KPI)  │ │  seasonality)  │ │  pricing)          │   │
│  └────────┬───────┘ └───────┬────────┘ └─────────┬──────────┘   │
│           │                 │                    │               │
│  ┌────────▼─────────────────▼────────────────────▼──────────┐   │
│  │              Analytics Service Layer                      │   │
│  │   (lib/analytics/ — 6 existing services, 34+ methods)   │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌────────────────────────▼────────────────────────────────┐   │
│  │              Data Layer                                   │   │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ OLTP DB  │ │ Materialized│ │ Cache    │ │ Event    │   │   │
│  │  │ (Supabase)│ │ Views     │ │ (Redis)  │ │ Stream   │   │   │
│  │  └──────────┘ └───────────┘ └──────────┘ └──────────┘   │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Module Boundary

Product Intelligence lives as a **single new module**: `lib/modules/product-intelligence/`. It does NOT replace the existing analytics module (M-16 Reports) — it consumes it.

| Module | Role |
|--------|------|
| `lib/modules/product-intelligence/` | **NEW** — Scoring, forecasting, recommendations, KPI tracking |
| `lib/analytics/` (existing) | **Consumed** — Provides raw metrics and aggregation queries |
| `lib/ai/` (existing) | **Consumed** — AI assistant calls PI data for insight generation |
| `lib/automation/` (existing) | **Consumed** — Scheduled PI computations via automation engine |
| `lib/modules/reports/` (M-16) | **Extended** — PI data feeds into report builder |

### 1.3 Internal Module Structure

```
lib/modules/product-intelligence/
├── index.ts                     # Module adapter (re-exports)
├── types.ts                     # All PI types and interfaces
├── scoring/
│   ├── index.ts                 # Scoring engine entry
│   ├── product-scorer.ts        # Product performance scoring
│   ├── customer-scorer.ts       # Customer value/risk scoring
│   ├── supplier-scorer.ts       # Supplier quality scoring
│   └── business-health.ts       # Overall business KPI scoring
├── forecasting/
│   ├── index.ts                 # Forecasting engine entry
│   ├── demand-forecast.ts       # Product demand prediction
│   ├── revenue-forecast.ts      # Revenue trend projection
│   └── seasonality.ts           # Seasonal pattern detection
├── recommendations/
│   ├── index.ts                 # Recommendation engine entry
│   ├── cross-sell.ts            # Market basket / co-occurrence
│   ├── reorder.ts               # Smart reorder suggestions
│   └── pricing.ts               # Price optimization signals
├── kpi/
│   ├── index.ts                 # KPI tracking engine
│   ├── tracker.ts               # KPI computation + thresholds
│   └── targets.ts               # Target setting and attainment
├── insights/
│   ├── index.ts                 # Insight generation
│   ├── anomaly-detector.ts      # Statistical anomaly detection
│   └── trend-analyzer.ts        # Trend direction analysis
└── __tests__/
    ├── scoring.test.ts
    ├── forecasting.test.ts
    ├── recommendations.test.ts
    └── kpi.test.ts
```

---

## 2. Dependency Map

### 2.1 Existing Services to Reuse

| Existing Service | Reuse Pattern | PI Consumer |
|-----------------|---------------|-------------|
| `salesAnalyticsService.getSalesMetrics()` | Time-series revenue/transaction data | Forecasting, KPI tracker |
| `salesAnalyticsService.getProductPerformance()` | Product revenue/profit ranking | Product scoring |
| `salesAnalyticsService.getPeakHours()` | Hourly sales distribution | Business health |
| `salesAnalyticsService.getPaymentMethodDistribution()` | Payment mix | KPI tracker |
| `salesAnalyticsService.getSalesTrend()` | Daily/weekly trend data | Forecasting, seasonality |
| `salesAnalyticsService.getSlowMovingProducts()` | Low-velocity product list | Product scoring, reorder |
| `inventoryAnalyticsService.getInventoryMetrics()` | Stock health summary | KPI tracker, business health |
| `inventoryAnalyticsService.getStockTurnover()` | Turnover rate per product | Product scoring, reorder |
| `inventoryAnalyticsService.getReorderPredictions()` | Basic reorder signals | **Replace with smarter Reorder** |
| `inventoryAnalyticsService.getDeadStock()` | Stale inventory | Product scoring |
| `inventoryAnalyticsService.getSupplierPerformance()` | Supplier reliability | Supplier scoring |
| `customerAnalyticsService.getCustomerMetrics()` | Customer health summary | KPI tracker |
| `customerAnalyticsService.getRFMSegments()` | RFM segment assignment | Customer scoring |
| `customerAnalyticsService.getCustomerLifetimeValue()` | CLV calculation | Customer scoring |
| `customerAnalyticsService.getChurnRisk()` | Churn risk scores | Customer scoring, anomaly |
| `financialAnalyticsService.getFinancialMetrics()` | P&L summary | Business health, KPI |
| `financialAnalyticsService.getPLTrend()` | P&L over time | Forecasting |
| `financialAnalyticsService.getCashFlowForecast()` | Cash flow projection | Business health |
| `executiveDashboardActions.getAIInsights()` | Rule-based business insights | **Consumed and extended** |
| `inventoryAnalyticsActions.getReorderSuggestions()` | Priority-based reorder | **Replace with smarter Reorder** |
| `inventoryAnalyticsActions.getTopPerformers()` | Profit/revenue/slowness ranking | Product scoring |
| `posSuggestionsActions.getSmartSuggestions()` | Co-occurrence analysis | Cross-sell (baseline) |
| `reportBuilderService` | Report templates | PI report widgets |
| `automation engine` | Scheduled tasks | KPI recalculation schedule |
| `AI tool registry` | 31 existing tools | PI data for natural-language Q&A |

### 2.2 External Dependencies

| Dependency | Use | Required? |
|-----------|-----|-----------|
| None new | All computations are pure math on existing data | — |

Product Intelligence introduces **zero new external service dependencies**. All computation is in-process TypeScript math on data already in Supabase.

---

## 3. Data Flow Diagrams

### 3.1 Batch Scoring Flow (Scheduled)

```
Scheduler (cron) ──► PI Engine
    │
    ├── daily: Product Scorer
    │     └── Reads: salesAnalytics.getProductPerformance(30d)
    │                  salesAnalytics.getSlowMovingProducts(30d)
    │                  inventoryAnalytics.getStockTurnover(30d)
    │                  inventoryAnalytics.getDeadStock(30d)
    │         Writes: product_intelligence_scores (DB table)
    │
    ├── daily: Customer Scorer
    │     └── Reads: customerAnalytics.getRFMSegments()
    │                  customerAnalytics.getCustomerLifetimeValue()
    │                  customerAnalytics.getChurnRisk(30d)
    │         Writes: customer_intelligence_scores (DB table)
    │
    ├── daily: KPI Tracker
    │     └── Reads: salesAnalytics.getSalesMetrics()
    │                  inventoryAnalytics.getInventoryMetrics()
    │                  customerAnalytics.getCustomerMetrics()
    │                  financialAnalytics.getFinancialMetrics()
    │         Writes: kpi_snapshots (DB table)
    │
    └── weekly: Supplier Scorer
          └── Reads: inventoryAnalytics.getSupplierPerformance(90d)
                 Writes: supplier_intelligence_scores (DB table)
```

### 3.2 Real-Time Recommendation Flow (On-Demand)

```
POS Checkout ──► Cart Update
    │
    ├── Cross-Sell Engine
    │     └── Reads: Cart items
    │                  product_affinity_matrix (DB, pre-computed)
    │         Returns: Top 5 cross-sell suggestions
    │                  (by lift score, live)
    │
    ├── Reorder Alert Engine
    │     └── Reads: Current inventory level
    │                  product_forecasts (DB, pre-computed)
    │         Returns: Low-stock alert if days-to-stockout < lead_time
    │
    └── Price Signal Engine
          └── Reads: Product sales velocity
                       Inventory level
                       Competitor context (future)
             Returns: Price elasticity signal (future)
```

### 3.3 Query Flow (Read Path)

```
AI Assistant / Dashboard
    │
    ▼
lib/modules/product-intelligence/index.ts
    │
    ├── Product Score: product-intelligence/scoring/product-scorer
    │     ├── Check cache (Redis, if available)
    │     ├── If stale: recompute from analytics services
    │     └── Return cached score
    │
    ├── Recommendation: product-intelligence/recommendations/cross-sell
    │     ├── Read affinity matrix from DB
    │     ├── Filter by cart items
    │     └── Return top N by lift
    │
    └── KPI Status: product-intelligence/kpi/tracker
          ├── Read latest kpi_snapshots
          ├── Compare against targets
          └── Return status (on-track/at-risk/behind)
```

---

## 4. AI Integration Plan

### 4.1 Existing AI Tool Augmentation

The 31 existing AI tools will be extended to include PI data sources:

| AI Tool | Current Behavior | PI Enhancement |
|---------|-----------------|---------------|
| `getProductDetails` | Returns product metadata + stock | Add: `score`, `velocity`, `forecast`, `margin_rank` |
| `searchProducts` | ILIKE name/sku | Add: sort by `score` (velocity × margin) |
| `getSalesSummary` | Revenue + transaction summary | Add: `trend_direction`, `anomaly_flag`, `forecast_next_period` |
| `getCustomerHistory` | Sale list per customer | Add: `churn_risk_score`, `segment`, `lifetime_value` |
| `getLowStockAlerts` | inventory ≤ reorder_level | **Replace** with PI reorder engine (lead time, forecast, safety stock) |
| `getEmployeePerformance` | Tasks + sales per employee | Add: `efficiency_grade`, `trend` |
| `getRevenueReport` | Sales aggregation | Add: `forecast`, `confidence_interval`, `year_over_year` |

### 4.2 New AI Tools (3 new)

| Tool | Type | Description |
|------|------|-------------|
| `getBusinessHealthScore` | Read | Returns overall business health composite score with breakdown |
| `getProductRecommendations(productId)` | Read | Cross-sell + upsell recommendations for a product |
| `getKPIStatus()` | Read | Returns current KPI attainment vs targets with trend arrows |

### 4.3 Natural Language Query Patterns

The following NL queries should resolve correctly after PI integration:

| User Query | PI Data Source |
|------------|---------------|
| "Which products are underperforming?" | Product scorer → low velocity + low margin products |
| "Who are my best customers?" | Customer scorer → top CLV + high RFM segment |
| "Should I restock this item?" | Reorder engine → forecast demand × lead time |
| "How is the business doing this month?" | KPI tracker → status vs targets |
| "What should I cross-sell with milk?" | Cross-sell engine → affinity matrix |
| "Are we going to hit our revenue target?" | Revenue forecast → current trajectory × remaining days |
| "Which suppliers are unreliable?" | Supplier scorer → quality + on-time delivery trend |

---

## 5. KPI Framework

### 5.1 KPI Definitions

| KPI | Formula | Source | Refresh | Target Source |
|-----|---------|--------|---------|---------------|
| **Revenue Velocity** | `∑(daily_revenue) / days` | `salesAnalytics.getSalesMetrics()` | Daily | Manual set per branch |
| **Gross Margin %** | `(revenue - cogs) / revenue * 100` | `financialAnalytics.getFinancialMetrics()` | Daily | Industry benchmark |
| **Inventory Turnover** | `cogs / average_inventory_value` | `inventoryAnalytics.getStockTurnover()` | Weekly | Category-specific |
| **Stockout Rate** | `out_of_stock_days / total_days` | `inventoryAnalytics.getInventoryMetrics()` | Daily | < 2% |
| **Customer Retention** | `repeat_customers / total_customers` | `customerAnalytics.getCustomerMetrics()` | Monthly | > 60% |
| **Order Accuracy** | `(1 - returns_value / revenue) * 100` | Combined sales + returns | Daily | > 98% |
| **Labor Efficiency** | `revenue_per_labor_hour` | `workforceAnalytics.getLaborCostAnalysis()` | Weekly | Manual set |
| **AI Resolution Rate** | `successful_tools / total_queries` | AI logs | Weekly | > 80% |

### 5.2 KPI Tracking Engine

The KPI tracker (`kpi/tracker.ts`) will:

1. **Compute** each KPI on its refresh cadence using existing analytics services
2. **Store** snapshots in `kpi_snapshots` table (new migration):
   ```sql
   CREATE TABLE kpi_snapshots (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     kpi_id TEXT NOT NULL,
     branch_id UUID REFERENCES branches(id),
     value NUMERIC NOT NULL,
     target NUMERIC,
     status TEXT CHECK (status IN ('on_track', 'at_risk', 'behind', 'no_target')),
     computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     metadata JSONB
   );
   ```
3. **Emit events** on status changes (`kpi.status_changed`)
4. **Notify** via automation engine when a KPI goes from on_track → at_risk or at_risk → behind

### 5.3 Vision KPI Alignment

The 7 aspirational KPIs from D-00 (Vision) map to PI as:

| Vision KPI | PI Implementation | Status |
|-----------|-------------------|--------|
| K-001 Daily Active Cashiers | Count workforce active today | 🟡 Trackable via workforce analytics |
| K-002 Transaction Completion Rate | completed / initiated sales | 🟡 Needs payment flow instrumentation |
| K-003 Offline Transaction Sync Success | synced / total offline sales | 🔲 Needs offline queue |
| K-004 Shift Close Accuracy | matches between POS total and counted cash | 🟡 Needs cash event data |
| K-005 Inventory Accuracy (count vs system) | shrinkage from stock counts | 🟡 Trackable via stock counts |
| K-006 AI Assistant Resolution Rate | tool success / total queries | 🟡 Trackable via AI logs |
| K-007 Uptime (Vercel + Supabase) | health check success rate | 🟡 Trackable via system_health |

---

## 6. Forecasting Engine Plan

### 6.1 Approach

The forecasting engine uses **statistical methods** — no ML dependencies. All methods are implemented as pure TypeScript math functions.

| Method | Use Case | Algorithm |
|--------|----------|-----------|
| **Simple Moving Average** | Short-term demand | Average of last N periods |
| **Weighted Moving Average** | Recent-heavy demand | Weighted by recency (most recent = highest weight) |
| **Exponential Smoothing** | Steady demand with noise | α-weighted average of past + forecast |
| **Linear Regression** | Trending demand | Least-squares fit on time series |
| **Seasonal Decomposition** | Weekly/ monthly patterns | Ratio-to-moving-average method |
| **Holt-Winters (Triple ES)** | Trend + seasonality | Level × trend × seasonal factor |

### 6.2 Forecast Output

```typescript
interface ForecastResult {
  productId: string
  period: 'day' | 'week' | 'month'
  forecastValues: number[]        // Predicted values
  confidenceInterval: {
    upper: number[]
    lower: number[]
    confidence: 0.80 | 0.90 | 0.95
  }
  method: string                  // Which algorithm was selected
  accuracy: {                     // Historical accuracy (if available)
    mape: number                  // Mean Absolute Percentage Error
    mase: number                  // Mean Absolute Scaled Error
  }
  seasonality?: {
    pattern: 'daily' | 'weekly' | 'monthly' | 'none'
    factors: number[]             // Seasonal multipliers
  }
}
```

### 6.3 Data Requirements

All forecasting data comes from existing tables:
- `sales` (created_at, total_amount, branch_id)
- `sale_items` (quantity, product_id)
- `products` (purchase_price, selling_price)

**No new data sources needed.** The forecasting engine aggregates existing transaction data into time buckets.

### 6.4 Forecast Storage

Pre-computed forecasts stored in `product_forecasts` table:
```sql
CREATE TABLE product_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  branch_id UUID REFERENCES branches(id),
  forecast_period TSTZRANGE NOT NULL,
  method TEXT NOT NULL,
  values NUMERIC[] NOT NULL,
  confidence_upper NUMERIC[],
  confidence_lower NUMERIC[],
  mape NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

---

## 7. Business Scoring Model

### 7.1 Overall Business Health Score (0–100)

Composite score computed from weighted sub-scores:

```
BusinessHealth = w1 × RevenueHealth + w2 × MarginHealth 
               + w3 × InventoryHealth + w4 × CustomerHealth
               + w5 × CashHealth + w6 × WorkforceHealth
```

| Sub-Score | Weight | Source | Thresholds |
|-----------|--------|--------|------------|
| **RevenueHealth** | 25% | Revenue vs target, growth trend | >85: Growing, 70-85: Stable, <70: Declining |
| **MarginHealth** | 20% | Gross margin % vs target | >85: Excellent, 70-85: Good, <70: Needs attention |
| **InventoryHealth** | 20% | Turnover, stockout rate, dead stock % | >85: Optimized, 70-85: Adequate, <70: Bloated/starved |
| **CustomerHealth** | 15% | Retention rate, new vs returning | >85: Loyal, 70-85: Stable, <70: Churning |
| **CashHealth** | 10% | Cash flow forecast, outstanding credit | >85: Liquid, 70-85: Adequate, <70: Strained |
| **WorkforceHealth** | 10% | Labor efficiency, attendance | >85: Productive, 70-85: Normal, <70: Needs review |

### 7.2 Product Score (0–100)

```
ProductScore = w1 × VelocityScore + w2 × MarginScore 
             + w3 × StabilityScore + w4 × SeasonalityScore
```

- **VelocityScore**: Sales velocity (units/day) normalized against category peers
- **MarginScore**: Profit margin relative to category average
- **StabilityScore**: Low variance in daily sales (steady sellers score higher)
- **SeasonalityScore**: Seasonal lift detection

**Classification:**
| Score | Label | Action |
|-------|-------|--------|
| 85-100 | Star | High velocity, high margin — protect, feature |
| 70-84 | Cash Cow | Steady revenue — maintain, optimize cost |
| 50-69 | Question Mark | High margin but low velocity OR vice versa — investigate |
| 30-49 | Dog | Low margin, low velocity — consider discontinuing |
| <30 | Dead | No sales in 30+ days — flag for clearance |

### 7.3 Customer Score (0–100)

Reuses and extends the existing RFM + ChurnRisk:

```
CustomerScore = w1 × RecencyScore + w2 × FrequencyScore 
              + w3 × MonetaryScore + w4 × LoyaltyScore
```

- **RecencyScore**: Days since last purchase (inverse, normalized)
- **FrequencyScore**: Purchase count in period, normalized
- **MonetaryScore**: Total spend, normalized against top customer
- **LoyaltyScore**: Tenure × repeat ratio

**Segments** (reuses existing `Champions, Loyal, New, At Risk, Lost` from RFM):

### 7.4 Supplier Score (0–100)

```
SupplierScore = w1 × QualityScore + w2 × ReliabilityScore 
              + w3 × PriceScore + w4 × LeadTimeScore
```

- **QualityScore**: Return rate, quality rating average
- **ReliabilityScore**: On-time delivery %
- **PriceScore**: Price competitiveness vs other suppliers for same products
- **LeadTimeScore**: Lead time consistency (low variance = high score)

---

## 8. Customer Insights Model

### 8.1 What Exists (Reuse)

Customer analytics already provides:
- **RFM Segmentation** (Champions, Loyal, New, At Risk, Lost, etc.)
- **Customer Lifetime Value** (monthly value × 12)
- **Churn Risk** (days-based scoring formula)
- **Purchase Patterns** (One-time, Occasional, Regular, Frequent)
- **Segment assignment CRUD** (`segment-actions.ts`)

### 8.2 What to Build

| Feature | Description | Priority |
|---------|-------------|----------|
| **Customer-Product Affinity** | Which products each customer segment buys most | High |
| **Next Best Action** | Based on segment: "Champion → thank you offer", "At Risk → re-engagement discount" | Medium |
| **Loyalty Program Insights** | Points redemption patterns, tier upgrade prediction | Medium |
| **Customer Concentration Risk** | % revenue from top N customers | Low |
| **Purchase Cadence Analysis** | Time between purchases for each customer | Low |

### 8.3 Data Flow

```
customerAnalytics.getRFMSegments() ──► Assign customer to segment
customerAnalytics.getCustomerLifetimeValue() ──► Store CLV for each customer
customerAnalytics.getChurnRisk() ──► Flag high-risk customers

Product Intelligence:
  ├── customer-scorer.ts: Combine RFM + CLV + Churn → CustomerScore
  ├── customer-product-affinity: For each segment, compute top 10 products
  ├── next-best-action.ts: Segment-based action rules
  └── Store results in customer_intelligence_scores table
```

---

## 9. Inventory Optimization Model

### 9.1 What Exists (Reuse)

Inventory analytics already provides:
- **Reorder predictions** (basic linear: daysUntilReorder = (current - reorder) / avgDaily)
- **Reorder suggestions** (with priority levels and safety stock)
- **Dead stock detection** (products with no sales in 30+ days)
- **Shrinkage analysis** (opening + purchases - sales - closing)
- **Stock turnover** (COGS / average inventory)

### 9.2 What to Build

| Feature | Description | Algorithm | Priority |
|---------|-------------|-----------|----------|
| **Economic Order Quantity (EOQ)** | Optimal order size: `√(2DS/H)` | Standard formula | High |
| **Reorder Point (ROP)** | `avg_daily_demand × lead_time + safety_stock` | Forecast-based | High |
| **Safety Stock** | `z × σ × √L` where z = service level, σ = demand stddev, L = lead time | Statistical | High |
| **ABC Classification** | A (top 80% revenue), B (next 15%), C (last 5%) | Cumulative % | Medium |
| **Days of Supply** | `current_stock / forecast_daily_demand` | Forecast-based | Medium |
| **Slow-Mover Detection** | Products below 1 unit/month velocity | Threshold | Low |

### 9.3 Reorder Engine (replaces existing basic version)

```
Input:
  Current inventory level
  Product forecasts (from Forecasting Engine)
  Lead time (from supplier data or product default)
  Desired service level (default: 95%)

Output:
  ReorderSuggestion {
    productId: string
    productName: string
    currentStock: number
    forecastDailyDemand: number
    demandStdDev: number
    leadTimeDays: number
    serviceLevel: number
    safetyStock: number
    reorderPoint: number
    economicOrderQty: number
    suggestedOrderQty: number
    daysUntilStockout: number
    urgency: 'immediate' | 'soon' | 'normal' | 'sufficient'
    estimatedCost: number
    preferredSupplierId?: string
  }
```

### 9.4 Lead Time Management

Lead time is **not yet modeled** in the database at the product-supplier level. This requires:

```sql
-- New table for product-supplier lead times
CREATE TABLE product_supplier_lead_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  lead_time_days INT NOT NULL,
  lead_time_stddev NUMERIC,
  last_order_date TIMESTAMPTZ,
  sample_size INT DEFAULT 1,
  UNIQUE(product_id, supplier_id)
);
```

---

## 10. Milestone-Based Implementation Roadmap

### Milestone 1: Foundation (Week 1)

**Scope:** Module structure, types, data tables, KPI tracker

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Create module structure | `lib/modules/product-intelligence/{index,types}.ts` | — | ~150 lines |
| KPI snapshot migration | `supabase/migrations/...kpi_snapshots.sql` | — | ~40 lines SQL |
| Product forecast table | `supabase/migrations/...product_forecasts.sql` | — | ~40 lines SQL |
| Product-supplier lead time table | `supabase/migrations/...lead_times.sql` | — | ~30 lines SQL |
| KPI tracker | `lib/modules/product-intelligence/kpi/tracker.ts` | 6 analytics services | ~200 lines |
| AI tool: `getKPIStatus()` | `lib/ai/tools/product-intelligence.ts` | KPI tracker | ~60 lines |

**Deliverable:** KPI dashboard widget shows current vs target. AI can answer "How are we doing on revenue?"

**Test count:** ~20 unit tests

---

### Milestone 2: Scoring Engine (Week 2)

**Scope:** Product scoring, customer scoring, basic recommendations

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Product scorer | `scoring/product-scorer.ts` | `salesAnalytics.getProductPerformance()`, `inventoryAnalytics.getStockTurnover()`, `getDeadStock()` | ~250 lines |
| Customer scorer | `scoring/customer-scorer.ts` | `customerAnalytics.getRFMSegments()`, `getCustomerLifetimeValue()`, `getChurnRisk()` | ~200 lines |
| Supplier scorer | `scoring/supplier-scorer.ts` | `inventoryAnalytics.getSupplierPerformance()` | ~150 lines |
| Scoring results tables | Migration for `*_intelligence_scores` tables | — | ~60 lines SQL |
| Product score cache pre-compute | Scheduler integration | Automation engine trigger | ~80 lines |
| AI tool: `getBusinessHealthScore()` | `lib/ai/tools/product-intelligence.ts` | Business health composite | ~80 lines |

**Deliverable:** Products ranked by score. Customers classified by value. AI can answer "Which products are underperforming?"

**Test count:** ~50 unit tests

---

### Milestone 3: Forecasting Engine (Week 3)

**Scope:** Demand forecasting, seasonality detection, revenue projection

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Simple Moving Average + WMA | `forecasting/demand-forecast.ts` | `salesAnalytics.getSalesTrend()` | ~150 lines |
| Exponential Smoothing | `forecasting/demand-forecast.ts` | — | ~80 lines |
| Linear Regression (time series) | `forecasting/demand-forecast.ts` | — | ~100 lines |
| Seasonal Decomposition | `forecasting/seasonality.ts` | — | ~120 lines |
| Holt-Winters (Triple ES) | `forecasting/seasonality.ts` | — | ~100 lines |
| Revenue forecast | `forecasting/revenue-forecast.ts` | `financialAnalytics.getPLTrend()` | ~100 lines |
| Model auto-selection | Heuristic: picks best method by accuracy | — | ~80 lines |
| Forecast pre-compute scheduler | Automation engine integration | — | ~60 lines |
| AI tool enhancement: `getSalesSummary` adds forecast | `lib/ai/tools/sales.ts` (extend) | Forecast engine | ~40 lines |

**Deliverable:** 7-day/30-day demand forecasts for every product. Revenue projection for current month.

**Test count:** ~80 unit tests (heavy on math validation)

⚠️ **Architectural flag:** Holt-Winters requires at least 2 full seasonal cycles of data. Products with <2 weeks of history will fall back to SMA. Must handle cold-start gracefully.

---

### Milestone 4: Recommendation Engine (Week 4)

**Scope:** Cross-sell/upsell, smart reorder, affinity matrix

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Market basket / affinity matrix | `recommendations/cross-sell.ts` | `posSuggestionsActions.getSmartSuggestions()` | ~200 lines |
| Co-occurrence pre-compute | Cached product-product affinity table | — | ~60 lines SQL + ~80 lines |
| Smart reorder (EOQ + ROP + safety stock) | `recommendations/reorder.ts` | Forecast engine, `inventoryAnalytics.getReorderPredictions()` | ~250 lines |
| Price signal engine (basic) | `recommendations/pricing.ts` | Product scorer, margin data | ~100 lines |
| Reorder suggestion table | Migration for `reorder_suggestions` | — | ~30 lines SQL |
| AI tool: `getProductRecommendations(productId)` | `lib/ai/tools/product-intelligence.ts` | Cross-sell engine | ~60 lines |
| AI tool enhancement: `getLowStockAlerts` → PI reorder | `lib/ai/tools/inventory.ts` (rewrite) | Reorder engine | ~60 lines |

**Deliverable:** POS suggests cross-sell items. Reorder alerts use forecast + lead time. AI can recommend products to stock.

**Test count:** ~60 unit tests

⚠️ **Architectural flag:** Cross-sell matrix requires periodic rebuild (daily recommended). Heavy recomputation for stores with 10,000+ products. Consider batch processing via DB function.

---

### Milestone 5: Insight Engine + Polish (Week 5)

**Scope:** Anomaly detection, trend analysis, dashboard widgets, full AI integration

| Task | Files | Reuse | New Code |
|------|-------|-------|----------|
| Statistical anomaly detection | `insights/anomaly-detector.ts` | Forecast engine (expected vs actual) | ~150 lines |
| Trend analyzer | `insights/trend-analyzer.ts` | KPI tracker, forecast engine | ~100 lines |
| `executiveDashboardActions.getAIInsights()` extend | Add PI-powered insights | All PI engines | ~100 lines |
| Intelligence dashboard page | `app/(dashboard)/intelligence/page.tsx` | All PI services | ~300 lines |
| Wire all AI tools | `lib/ai/tools/product-intelligence.ts` | All PI engines | ~80 lines |
| Scheduled insight report | Automation engine + email | `notification-service.ts` | ~100 lines |

**Deliverable:** Full intelligence dashboard. AI assistant answers all 7 NL query patterns. Weekly email report.

**Test count:** ~40 unit tests

---

### Milestone 6: Hardening (Week 6)

**Scope:** Performance optimization, caching, edge cases, documentation

| Task | Description |
|------|-------------|
| Query optimization | Add DB indexes for forecast/kPI queries |
| Cache layer | Optional Redis caching for frequently-read scores |
| Cold-start handling | Graceful degradation for products/customers with <30 days data |
| D-16 doc update | Promote from Draft → Verified |
| PI module test suite | Target: >80% coverage on all math functions |
| Capacity testing | Verify forecast engine handles 10,000+ products |

---

## 11. Architectural Conflicts & Risks

### 11.1 Conflicts

| # | Conflict | Resolution |
|---|----------|------------|
| 1 | **Pre-computed scores in DB require new migration** — The existing analytics layer does all computation at query time. PI requires persisted scores for performance. | Accepted: New migrations are lightweight (~4 new tables). Cannot reuse existing schema for cached scores. |
| 2 | **AI assistant reads from analytics services directly** — Currently the AI tools call `lib/*-actions.ts` directly, bypassing the module layer. If we add PI data to AI tools, we create a third path. | Build PI AI tools using the same pattern as existing tools (direct supabase calls). Module layer refactoring is scope-separate (TD-004). |
| 3 | **Forecasting engine duplicates `getReorderPredictions` logic** — The existing reorder prediction in `inventory-analytics.ts` does a simpler version of what Milestone 4 builds. | **Replace** the existing reorder prediction with the PI engine. Keep `getReorderPredictions()` as a delegation wrapper for backward compat. |
| 4 | **Cross-sell engine overlaps with `pos-suggestions-actions.ts`** — That file already has co-occurrence analysis. | **Extend** the existing co-occurrence matrix rather than rebuilding. Add the lift metric and product-level scoring on top. |
| 5 | **KPI snapshots vs feature flags** — Feature flags exist in `lib/feature-flags.ts` but are not wired into features. Should PI use them? | No — KPI tracking is always enabled. Feature flags are for UI toggles, not metrics. |

### 11.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Forecast accuracy is poor for new products** | High | Medium | Fall back to category-average forecast; document cold-start limitations |
| **Performance regression from heavy forecast computation** | Medium | Medium | Pre-compute on scheduler; never compute on read; add worker timeout |
| **296 `as unknown` casts pollute PI types** | High | Medium | Define PI types independently in `types.ts`; avoid `database.types.ts` where possible |
| **PI features not used by actual users** | Medium | High | Build incrementally; validate each milestone with real data before proceeding |
| **Seasonality detection fails on short data** | High | Low | Only enable seasonal methods for products with >60 days of history |

### 11.3 Existing Bug/Tech Debt Interference

Before Milestone 1 begins:
- **B-004** (`NEXT_PUBLIC_API_URL=localhost`) — Does not affect PI (server-side only)
- **B-001/B-002** (payment credentials) — Does not affect PI (payment-independent)
- **TD-001** (296 `as unknown` casts) — **Moderate risk**: PI source data comes from analytics services which use `as unknown`. PI types must be independently defined in `types.ts`.
- **TD-008** (no root middleware) — Does not affect PI (server actions have per-route auth)

---

## 12. Estimated Effort Summary

| Milestone | Week | New Code (lines) | DB Tables | Test Count | Dependencies |
|-----------|------|-----------------|-----------|------------|--------------|
| M1: Foundation | 1 | ~480 | 3 new | ~20 | None |
| M2: Scoring | 2 | ~820 | 2 new | ~50 | M1 |
| M3: Forecasting | 3 | ~790 | 1 new | ~80 | M1 |
| M4: Recommendations | 4 | ~790 | 2 new | ~60 | M3 |
| M5: Insights | 5 | ~730 | 0 | ~40 | M2, M3, M4 |
| M6: Hardening | 6 | 0 (optimization) | Indexes | Coverage | M1-M5 |

**Total new code:** ~3,600 lines over 6 weeks
**Total new DB tables:** 8 (kpi_snapshots, product_forecasts, product_supplier_lead_times, product_intelligence_scores, customer_intelligence_scores, supplier_intelligence_scores, product_affinities, reorder_suggestions)
**Total test count:** ~290

**Go-livable after Milestone 3** — KPI tracking + forecasting alone provide immediate value without the recommendation engine.

---

## 13. Success Gates

| Gate | Criteria | Minimum Milestone |
|------|----------|------------------|
| 🟢 **Alpha** | KPI tracker computes 8 KPIs; AI answers "How are we doing?" | M1 |
| 🟢 **Beta** | Products and customers scored; AI answers "Which products are underperforming?" | M2 |
| 🟢 **GA** | 7-day demand forecasts for all products with >30 days history; AI answers "Should I restock?" | M3 |
| 🟢 **v2** | Cross-sell on POS; smart reorder; AI answers "What should I cross-sell?" | M4 |

---

## 14. Reuse Metrics

| Category | Count | Notes |
|----------|-------|-------|
| Existing analytics services reused | **6** of 6 | Sales, Inventory, Customer, Financial, Workforce, ReportBuilder |
| Existing AI tools enhanced | **5** of 31 | getProductDetails, searchProducts, getSalesSummary, getCustomerHistory, getLowStockAlerts |
| Existing AI tools extended | **1** (getLowStockAlerts → PI reorder) | Full replacement of implementation |
| Existing action files reused | **3** | pos-suggestions-actions.ts (co-occurrence), executive-dashboard-actions.ts (insight rules), inventory-analytics-actions.ts (reorder baseline) |
| Existing infrastructure reused | **4** | Event bus, automation engine, notification service, SSE streaming |
| **Total reuse value** | **~4,200 lines** | Existing code that PI leverages without rewriting |

---

*D-16 — Phase 3A Draft — 2026-07-15. This document is a living design artifact. Update as implementation reveals new patterns or constraints.*
