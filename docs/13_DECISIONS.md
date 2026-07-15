# D-13: WINNMATT POS — Architecture Decision Log

author: OpenWork
verified_by: User
verification_status: Verified (Phase 0)
last_verified: 2026-07-14
confidence: High
stable_id: D-13

**Freshness:** 180 days (permanent)  
**@see** [AGENTS.md](../AGENTS.md) · [D-02](02_PRINCIPLES.md) · [ID_REGISTRY.md](ID_REGISTRY.md) (stable ID conventions) · [PROJECT_AUDIT_REPORT.md](PROJECT_AUDIT_REPORT.md) §3

---

Decision records use the format: **C-NNN — Title** · **YYYY-MM-DD** · **Status:** Accepted / Superseded / Proposed

---

## C-001 — Single Application for All Domains

**Date:** Undated — earliest commit `71564a2` (2026-07)  
**Status:** Accepted  

**Context:** The team chose between building separate systems (POS, inventory, finance, HR) or one integrated application.

**Decision:** Build one Next.js application covering all domains. Sales, inventory, finance, customers, suppliers, and workforce share one database and one auth system.

**Consequences:**
- ✅ Single login, single truth, cross-domain analytics possible
- ✅ No data synchronization between systems needed
- ❌ Application is larger and more complex than a single-purpose tool
- ❌ If one domain has a bug, it affects all domains

---

## C-002 — Supabase as Full-Stack Backend

**Date:** 2026-07 (inferred, early project)  
**Status:** Accepted  

**Context:** Needed a managed backend with PostgreSQL, authentication, real-time capabilities, and file storage.

**Decision:** Use Supabase (PostgreSQL + Auth + Realtime) as the complete backend. No custom backend server.

**Consequences:**
- ✅ Zero backend server management
- ✅ Built-in RLS for per-row access control
- ✅ Real-time subscriptions for live updates
- ❌ Database query patterns constrained by Supabase limits
- ❌ Migration from Supabase would require significant refactoring

---

## C-003 — Module Layer with Gradual Migration

**Date:** 2026-07 (Sprint 7)  
**Status:** Accepted  

**Context:** Server actions (`lib/*-actions.ts`) were called directly from pages. No interface boundary between pages and business logic. Tight coupling made refactoring risky.

**Decision:** Introduce `lib/modules/*/index.ts` adapters that delegate to the real actions. Migrate callers gradually (Sprint 10).

**Consequences:**
- ✅ Pages only import module adapters — implementation can change
- ✅ Migration can happen file by file without breaking builds
- ❌ Dual pattern (direct + module) during migration creates confusion
- ❌ 1 page (`purchases`) bypasses via `@/lib/procurement-actions` — no module adapter exists for procurement

---

## C-004 — Event Bus Factory: Redis or In-Memory

**Date:** 2026-07 (Sprint 4)  
**Status:** Accepted  

**Context:** Needed real-time event broadcasting for device heartbeats, shift changes, and sale notifications. Redis was desired for production but not available in local development.

**Decision:** Implement a factory pattern — `event-bus.ts` loads `_redis.ts` if `REDIS_URL` is set, otherwise falls back to `_in-memory.ts`. Graceful degradation on Redis disconnect.

**Consequences:**
- ✅ Local development works with zero dependencies
- ✅ Production can scale with Redis Pub/Sub
- ✅ Graceful fallback prevents hard failures
- ❌ In-memory mode loses events on restart (acceptable for dev)
- ❌ `REDIS_URL` not configured in current deployment — always in-memory

---

## C-005 — Shift-Enforced POS

**Date:** 2026-07 (Sprint 3)  
**Status:** Accepted  

**Context:** Cash accountability: every payment needed to be attributed to an open cashier shift. Without enforcement, payments could be made without a shift context.

**Decision:** Require an active shift before any payment. `useShiftGuard()` polls every 30s. `shiftId` flows through `AuthorizedSaleContext` → `completePaymentAction`. Payment guard shows "Start Shift" prompt.

