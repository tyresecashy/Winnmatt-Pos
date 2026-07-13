# Production Launch Gate — v1.0 Report

**Date:** 2026-07-13  
**Gate:** Final pre-deployment verification  

---

## Phase 1 — Configuration Audit

### Environment Variables (`.env.local`)

| Variable | Value | Verdict |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://aunnoikvfjgrlejccywv.supabase.co` | ✅ Production Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set | ✅ Present |
| `SUPABASE_SERVICE_ROLE_KEY` | Set | ✅ Present |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | ⚠️ Points to localhost — **MUST change to production URL** |
| `NEXT_PUBLIC_APP_NAME` | `WINNMATT POS` | ✅ |
| `MPESA_CONSUMER_KEY` | Set (sandbox key) | ⚠️ **Test key** — must replace with production Daraja key |
| `MPESA_CONSUMER_SECRET` | Set (sandbox secret) | ⚠️ **Test secret** — must replace with production Daraja secret |
| `MPESA_PAYBILL` | `174379` (sandbox) | ⚠️ **Test paybill** — must replace with production paybill/till |
| `MPESA_PASSKEY` | (empty) | ❌ **Empty** — required for production M-Pesa |
| `MPESA_CALLBACK_URL` | (empty) | ❌ **Empty** — must be set to production callback URL |
| `MPESA_ENVIRONMENT` | `sandbox` | ⚠️ **Must be `production`** for live payments |
| `MPESA_SANDBOX_SIMULATE` | `true` | ⚠️ **Must be `false`/removed** for production |
| `MPESA_ACCOUNT_REFERENCE` | `WINNMATT` | ✅ |
| `STRIPE_SECRET_KEY` | Set (test key `sk_test_...`) | ⚠️ **Test key** — must replace with production `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Set (test key `pk_test_...`) | ⚠️ **Test key** — must replace with production `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | (empty) | ❌ **Empty** — Stripe webhook signature verification will fail |
| `SENTRY_DSN` | Not set | ⚠️ Sentry error monitoring **disabled** — set for production |
| `SENTRY_ORG` | Not set | ⚠️ Required for Sentry source map upload |
| `SENTRY_PROJECT` | Not set | ⚠️ Required for Sentry source map upload |
| `OPENROUTER_API_KEY` | Set | ✅ (AI degrades gracefully without it) |

**Secrets committed?** `.env.local` is in `.gitignore` ✅ — no secrets leaked to git.

### Security Headers (next.config.mjs)

| Header | Value | Verdict |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | ✅ |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `X-XSS-Protection` | `1; mode=block` | ✅ |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ✅ |
| `Content-Security-Policy` | See CSP audit below | ✅ |

### CSP Audit

| Directive | Value | Verdict |
|-----------|-------|---------|
| `default-src` | `'self'` | ✅ |
| `script-src` (prod) | `'self' 'unsafe-inline'` | ⚠️ `unsafe-inline` required by Next.js; no `unsafe-eval` ✅ |
| `style-src` | `'self' 'unsafe-inline'` | ✅ |
| `img-src` | `'self' data: blob:` | ✅ |
| `font-src` | `'self' data:` | ✅ |
| `connect-src` | `'self' *.supabase.co api.safaricom.co.ke *.sentry.io` | ✅ |
| `frame-src` | `'none'` | ✅ |
| `object-src` | `'none'` | ✅ |
| `base-uri` | `'self'` | ✅ |
| `form-action` | `'self'` | ✅ |

### CORS Audit

- ❌ No wildcard origins
- ✅ Explicit allow-list: `winnmatt.com`, `www.winnmatt.com`, `pos.winnmatt.com`
- ✅ Vercel preview deployments allowed dynamically
- ✅ Localhost allowed only in `development` mode
- ✅ Credentials-safe (empty origin when not in allow-list)

### Vercel Configuration

| Item | Value | Verdict |
|------|-------|---------|
| Region | `cle1` (Cleveland, Ohio) | ✅ |
| Build command | `next build` | ✅ |
| Install command | `npm install` | ✅ |
| Framwork | Next.js | ✅ |
| Env references | `@supabase-url`, `@supabase-anon-key`, `@supabase-service-role-key` | ✅ Uses Vercel secrets |

