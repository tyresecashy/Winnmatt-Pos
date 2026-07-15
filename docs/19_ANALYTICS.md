# WINNMATT POS — Analytics & Business Intelligence

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: High
stable_id: D-17
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) (system architecture) · [05_DATABASE.md](05_DATABASE.md) (underlying schema) · `AGENTS.md` (Sprint 5 analytics hardening)

---

## Executive Summary

WINNMATT POS has a dedicated analytics layer (`lib/analytics/`) with typed analysis services for sales, inventory, customers, workforce, and finance. The analytics pages live under `app/(dashboard)/analytics/` with 5 sub-pages (overview, sales, inventory, customers, workforce, finance, reports). All `useState<any>` were hardened to typed interfaces in Sprint 5.

**Status:** ✅ Analytics layer implemented with typed services. 6 service files + report builder.

---

## Analytics Architecture

```
Dashboard UI ──► Analytics Pages ──► Analytics Services ──► Server Actions ──► Supabase
(app/(dashboard)/analytics/)                                                          
                                    │                                                
                            lib/analytics/                                             
                              ├── index.ts (re-exports)                               
                              ├── sales-analytics.ts                                  
                              ├── inventory-analytics.ts                              
                              ├── customer-analytics.ts                               
                              ├── workforce-analytics.ts                              
                              ├── financial-analytics.ts                              
                              └── report-builder.ts                                   
```

### Service Files (7 total)

| File | Purpose | Key Types |
|------|---------|-----------|
| `index.ts` | Re-exports all services | — |
| `sales-analytics.ts` | Sales trends, hourly/distribution, payment mix | `SalesMetrics`, `SalesTrend`, `PeakHours` |
| `inventory-analytics.ts` | Stock health, turnover, reorder predictions | `InventoryMetrics` |
| `customer-analytics.ts` | Customer lifetime value, tiers, retention | `CustomerMetrics` |
| `workforce-analytics.ts` | Attendance, payroll trends, productivity | `WorkforceMetrics` |
| `financial-analytics.ts` | Revenue, expenses, profit, cash flow | `FinancialMetrics` |
| `report-builder.ts` | Generic report generation | `ReportResult` |

### Analytics Pages (`app/(dashboard)/analytics/`)

| Page | Route | Service Used | Status |
|------|-------|-------------|--------|
| Overview | `/analytics` | All services | ✅ |
| Sales | `/analytics/sales` | `sales-analytics.ts` | ✅ |
| Customers | `/analytics/customers` | `customer-analytics.ts` | ✅ |
| Inventory | `/analytics/inventory` | `inventory-analytics.ts` | ✅ |
| Workforce | `/analytics/workforce` | `workforce-analytics.ts` | ✅ |
| Finance | `/analytics/finance` | `financial-analytics.ts` | ✅ |
| Reports | `/analytics/reports` | `report-builder.ts` | ✅ |

---

## Key Metrics

### Sales Metrics
- Total revenue (daily/weekly/monthly)
- Transaction count and average order value
- Payment method distribution
- Peak hours analysis
- Sales trends over time
- Hourly sales distribution

### Inventory Metrics
- Stock health (in-stock, low, out-of-stock)
- Inventory turnover rate
- Reorder predictions
- Category distribution

### Customer Metrics
- Customer lifetime value
- Tier distribution
- Retention rate
- New vs returning customers

### Workforce Metrics
- Attendance rates
- Payroll trends (gross, net, tax)
- Hours worked per employee
- Department distribution

### Financial Metrics
- Revenue trends
- Expense breakdown by category
- Profit margin analysis
- Cash flow projection

---

## Implementation Pattern

Each analytics service follows the same pattern:

```typescript
export interface SalesMetrics {
  totalRevenue: number
  totalTransactions: number
  averageOrderValue: number
  paymentMethodBreakdown: PaymentMethod[]
  peakHours: PeakHours
  dailyTrend: DailyTrend[]
}

export async function getSalesMetrics(
  dateRange: DateRange,
  branchId?: string
): Promise<SalesMetrics> {
  const supabase = createClient()
  // Query aggregation from Supabase
  // Return typed result
}
```

All services use `Promise.all` for parallel data fetching and return typed interfaces.

---

## Known Limitations

1. **No real-time analytics** — All analytics are query-time aggregations; no pre-computed OLAP cubes or materialized views.
2. **No export to external BI tools** — No integration with Metabase, Tableau, PowerBI, or Superset.
3. **No scheduled reports** — `lib/notification-service.ts` has webhook dispatch, but no auto-generated email/SMS reports.
4. **No anomaly detection** — The AI assistant doesn't analyze trends or flag anomalies.
5. **Report builder is basic** — `report-builder.ts` provides a generic template but no custom report builder UI.
6. **No data warehouse** — All analytics run against the production OLTP database; no ETL pipeline to a warehouse.
7. **No caching** — Every analytics page load re-runs expensive aggregation queries.

---

## Future Direction

1. Add pre-computed aggregation tables or materialized views for common metrics
2. Schedule recurring reports via the automation engine
3. Add AI-powered anomaly detection and trend insights
4. Build a custom report builder UI with drag-and-drop metric selection
5. Add data export (CSV/PDF) for all analytics views
6. Consider an OLAP/columnar store for historical analytics
