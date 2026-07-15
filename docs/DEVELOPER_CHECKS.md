# WINNMATT POS — Developer Checks

author: OpenWork
verified_by: Repository Audit (Phase 1C)
verification_status: Verified
last_verified: 2026-07-14
confidence: High

**Purpose:** Pre-commit, pre-PR, and pre-deployment verification checklist. Not a Brain document — operational reference for developers.

**@see** [INDEX.md](INDEX.md) · [AGENTS.md](../AGENTS.md) (build commands) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) · [18_TESTING.md](18_TESTING.md)

---

## Daily Workflow

```bash
git checkout all-fixes-and-features-20260705  # active branch
git pull                                       # or rebase
npm run build                                  # must pass before any commit
npm test                                       # 517+ tests, 29 files
```

---

## Pre-Commit Checklist

### Build Verification
- [ ] `npm run build` passes (0 errors, 0 warnings)
- [ ] `npm test` passes (517+ tests)

### Code Quality
- [ ] No `any` types introduced (`rg "as any"` returns 0)
- [ ] No `console.log` added (use `lib/logger.ts` instead)
- [ ] No `TODO` or `FIXME` markers in modified code
- [ ] No unused imports
- [ ] TypeScript strict mode maintained

### Architecture
- [ ] UI pages import from `@/lib/modules/*` (not direct `@/lib/*-actions`)
- [ ] New API routes use `withAuth()` middleware
- [ ] New migrations include RLS policies
- [ ] New server actions call `authenticateServerAction()`

### Documentation
- [ ] If changing a Brain doc, update `last_verified` date
- [ ] If adding a new document, register in `ID_REGISTRY.md` 
- [ ] If adding a new ID, follow append-only rules
- [ ] Cross-references use stable IDs, not relative paths

### Database Migrations
- [ ] Migration file name follows `YYYYMMDDHHMMSS_description.sql` format
- [ ] Migration includes `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Migration includes CREATE INDEX statements for query columns
- [ ] Migration is reversible (no destructive data changes without backup)

---

## Pre-PR Checklist
- [ ] All pre-commit checks pass
- [ ] Branch is rebased on latest target branch
- [ ] No merge conflicts
- [ ] PR description explains the change, motivation, and testing done
- [ ] New features have test coverage
- [ ] Screenshots attached for UI changes
- [ ] At least one reviewer assigned

---

## Pre-Deployment Checklist
- [ ] Build passes with production flags
- [ ] All 13 environment variables configured in Vercel
- [ ] M-Pesa credentials are production keys (not sandbox)
- [ ] Stripe keys are production keys
- [ ] Sentry DSN configured
- [ ] Database migrations applied
- [ ] Redis URL configured (if using Redis event bus)
- [ ] Security headers verified in deployment
- [ ] CSP allows all required origins
- [ ] CORS allows production domains

---

## Environment Variables (13 total)

**Required:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PAYBILL=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

**Optional but recommended:**
```
REDIS_URL=
SENTRY_ORG=
SENTRY_PROJECT=
```

**Optional:**
```
RESEND_API_KEY=
EMAIL_FROM=
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
SMS_FROM=
WEBHOOK_NOTIFICATION_URL=
WEBHOOK_NOTIFICATION_SECRET=
FIREBASE_SERVER_KEY=
OPENROUTER_API_KEY=
MPESA_ACCOUNT_REFERENCE=
```

---

## Architecture Verification

### Module Adapter Pattern
```typescript
// ✅ CORRECT — imports from module adapter
import { createSale } from '@/lib/modules/sales'

// ❌ WRONG — imports directly from action file (bypasses module layer)
import { createSale } from '@/lib/sales-actions'
```

### API Route Pattern
```typescript
// ✅ CORRECT — uses withAuth middleware
import { withAuth } from '@/lib/api/middleware'
export async function POST(request: NextRequest) {
  return withAuth(request, async (ctx) => { ... })
}

// ❌ WRONG — no authentication middleware
export async function POST(request: NextRequest) { ... }
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| Build fails | Check `next.config.mjs` for syntax; run `npm run lint` |
| Tests fail | Run `npm test` locally; check test file for import errors |
| TypeScript errors | Run `npm run typecheck` (may need `--max-old-space-size=4096`) |
| RLS errors | Check that migration includes `ENABLE ROW LEVEL SECURITY` |
| Auth errors | Ensure `authenticateServerAction()` or `withAuth()` is called |
| Missing env var | Check `lib/env.ts` schema; set in `.env.local` for dev |
| Module import not found | Run `npm run build` to check for module export issues |
