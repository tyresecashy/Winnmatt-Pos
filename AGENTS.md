# Winnmatt POS — Agent Guide

## Build
- `npm run build` — production build (always run after changes)
- All 59 tests pass via `npm run test` / `npm run test:run`
- `npm run typecheck` — full TypeScript check (requires `NODE_OPTIONS="--max-old-space-size=4096"`, ~5 min)

## Phase 3 — One Living System (10 sprints)

**Done:**
- **Sprint 1: Real-Time Sync Engine** — `lib/realtime/types.ts`, `lib/realtime/event-bus.ts`, `app/api/events/stream/route.ts` (generic SSE), `app/api/health/route.ts`, refactored `lib/mpesa-events.ts` and `lib/automation/events.ts`
- **Sprint 2: Device Management** — `supabase/migrations/20260708000001_devices.sql`, `supabase/migrations/20260708000002_shifts.sql`, `lib/device-actions.ts`, `app/api/devices/heartbeat/route.ts`, `app/(dashboard)/devices/page.tsx`, `hooks/use-device-heartbeat.ts`, POS auto-register + heartbeat in `app/(dashboard)/pos/page.tsx`
- **Sprint 3: Shift-Enforced POS** — `hooks/use-shift-guard.ts`, `components/pos/quick-shift-dialog.tsx`, shift status dot + payment guard in POS page, `shiftId` flow through `AuthorizedSaleContext` + `completePaymentAction`, RPC fast-path skip when shiftId present
- **Sprint 4: Redis Event Bus** — `lib/realtime/_in-memory.ts`, `lib/realtime/_redis.ts`, `lib/realtime/event-bus.ts` (factory pattern), Redis Pub/Sub on `pos:events`, in-memory fallback, graceful shutdown, `/api/health` reports `eventBus.mode`
- **Sprint 5: Quote/Receipt Features + Analytics Type Hardening** — `lib/pos-actions.ts` (convertCartToQuote, emailSaleReceipt, smsSaleReceipt), wired QuickActionBar handlers, analytics type hardening (29 `useState<any>` → typed interfaces across 6 pages), data loading fixes for all analytics sub-pages
- **Sprint 6: Notifications + Sales Search + Mobile POS + Performance** — Real email/SMS via Resend + Africa's Talking; Sales History server-side ILIKE search + date range picker + pagination; Mobile POS with `useIsMobile()` hook, dynamic imports for heavy components (`PaymentPanel`/`PromotionPanel`/`MobilePOSWrapper` → framer-motion lazy-loaded); PWA icon generation via sharp; 33 loose SQL files archived to `db/archived-migrations/` with categorization README
- **Sprint 7: Module Layer + API Consolidation** — 6 `lib/modules/*/index.ts` adapters delegating to real `lib/*-actions.ts` (sales, inventory, finance, customers, workforce, automation); 6 test suites in `tests/modules/` (117 total tests); `createSale()` consolidated to delegate to `createSaleWithContext` (eliminated 280 duplicated lines); 53 `as any` casts eliminated across codebase; Stripe gateway provider in `lib/payments/gateway.ts`; enterprise overview page at `/enterprise` with 6 health stat cards
- **Sprint 8: AI Functional Assistant** — `lib/ai/*` (types, prompts, executor, tool-registry, 8 tool files); `components/ai/` (floating FAB, chat, command palette, action cards); `hooks/use-ai-chat.ts`; `lib/ai-actions.ts` server actions; page-specific suggestions for 10 routes; OpenRouter free-tier integration with JSON prompting
- **Sprint 9: TypeScript Quality + Notification Hardening** — FCM push + webhook dispatch in `lib/notification-service.ts`; payslip dialog with Approve/Paid lifecycle; AI command palette (Cmd+K); Phase F cleanup (dead code removal, attendance bug fix); 10 `useState<any>` → typed interfaces across 7 pages; env schema additions for FCM + webhook
- **Sprint 10: Module Migration + Zero `any`** — (in progress) Migrate direct callers from `lib/*-actions.ts` to `lib/modules/*` (~41 files); eliminate remaining ~150 `any` type positions across `lib/`, `app/`, `components/`; work toward removing `ignoreBuildErrors: true` from `next.config.mjs`

