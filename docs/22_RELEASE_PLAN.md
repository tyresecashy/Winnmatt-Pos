# WINNMATT POS — Release Plan

author: OpenWork
verified_by: Repository Audit (Phase 1C)
verification_status: Verified
last_verified: 2026-07-14
confidence: Medium
stable_id: D-22
**Freshness:** 90 days (living)

**@see** [INDEX.md](INDEX.md) · [15_ROADMAP.md](15_ROADMAP.md) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) · [FINAL_PRODUCTION_SIGNOFF.md](FINAL_PRODUCTION_SIGNOFF.md) · [PRODUCTION_LAUNCH_GATE.md](PRODUCTION_LAUNCH_GATE.md)

---

## Executive Summary

WINNMATT POS is currently at **CONDITIONAL RELEASE** status (🟡 per `FINAL_PRODUCTION_SIGNOFF.md`). The application compiles, tests pass, and core functionality works, but 7 of 13 environment variables are not configured, payment processing uses sandbox credentials, and error monitoring is not set up.

**Current deployment:** https://winnmattpos.vercel.app  
**Branch:** `all-fixes-and-features-20260705` (162 uncommitted modified files)

---

## Release Candidates

### RC-1 — Production Launch (Blocked)

**Gate score:** 86/100 (weighted)  
**Blockers:** 6 of 13 required env vars not configured; sandbox payments; Sentry not configured; in-memory event bus only

**Required before launch:**

| Item | Status | Owner |
|------|--------|-------|
| NEXT_PUBLIC_SUPABASE_URL | ✅ Configured | — |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ Configured | — |
| SUPABASE_SERVICE_ROLE_KEY | ✅ Configured | — |
| MPESA_CONSUMER_KEY | ❌ Missing | Operations |
| MPESA_CONSUMER_SECRET | ❌ Missing | Operations |
| MPESA_PAYBILL | ❌ Missing | Operations |
| MPESA_PASSKEY | ❌ Missing | Operations |
| MPESA_CALLBACK_URL | ❌ Missing | Operations |
| STRIPE_SECRET_KEY | ❌ Missing | Finance |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | ✅ Configured | — |
| SENTRY_ORG | ❌ Missing | Development |
| SENTRY_PROJECT | ❌ Missing | Development |
| REDIS_URL | ❌ Not configured | DevOps |

### RC-2 — Architecture Hardening (Phase 4)

**Target gates:**
- Root middleware.ts implemented (C-011)
- Suspense boundaries on all dashboard pages
- M-Pesa/Stripe production credentials
- Sentry error monitoring active
- At least Redis-based rate limiting (or ready for it)

### RC-3 — Full Production

**Target gates:**
- E2E tests passing (Playwright)
- Load testing completed (k6)
- CSP upgraded to nonce-based
- All env vars configured
- Penetration testing completed

---

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| v0.1.0 | 2026-07 | 🟡 CONDITIONAL | Initial release candidate |
| v0.2.0 | 2026-07 (Phase 1B) | 🟡 CONDITIONAL | Architecture docs complete |
| v0.3.0 | Phase 1C | 🟡 In progress | Brain completion |
| v1.0.0 | Future | 🔲 Planned | Production GA |

---

## Key Milestones

| Milestone | Target | Gate Criteria |
|-----------|--------|---------------|
| All env vars configured | Before RC-1 | 13/13 vars present in Vercel |
| Middleware deployed | Before RC-2 | middleware.ts at root, tests pass |
| Production payments | Before RC-1 | M-Pesa + Stripe with live keys |
| Sentry active | Before RC-1 | Error reporting visible in Sentry dashboard |
| E2E tests passing | Before RC-3 | Playwright suite in CI |
| Penetration test | Before v1.0.0 | Third-party security audit |

---

## Rollback Plan

- **Vercel:** Instant rollback via Vercel dashboard (previous deployment)
- **Database:** Supabase point-in-time recovery (7-day retention)
- **Migration rollback:** Down migrations not yet written — manual SQL revert if needed

---

## Known Limitations

1. **No down migrations** — All migrations are forward-only. DB rollback requires manual SQL.
2. **No feature flags in production** — Feature flag system exists (`lib/feature-flags.ts`) but is not wired into any features.
3. **No blue/green deployment** — Vercel deploys directly to production (preview deploys available for testing).
4. **No automated rollback** — Rollback requires manual Vercel dashboard action.
5. **No canary releases** — Single deployment target, no traffic splitting.

---

## Future Direction

1. Create down migrations for all existing migrations
2. Wire feature flags into key features (new UI components, experimental AI tools)
3. Set up preview deployments for every PR
4. Document the full release workflow in CI/CD
5. Establish a bi-weekly release cadence after v1.0.0