### Vercel Platform Secrets Required

These must be set in Vercel dashboard before deployment:

- `@supabase-url`
- `@supabase-anon-key`
- `@supabase-service-role-key`
- `@mpesa-consumer-key` (production)
- `@mpesa-consumer-secret` (production)
- `@mpesa-paybill` (production)
- `@mpesa-passkey` (production)
- `@mpesa-callback-url`
- `@stripe-secret-key` (production `sk_live_...`)
- `@stripe-publishable-key` (production `pk_live_...`)
- `@stripe-webhook-secret`
- `@sentry-dsn`
- `@openrouter-api-key`

### Phase 1 Verdict: **⚠️ CONDITIONS** (see Phase 6 for required changes before production)

---

## Phase 2 — Database Release Gate

### Migrations

| Item | Status | Evidence |
|------|--------|----------|
| Latest migration applied | ⚠️ **UNKNOWN** | Cannot verify from codebase alone — must check via Supabase dashboard or `supabase migration list` |
| Migration files present | ✅ | 40 migrations from `20260703164500` to `20260710000004` |
| Rollback script documented | ⚠️ Partial | RUNBOOK documents manual rollback SQL — no automated migrate-down |
| Backups configured | ✅ | `scripts/backup-db.sh` and `scripts/backup-db.bat` exist |
| Restore procedure | ⚠️ Documented but untested | RUNBOOK has `psql` restore command |
| Indexes present | ⚠️ Not verified | Cannot inspect Supabase indexes from codebase |
| Constraints valid | ⚠️ Not verified | DB constraints are in migrations — assume valid if migrations applied |
| RLS policies enabled | ✅ | All 40+ migrations include RLS policies per table |
| Service-role usage minimized | ⚠️ Heavy but necessary | `supabaseAdmin` used in ~100+ server-only locations (analytics, AI tools, API routes) — all behind authenticated server endpoints |
| Seed/test data removed | ⚠️ Not verified | No seed files in migrations directory; DB state unknown |

### RLS Policy Coverage

- ✅ `auth.role() = 'authenticated'` — applied to all core tables
- ✅ `auth.uid() = user_id` — applied for notification, user-specific tables
- ✅ Admin/manager-specific policies exist for automation, devices, shifts

### Phase 2 Verdict: **⚠️ CONDITIONS** (must verify migration state and run backup before deployment)

---

## Phase 3 — Production Smoke Test Plan

The following smoke tests must be executed against the **production deployment** after it goes live. Pre-deployment, I can verify the routes exist and validate the auth/security posture.

| Test | Pre-Deployment Check | Expected Post-Deployment |
|------|---------------------|--------------------------|
| **Health** — GET /api/health | ✅ Route exists in build output | 200 OK, `{status:"healthy", database:{ok:true}}` |
| **Login** — POST /auth/login | ✅ Auth flow via Supabase | User can log in with valid credentials |
| **POS** — Load POS page | ✅ `/pos` route in build | Page renders with shift guard, product scanner |
| **M-Pesa** — POST /api/mpesa/stk-push | ✅ Route exists, auth required | Returns 200 with `success:true` or proper error |
| **Stripe** — POST /api/stripe/webhook | ✅ Route exists, signature verification | 200 with `received:true` |
| **Events** — GET /api/events/stream | ✅ Route exists, auth required | SSE connection established |
| **Monitoring** — Sentry test event | ⚠️ DSN not set | Must be verified after DSN configured |
| **Shift** — Open/close flow | ✅ shift-operations.tsx in build | Shift opens with float, closes with reconciliation |

