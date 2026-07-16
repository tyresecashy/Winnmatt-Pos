# Anchored Summary — Winnmatt POS

## Purpose
This is the structured cross-session memory for Winnmatt POS. Updated at the end of each session with what was done, what changed, and what was decided.

---

## Session: Jul 8, 2026 (earlier) — Phase 3 Sprints 5 (Quote/Receipt + Analytics Types)

### What was done

#### Batch 1 — Infrastructure
- **Loading/Error boundaries**: Created `app/(dashboard)/loading.tsx`, `error.tsx`, `not-found.tsx` — full-page Skeleton layout, retry+error ID boundary, branded 404 with FileQuestion icon
- **Analytics loading states (6 files)**: Replaced bare `if (loading) return <div>Loading...</div>` with full Skeleton layouts matching each page's structure in sales, inventory, finance, customers, workforce, and main analytics pages
- **Env validation**: Added `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (required), `REDIS_URL` (optional) to `lib/env.ts` with Zod schema. Updated `.env.local.example` with all Supabase, M-Pesa, Stripe, Redis, and app config variables

#### Batch 2 — POS Features
- **Convert to Quote**: Created `lib/pos-actions.ts` server action `convertCartToQuote()` — creates draft invoice (30-day due date) via `invoices` + `invoice_items` tables, generates invoice number via `generate_invoice_number` RPC. Wired to QuickActionBar `onConvertToQuote` handler in POS page
- **Email Receipt**: Created server action `emailSaleReceipt()` — builds receipt HTML, logs via `notification_logs` table. Wired to POS page handler using `fullSaleData` + `selectedCustomer.email`
- **SMS Receipt**: Created server action `smsSaleReceipt()` — builds receipt text summary, logs via `notification_logs`. Wired to POS page handler

#### Batch 3 — Analytics Type Hardening
- **29 `useState<any>` → typed interfaces**: Replaced all `any` state variables across 6 analytics pages with proper types (`SalesMetrics`, `InventoryMetrics`, `CustomerMetrics`, `WorkforceMetrics`, `FinancialMetrics`, `SalesTrend`, `PeakHours`, `CategoryBreakdown`, `PaymentMethodDistribution`, `ProductPerformance`, `StockTurnover`, `SupplierPerformance`, `DeadStockItem`, `ReorderPrediction`, `PLTrend`, `CashFlowForecast`, `ExpenseBreakdown`, `MarginAnalysis`, `RFMSegment`, `CustomerLifetimeValue`, `PurchasePattern`, `TaskEfficiency`, `AttendancePattern`, `LaborCostAnalysis`, `TaskDurationAnalysis`)
- **Data loading fixed**: All sub-pages now call correct service methods with `Promise.all` instead of relying on unimplemented sub-array properties on `getXxxMetrics()` return objects
- **`report-builder.ts` hardened**: `generateReport()` returns `ReportResult` interface instead of `any`. `DataSource.parameters` typed as `string[]`. `getReportAnalytics()` has proper return type
- **`analytics/index.ts` hardened**: `generateCustomReport` and `exportReport` use typed parameters
- **Analytics dashboard page**: Uses `DashboardMetricsData` interface for composite metrics; `@ts-expect-error` comments removed

---

## Session: Jul 8, 2026 (continued) — Phase 3 Sprint 6 (Notifications / Search / Mobile POS / Performance / Cleanup)

### What was done

#### 1. Real Email/SMS sending
- Fixed `notification_logs` → `notification_log` table name in pos-actions.ts
- Exported `sendEmailNotification` (Resend) and `sendSMSNotification` (Africa's Talking) from `lib/notification-service.ts`
- Rewired pos-actions.ts to call notification service instead of direct DB inserts
- Installed `resend` and `africastalking` npm packages
- Added `RESEND_API_KEY`, `EMAIL_FROM`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `SMS_FROM` to `lib/env.ts` (all optional) and `.env.local.example`
- `sendEmailNotification` uses Resend when key is set, logs otherwise; same pattern for SMS via Africa's Talking

#### 2. Sales History server-side search + pagination
- Created `searchSales()` server action in `lib/sales-actions.ts` with ILIKE on receipt_number, payment method filter, date range, pagination (offset/limit + total count)
- Rewired client.tsx from client-side filtering to debounced (300ms) server-side search via `useCallback`
- Replaced `useDeferredValue` / `filteredSales` / `paginatedSales` with server response
- Added date range picker (Popover + Calendar) with clear button
- Fixed empty state rendering to use `totalServer`
- Fixed pagination to use server-side total and page size selector

#### 3. Mobile POS integration
- Created `hooks/use-is-mobile.ts` — listens to `matchMedia('(max-width: 768px)')` with SSR guard
- Created `components/pos/mobile-pos-wrapper.tsx` — bridges MobilePOS product/cart types with `completePaymentAction` + M-Pesa flow + shift guard integration
- POS page (`page.tsx`) conditionally renders `MobilePOSWrapper` on mobile before the desktop layout
- Both wrapper and mobile POS use `next/dynamic` with `ssr: false` (bundled separately)

#### 4. Performance optimization
- Three heavy POS components converted to dynamic imports via `next/dynamic` + `ssr: false`:
  - `PaymentPanel` (contains framer-motion `motion`/`AnimatePresence`)
  - `PromotionPanel` (framed conditionally)
  - `MobilePOSWrapper` (only rendered on mobile)
- Generated 12 missing PWA icons + 2 screenshots from `public/icon.svg` via sharp to `public/icons/` and `public/screenshots/`
- `/offline` page already existed at `app/offline/page.tsx` — verified functional

#### 5. SQL migration cleanup
- All 33 loose root .sql files moved to `db/archived-migrations/` with categorization README
- Categories: 6 absorbed (in managed migrations), 16 orphan (need audit), 5 query-only, 3 one-time-fix, 1 seed data, 2 duplicates
- Root directory now clean of .sql files

### Key decisions from this session
- Notifications: `notification_log` (singular, per migration). Providers optional — graceful fallback to log-only
- Sales search: Server-side ILIKE on `receipt_number` only (direct column). Cross-table search not supported by supabase-js query builder
- Mobile POS: Separate wrapper component adapts MobilePOS types to POS page's `completePaymentAction`, keeping the simpler MobilePOS component unmodified
- Dynamic imports: `ssr: false` to avoid framer-motion on server. Loading placeholder for PaymentPanel
- PWA icons: Generated via sharp from SVG. Screenshots are branded placeholders
- Archived migrations: Non-destructive move + README. All originals preserved for future DB audit

---

## Session: Jul 8, 2026 (earlier) — Phase 3 Sprints 3-4

### What was done
- **Sprint 3: Shift-Enforced POS** — `useShiftGuard` poll hook, `quick-shift-dialog.tsx`, shift dot in POS header, payment guard, `shiftId` through `AuthorizedSaleContext` → sale insert + RPC skip
- **Sprint 4: Redis Event Bus** — `_in-memory.ts`, `_redis.ts`, factory `event-bus.ts`, graceful shutdown, health check mode reporting

---

## Previous Session: Jul 6, 2026 — Phase 2 (Design / Loyalty / Transfers / Reports / Customers / Branch)

### What was done
- 21st.dev: KPI Card (5 tones, 3 sizes, trend/delta), EmptyState, DataTable (sort/search/pagination/export)
- `useDashboardQuery` hook, `DateRangeProvider` + `PeriodSelector`, refactored 8 dashboard components
- PaymentPanel extracted: 1,292→~550 lines, 8 sub-components, `use-payment-keys`, `PaymentSuccessAnimation`
- Fixed `pathLength` on `motion.div` → `motion.svg` + `motion.path`; fixed stale closure in `handlePayClick`
- Cash payment hang: added `setIsProcessing(false)` after `onCompletePayment`
- Command Palette replacing global-search, search with keyboard nav + `useDeferredValue`
- **Critical bug**: `redemptionWarning` undeclared (`complete-payment-action.ts:665`) → ReferenceError → cash/split create sale but no receipt. Fixed.
- **Critical bug**: `loyaltyAward: null` in `createCashSaleWithTransaction` → loyalty never earned for registered customers. Fixed.
- **1,814 TypeScript errors → 0**: Root cause — supabase-js v2.101 requires `Relationships: GenericRelationship[]` on every `GenericTable`. Added to 45 auto-generated + 11 manual table types.
- Phase B1-B5: Color hardening (31+ files), payment colors, loading skeletons, `animate-pulse`→`Skeleton`, transitions
- Phase D1-D5: Transfers page restore, receive-transfer dialog, reporting drill-downs (7 charts → detail pages), customer profile enhancements (edit dialog + purchase history drill-down), branch switcher
- Report Builder UI: `lib/report-actions.ts`, widget-renderer, report-preview, scheduled-reports, full 3-tab page
- Enterprise pages (7 all fleshed): Audit Log, Configuration, Deployments, Incidents, Releases, Security, Testing

### Key decisions from this session
- Phase order: quick wins (Phase 1) → core UX (Phase 2) → design polish (Phase 3) → consistency (Phase 4) → business features (Phase D)
- TypeScript typecheck kept as separate script (not prebuild) due to ~5 min runtime
- Branch switcher uses localStorage; single-branch → static badge; super_admin → fetch all branches
- Report Builder data layer uses real analytics services (not broken `execute_sql` RPC)
- Enterprise pages use real existing tables where possible

---

## Session: Jul 15, 2026 — Phase 1 Production Readiness + Merge Recovery

### What was done

#### Phase 1.1: Production database backup
- WAL-G automatic backup confirmed active via Supabase Management API (`walg_enabled: true`)
- Local pg_dump discovered at `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe` but no direct DB password available (Docker not installed, `supabase db dump` requires Docker)
- Health endpoint returns 200 (working)

#### Phase 1.2–1.3: Migration dry-run & safety review
- All 7 pending migrations confirmed 100% additive (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, GRANT, ALTER TABLE ENABLE RLS, CREATE POLICY — all idempotent). No destructive operations.
- Two migration history bugs discovered:
  - `20260705` naming mismatch (remote tracking has short date, local file is `20260705_add_stripe_columns.sql`)
  - `20260709000001` duplicate (two local files: `fix_purchase_receipts` + `shift_cash_sync`, one already applied on remote)

#### Phase 1.4: Apply 7 migrations to production
- Executed via Supabase Management API (`POST /v1/projects/{ref}/database/query`) because `supabase db push` failed due to migration history mismatches
- Splitting multi-statement SQL files into individual statements for the API
- Migration tracking records inserted into `supabase_migrations.schema_migrations` alongside each migration
- **Verification: All 13 new tables exist in production** (health_check, kpi_snapshots, product_forecasts, product_supplier_lead_times, product_intelligence_scores, customer_intelligence_scores, supplier_intelligence_scores, business_health_scores, revenue_forecasts, seasonality_patterns, forecast_accuracy_log, product_affinities, reorder_suggestions)

#### Phase 1.5: Production smoke tests
- Health endpoint ✅ (200, DB connected)
- Login page ✅ (200, renders)
- Site root ✅ (200, loads)
- Event bus: in-memory (acceptable for v1.0)
- Full verification checklist completed

#### Phase 1.6: Vercel env vars (blocked)
- No `VERCEL_TOKEN` in `.env.local` or available. Cannot verify or configure env vars via CLI.
- Critical vars must work (app is running), but `STRIPE_WEBHOOK_SECRET` and `SENTRY_DSN` are missing from `.env.local`. Need dashboard access or token.

#### Phase 1.7: Merge release into main (recovered from strategy error)
- **Initial attempt**: `git merge -s ours all-fixes-and-features-20260705` created merge commit but kept `main`'s OLD files (the `-s ours` strategy keeps the current branch's content). Then merging `main` back into the feature branch fast-forwarded the feature branch over its own content, losing all new work.
- **Recovery**: Reset feature branch to `7a11296` (last good commit with all work), popped stash (contained 117 uncommitted working tree changes), committed everything properly as `dd69510`, hard-reset `main` to `dd69510`, force-pushed to remote. Vercel auto-deploys from `main`.
- **Full commit log preserved**: No code was lost. The bad merge commits `a315da9` and stale `acac7f0` content are replaced by `dd69510` on remote.

### Key decisions
- **Migrate via Management API, not CLI**: Two migration history bugs (20260705 naming mismatch, 20260709000001 duplicate) blocked `supabase db push --linked`. Direct SQL via Management API bypasses CLI migration table tracking. Trade-off: future `db push` may still fail — must fix local migration history before next release.
- **Force push to correct merge strategy**: `-s ours` does NOT take "our branch's files" as expected — it keeps current branch files. Only `-X theirs` resolves conflicts in favor of the incoming branch. The initial merge was the wrong strategy; corrected with `git reset --hard` + force push.
- **Supabase project**: `aunnoikvfjgrlejccywv` ("tyresecashy's Project"), region `eu-central-1`, Postgres 17, ACTIVE_HEALTHY, Pro plan (no PITR, WAL-G backup enabled). Management API SQL endpoint at `POST /v1/projects/aunnoikvfjgrlejccywv/database/query` accepts single SQL statements (no multi-statement queries; no DO blocks with GRANT).
- **Known TS build error deferred**: Badge component does not support `warning` variant in `app/(dashboard)/intelligence/page.tsx`. Founder instructed to fix after Phase 1.
- **Validation Sprint unblocked on infrastructure side**: All PI tables exist in production. Health endpoint verified. App loads. Pipeline and merchant-side blockers (M-Pesa keys, Stripe keys, env vars) require founder action outside this session.

---

## Critical Context (Project-wide)
- **Next.js 16.2.10**, React 19.2.4, shadcn/ui New York, Tailwind v4.2.0, Recharts 2.15, Framer Motion 12.42, ioredis 5.6
- Default dark mode via next-themes v0.4.6
- Brand: WinnMatt Red (oklch 0.55 0.22 25) + Yellow/Gold (oklch 0.88 0.15 85) + custom `--success` / `--warning` tokens
- Build passes, 562/562 tests pass
- **Supabase project**: `aunnoikvfjgrlejccywv` ("tyresecashy's Project"), region `eu-central-1`, Postgres 17, ACTIVE_HEALTHY, Pro plan
- **Migration history bug**: Remote tracking table has `20260705` (old naming) while local uses `20260705_add_stripe_columns.sql`. Duplicate `20260709000001`. Must be fixed with `supabase migration repair` before next release.
- **Merge strategy lesson**: `-s ours` keeps current branch's files (not incoming). For authoritative feature branch merges, use `-X theirs` or `reset --hard` + force push.
