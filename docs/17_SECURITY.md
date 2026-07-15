# WINNMATT POS — Security Model

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: Medium
stable_id: D-06
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) · [13_DECISIONS.md](13_DECISIONS.md) (C-011 middleware ADR) · `AGENTS.md` (RBAC conventions) · `PRODUCTION_READINESS_CHECKLIST.md`

---

## Executive Summary

Security in WINNMATT POS is implemented at three layers: **Supabase RLS** (database level), **server action authentication** (application level), and **API middleware** (API route level). RBAC is enforced via a `users` table with `role` column. No root Next.js middleware exists. Rate limiting is in-memory only. Security headers are configured in `next.config.mjs`.

**Status:** 🟡 No critical gaps, but several improvements needed before production confidence.

---

## Authentication

### User Authentication
- **Provider:** Supabase Auth (email/password, magic link)
- **Session:** Managed via `@supabase/ssr` package (cookie-based)
- **Server action auth:** `authenticateServerAction()` in `lib/auth-helpers.ts` (585 lines)
- **API route auth:** `withAuth()` middleware in `lib/api/middleware.ts` (Bearer token → Supabase `getUser()`)

### Protected Routes
- All server actions authenticate via cookie session
- All API routes (19) use `withAuth()` which extracts Bearer token and validates with Supabase
- Dashboard pages use layout-level auth checks

### Missing: Root Middleware
- No `middleware.ts` at root level (C-011 is Proposed)
- No centralized request filtering, session refresh, or redirect logic
- Auth is handled per-route/per-action rather than at the edge

---

## Authorization (RBAC)

| Role | Scope | Capabilities |
|------|-------|-------------|
| `admin` | Global | Full system access, user management, config |
| `manager` | Branch-scoped | Read/write for assigned branch, view reports |
| `cashier` | Branch-scoped | Create sales, read products/customers, shift management |
| `viewer` | Global | Read-only access to permitted data |

- Roles stored in `users.role` column
- RBACchecked via `requireRole(ctx, ...roles)` in API middleware
- Server actions check role via `authenticateServerAction()` which returns user context
- No role hierarchy — each role is explicitly checked

---

## Row Level Security (RLS)

- RLS enabled on all application tables (40+ migrations include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- Policies follow the role pattern: admin = full access, manager/cashier = branch-scoped
- RLS enforced at the Supabase level — bypassing app layer doesn't bypass RLS
- Some tables may use service_role key (bypasses RLS) for server-side operations

---

## API Security

### Middleware Pipeline (`lib/api/middleware.ts`)
1. **Authentication** — Bearer token → Supabase `getUser()` → APIContext
2. **Rate limiting** — In-memory token-bucket per userId+route
3. **CORS** — Explicit allowlist (winnmatt.com, Vercel previews, localhost)
4. **Error handling** — Catches all errors, returns 500 with generic message

### Rate Limiting (`lib/api/rate-limiter.ts`)
- In-memory only (not persisted, not distributed)
- Token-bucket algorithm per user+route
- Resets on server restart

---

## Security Headers (next.config.mjs)

| Header | Value | Status |
|--------|-------|--------|
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `X-XSS-Protection` | `1; mode=block` | ✅ |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ✅ |
| `Content-Security-Policy` | See next.config.mjs | ✅ (unsafe-inline for scripts) |

CSP note: Uses `'unsafe-inline'` for scripts (Next.js requirement). Migration to `'strict-dynamic'` or nonce-based CSP is a TODO.

---

## Payment Security

### M-Pesa
- Direct API integration (no aggregator — C-007)
- Credentials stored in env vars (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`)
- Callbacks validated via passkey verification
- Sandbox by default (`MPESA_ENVIRONMENT=sandbox`)

### Stripe
- `lib/stripe-actions.ts` handles Stripe API calls
- `lib/payments/gateway.ts` **does not exist** (documented but never created)
- Webhook receiver validates Stripe signatures
- Stripe keys stored in env vars

---

## Data Protection

- **Logger** (`lib/logger.ts`) — Automatic PII redaction (phone numbers, UUIDs, transaction refs, API keys)
- **No secrets in code** — All credentials in environment variables (zod-validated via `lib/env.ts`)
- **No client-side secrets** — Only `NEXT_PUBLIC_*` vars exposed to browser

---

## Known Gaps

| Issue | Severity | Status |
|-------|----------|--------|
| No root middleware for auth filtering | **High** | C-011 Proposed |
| Rate limiting is in-memory (resets on restart) | Medium | Would need Redis |
| CSP uses unsafe-inline for scripts | Medium | TODO noted in config |
| No audit log for auth failures | Medium | Would need middleware |
| No brute-force protection on login | Medium | Supabase default only |
| `lib/payments/gateway.ts` missing | Low | Stripe works via stripe-actions.ts |
| No CSRF token validation | Low | Next.js server actions have built-in CSRF |
| No API key rotation policy | Low | Manual process |
| No Penetration testing done | Low | Pre-production task |

---

## Future Direction

1. Implement root middleware.ts (C-011) for centralized auth, session refresh, and request filtering
2. Move rate limiting to Redis for persistence across deployments
3. Upgrade CSP to 'strict-dynamic' or nonce-based
4. Add auth failure audit logging
5. Implement brute-force protection on login routes
6. Schedule penetration testing before production launch
7. Create `DEVELOPER_CHECKS.md` with security review checklist
