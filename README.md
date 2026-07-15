# WINNMATT POS — Production Retail Management System

A comprehensive Point-of-Sale (POS) and retail management system for multi-branch Kenyan businesses. Built with Next.js 16 + Supabase, featuring real-time inventory, analytics, AI assistant, and M-Pesa integration.

**Tech Stack:**
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Real-time + Storage)
- **Database:** PostgreSQL — ~147 tables across 40+ managed migrations
- **State:** React Hooks + Server Actions + Supabase subscriptions
- **Automation:** Redis Pub/Sub event bus (in-memory fallback)
- **AI:** OpenRouter-powered functional assistant (free tier)
- **Payments:** M-Pesa Daraja API (STK Push) + Card (Stripe) + Cash + Bank Transfer
- **Notifications:** Email (Resend) + SMS (Africa's Talking) + in-app + FCM push

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project (free tier works)
- Git

### Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.local.example .env.local
# Edit with your Supabase URL, anon key, and service role key

# 3. Run database migrations against your Supabase project
# Copy contents of supabase/migrations/ to Supabase SQL Editor
# or use the Supabase CLI: npx supabase migration up

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

> For detailed setup, see [`docs/INDEX.md`](docs/INDEX.md).

---

## Project Structure

```
winnmatt-pos/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Protected dashboard routes (13+ pages)
│   ├── api/                      # API routes (19 routes)
│   └── login/                    # Authentication UI
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives
│   ├── pos/                      # POS terminal components
│   └── ai/                       # AI assistant chat & command palette
├── lib/
│   ├── modules/                  # Layer adapter (25 modules)
│   │   ├── sales/                # Sales domain
│   │   ├── inventory/            # Inventory management
│   │   ├── procurement/          # Purchase orders & receipts
│   │   ├── finance/              # Financial tracking
│   │   ├── customers/            # Customer management
│   │   ├── workforce/            # HR & payroll
│   │   └── core/                 # Shared infrastructure (7 files)
│   ├── ai/                       # AI assistant (executor, tools, prompts)
│   ├── realtime/                 # Event bus (Redis Pub/Sub / in-memory)
│   ├── analytics/                # Analytical services (6 services)
│   ├── enterprise/               # Enterprise features (12 sub-systems)
│   └── *-actions.ts              # Server actions (domain files)
├── hooks/                        # Custom React hooks
├── docs/                         # Developer & AI documentation
├── supabase/migrations/          # 40 managed database migrations
├── tests/                        # Test suites (28+ unit, Vitest + jsdom)
└── graphify-out/                 # Codebase knowledge graph
```

---

## Key Features

### POS Terminal
- Real-time product search & multi-item cart
- Multiple payment methods (Cash, M-Pesa, Card, Bank Transfer, Cheque, Credit)
- Shift-enforced cashier accountability (open/close with float reconciliation)
- Customer lookup with loyalty points
- Mobile-optimized responsive layout
- Receipt printing, email, and SMS

### Inventory Management
- Real-time stock tracking per branch with low-stock alerts
- Purchase order lifecycle (draft → pending → approved → received)
- Goods Received Note (GRN) automation with batch/lot tracking
- Branch-to-branch transfers with backorder support
- Supplier returns & stock adjustments

### Analytics & Reporting
- 6 analytical services: sales, inventory, customers, workforce, finance, reports
- Daily/monthly sales trends, top products, payment breakdowns
- Cashier performance metrics & branch comparison
- Custom date-range reporting with export

### AI Functional Assistant
- Natural-language querying of sales, inventory, customers, and more
- 31+ tools across 8 domains (products, sales, inventory, finance, etc.)
- Write tools require user confirmation before execution
- Command palette (Cmd+K) for quick access
- Page-specific suggestions on 10 dashboard routes

### Customer Management
- Customer profiles with purchase history
- Loyalty points & credit account management (retail/wholesale/business)
- Credit limit enforcement & balance tracking

### Real-Time & Events
- Generic SSE stream (`/api/events/stream`) with type filtering
- 15 event types across POS, inventory, finance, and automation
- Redis Pub/Sub with automatic in-memory fallback
- Device heartbeat (30s) + auto-registration for POS terminals

### Enterprise Features
- Shift management with audit trails
- Purchase requisition workflow
- Multi-role RBAC (cashier, admin, manager, super_admin)
- Rate limiting, audit logging, disaster recovery, scenario simulation
- Payment gateway abstraction (M-Pesa + Stripe)

---

## Development

```bash
npm run dev          # Dev server on http://localhost:3000
npm run build        # Production build
npm run test         # Run test suites (28+ unit tests)
npm run test:run     # Test runner (single run)
npm run typecheck    # Full TypeScript check (requires NODE_OPTIONS="--max-old-space-size=4096")
npm run lint         # ESLint
```

### Database
- Migrations: `supabase/migrations/` (40 managed files)
- Archived: `db/archived-migrations/` (33 legacy SQL files)
- Health: `GET /api/health` reports DB + event bus status

---

## Deployment

### Vercel
```bash
# Connect GitHub repo to Vercel
# Required environment variables:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
```

### Production Checklist
See [PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md) (25 domains, 837 items)
and [FINAL_PRODUCTION_SIGNOFF.md](./docs/FINAL_PRODUCTION_SIGNOFF.md) for current go-live status.

---

## Architecture

- **Module layer:** 25 adapters (`lib/modules/*/index.ts`) wrap domain-specific server actions. Pages import only module interfaces, never action files directly.
- **Event bus:** Factory pattern selects Redis or in-memory at module load time. Channel `pos:events` for Pub/Sub.
- **Shift enforcement:** `useShiftGuard()` polls every 30s. `shiftId` required through `AuthorizedSaleContext` → `completePaymentAction`.
- **AI assistant:** OpenRouter JSON prompting. 8 tool files registered via singleton tool-registry. Read tools auto-execute, write tools require confirmation.

---

## Documentation

All developer and AI documentation begins at:

> **[`docs/INDEX.md`](docs/INDEX.md)** — bootloader, navigation map, and AI loading rules

Key supporting resources:

| Resource | Purpose |
|----------|---------|
| [`AGENTS.md`](AGENTS.md) | Sprint-by-sprint implementation guide |
| [`supabase/migrations/`](supabase/migrations/) | Database schema (40 managed migrations) |
| [`PRODUCTION_READINESS_CHECKLIST.md`](PRODUCTION_READINESS_CHECKLIST.md) | 25-domain, 837-item checklist |
| [`docs/FINAL_PRODUCTION_SIGNOFF.md`](docs/FINAL_PRODUCTION_SIGNOFF.md) | Current go-live status |
| [`docs/event-catalog.md`](docs/event-catalog.md) | Event type definitions |

### External

- [Supabase Docs](https://supabase.com/docs) · [Next.js Docs](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com) · [Tailwind CSS](https://tailwindcss.com)

---

**License:** Proprietary — WINNMATT POS System