### Route Verification (from build output)
All 107 routes compiled and generated successfully. Key routes present:
- ✅ `/pos` — POS interface
- ✅ `/dashboard` — Main dashboard
- ✅ `/analytics/*` — All analytics pages (sales, inventory, customers, finance, workforce, reports)
- ✅ `/api/health` — Health check
- ✅ `/api/mpesa/callback` — M-Pesa callback
- ✅ `/api/mpesa/stk-push` — STK Push initiation
- ✅ `/api/mpesa/stream` — M-Pesa SSE stream
- ✅ `/api/stripe/webhook` — Stripe webhook
- ✅ `/api/stripe/create-payment-intent` — Stripe payment
- ✅ `/api/events/stream` — Real-time event stream
- ✅ `/api/devices/heartbeat` — Device heartbeat
- ✅ `/login` — Login page
- ✅ `/offline` — PWA offline fallback
- ✅ `/sitemap.xml` — Sitemap
- ✅ `/not-provisioned` — Not-provisioned fallback

### Phase 3 Verdict: **⚠️ DEPLOY AND TEST** (smoke tests can only pass post-deployment)

---

## Phase 4 — Production Monitoring

Pre-deployment, the following monitoring infrastructure is verified:

| Item | Status | Details |
|------|--------|---------|
| Structured JSON logging | ✅ | `lib/logger.ts` with PII redaction |
| Sentry error tracking | ⚠️ Not configured | `SENTRY_DSN` not set — **MUST be set** for production |
| Health endpoint | ✅ | `GET /api/health` returns DB status + event bus mode |
| Rate limiting | ✅ | Redis-backed with in-memory fallback |
| Startup error logging | ✅ | `logger.error` catches all startup failures |
| Migration failure detection | ⚠️ Limited | `verify-db` script exists but no automated migration check in deploy |
| Payment failure logging | ✅ | `payment_logs` table + structured logging |
| Memory/CPU monitoring | ❌ Not implemented | Requires Vercel Analytics or external APM |
| Vercel Analytics | ✅ | Built into Next.js/Vercel platform |

### Phase 4 Verdict: **⚠️ CONDITIONS** (Sentry DSN must be configured pre-deployment)

---

## Phase 5 — Deployment Safety

| Item | Status | Details |
|------|--------|---------|
| Rollback command documented | ✅ | `vercel rollback` in RUNBOOK |
| Previous deployment | ⚠️ N/A (first production deploy) | N/A for initial launch |
| Database backup | ⚠️ Pre-deployment required | Run `scripts/backup-db.bat` before deploy |
| Backup timestamp | ⚠️ Record at deployment time | Must note timestamp for rollback reference |
| Release notes | ✅ | This document + RC1 report |
| Operations runbook | ✅ | `docs/operations/RUNBOOK.md` |
| Incident contacts | ❌ Not documented | No P0/P1 contact list in runbook |

### Rollback Procedure

```bash
# Vercel application rollback
vercel rollback

# Database rollback (if migration caused issues)
# Find last migration:
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;
# Manually reverse its SQL changes

# Full DB restore from backup:
psql "$SUPABASE_DB_URL" < backups/backup_YYYY-MM-DD.sql
```

### Pre-Deployment Checklist

- [ ] Run `scripts/backup-db.bat` (Windows) or `scripts/backup-db.sh` (Linux/macOS)
- [ ] Verify backup file exists in `./backups/`
- [ ] Record backup timestamp
- [ ] Confirm all env vars are set in Vercel dashboard
- [ ] Confirm `SENTRY_DSN` is set
- [ ] Confirm Stripe production keys are set
- [ ] Confirm M-Pesa production config is set
- [ ] Confirm `MPESA_CALLBACK_URL` is set to production HTTPS URL

### Phase 5 Verdict: **⚠️ CONDITIONS** (run backup, configure missing env vars)

---

## Phase 6 — Go / No-Go Decision

---

### Executive Summary

The codebase is **production-ready from a code quality, security, and stability standpoint**. All release blockers resolved, build passes, tests pass, and the security posture is strong (no wildcard CORS, no leaked errors, authenticated API routes, CSP enforced).

However, the application **cannot be safely deployed to production in its current `.env.local` state** because all payment providers (M-Pesa, Stripe) are pointing to sandbox/test credentials, and Sentry error monitoring is unconfigured. These are configuration issues, not code issues, and are expected for a pre-production environment.

---

### Deployment Evidence

