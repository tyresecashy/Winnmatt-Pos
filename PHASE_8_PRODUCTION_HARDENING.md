# Phase 8 — Production Hardening Plan

> **Goal**: Move Winnmatt POS from "functional prototype" to "production-ready" by addressing compliance risks, code quality gaps, and infrastructure deficiencies.
>
> **Estimated total effort**: 3–5 days for one developer

---

## Table of Contents

1. [Strip sensitive M-PESA logs](#1-strip-sensitive-m-pesa-logs)
2. [Server-side API validation with Zod](#2-server-side-api-validation-with-zod)
3. [Security headers](#3-security-headers)
4. [TypeScript `any` cleanup](#4-typescript-any-cleanup)
5. [Centralized error logging](#5-centralized-error-logging)
6. [Error monitoring (Sentry)](#6-error-monitoring-sentry)
7. [4 deferred polish items](#7-4-deferred-polish-items)
8. [Clean stale documentation](#8-clean-stale-documentation)
9. [GitHub Actions CI](#9-github-actions-ci)
10. [Automated tests (Vitest + RTL)](#10-automated-tests-vitest--rtl)
11. [Centralized env var validation](#11-centralized-env-var-validation)
12. [Data backup script](#12-data-backup-script)
13. [Accessibility pass](#13-accessibility-pass)
14. [Offline resilience for POS](#14-offline-resilience-for-pos)
15. [Performance budget + Lighthouse CI](#15-performance-budget--lighthouse-ci)

---

## 1. Strip Sensitive M-PESA Logs

### Objective
Remove phone numbers, transaction IDs, and amounts from production stdout in M-PESA API routes. These logs are a PCI-DSS / data protection compliance risk.

### Files to modify
- `app/api/mpesa/callback/route.ts` — 21 `console.*` calls
- `app/api/mpesa/stk-push/route.ts` — 18 `console.*` calls
- `app/api/mpesa/status/route.ts` — check existing logs
- `lib/mpesa-service.ts` — 13 `console.*` calls
- `lib/mpesa-actions.ts` — 13 `console.*` calls

### Steps
1. Read each file and identify every `console.log` / `console.error` call
2. Classify each as:
   - **Sensitive** (contains phone, amount, transaction ID, account ref) → remove or redact
   - **Debug-only** (flow tracing, timestamps) → guard with `if (process.env.NODE_ENV !== 'production')`
   - **Operational** (errors that need alerting) → replace with structured logger (see #5)
3. Create a redaction helper in `lib/logger.ts`:
   ```ts
   function redact(obj: unknown): unknown {
     if (typeof obj === 'string') {
       return obj.replace(/\b\d{9,12}\b/g, '***PHONE***')  // phone numbers
                 .replace(/\b(WS|ws)[A-Za-z0-9]{10,}\b/g, '***TX***')  // transaction refs
     }
     return obj
   }
   ```
4. Replace raw `console.log(data)` with `console.log(redact(data))` in payment routes
5. Verify: build passes, no phone/amount strings appear in build output

### Success criteria
- Zero phone numbers logged to stdout in production
- Zero transaction IDs logged to stdout in production
- `npm run build` passes

### Effort: 1–2 hours

---

## 2. Server-side API Validation with Zod

### Objective
Add runtime request validation to all 7 API routes so malformed or malicious payloads are rejected before touching the database.

### Files to modify
- `app/api/prices/approve/route.ts`
- `app/api/prices/review/route.ts`
- `app/api/mpesa/callback/route.ts`
- `app/api/mpesa/stk-push/route.ts`
- `app/api/mpesa/status/route.ts`
- `app/api/import/csv/route.ts`
- `app/api/auth/profile/route.ts` (GET — if body expected, validate query params)
- `lib/api-errors.ts` — new file for standardized error responses
- `package.json` — zod is already a dependency; verify version

### Steps
1. Create `lib/api-errors.ts`:
   ```ts
   import { NextResponse } from 'next/server'

   export function badRequest(errors: { field: string; message: string }[]) {
     return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
   }

   export function unauthorized(msg = 'Unauthorized') {
     return NextResponse.json({ error: msg }, { status: 401 })
   }

   export function notFound(msg = 'Not found') {
     return NextResponse.json({ error: msg }, { status: 404 })
   }

   export function serverError(error: unknown) {
     console.error('[API]', error instanceof Error ? error.message : error)
     return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
   }
   ```

2. Create `lib/api-schemas.ts` with Zod schemas for each endpoint:
   ```ts
   import { z } from 'zod'

   // ── Price approve ──
   export const priceApproveActionSchema = z.enum(['approve', 'correct', 'protect'])
   export const priceApproveSchema = z.object({
     action: priceApproveActionSchema,
     productId: z.string().uuid(),
     prices: z.object({
       correctedSellingPrice: z.number().positive().optional(),
       correctedCostPrice: z.number().positive().optional(),
     }).optional(),
     resolutionNote: z.string().max(500).optional(),
   })

   // ── M-PESA STK Push ──
   export const stkPushSchema = z.object({
     amount: z.number().int().positive().max(150000),
     phoneNumber: z.string().regex(/^(254|0)\d{9}$/, 'Invalid Kenyan phone number'),
     saleId: z.string().uuid(),
   })

   // ── M-PESA Status ──
   export const mpesaStatusSchema = z.object({
     checkoutRequestId: z.string().min(1),
   })

   // ── M-PESA Callback ──
   export const mpesaCallbackSchema = z.object({
     Body: z.object({
       stkCallback: z.object({
         MerchantRequestID: z.string(),
         CheckoutRequestID: z.string(),
         ResultCode: z.number().int(),
         ResultDesc: z.string(),
         CallbackMetadata: z.object({
           Item: z.array(z.object({
             Name: z.string(),
             Value: z.unknown().optional(),
           })),
         }).optional(),
       }),
     }),
   })
   ```

3. Update each API route:
   ```ts
   import { priceApproveSchema, badRequest, serverError } from '@/lib/api-schemas'
   import { badRequest } from '@/lib/api-errors'

   // In route handler:
   const parsed = priceApproveSchema.safeParse(body)
   if (!parsed.success) {
     return badRequest(parsed.error.issues.map(i => ({
       field: i.path.join('.'),
       message: i.message,
     })))
   }
   ```

4. Build + test each route manually with curl or Postman

### Success criteria
- All 7 routes validate input before processing
- Invalid payloads return `400 { error: "Validation failed", details: [...] }` with field-level messages
- `npm run build` passes

### Effort: 3–4 hours

---

## 3. Security Headers

### Objective
Add HTTP security headers via Next.js `headers()` in `next.config.mjs` to protect against XSS, clickjacking, MIME sniffing, and downgrade attacks.

### Files to modify
- `next.config.mjs`

### Steps
1. Edit `next.config.mjs`:
   ```js
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     typescript: { ignoreBuildErrors: false },
     images: { unoptimized: true },
     turbopack: { root: process.cwd() },
     devIndicators: false,
     async headers() {
       return [
         {
           source: '/(.*)',
           headers: [
             { key: 'X-Frame-Options', value: 'DENY' },
             { key: 'X-Content-Type-Options', value: 'nosniff' },
             { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
             { key: 'X-XSS-Protection', value: '1; mode=block' },
             {
               key: 'Strict-Transport-Security',
               value: 'max-age=63072000; includeSubDomains; preload',
             },
             {
               key: 'Permissions-Policy',
               value: 'camera=(), microphone=(), geolocation=()',
             },
             {
               key: 'Content-Security-Policy',
               value: [
                 "default-src 'self'",
                 "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                 "style-src 'self' 'unsafe-inline'",
                 "img-src 'self' data: blob:",
                 "font-src 'self' data:",
                 "connect-src 'self' https://*.supabase.co https://api.safaricom.co.ke",
                 "frame-src 'none'",
                 "object-src 'none'",
                 "base-uri 'self'",
               ].join('; '),
             },
           ],
         },
       ]
     },
   }
   ```

2. Verify: `npm run build` passes
3. Verify: `curl -I http://localhost:3000` shows all headers

### Success criteria
- All recommended headers present in production responses
- CSP allows Supabase API and Safaricom M-PESA API connections
- `npm run build` passes

### Effort: 30 minutes

---

## 4. TypeScript `any` Cleanup

### Objective
Replace `any` types with proper Supabase-generated types or well-defined interfaces in the 5 heaviest files, improving type safety and IDE support.

### Files to target (in priority order)
1. `lib/sales-actions.ts` — 11+ `any` usages
2. `lib/receipt-builder.ts` — ~5 `any` usages
3. `lib/product-normalizer.ts` — ~5 `any` usages
4. `lib/transfer-actions.ts` — ~5 `any` usages
5. `lib/csv-importer.ts` — ~3 `any` usages
6. `lib/actions/complete-payment-action.ts` — ~4 `any` usages
7. `app/api/prices/approve/route.ts` — ~6 `any` usages

### Steps
1. Check if Supabase types are already generated: look for `lib/db.types.ts` or `database.types.ts`
   - If yes, use `import type { Database } from '@/lib/db.types'` and `type Product = Database['public']['Tables']['products']['Row']`
   - If no, generate them: `npx supabase gen types typescript --linked > lib/db.types.ts`
2. For each target file:
   a. Read the file
   b. Replace `sale: any` → `sale: Database['public']['Tables']['sales']['Row']`
   c. Replace `item: any` → `item: Database['public']['Tables']['sale_items']['Row']`
   d. For return types from Supabase queries that use `.select('*')`, use the `Row` type
   e. For joined/transformed shapes, create inline interfaces:
      ```ts
      interface SaleWithItems extends Database['public']['Tables']['sales']['Row'] {
        sale_items: Database['public']['Tables']['sale_items']['Row'][]
        customer?: Database['public']['Tables']['customers']['Row'] | null
      }
      ```
   f. Use `satisfies` operator or explicit return types to validate shapes
3. Run `npm run build` after each file and fix type errors

### Success criteria
- Zero `: any` or `as any` usages in the top 7 target files
- `npm run build` passes with `strict: true`
- No regressions in runtime behavior

### Effort: 4–6 hours (most time-consuming item)

---

## 5. Centralized Error Logging

### Objective
Replace ad-hoc `console.log`/`console.error` with a structured logger that provides severity levels, request context, and environment-aware filtering.

### Files to create
- `lib/logger.ts`

### Files to modify (gradually)
- All files that currently call `console.*` (63 files, 364 calls) — start with the 10 heaviest, then batch the rest

### Steps
1. Create `lib/logger.ts`:
   ```ts
   type Level = 'debug' | 'info' | 'warn' | 'error'

   interface LogEntry {
     level: Level
     message: string
     context?: Record<string, unknown>
     timestamp: string
   }

   const IS_PROD = process.env.NODE_ENV === 'production'
   const IS_DEV = process.env.NODE_ENV === 'development'

   function formatEntry(entry: LogEntry): string {
     return JSON.stringify(entry)
   }

   export const logger = {
     debug(message: string, context?: Record<string, unknown>) {
       if (IS_PROD) return  // strip debug in production
       console.debug(formatEntry({ level: 'debug', message, context, timestamp: new Date().toISOString() }))
     },
     info(message: string, context?: Record<string, unknown>) {
       console.info(formatEntry({ level: 'info', message, context, timestamp: new Date().toISOString() }))
     },
     warn(message: string, context?: Record<string, unknown>) {
       console.warn(formatEntry({ level: 'warn', message, context, timestamp: new Date().toISOString() }))
     },
     error(message: string, error?: unknown, context?: Record<string, unknown>) {
       console.error(formatEntry({
         level: 'error',
         message,
         context: {
           ...context,
           error: error instanceof Error
             ? { name: error.name, message: error.message, stack: IS_DEV ? error.stack : undefined }
             : error,
         },
         timestamp: new Date().toISOString(),
       }))
     },
   }
   ```

2. Create `lib/logger.test.ts` (manual verification):
   ```ts
   // Run with: node -e "require('./lib/logger')"
   import { logger } from './logger'
   logger.info('Test message', { key: 'value' })
   logger.error('Something broke', new Error('test'))
   ```

3. Migrate heaviest files first (pattern):
   ```ts
   // Before
   console.log('Creating sale:', saleData)
   console.error('Failed:', error)

   // After
   logger.info('Creating sale', { items: saleData.items.length, total: saleData.total })
   logger.error('Sale creation failed', error, { saleId: saleData.id })
   ```

4. Batch-apply to remaining files (search+replace for common patterns)

### Success criteria
- Structured JSON log output (parseable by log aggregators)
- Debug logs stripped in production (`NODE_ENV=production`)
- Errors include stack traces in dev, safe message-only in prod
- `npm run build` passes

### Effort: 4–5 hours (60% of time is updating all call sites)

---

## 6. Error Monitoring (Sentry)

### Objective
Add real-time error tracking so crashes in production are visible immediately instead of relying on users reporting them.

### Steps
1. Install Sentry:
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard -i nextjs
   ```
   (The wizard sets up `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and wraps `next.config.mjs`)

2. Configure `sentry.server.config.ts`:
   ```ts
   import * as Sentry from '@sentry/nextjs'

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
     enabled: process.env.NODE_ENV === 'production',
   })
   ```

3. Add `SENTRY_DSN` to `.env.example`:
   ```
   # Error monitoring (Sentry)
   SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxxx.ingest.sentry.io/xxxxxx
   ```

4. Add Sentry to the centralized logger (#5):
   ```ts
   import * as Sentry from '@sentry/nextjs'

   // In logger.error():
   Sentry.captureException(error, { tags: { ...context } })
   ```

5. Add sample error to verify during deploy:
   ```ts
   // In an API route during testing
   import * as Sentry from '@sentry/nextjs'
   Sentry.captureMessage('Test error — remove after verification')
   ```

### Success criteria
- Sentry receives and displays errors from the app
- Errors include context (route, user, request data without secrets)
- `SENTRY_DSN` configured only in production env
- `npm run build` passes

### Effort: 1–2 hours

---

## 7. 4 Deferred Polish Items

### Objective
Complete the remaining nice-to-haves from Phase 7 that were deferred.

### 7a — Price audit pagination (A4)

**Files**: `components/prices/price-audit-dashboard.tsx`

**Steps**:
1. Add `page` state and `pageSize = 10` constant
2. Add `totalCount` to the `PriceAnomaly` fetch result
3. After the table, add a pagination component:
   ```tsx
   <div className="flex items-center justify-between mt-4">
     <p className="text-sm text-muted-foreground">
       Showing {anomalies.length} of {totalCount} anomalies
     </p>
     <div className="flex gap-2">
       <Button variant="outline" size="sm" disabled={page === 1}
         onClick={() => setPage(p => p - 1)}>Previous</Button>
       <Button variant="outline" size="sm"
         disabled={page * pageSize >= totalCount}
         onClick={() => setPage(p => p + 1)}>Next</Button>
     </div>
   </div>
   ```
4. Update the fetch to pass `page` and `pageSize` to the API
5. Update the API route to accept `?page=1&pageSize=10` and return `{ data, total }`

### 7b — Reports section pagination (C2)

**Files**: `app/(dashboard)/reports/page.tsx`

**Steps**:
1. Identify the 5 sections that list data (products, sales, purchases, customers, inventory)
2. For each section's data fetch, add `count: { exact: true }` to the Supabase query
3. Add a count badge to each section heading: `Products ({count})`
4. Add "Show more" links or a simple pagination UI for each section
5. Cap each section at 5 items by default, with "Show all X" expanding to 20

### 7c — Dashboard freshness indicator (B2)

**Files**: `components/dashboard/dashboard-stats.tsx`

**Steps**:
1. Track `lastFetchedAt` state with `Date.now()` after each successful fetch
2. Render in the card header:
   ```tsx
   {lastFetchedAt && (
     <p className="text-xs text-muted-foreground">
       Updated {formatDistanceToNow(lastFetchedAt, { addSuffix: true })}
     </p>
   )}
   ```
3. Add a manual refresh button using `setRetryCount(c => c + 1)`

### 7d — Seasonal insights polling (B3)

**Files**: `components/dashboard/seasonal-insights.tsx`

**Steps**:
1. Add a `useEffect` with `setInterval` of 5 minutes
2. On each tick, call the same fetch function that `retryCount` triggers
3. Clean up the interval on unmount:
   ```tsx
   useEffect(() => {
     const interval = setInterval(() => setRetryCount(c => c + 1), 5 * 60 * 1000)
     return () => clearInterval(interval)
   }, [])
   ```
4. Add `lastFetchedAt` display (same pattern as B2)

### Success criteria
- Price audit table has Previous/Next buttons and count label
- Reports sections show item counts and expand/collapse
- Dashboard stats show "Updated X minutes ago"
- Seasonal insights auto-refreshes every 5 minutes
- `npm run build` passes

### Effort: 3–4 hours

---

## 8. Clean Stale Documentation

### Objective
Remove 95+ redundant markdown files from the project root, keeping only the essential 3–4 in a `docs/` folder.

### Steps

1. Create `docs/` directory:
   ```bash
   mkdir docs
   ```

2. Keep (move to `docs/`):
   - `README.md` → `README.md` (stays in root, essential)
   - `IMPLEMENTATION_GUIDE.md` → `docs/implementation-guide.md`
   - `DEMO_GUIDE.md` → `docs/demo-guide.md`
   - `PRODUCTION_AUDIT_REPORT.md` → optionally keep

3. Delete (by category — safe to remove):
   ```
   # Phase docs (all superseded)
   PHASE_0_COMPLETION.md
   PHASE_1_BEFORE_AFTER.md
   PHASE_1_CODE_CHANGES.md
   PHASE_1_COMPLETE_DELIVERY.md
   PHASE_1_COMPLETION.md
   PHASE_1_DETAILED_IMPLEMENTATION.md
   PHASE_1_QUICK_REFERENCE.md
   PHASE_2A_CODE_CHANGES.md
   PHASE_2A_IMPLEMENTATION.md
   PHASE_2A_TESTING_GUIDE.md
   PHASE_2_IMPLEMENTATION_GUIDE.md
   PHASE_2_ROLLOUT_PLAN.md
   PHASE_2_VERIFICATION_GUIDE.md
   PHASE_3_QUICK_REFERENCE.md
   PHASE_3_TESTING_GUIDE.md
   PHASE_3_TEST_PACKAGE_READY.md
   PHASE_3_TEST_SEQUENCE.md
   PHASE_3_VERIFICATION_GATES.md
   PHASE1_IMPLEMENTATION.md
   PHASE_2A_IMPLEMENTATION.md

   # M-Pesa docs (10 files, most redundant)
   MPESA_DELIVERY.md
   MPESA_DELIVERY_SUMMARY.md
   MPESA_IMPLEMENTATION_COMPLETE.md
   MPESA_IMPLEMENTATION_STATUS.md
   MPESA_INTEGRATION.md
   MPESA_INTEGRATION_COMPLETE.md
   MPESA_QUICK_REFERENCE.md
   MPESA_QUICK_START.md
   MPESA_READY_FOR_TESTING.md
   MPESA_SETUP_GUIDE.md
   MPESA_MIGRATION.sql

   # Pricing docs (11 files, all superseded)
   PRICING_CLEANUP_ACTION_GUIDE.md
   PRICING_CLEANUP_DIAGNOSTICS.sql
   PRICING_CLEANUP_EXECUTION_GUIDE.md
   PRICING_CLEANUP_FRAMEWORK.md
   PRICING_CLEANUP_IMPLEMENTATION.md
   PRICING_CLEANUP_PRODUCTION.sql
   PRICING_CLEANUP_QUERIES.sql
   PRICING_CLEANUP_QUICK_REF.md
   PRICING_CLEANUP_READY.md
   PRICING_CLEANUP_SUMMARY.md
   PRICING_CLEANUP_VERIFY.sql
   PRICING_CORRECTION_EXECUTION_REPORT.md
   PRICING_CORRECTION_MIGRATION.sql
   PRICING_PROTECTION_MIGRATION.sql

   # Customer docs (4 files, superseded)
   CUSTOMERS_COMPLETE_SUMMARY.md
   CUSTOMERS_DEV_QUICK_START.md
   CUSTOMERS_IMPLEMENTATION.md
   CUSTOMERS_QUICK_REF.md

   # Inventory docs (6 files, superseded)
   INVENTORY_DEBUG_GUIDE.md
   INVENTORY_FIX_SUMMARY.md
   INVENTORY_OPERATIONS_SUMMARY.md
   INVENTORY_QUICK_REF.md
   INVENTORY_UI_TESTING_GUIDE.md
   INVENTORY_VERIFICATION_QUERIES.sql

   # Shift docs (9 files, superseded)
   SHIFT_ARCHITECTURE_OVERVIEW.md
   SHIFT_DEPLOYMENT_VERIFICATION.md
   SHIFT_IMPLEMENTATION_COMPLETE.md
   SHIFT_IMPLEMENTATION_INDEX.md
   SHIFT_MANAGEMENT_IMPLEMENTATION.md
   SHIFT_MANAGEMENT_READINESS_AUDIT.md
   SHIFT_NEXT_STEPS.md
   SHIFT_QUICK_DEPLOYMENT.md
   SHIFT_TESTING_GUIDE.md

   # Receipt docs (5 files, superseded)
   RECEIPT_PRINTING_COMPLETE.md
   RECEIPT_PRINTING_FINAL_SUMMARY.md
   RECEIPT_PRINTING_IMPLEMENTATION.md
   RECEIPT_PRINTING_QUICK_TEST.md
   RECEIPT_SETTINGS_AUDIT_REPORT.md
   RECEIPT_SETTINGS_MIGRATION.sql

   # Implementation/status docs (superseded)
   IMPLEMENTATION_NOTES.md
   QUICK_WINS_COMPLETE.md
   READY_FOR_DEPLOYMENT.md
   STATUS_SUMMARY.md
   PROJECT_SUMMARY.md
   PROJECT_AUDIT.md
   FUNCTIONAL_AUDIT.md
   UX_AUDIT.md
   VERIFIER_AUDIT.md
   DELIVERABLES.md
   POSTMAN_ACTION_ITEMS.md
   POSTMAN_ANALYSIS.md
   SANDBOX_TEST_COMMANDS.md
   UUID_CONSISTENCY_AUDIT.md
   SUPABASE_SETUP.md
   SQL_SETUP.md
   START_HERE.md

   # Smaller feature docs (all superseded)
   BARCODE_SEARCH_IMPLEMENTATION.md
   BRANCH_TRANSFERS_IMPLEMENTATION.md
   BRANCH_TRANSFERS_QUICK_TEST.md
   CHECKOUT_COMPLETION_IMPROVEMENT.md
   CHECKOUT_COMPLETION_QUICK_REF.md
   DASHBOARD_MODERNIZATION.md
   DATABASE_OPERATIONS.md
   LOYALTY_VISIBILITY_IMPLEMENTATION.md
   OWNER_DASHBOARD_AUDIT.md
   OWNER_LOYALTY_IMPLEMENTATION.md
   OWNER_LOYALTY_QUICK_REFERENCE.md
   POS_REFACTOR_COMPLETE.md
   POS_UX_AUDIT.md
   QUICK_TEST_GUIDE.md
   SALES_VOID_IMPLEMENTATION.md
   SALES_VOID_QUICK_REF.md
   USERS_IMPLEMENTATION_PLAN.md
   ```

4. Remove stale SQL migration files from root (they exist in `migrations/` or are already applied):
   ```
   cash-sale-transaction-migration.sql
   db-migrations.sql
   db-product-ingestion-migration.sql
   db-seed.sql
   mpesa-migration.sql
   owner-loyalty-migration.sql
   redemption-migration.sql
   sales-void-migration.sql
   shift-management-migration.sql
   ```

5. Remove other clutter:
   ```
   repomix-output.xml         # AI-tool output, not project artifact
   opencode.jsonc             # IDE config, belongs in .opencode/
   AUDIT_EXECUTIVE_SUMMARY.md
   AUDIT_FIXES_QUICK_GUIDE.md
   AUDIT_VERIFICATION_PROCEDURES.md
   START_POS.bat
   run-migration.js
   tsconfig.tsbuildinfo       # generated build artifact
   supabase-setup.ps1
   supabase-setup.sh
   PHASE_3_TEST_PRODUCTS.csv
   ```

### Success criteria
- `README.md` remains in root
- At most 4 essential files in `docs/`
- Zero `.md` files in root that are redundant development notes
- `npm run build` passes (no imports from deleted files)

### Effort: 1–2 hours

---

## 9. GitHub Actions CI

### Objective
Add automated linting, type-checking, and build verification on every push.

### Files to create
- `.github/workflows/ci.yml`

### Steps
1. Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI

   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main]

   jobs:
     build:
       runs-on: ubuntu-latest

       steps:
         - uses: actions/checkout@v4

         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: 'npm'

         - run: npm ci

         - run: npm run build
           env:
             NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
             NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
             SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

         - run: npm test
   ```

2. Add a `test` placeholder script to `package.json` if it doesn't exist:
   ```json
   "test": "vitest run"
   ```

3. Verify: push to GitHub, observe Actions tab

### Success criteria
- Green CI run on every push
- Build fails if TypeScript errors or tests fail
- Secrets stored in GitHub Secrets, not in repo

### Effort: 30 minutes

---

## 10. Automated Tests (Vitest + RTL)

### Objective
Set up a proper test framework and write tests for the most critical paths: price approval API, POS cart logic, and CSV export.

### Steps

1. Install dependencies:
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   ```

2. Create `vitest.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config'
   import path from 'path'

   export default defineConfig({
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./tests/setup.ts'],
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname),
       },
     },
   })
   ```

3. Create `tests/setup.ts`:
   ```ts
   import '@testing-library/jest-dom'
   ```

4. Add test script to `package.json`:
   ```json
   "test": "vitest run",
   "test:watch": "vitest"
   ```

5. Write `tests/price-approve.test.ts`:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { priceApproveSchema } from '@/lib/api-schemas'

   describe('Price approve schema', () => {
     it('accepts a valid approve action', () => {
       const result = priceApproveSchema.safeParse({
         action: 'approve',
         productId: '00000000-0000-0000-0000-000000000001',
       })
       expect(result.success).toBe(true)
     })

     it('accepts a correct action with prices', () => {
       const result = priceApproveSchema.safeParse({
         action: 'correct',
         productId: '00000000-0000-0000-0000-000000000001',
         prices: { correctedSellingPrice: 1500, correctedCostPrice: 1000 },
         resolutionNote: 'Price mismatch verified',
       })
       expect(result.success).toBe(true)
     })

     it('rejects an invalid action', () => {
       const result = priceApproveSchema.safeParse({
         action: 'delete',
         productId: '00000000-0000-0000-0000-000000000001',
       })
       expect(result.success).toBe(false)
     })

     it('rejects a non-UUID productId', () => {
       const result = priceApproveSchema.safeParse({
         action: 'approve',
         productId: 'not-a-uuid',
       })
       expect(result.success).toBe(false)
     })

     it('rejects negative prices', () => {
       const result = priceApproveSchema.safeParse({
         action: 'correct',
         productId: '00000000-0000-0000-0000-000000000001',
         prices: { correctedSellingPrice: -100 },
       })
       expect(result.success).toBe(false)
     })
   })
   ```

6. Write `tests/csv-export.test.ts`:
   ```ts
   import { describe, it, expect } from 'vitest'

   function escapeCsvField(value: string): string {
     if (value.includes(',') || value.includes('"') || value.includes('\n')) {
       return `"${value.replace(/"/g, '""')}"`
     }
     return value
   }

   describe('CSV export escaping', () => {
     it('passes through a simple string', () => {
       expect(escapeCsvField('hello')).toBe('hello')
     })

     it('wraps a field containing commas', () => {
       expect(escapeCsvField('hello, world')).toBe('"hello, world"')
     })

     it('escapes double quotes', () => {
       expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""')
     })

     it('wraps a field containing newlines', () => {
       expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
     })
   })
   ```

7. Verify: `npm test` passes

### Success criteria
- `npm test` runs Vitest successfully
- At least 10 tests across price-approve schema and CSV export
- Tests run in CI (from #9)
- `npm run build` still passes

### Effort: 2–3 hours initial (can be expanded incrementally)

---

## 11. Centralized Env Var Validation

### Objective
Validate all required environment variables at application startup so misconfiguration is caught immediately, not at runtime.

### Files to create
- `lib/env.ts`

### Files to modify
- `lib/supabase.ts` — replace inline validation with `env` import
- `lib/supabase-server.ts` — replace inline validation with `env` import
- `app/api/mpesa/stk-push/route.ts` — replace `getMissingMpesaConfig()` with `env` import

### Steps

1. Create `lib/env.ts`:
   ```ts
   import { z } from 'zod'

   const envSchema = z.object({
     // Supabase
     NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
     NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
     SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

     // M-PESA
     MPESA_CONSUMER_KEY: z.string().min(1),
     MPESA_CONSUMER_SECRET: z.string().min(1),
     MPESA_PAYBILL: z.string().min(1),
     MPESA_PASSKEY: z.string().min(1),
     MPESA_CALLBACK_URL: z.string().url(),
     MPESA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

     // Optional
     MPESA_ACCOUNT_REFERENCE: z.string().optional().default('WINNMATT'),
     MPESA_FAILURE_EMAIL: z.string().email().optional(),
     NEXT_PUBLIC_APP_NAME: z.string().optional().default('Winnmatt POS'),
     NEXT_PUBLIC_API_URL: z.string().optional(),
   })

   const parsed = envSchema.safeParse(process.env)

   if (!parsed.success) {
     console.error('❌ Invalid environment variables:')
     for (const issue of parsed.error.issues) {
       console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
     }
     throw new Error('Invalid environment variables — check logs above')
   }

   export const env = parsed.data
   ```

2. Use in `lib/supabase.ts`:
   ```ts
   // Before
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

   // After
   import { env } from '@/lib/env'
   const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
   const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

3. Verify: startup with missing vars shows clear error message

### Success criteria
- Missing env vars produce clear, specific error messages at startup
- All required vars are validated, not just Supabase and M-PESA
- `npm run build` passes

### Effort: 1 hour

---

## 12. Data Backup Script

### Objective
Provide a one-command database backup script that can be run manually or scheduled.

### Files to create
- `scripts/backup-db.bat` (Windows)
- `scripts/backup-db.sh` (Linux/macOS)

### Steps

1. Create `scripts/backup-db.bat`:
   ```batch
   @echo off
   setlocal enabledelayedexpansion

   if "%SUPABASE_DB_URL%"=="" (
     echo ERROR: SUPABASE_DB_URL environment variable not set.
     echo Usage: set SUPABASE_DB_URL=postgresql://user:pass@host:5432/db
     echo Then run: scripts\backup-db.bat
     exit /b 1
   )

   set BACKUP_DIR=.\backups
   if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

   for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DATETIME=%%I
   set FILENAME=winnmatt-pos-%DATETIME:~0,8%_%DATETIME:~8,6%.sql

   echo Backing up database to %BACKUP_DIR%\%FILENAME% ...
   pg_dump "%SUPABASE_DB_URL%" --clean --if-exists --no-owner > "%BACKUP_DIR%\%FILENAME%"

   if %errorlevel% equ 0 (
     echo ✓ Backup complete: %BACKUP_DIR%\%FILENAME%
   ) else (
     echo ✗ Backup failed. Is pg_dump installed and SUPABASE_DB_URL correct?
     exit /b 1
   )
   ```

2. Create `scripts/backup-db.sh`:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   BACKUP_DIR="./backups"
   mkdir -p "$BACKUP_DIR"

   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   FILENAME="winnmatt-pos-${TIMESTAMP}.sql"

   if [ -z "${SUPABASE_DB_URL:-}" ]; then
     echo "ERROR: SUPABASE_DB_URL environment variable not set."
     echo "Usage: SUPABASE_DB_URL=postgresql://user:pass@host:5432/db $0"
     exit 1
   fi

   echo "Backing up database to $BACKUP_DIR/$FILENAME ..."
   pg_dump "$SUPABASE_DB_URL" --clean --if-exists --no-owner > "$BACKUP_DIR/$FILENAME"

   echo "✓ Backup complete: $BACKUP_DIR/$FILENAME"
   ```

3. Add to `.gitignore`:
   ```
   backups/
   ```

4. Add documentation to `README.md` or document in a brief comment

### Success criteria
- Running `scripts/backup-db.bat` (or .sh) creates a SQL dump in `backups/`
- `.gitignore` prevents backups from being committed
- `npm run build` is unaffected

### Effort: 30 minutes

---

## 13. Accessibility Pass

### Objective
Add focus management, keyboard navigation, and screen reader labels to the 4 key user-facing pages: POS, Reports, Settings, and Price Audit.

### Files to target
- `app/(dashboard)/pos/page.tsx`
- `components/prices/price-audit-dashboard.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/(dashboard)/settings/page.tsx`

### Steps

1. **POS page**:
   - Add `aria-live="polite"` region that announces cart changes
   - Add `aria-label` to the search input: `aria-label="Search products"`
   - Focus the search input on page load (already done via `searchInputRef`)
   - Ensure payment dialog traps focus (use shadcn Dialog which does this by default)

2. **Price audit page**:
   - Add `aria-label` to approve/correct/protect action buttons
   - Add `role="status"` to the error banner for screen reader announcement
   - Add `tabIndex={0}` and keyboard handlers (`Enter` or `Space`) to anomaly type badges if they're interactive

3. **Reports page**:
   - Add `aria-label` to tab list: `aria-label="Report sections"`
   - Add `aria-label="Export report"` to the Export button
   - Ensure sort controls have `aria-label` or `aria-describedby`

4. **Settings page**:
   - Add `aria-label` to reset button
   - Add `role="alert"` to save success/error alerts

5. General:
   - Run `axe DevTools` or `Lighthouse Accessibility` audit
   - Fix any violations found (target: 0 violations on main pages)

### Success criteria
- Lighthouse Accessibility score ≥ 90 on POS, Reports, Settings, and Prices pages
- All interactive elements have accessible names
- Error announcements reach screen readers
- `npm run build` passes

### Effort: 3–4 hours

---

## 14. Offline Resilience for POS

### Objective
Allow the POS to continue selling even when the internet connection drops, then sync transactions when connectivity returns.

> ⚠️ **Heavy lift** — this is the most invasive change in the plan. Consider it a separate project milestone, not a quick polish item.

### Architecture
```
Browser ←→ Service Worker ←→ IndexedDB (cache)
                ↕
            Server API (when online)
```

### Files to create
- `public/sw.js` — service worker
- `lib/offline-queue.ts` — IndexedDB sync queue
- `lib/db-cache.ts` — product cache

### Files to modify
- `app/layout.tsx` — register service worker
- `app/(dashboard)/pos/page.tsx` — fall back to cached products, queue transactions
- `lib/products-actions.ts` — cache products in IndexedDB after fetch
- `lib/sales-actions.ts` — queue failed sales to IndexedDB instead of throwing

### Implementation outline

1. **Service worker** (`public/sw.js`):
   - Cache static assets at install time
   - Intercept API requests and serve from cache when offline
   - Use "Network first, cache fallback" strategy for product listings
   - Use "Cache then network" for sale creation (store locally, sync when online)

2. **Product cache** (`lib/db-cache.ts`):
   ```ts
   // After fetching products from API, also store in IndexedDB
   export async function cacheProducts(products: Product[]) {
     const db = await openDB('winnmatt-pos', 1)
     const tx = db.transaction('products', 'readwrite')
     for (const p of products) tx.store.put(p)
     await tx.done
   }

   export async function getCachedProducts(): Promise<Product[]> {
     const db = await openDB('winnmatt-pos', 1)
     return db.getAll('products')
   }
   ```

3. **Offline sale queue** (`lib/offline-queue.ts`):
   ```ts
   export async function queueSale(saleData: OfflineSale) {
     const db = await openDB('winnmatt-pos', 1)
     await db.add('offline-sales', { ...saleData, synced: false, createdAt: Date.now() })
   }

   export async function syncQueuedSales(): Promise<void> {
     const db = await openDB('winnmatt-pos', 1)
     const pending = await db.getAll('offline-sales')
     for (const sale of pending) {
       try {
         await createSale(sale)
         await db.delete('offline-sales', sale.id)
       } catch (e) {
         console.error('Sync failed for sale', sale.id, e)
       }
     }
   }
   ```

4. **Register service worker** in `app/layout.tsx`:
   ```tsx
   useEffect(() => {
     if ('serviceWorker' in navigator) {
       navigator.serviceWorker.register('/sw.js')
       window.addEventListener('online', syncQueuedSales)
       window.addEventListener('offline', () => { /* show offline banner */ })
     }
   }, [])
   ```

### Success criteria
- POS loads and displays cached products when offline
- Completed sales are queued locally when offline
- Queued sales sync automatically when connection returns
- User sees an "Offline Mode" indicator when disconnected
- `npm run build` passes

### Effort: 2–3 days (estimate only — needs research)

---

## 15. Performance Budget + Lighthouse CI

### Objective
Establish measurable performance standards and catch regressions before they ship.

### Steps

1. **Add bundle analyzer**:
   ```bash
   npm install -D @next/bundle-analyzer
   ```
   ```js
   // next.config.mjs
   const withBundleAnalyzer = process.env.ANALYZE === 'true'
     ? (await import('@next/bundle-analyzer')).default()
     : (config) => config
   export default withBundleAnalyzer(nextConfig)
   ```

2. **Set a performance budget** in `package.json`:
   ```json
   "budget": {
     "maxBundleSize": "300KB",
     "maxInitialLoad": "150KB"
   }
   ```
   (Can be enforced with a custom script or `bundlesize` package)

3. **Run Lighthouse CI** (optional, requires CI env):
   ```bash
   npm install -D @lhci/cli
   ```
   Create `lighthouserc.json`:
   ```json
   {
     "ci": {
       "collect": { "url": ["http://localhost:3000/pos"], "numberOfRuns": 3 },
       "assert": {
         "assertions": {
           "categories:performance": ["warn", { "minScore": 0.8 }],
           "categories:accessibility": ["error", { "minScore": 0.9 }],
           "categories:best-practices": ["error", { "minScore": 0.9 }]
         }
       }
     }
   }
   ```

4. **Enable image optimization** in `next.config.mjs`:
   ```js
   images: {
     unoptimized: false,  // default, removes the override
     formats: ['image/avif', 'image/webp'],
   }
   ```
   (Requires a Sharp installation on the server)

### Success criteria
- Bundle analysis reveals largest dependencies
- Performance budget document exists
- Images are optimized with AVIF/WebP
- `npm run build` passes

### Effort: 1–2 hours

---

## Execution Order (Recommended)

| Order | Item | Why this order |
|-------|------|----------------|
| 1 | **#3 Security headers** | Fastest win, ~30 min, no code changes needed |
| 2 | **#1 Strip M-PESA logs** | Compliance risk, 1–2 hours |
| 3 | **#2 API validation with Zod** | Blocks injection attacks, 3–4 hours |
| 4 | **#5 Centralized logger** | Needed before Sentry, 4–5 hours |
| 5 | **#6 Sentry** | Depends on #5, 1–2 hours |
| 6 | **#11 Env validation** | Quick 1-hour win |
| 7 | **#8 Clean docs** | Quick organizational win, 1–2 hours |
| 8 | **#9 CI** | Enables quality gates, 30 min |
| 9 | **#10 Tests** | Depends on #2 + #9, 2–3 hours |
| 10 | **#7 Polish items** | Already scoped, 3–4 hours |
| 11 | **#4 TypeScript cleanup** | Most time-consuming, 4–6 hours |
| 12 | **#13 Accessibility** | Polish round, 3–4 hours |
| 13 | **#12 Backup script** | Quick ops win, 30 min |
| 14 | **#15 Performance** | Nice-to-have polish, 1–2 hours |
| 15 | **#14 Offline POS** | Major feature, separate milestone, 2–3 days |

**Sprint recommendation**: Items 1–10 (first sprint, ~3 days). Items 11–13 (second sprint, ~2 days). Items 14–15 (separate roadmap).
