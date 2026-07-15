# D-02: WINNMATT POS — Engineering & Architecture Principles

author: OpenWork
verified_by: User
verification_status: Verified (Phase 0)
last_verified: 2026-07-14
confidence: High
stable_id: D-02

**Freshness:** 180 days (permanent)  
**@see** [AGENTS.md](../AGENTS.md) · [D-00](00_VISION.md) (vision) · [D-13](13_DECISIONS.md) (ADR log) · [PROJECT_AUDIT_REPORT.md](PROJECT_AUDIT_REPORT.md) §3 · [GRAPH_AUDIT_REPORT.md](GRAPH_AUDIT_REPORT.md)

---

## Architecture Principles

### 1. Module Layer with Shared Contracts

All business operations flow through `lib/modules/*/index.ts` adapters. These adapters delegate to real `lib/*-actions.ts` implementations. Shared contracts live in `lib/shared/contracts.ts`.

**Why:** Decouples the API surface from implementation. A page imports `lib/modules/sales` — the underlying implementation can change without touching the page.

**Status:** 25 modules (24 domain + 1 core with 7 infrastructure files). All pages use module imports (Phase 1A verified — `purchases/page.tsx` is the last confirmed page migrated from direct `@/lib/procurement-actions` to `@/lib/modules/procurement`).

### 2. Auth-Guarded Server Actions

Every server action authenticates via `authenticateServerAction()`. Every API route authenticates via `authenticateRequest()`.

**Why:** Prevents unauthorized database access. Keeps auth logic centralized.

**Roles:** `super_admin`, `admin`, `manager`, `cashier` — enforced at RLS + application level.

**Known gap:** No root-level middleware for auth redirect/session refresh. Each page handles its own auth check.

### 3. Factory Pattern for Infrastructure

The event bus uses a factory: `event-bus.ts` → `_in-memory.ts` or `_redis.ts`, selected at module load time via `REDIS_URL` env var.

**Why:** Allows local development with zero dependencies (in-memory) while scaling to production (Redis Pub/Sub on channel `pos:events`). Graceful fallback if Redis disconnects.

### 4. Shift-Enforced POS

All payments require an active shift. `useShiftGuard()` polls every 30 seconds. `shiftId` flows through `AuthorizedSaleContext` → sale insert as `shift_id`.

**Why:** Cash accountability. Every transaction is attributed to an open shift. No payment without shift.

### 5. Dynamic Imports for Heavy Components

`PaymentPanel`, `PromotionPanel`, `MobilePOSWrapper` — all dynamically imported with `ssr: false`.

**Why:** Heavy framer-motion dependencies not bundled in initial page load. POS page stays fast on mobile.

### 6. Type Safety First

Zod validation on env vars (`lib/env.ts`) and API payloads. Strict TypeScript mode (`strict: true` in tsconfig.json). Target: zero `useState<any>` across the entire codebase.

**Status:** ✅ Zero `any` positions — Sprint 10 completed. Phase 1A/1B verified zero `as any` across the entire codebase. 296 `as unknown` casts remain (Supabase type staleness).

### 7. Event-Driven Real-Time Updates

Events flow: action → event bus (Redis/in-memory) → SSE stream (`/api/events/stream`) → client. Types filter available.

**Why:** Decouples event producers from consumers. Multiple subscribers without modifying the producer.

---

## Coding Conventions

| Convention | Rule |
|------------|------|
| **Database** | All new tables get RLS + indexes |
| **Server actions** | `lib/*-actions.ts`, auth via `authenticateServerAction()` |
| **API routes** | `app/api/**/route.ts`, auth via `authenticateRequest()` |
| **UI** | shadcn/ui from `components/ui/` |
| **State** | Typed interfaces — no `useState<any>` |
| **Build** | `npm run build` must pass before sprint complete |
| **Tests** | All tests must pass (`npm test`) before considering a task done |

---

## Key Architecture Patterns

| Pattern | Implementation | Location |
|---------|---------------|----------|
| **Module layer** | 25 modules with public API + optional repository | `lib/modules/` |
| **Shared contracts** | Types for events, health, audit, notifications, currency | `lib/shared/contracts.ts` |
| **Event bus** | Factory pattern (Redis or in-memory) | `lib/realtime/` |
| **AI assistant** | OpenRouter LLM + tool registry | `lib/ai/` |
| **Notifications** | Email (Resend), SMS (Africa's Talking), Push (FCM), Webhook | `lib/notification-service.ts` |
| **Analytics** | 6 domain services + report builder | `lib/analytics/` |
| **Enterprise** | 12 sub-directories (audit through testing) | `lib/enterprise/` |
| **Automation** | Engine built and tables exist, UI not wired | `lib/automation/` |
| **Payments** | M-Pesa (Daraja) + Stripe gateway | `lib/payments/` |

---

## Technology Choices & Rationale

| Choice | Rationale |
|--------|-----------|
| Next.js 16 + React 19 | App Router, SSR/ISR, API routes in one framework |
| Supabase PostgreSQL | Managed Postgres with built-in Auth, Realtime, RLS |
| Tailwind CSS + shadcn/ui | Utility-first + accessible component library |
| Framer Motion 12 | Animation library with good React 19 support |
| Redis (optional) | Event bus Pub/Sub for multi-instance deployments |
| Vercel | Zero-config deployment, ISR support |
| Vitest | Fast, compatible with Vite/Turbopack toolchain |

---

## Principles Violations (Known)

| Violation | Impact | Status |
|-----------|--------|--------|
| No root middleware | Each page handles auth independently → inconsistent behavior | 🔴 Open |
| 3 copies of `useIsMobile()` | Inconsistent breakpoint, maintainability risk | 🔄 Phase 1A — ✅ FIXED — canonical at `hooks/use-mobile.ts`, others deprecated |
| ~150 `any` positions | Type safety gaps | 🔄 Sprint 10 |
| Module layer bypass (purchases page) | Was importing `@/lib/procurement-actions` directly | 🔄 Phase 1A — ✅ FIXED |
| README.md outdated | Was showing "12 core tables" (~147 actual) | 🔄 Phase 1A — ✅ FIXED |
| No React Suspense boundaries | Data-fetching pages block rendering | 🔴 Open |

---

*D-02 Principles — last updated 2026-07-14.*