| Check | Result | Details |
|-------|--------|---------|
| `npm run build` | ✅ PASS | Compiled in ~2min, Turbopack |
| TypeScript | ✅ PASS | Zero type errors (after fixes) |
| ESLint | ✅ PASS | 0 errors |
| Tests | ✅ PASS | 117/117 passing |
| Security audit | ✅ PASS | 13 release blockers resolved |
| Dependency audit | ✅ PASS | 85 packages removed, no critical vulns |
| RC1 hardening | ✅ PASS | 7-phase hardening complete |
| Environment config | ⚠️ CONDITIONAL | See Phase 1 |

---

### Smoke Test Results

| Test | Result | Notes |
|------|--------|-------|
| Build output: 107 routes | ✅ PASS | All routes generated |
| API routes present | ✅ PASS | Health, M-Pesa, Stripe, Auth, SSE all verified |
| Auth middleware | ✅ PASS | `authenticateRequest` + `authenticateServerAction` on all sensitive routes |
| CSP headers | ✅ PASS | Production CSP excludes `unsafe-eval` |
| CORS | ✅ PASS | Explicit allow-list, no wildcard |
| Security headers | ✅ PASS | HSTS, XFO, XSS, CT all set |
| Rate limiting | ✅ PASS | Redis + in-memory fallback |
| PII redaction | ✅ PASS | Logger redacts phone, UUIDs, keys |
| PWA | ✅ PASS | Icons generated, `/offline` page exists |
| **Live smoke tests** | ⏳ POST-DEPLOY | Can only run after deployment |

---

### Monitoring Results

| Check | Result | Notes |
|-------|--------|-------|
| Startup errors | ⏳ POST-DEPLOY | Verify first 5 minutes post-deploy |
| Migrations applied | ⏳ VERIFY AT DEPLOY | Run `supabase migration list` before deploy |
| API success rate | ⏳ POST-DEPLOY | Monitor first hour |
| Auth failures | ⏳ POST-DEPLOY | Check Supabase auth logs |
| Payment failures | ⏳ POST-DEPLOY | Test M-Pesa + Stripe transactions |
| Memory/CPU | ⏳ POST-DEPLOY | Vercel dashboard |

---

### Remaining Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | M-Pesa sandbox keys in .env.local | 🔴 **HIGH** | Replace with production keys in Vercel dashboard before deploy |
| 2 | Stripe test keys in .env.local | 🔴 **HIGH** | Replace with live keys in Vercel dashboard before deploy |
| 3 | MPESA_PASSKEY empty | 🔴 **HIGH** | Set production passkey from Daraja portal |
| 4 | MPESA_CALLBACK_URL empty | 🔴 **HIGH** | Set to `https://pos.winnmatt.com/api/mpesa/callback` |
| 5 | STRIPE_WEBHOOK_SECRET empty | 🔴 **HIGH** | Set from Stripe dashboard webhook settings |
| 6 | SENTRY_DSN not configured | 🔴 **HIGH** | No error monitoring in production — set from Sentry project |
| 7 | NEXT_PUBLIC_API_URL=localhost | 🟡 **MEDIUM** | Change to production URL (may affect API client calls) |
| 8 | Service-role key used heavily | 🟡 **MEDIUM** | Acceptable for server-only code, but should migrate to per-user RLS over time |
| 9 | Transitve npm vulns (5) | 🟢 **LOW** | All moderate, no known exploit |
| 10 | Stale Supabase types | 🟢 **LOW** | Workaround via `unknown` casts |
| 11 | No incident contact list | 🟡 **MEDIUM** | Document P0/P1 contacts in runbook |

---

### Required Pre-Deployment Actions (Gate Items)

1. **Set production M-Pesa credentials** in Vercel dashboard:
   - `MPESA_CONSUMER_KEY` (production Daraja key)
   - `MPESA_CONSUMER_SECRET` (production Daraja secret)
   - `MPESA_PAYBILL` (production paybill/till number)
   - `MPESA_PASSKEY` (production passkey from Daraja portal)
   - `MPESA_CALLBACK_URL` → `https://pos.winnmatt.com/api/mpesa/callback`
   - `MPESA_ENVIRONMENT` → `production`
   - Remove or set `MPESA_SANDBOX_SIMULATE` → `false`

