# WINNMATT POS — Performance Guide

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: Medium
stable_id: D-18
**Freshness:** 90 days (living)

**@see** [INDEX.md](INDEX.md) · [03_ARCHITECTURE.md](03_ARCHITECTURE.md) (system architecture) · [02_PRINCIPLES.md](02_PRINCIPLES.md) (engineering principles) · `PRODUCTION_READINESS_CHECKLIST.md`

---

## Executive Summary

WINNMATT POS is a Next.js 14 application deployed on Vercel with Supabase Postgres. Performance optimizations focus on bundle size (dynamic imports), image optimization (unoptimized), and query performance (indexed columns, pagination). No formal performance budget or load testing framework exists.

**Build time:** ~39.8s (Turbopack, Next.js 16.2.10, 2 cores)

---

## Current Optimizations

### Bundle Size
- **Dynamic imports** — `next/dynamic` with `ssr: false` for:
  - `PaymentPanel` (framer-motion heavy)
  - `PromotionPanel`
  - `MobilePOSWrapper`
- **No large vendor bundles** — shadcn/ui components are tree-shaken by default
- **Lucide icons** — Individual imports ensure tree-shaking

### Caching
- **Supabase queries** — No application-level caching; relies on Supabase connection pooling
- **Static pages** — 107 static routes generated at build time
- **No ISR or on-demand revalidation** configured

### Images
- `images.unoptimized: true` in `next.config.mjs` — Disables Next.js image optimization (saves build time/cost)
- PWA icons generated at build via sharp

### Database
- **Indexed queries** — Key indexes on sales(receipt_number), products(sku/barcode), inventory(product_id/branch_id)
- **Server-side search** — ILIKE search on receipt_number with pagination
- **Date range filtering** — Sales history supports date range + pagination

### Network
- **Security headers** — CSP, HSTS, CORS configured
- **No render-blocking resources** — Radix UI components load async
- **PWA service worker** — Minimal offline support via `public/sw.js`

---

## Bundle Analysis

| Category | Count | Notes |
|----------|-------|-------|
| UI primitives | 42 components | shadcn/ui, tree-shaken |
| Custom hooks | 9 | Lightweight, no heavy deps |
| Server actions | 58 files | 'use server' — not in client bundle |
| API routes | 19 | Edge/server-side only |
| Dependencies | 1,045 packages | Includes Radix, framer-motion, Supabase SDK |

Key heavy dependencies (client-side):
- `framer-motion` — Only loaded on POS page (dynamic import)
- `@supabase/supabase-js` — Tree-shaken to used queries
- `lucide-react` — Individual icon imports

---

## Known Issues

1. **No Suspense boundaries** — Zero `<Suspense>` boundaries anywhere. All data fetching either blocks rendering or is client-side fetch.
2. **No application cache** — No Redis cache layer for frequent queries (product catalog, customer list). Each page load hits Supabase directly.
3. **No ISR** — Static pages are fully static; no incremental static regeneration for dynamic content.
4. **No prefetching** — Next.js `<Link>` prefetch is default behavior but no manual prefetching of likely-next pages.
5. **No performance budget** — No defined metrics for LCP, FID, CLS, TBT, or INP.
6. **No load testing** — No k6, Artillery, or similar load testing suite.
7. **Unoptimized images** — `images.unoptimized: true` means no automatic WebP/AVIF conversion.

---

## Recommendations (Ranked)

| Priority | Action | Expected Impact |
|----------|--------|-----------------|
| High | Add Suspense boundaries for dashboard pages | Reduces TTFB perceived delay |
| High | Add application-level caching (Redis or in-memory) for frequent queries | Reduces DB load by 40-60% |
| Medium | Enable image optimization (remove `unoptimized`) | Better LCP for image-heavy pages |
| Medium | Implement ISR for dynamic routes (products, customers) | Fewer DB calls |
| Medium | Add loading.tsx for all dashboard segments | Better perceived performance |
| Low | Set performance budget in CI (Lighthouse CI) | Prevent regression |
| Low | Add load testing (k6 scenario for POS) | Capacity planning |

---

## Future Direction

1. Suspense boundary rollout across all dashboard pages (Phase 1C/2)
2. Redis caching layer for high-frequency queries (product search, customer lookups)
3. ISR for product/customer detail pages
4. Performance budget enforcement in CI
5. Load testing for peak POS transaction throughput
