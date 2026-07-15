# WINNMATT POS — Architecture Overview

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: High
stable_id: D-01
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) (navigation map) · [02_PRINCIPLES.md](02_PRINCIPLES.md) (engineering principles) · [04_MODULE_MAP.md](04_MODULE_MAP.md) (module details) · [13_DECISIONS.md](13_DECISIONS.md) (ADRs)

---

## Executive Summary

WINNMATT POS is a single-tenant, multi-branch Point of Sale system built on Next.js 14 (App Router) with Supabase as the backend. It follows a **layered architecture**: a Next.js UI layer → server actions/API routes → a module adapter layer → thin action files → Supabase client queries. The system supports real-time events (SSE + Redis Pub/Sub), offline-capable POS, shift-enforced cash management, M-Pesa/Stripe payments, and an AI functional assistant.

**Stack:** TypeScript, Next.js 14 App Router, Supabase (Postgres + Auth + Realtime), Redis (optional), M-Pesa API, Stripe, Resend (email), Africa's Talking (SMS), OpenRouter (AI), shadcn/ui, Tailwind CSS, framer-motion, Sentry.

**Deployment:** Vercel (frontend) + Supabase (database/auth). Single Next.js application serving all domains (retail, finance, HR, inventory, CRM).

---

## Stable IDs

| Prefix | Scope | Registered | Notes |
|--------|-------|------------|-------|
| D-01 | This document | ✅ | Architecture overview |
| M-00–24 | Module layer | 25 | See [ID_REGISTRY.md](ID_REGISTRY.md) |
| API-001–019 | API routes | 19 | See ID_REGISTRY.md |
| C-001–011 | Decisions | 9 accepted, 2 proposed | See [13_DECISIONS.md](13_DECISIONS.md) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 14 App Router                    │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────────────┐  │
│  │ Dashboard │ │   POS UI    │ │  AI Assistant Chat     │  │
│  │  (77+     │ │ (mobile/    │ │  (floating FAB +       │  │
│  │  routes)  │ │  desktop)   │ │  command palette)      │  │
│  └────┬─────┘ └──────┬───────┘ └──────────┬─────────────┘  │
│       │              │                    │                │
│  ┌────▼──────────────▼────────────────────▼─────────────┐  │
│  │           Server Actions (lib/*-actions.ts)            │  │
│  │     + API Routes (app/api/**/route.ts, 19 endpoints)   │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │           Module Adapter Layer (lib/modules/*/)        │  │
│  │     25 modules with index.ts adapters + repository.ts  │  │
│  │     Core module: audit-engine, business-clock,         │  │
│  │     correlation-id, idempotency-manager,               │  │
│  │     identity-context, lock-manager, repository         │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │  Direct Action Files (lib/*-actions.ts, 58 files)     │  │
│  │  → Legacy: being replaced by module adapter layer      │  │
│  │  → Each imports supabase client, authenticates,        │  │
│  │    runs DB queries                                     │  │
│  └──────────────────────┬────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   External Services                          │
│  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────┐ ┌────────┐  │
│  │ Supabase │ │  Redis   │ │M-Pesa│ │Stripe│ │Sent ry │  │
│  │ (PG+Auth │ │ (optional│ │ API  │ │ API  │ │        │  │
│  │ +Realtime│ │  event   │ │      │ │      │ │        │  │
│  │ +Storage)│ │  bus)    │ │      │ │      │ │        │  │
│  └──────────┘ └──────────┘ └──────┘ └──────┘ └────────┘  │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────────┐   │
│  │ Resend   │ │ Africa's    │ │ OpenRouter (AI/LLM)  │   │
│  │ (Email)  │ │ Talking(SMS)│ │ (optional, degrades) │   │
│  └──────────┘ └──────────────┘ └──────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### 1. UI Layer (app/ + components/)
- **`app/(dashboard)/**` — 77 route directories, 96 `page.tsx` files covering all business domains
- **`app/api/**` — 19 REST API routes (auth, devices, events, health, imports, M-Pesa, prices, Stripe, v1)
- **`components/ui/`** — 42 shadcn/ui-based primitive components
- **`components/` domain dirs** — per-domain (ai/, pos/, reports/, employees/, shifts/, etc.)
- **`hooks/`** — 9 custom React hooks (use-mobile, use-ai-chat, use-device-heartbeat, use-shift-guard, etc.)

### 2. Server Action Layer (lib/*-actions.ts)
- 58 server action files, each a collection of `'use server'` exported functions
- Authenticated via `authenticateServerAction()` (reads session cookie)
- Each action imports `createClient()` from `lib/supabase-server.ts`
- **Migration in progress:** Direct calls being replaced by module adapter calls

### 3. Module Adapter Layer (lib/modules/*/)
- 25 modules with `index.ts` adapter entry points
- Adapters delegate to underlying `lib/*-actions.ts` functions
- Core module (`lib/modules/core/`) provides shared infrastructure (7 files)
- **Status:** Sprint 10 migration — module adapter structure complete for all 25 modules; some bypass routes remain in UI pages