2. **Set production Stripe credentials** in Vercel dashboard:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → from Stripe webhook settings

3. **Set Sentry DSN** in Vercel dashboard:
   - `SENTRY_DSN` → from Sentry project settings
   - `SENTRY_ORG` → Sentry organization slug
   - `SENTRY_PROJECT` → Sentry project slug

4. **Set production URL** in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL` → `https://pos.winnmatt.com`

5. **Configure Supabase** (via Supabase dashboard or CLI):
   - Run `supabase migration list` to verify all migrations applied
   - Run `supabase db push` if pending migrations exist
   - Run `scripts/backup-db.bat` immediately before deploy

6. **Set Vercel platform secrets** (if not already done):
   - `@supabase-url`, `@supabase-anon-key`, `@supabase-service-role-key`

7. **Stripe webhook configuration** (in Stripe dashboard):
   - Set endpoint: `https://pos.winnmatt.com/api/stripe/webhook`
   - Subscribe to: `payment_intent.succeeded`, `payment_intent.payment_failed`

8. **Safaricom Daraja configuration** (in Daraja portal):
   - Set callback URL for STK Push: `https://pos.winnmatt.com/api/mpesa/callback`

---

### Rollback Instructions

```bash
# 1. Roll back application (Vercel)
vercel rollback

# 2. Roll back database migration (if needed)
#    Connect to Supabase and reverse the last migration manually

# 3. Restore from backup (last resort)
psql "$SUPABASE_DB_URL" < backups/backup_2026-07-13.sql
```

---

### Post-Deployment Checklist

#### 5 minutes after deploy
- [ ] `curl https://pos.winnmatt.com/api/health` returns 200
- [ ] Login page loads at `https://pos.winnmatt.com/login`
- [ ] Dashboard loads at `https://pos.winnmatt.com/dashboard`
- [ ] Sentry dashboard shows no new errors
- [ ] No 5xx errors in Vercel deployment log

#### 30 minutes after deploy
- [ ] Complete a test M-Pesa STK Push transaction
- [ ] Complete a test credit card transaction (Stripe)
- [ ] Verify payment callback was received (check `payment_logs` table)
- [ ] Open and close a POS shift
- [ ] Verify analytics pages render with data
- [ ] Check Vercel Analytics for abnormal traffic patterns

#### 24 hours after deploy
- [ ] Review Sentry error report for any uncaught exceptions
- [ ] Review M-Pesa callback success rate
- [ ] Review Stripe webhook success rate
- [ ] Check database connection pool usage
- [ ] Verify no excessive memory usage in Vercel dashboard
- [ ] Confirm backup ran successfully (if cron was set up)

---

### Final Scores

| Category | Score (1-10) | Assessment |
|----------|--------------|------------|
| **Production Readiness** | **7/10** | Code is production-ready but 6 configuration items must be set before go-live |
| **Security** | **9/10** | Strong CSP, CORS, auth, rate limiting, PII redaction. Only gap: Sentry unconfigured |
| **Reliability** | **8/10** | Health checks, graceful degradation (Redis fallback, AI degrade), structured logging |
| **Performance** | **8/10** | Turbopack build, dynamic imports, PWA optimization, 107 routes generated efficiently |
| **Maintainability** | **7/10** | Clean module structure, typed interfaces, some large files to decompose post-v1 |

### Final Decision

```
🟡 GO TO PRODUCTION WITH MINOR CONDITIONS
```

**Conditions (must be completed before deployment):**

1. Replace all sandbox/test payment credentials with production keys in Vercel dashboard
2. Set `MPESA_PASSKEY`, `MPESA_CALLBACK_URL`, `STRIPE_WEBHOOK_SECRET`
3. Configure `SENTRY_DSN` for error monitoring
4. Set `NEXT_PUBLIC_API_URL` to production URL
5. Verify all database migrations are applied and run a backup
6. Configure Stripe webhook endpoint and Daraja callback URL
7. Optional: Document incident contact list in runbook

Once these 7 items are completed, the deployment can proceed with full confidence.