## Key Implementation Details
- **Event bus**: Factory pattern (`event-bus.ts` → `_in-memory.ts` or `_redis.ts`), selected at module load time via `REDIS_URL` env var. Redis Pub/Sub on channel `pos:events`. In-memory fallback if Redis disconnects. `shutdownEventBus()` for graceful shutdown.
- **SSE**: Generic `/api/events/stream` with `?types=` filter + auth guard
- **M-Pesa stream**: Still works independently via backward-compatible `mpesa-events` wrapper
- **Devices**: POS terminals auto-register on mount; 30s heartbeat via `useDeviceHeartbeat`; device ID persisted in `localStorage('pos_device_id')`
- **Shift management**: `shifts`, `shift_ledgers`, `shift_audit_log` tables + `sales.shift_id` FK; external `shift-management-migration.sql` absorbed into managed migrations; shift guard in POS requires active shift before payment
- **Shift-enforced POS**: `useShiftGuard` polls every 30s for active shift; `quick-shift-dialog.tsx` provides open/close with float/count/over-short; payment guard shows "Start Shift" prompt; `shiftId` passed through `AuthorizedSaleContext` → sale insert as `shift_id`
- **Health check**: `/api/health` pings `health_check` table; returns 503 degraded if DB fails; reports `eventBus.mode` (redis|in-memory)
- **Analytics type hardening**: All 6 analytics pages use proper typed state variables (`SalesMetrics`, `InventoryMetrics`, `CustomerMetrics`, `WorkforceMetrics`, `FinancialMetrics`, `SalesTrend`, `PeakHours`, etc.) instead of `any`. Service methods called correctly with `Promise.all`. `report-builder.ts` uses `ReportResult` interface. `AnalyticsService` uses typed config params.
- **POS features**: Convert to Quote creates draft invoice (30-day due date) via `invoices` + `invoice_items` tables. Email/SMS receipts send via Resend / Africa's Talking when API keys set, log-only otherwise. `sendEmailNotification`/`sendSMSNotification` exported from `lib/notification-service.ts`.
- **Mobile POS**: `useIsMobile()` hook at 768px breakpoint; POS page conditionally renders `MobilePOSWrapper` (dynamic import, SSR disabled) which maps products and delegates checkout to `completePaymentAction` with shift guard integration.
- **Dynamic imports**: Heavy framer-motion components (`PaymentPanel`/`PromotionPanel`) and `MobilePOSWrapper` imported via `next/dynamic` with `ssr: false` — not bundled in initial POS page load.
- **PWA icons**: All 12 icon sizes + 2 screenshots generated from `public/icon.svg` via sharp. `/offline` fallback page exists at `app/offline/page.tsx`.

