# WINNMATT POS — Developer Onboarding

author: OpenWork
verified_by: Repository Audit (Phase 1C)
verification_status: Verified
last_verified: 2026-07-14
confidence: Medium

**Purpose:** Getting started guide for new developers joining the WINNMATT POS project. Not a Brain document — practical setup guide.

**@see** [INDEX.md](INDEX.md) · [AGENTS.md](../AGENTS.md) (sprint details) · [DEVELOPER_CHECKS.md](DEVELOPER_CHECKS.md) (daily checklist) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) (system overview) · [PRODUCTION_READINESS_CHECKLIST.md](../PRODUCTION_READINESS_CHECKLIST.md)

---

## Project Overview

WINNMATT POS is a single-tenant, multi-branch Point of Sale system built with:

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage)
- **Payments:** M-Pesa (direct), Stripe
- **AI:** OpenRouter (free-tier LLM)
- **Deployment:** Vercel
- **Monitoring:** Sentry

---

## Prerequisites

- **Node.js** ≥ 18 (recommended: 24.x)
- **npm** ≥ 10
- **Git** (any recent version)
- **A code editor** (VS Code recommended with Tailwind CSS IntelliSense)
- **Supabase account** (free tier sufficient for development)
- **Vercel account** (for deployment — optional for local dev)

---

## Step 1: Clone and Install

```bash
git clone <repo-url>
cd winnmatt_pos
npm install
```

**Note:** `npm install` installs ~1,045 packages. The build has 5 moderate/high vulnerabilities that are pre-existing and non-blocking.

---

## Step 2: Environment Setup

Copy the environment template:

```bash
# Create .env.local in the project root
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Minimum required for local dev:** The 3 Supabase variables above.

**Optional for local dev:**
- `OPENROUTER_API_KEY` — enables AI assistant
- `MPESA_*` — enables M-Pesa payments (sandbox)
- `STRIPE_SECRET_KEY` — enables Stripe payments (test mode)
- `REDIS_URL` — enables Redis event bus (falls back to in-memory)

---

## Step 3: Database

The project uses Supabase as its database. For local development:

```bash
# Option A: Use the hosted Supabase project
npm run dev  # connects to your production/staging Supabase instance

# Option B: Local Supabase (if you have the Supabase CLI installed)
supabase start
supabase migration up
```

Migrations are in `supabase/migrations/` (40 managed SQL files). They are applied via the Supabase dashboard or CLI.

---

## Step 4: Development

```bash
npm run dev        # Start development server (Turbopack)
npm run dev:stable # Start development server (Webpack — if Turbopack issues)
```

The app runs at `http://localhost:3000`. The login page is at `http://localhost:3000/login`.

---

## Step 5: Testing

```bash
npm test           # Run tests (Vitest, 29 files, 517+ tests)
npm run lint       # Run ESLint
npm run typecheck  # Full TypeScript check (~5 min, requires 4GB memory)
```

---

## Step 6: Build

```bash
npm run build  # Production build (must pass before committing)
```

---

## Project Structure

```
winnmatt_pos/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # 77 route directories (96 page.tsx files)
│   ├── api/                # 19 REST API endpoints
│   └── ...
├── components/             # UI components
│   ├── ui/                 # 42 shadcn/ui primitives
│   ├── ai/                 # AI assistant components
│   ├── pos/                # POS components
│   └── ...
├── lib/                    # Server-side code
│   ├── modules/            # 25 module adapters (domain isolation)
│   │   └── core/           # Shared infrastructure (7 files)
│   ├── ai/                 # AI assistant (tools, prompts, executor)
│   ├── analytics/          # Analytics services (7 files)
│   ├── realtime/           # Event bus (Redis/in-memory)
│   ├── enterprise/         # Enterprise features (12 sub-dirs)
│   └── *-actions.ts       # 58 server action files
├── hooks/                  # 9 custom React hooks
├── docs/                   # Brain documentation
├── supabase/
│   └── migrations/         # 40 managed SQL migrations
├── tests/                  # Test files (29 files)
└── public/                 # Static assets, PWA icons
```

---

## Key Architecture Patterns

### Module Adapter Pattern
All business logic is accessed through module adapters in `lib/modules/*/`:

```typescript
// CORRECT
import { createSale } from '@/lib/modules/sales'
import { searchProducts } from '@/lib/modules/inventory'

// INCORRECT (bypasses module layer — do not use)
import { createSale } from '@/lib/sales-actions'
```

### Server Action Pattern
All server actions use `'use server'` and authenticate via `authenticateServerAction()`.

### API Route Pattern
All API routes use `withAuth()` middleware from `@/lib/api/middleware`.

### Migration Pattern
Every new table gets:
- UUID primary key
- `created_at` / `updated_at` timestamps
- RLS enabled
- Appropriate indexes

---

## Key Files to Know

| File | Why It Matters |
|------|---------------|
| `AGENTS.md` | Sprint history, implementation details, conventions (most detailed operational doc) |
| `docs/INDEX.md` | Brain navigation — read this first |
| `lib/env.ts` | All environment variables defined & validated (zod schema) |
| `lib/api/middleware.ts` | Auth + rate limiting + CORS for API routes |
| `lib/logger.ts` | JSON-structured logging with PII redaction |
| `lib/auth-helpers.ts` | Server action authentication (585 lines) |
| `lib/modules/core/repository.ts` | Base repository with audit logging (382 lines) |
| `next.config.mjs` | Security headers, Sentry config, build settings |

---

## Common First Tasks

1. **Add a new dashboard page:**
   - Create `app/(dashboard)/new-page/page.tsx`
   - Import from `@/lib/modules/` for data access
   - Add to navigation in the sidebar layout

2. **Add a new API endpoint:**
   - Create `app/api/new-endpoint/route.ts`
   - Use `withAuth()` middleware
   - Register in `docs/ID_REGISTRY.md` with next API- ID

3. **Add a new module adapter:**
   - Create `lib/modules/new-domain/index.ts`
   - Delegate to existing `lib/*-actions.ts` function
   - Export typed interfaces

---

## Getting Help

- Read `docs/INDEX.md` first — it routes to the right Brain document
- Read `AGENTS.md` for sprint-specific implementation details
- Check `DEVELOPER_CHECKS.md` for pre-commit/pre-deployment checks
- Ask questions in the team chat with specific file references

---

## Known Issues for New Developers

1. **`npm run typecheck` requires 4GB+ memory** — Use `NODE_OPTIONS="--max-old-space-size=4096"`
2. **`build` skips typecheck if `tsconfig.tsbuildinfo` is stale** — Run `npm run typecheck` separately for full check
3. **No staging environment** — Development connects to the same Supabase instance as preview deployments
4. **162 modified files on the active branch** — The `all-fixes-and-features-20260705` branch has accumulated changes. Normal for the current development phase.
5. **Module bypass still exists in 4 files** — Direct action imports in branch-dashboard, product-intelligence, supplier-portal, and webhooks pages need migration.