### 4. Infrastructure Layer
- **Event bus** (`lib/realtime/`): Factory pattern — Redis Pub/Sub on `pos:events` or in-memory fallback
- **SSE** (`/api/events/stream`): Generic event stream with `?types=` filter
- **Logger** (`lib/logger.ts`): JSON-structured logging with PII redaction
- **Rate limiter** (`lib/api/rate-limiter.ts`): In-memory token-bucket per user+route
- **API middleware** (`lib/api/middleware.ts`): Authentication + rate limiting + CORS pipeline for API routes
- **Feature flags** (`lib/feature-flags.ts`): DB-backed toggle system

---

## Key Architectural Decisions

See [13_DECISIONS.md](13_DECISIONS.md) for complete ADR log. Summary of active decisons:

| C-ID | Decision | Status | Rationale |
|------|----------|--------|-----------|
| C-001 | Single app for all domains | Accepted | Avoid microservice complexity; POS, finance, HR in one Next.js app |
| C-002 | Supabase full-stack backend | Accepted | Postgres + Auth + Realtime + Storage in one product |
| C-003 | Module layer with gradual migration | Accepted | Isolate domain logic without rewriting all at once |
| C-004 | Event bus factory: Redis or in-memory | Accepted | Dev/prod parity; graceful degradation |
| C-005 | Shift-enforced POS | Accepted | Cash accountability per cashier shift |
| C-006 | Dynamic imports for heavy components | Accepted | Initial bundle size optimization for POS page |
| C-007 | Direct M-Pesa integration | Accepted | No aggregator dependency; Kenya-specific optimization |
| C-008 | OpenRouter for AI assistant | Accepted | Free-tier LLM access; no paid API dependency |
| C-010 | Flat docs/ layout | Accepted | No nested brain/ subdirectory |
| C-009 | Code-only graph (no semantic extraction) | Proposed | Deferred — needs Gemini key |
| C-011 | Root middleware for auth | Proposed | Not yet implemented |

---

## Known Limitations

1. **No root middleware.ts** — C-011 is Proposed, not Accepted. Auth is handled per-route via `authenticateServerAction()` and `authenticateRequest()`, but there is no global middleware for request filtering, redirects, or header injection.
2. **Module migration incomplete** — Some UI pages bypass module adapters and call `lib/*-actions.ts` directly. ~41 files flagged for migration in Sprint 10.
3. **`lib/payments/gateway.ts` missing** — Referenced in AGENTS.md but does not exist on disk. Stripe integration routed through `lib/stripe-actions.ts` directly.
4. **No React Suspense boundaries** — Zero Suspense boundaries exist anywhere in the component tree.
5. **Offline support is minimal** — `/offline` route exists with a fallback page, but no full offline transaction queue.
6. **Testing gap in enterprise modules** — 12 enterprise sub-modules have zero dedicated test files.

---

## Future Direction

1. **Phase 1C** — Create root middleware.ts, complete module migration, add Suspense boundaries
2. **Phase 2** — Full brain documentation: roadmap, bugs, features, module map, database schema
3. **Phase 3** — AI assistant spec, prompt library, tool review
4. **Phase 4** — AI+POS integration (voice POS, auto-pricing)
5. **Phase 5** — Autonomous BI (auto-generated reports, anomaly detection)