- **Notification integration**: `lib/notification-service.ts` now exports `sendEmailNotification` (Resend) and `sendSMSNotification` (Africa's Talking). `lib/pos-actions.ts` rewired from direct `notification_logs` table inserts to calling the notification service. `RESEND_API_KEY`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `EMAIL_FROM`, `SMS_FROM` added to `lib/env.ts` (all optional).
- **Sales history search**: Server-side ILIKE on `receipt_number` via `searchSales()` server action with payment method filter, date range, and pagination. `client.tsx` uses `useCallback` debounce (300ms) instead of `useDeferredValue`.

## AI Functional Assistant (Phase 3+ Expansion)

The AI assistant has been expanded beyond analytics into a functional assistant that can perform actions:

**Architecture:**
- `lib/ai/types.ts` — Core types: ToolDefinition, ToolContext, ToolResult, ExecutionResult, ChatMessage
- `lib/ai/tool-registry.ts` — Central registry (singleton) for all tool definitions
- `lib/ai/executor.ts` — NL-to-action: parses user messages, identifies tool calls via OpenRouter, executes read tools immediately, returns write tools as pending actions for user confirmation
- `lib/ai/prompts.ts` — System prompt builder that serializes all tool schemas into the LLM prompt
- `lib/ai/tools/` — Tool implementations by domain:

| File | Tools |
|------|-------|
| `products.ts` | addProduct, updateProduct, searchProducts, getProductDetails, setReorderLevel |
| `customers.ts` | createCustomer, searchCustomers, getCustomerHistory, updateCustomer |
| `sales.ts` | searchSales, getSaleDetails, voidSale, getSalesSummary |
| `inventory.ts` | getStockLevel, getLowStockAlerts, transferStock, adjustInventory |
| `suppliers.ts` | createSupplier, searchSuppliers, getSupplierOrders, createPurchaseOrder |
| `employees.ts` | searchEmployees, getEmployeePerformance |
| `finance.ts` | getRevenueReport, getExpenseReport, getAccountBalance |
| `admin.ts` | createUser, assignRole, getBranchDetails, getSystemAuditLog, listBranches |

**Server actions:** `aiExecute(message, pageContext, history)` and `aiConfirmAction(tool, args)` in `lib/ai-actions.ts`

**UI:**
- `components/ai/floating-ai-button.tsx` — Floating FAB → Sheet with chat interface
- `components/ai/ai-assistant-chat.tsx` — Chat UI with message history, suggestion chips, action cards
- `components/ai/ai-action-card.tsx` — Pending write action with Confirm/Cancel
- `components/ai/ai-action-result.tsx` — Execution result display
- `hooks/use-ai-chat.ts` — Chat state management hook

**Tool format:** Tools are described as JSON schemas in the system prompt. The LLM responds with either `{"type":"text","content":"..."}` or `{"type":"tool_call","tool":"name","arguments":{...}}`. Read tools auto-execute; write tools require user confirmation.

**Models:** OpenRouter free tier (`meta-llama/llama-3.3-70b-instruct:free`, etc.) via `callOpenRouter()` — no paid API dependency. Key stored as `OPENROUTER_API_KEY` env var (optional; AI gracefully degrades).

**Payroll NaN fix:** Pure math functions moved from `'use server'` file to `lib/payroll-calculations.ts` (synchronous), removing `async` requirement that caused `Promise + Promise` concatenation → `NaN`. Dead `previewTaxCalculation` server action removed.

**Recent migrations applied:**
- `20260709000001_shift_cash_sync.sql` — register_id + drawer_id on shifts
- `20260709000002_fix_void_return_tables.sql` — void/return table fixes
- `20260709000003_fix_bank_reconciliation.sql` — bank reconciliation fixes
- `20260709000004_login_history.sql` — login history tracking
- `20260709000005_system_audit_log.sql` — system audit log
- `20260710000001_purchase_requisitions.sql` — purchase requisitions
- `20260710000002_po_attachments.sql` — purchase order attachments
- `20260710000003_supplier_returns.sql` — supplier returns
- `20260710000004_fix_stock_movements_return.sql` — stock movement fixes

## New Routes
- `ƒ /api/events/stream` — SSE real-time event stream
- `ƒ /api/health` — health check
- `ƒ /api/devices/heartbeat` — device heartbeat (POST)
- `○ /devices` — device management UI

## Conventions
- All new DB tables get RLS + indexes
- Server actions in `lib/*-actions.ts`, authenticated via `authenticateServerAction`
- API routes in `app/api/**/route.ts`, authenticated via `authenticateRequest`
- UI uses shadcn/ui components from `components/ui/`
- `npm run build` must pass before considering a sprint complete
- All state variables must use proper typed interfaces — no `useState<any>` allowed across the entire codebase