**Consequences:**
- ✅ Every transaction attributable to a shift → cash accountability
- ✅ Shift reconciliation (float, count, over/short) is accurate
- ❌ Cannot process payments if shift times out or fails to open
- ❌ Additional polling overhead (30s interval)

---

## C-006 — Dynamic Imports for Heavy Components

**Date:** 2026-07 (Sprint 6)  
**Status:** Accepted  

**Context:** Framer Motion added ~30 KB to the POS page bundle. PaymentPanel and PromotionPanel used complex animations but weren't needed on initial render.

**Decision:** Use `next/dynamic` with `ssr: false` for `PaymentPanel`, `PromotionPanel`, and `MobilePOSWrapper`. They load only when the user opens them.

**Consequences:**
- ✅ POS page initial bundle stays small
- ✅ Faster time-to-interactive on mobile
- ❌ Brief loading state when panels first open
- ❌ Dynamic imports are harder to test

---

## C-007 — Direct M-Pesa Integration (No Aggregator)

**Date:** 2026-07 (inferred, early project)  
**Status:** Accepted  

**Context:** Needed M-Pesa payment processing. Options: direct Daraja API, or an aggregator (e.g., Lipa Na M-Pesa, iPay).

**Decision:** Integrate directly with Safaricom Daraja API (STK Push). No payment aggregator.

**Consequences:**
- ✅ No aggregator fees — direct processing
- ✅ Full control over the payment flow
- ❌ Must handle Daraja API quirks and rate limits directly
- ❌ Currently on sandbox keys — production requires application process
- ❌ No fallback if Daraja is down

---

## C-008 — OpenRouter for AI Assistant (Not Local LLM)

**Date:** 2026-07 (Sprint 8)  
**Status:** Accepted  

**Context:** Needed an LLM for the AI functional assistant. Options: local Ollama model, paid API (OpenAI/Anthropic), or OpenRouter free tier.

**Decision:** Use OpenRouter free tier (`meta-llama/llama-3.3-70b-instruct:free`). Key stored as optional env var. Graceful degradation if unset.

**Consequences:**
- ✅ Zero cost for AI assistant
- ✅ No local compute requirements
- ✅ Can switch models by changing the OpenRouter route
- ❌ Free tier may have rate limits or availability issues
- ❌ No data privacy guarantee (OpenRouter proxies to third-party models)

---

## Proposed: C-009 — Code-Only Graph (No Semantic Extraction)

**Date:** 2026-07-14  
**Status:** Proposed  

**Context:** First build of the project knowledge graph. Options: code-only AST extraction (fast, deterministic) or full semantic extraction with Gemini (slow, requires API key).

**Decision:** (Pending) Build code-only graph first (AST extraction). Skip semantic extraction until Gemini key is available. Code-only graph is useful as-is; semantic extraction requires a Gemini API key that has not been configured.

**Consequences:**
- ✅ 2,025 nodes, 6,715 edges built in seconds
- ✅ Zero API cost
- ❌ 2,415 dangling edges from skipped docs/images
- ❌ Documentation is invisible in the graph

---

## C-010 — Flat docs/ Layout (No docs/brain/ Subdirectory)

**Date:** 2026-07-14  
**Status:** Accepted  

**Context:** Brain documents needed a location. Options: `docs/brain/` subdirectory or flat in `docs/`.

**Decision:** Place all Brain documents flat in `docs/` with prefix numbering (00_, 02_, 07_, etc.) for alphabetical ordering.

**Consequences:**
- ✅ Shorter file paths, easier to find
- ✅ No nesting confusion
- ❌ docs/ directory becomes crowded as 21 files land
- ❌ Prefix numbering requires manual ordering

---

## Proposed: C-011 — Root Middleware for Auth

**Date:** 2026-07-14  
**Status:** Proposed  

**Context:** No centralized auth redirect, session refresh, or route protection. Each page handles auth independently.

**Decision:** (Pending) Add `middleware.ts` at project root for auth session check, redirect to `/login`, and session refresh.

**Rationale:** Flagged in PROJECT_AUDIT_REPORT.md as a high-priority gap.

---

*D-13 Decisions — last updated 2026-07-14. 9 accepted, 2 proposed.*
