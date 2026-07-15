# D-07: WINNMATT POS — Animation Design System

author: OpenWork
verified_by: User
verification_status: Verified (Phase 0)
last_verified: 2026-07-14
confidence: High
stable_id: D-07

**Freshness:** 90 days (permanent)  
**@see** [AGENTS.md](../AGENTS.md) · [D-08](08_COPYWRITING.md) (accessibility notes) · [GRAPH_AUDIT_REPORT.md](GRAPH_AUDIT_REPORT.md) §3

---

## Technology

Framer Motion 12.42.2 — the single animation library used throughout the application.

---

## Animation Principles

1. **Subtle and purposeful.** Animations should communicate state changes, not decorate. If it doesn't communicate, remove it.
2. **Fast by default.** All animations under 300ms. POS transactions under 150ms.
3. **Accessible.** Respect `prefers-reduced-motion`. All animations are non-essential.
4. **Consistent easing.** Use the system tokens below — no ad-hoc cubic-bezier values.

---

## Motion Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `duration.fast` | 150ms | POS interactions, button feedback, checkbox toggle |
| `duration.normal` | 200ms | Dialog open/close, sheet slide, dropdown |
| `duration.slow` | 300ms | Page transitions, sidebar collapse, list reorder |
| `easing.default` | `[0.4, 0, 0.2, 1]` | All standard animations (Material Design ease) |
| `easing.enter` | `[0, 0, 0.2, 1]` | Elements entering the screen (dialogs, sheets) |
| `easing.exit` | `[0.4, 0, 1, 1]` | Elements leaving the screen |

---

## Component Animation Patterns

### Dialogs & Modals
```
Enter: scale(0.95 → 1) + fade(0 → 1), 200ms, ease.enter
Exit:  scale(1 → 0.95) + fade(1 → 0), 150ms, ease.exit
Overlay: fade(0 → 0.5), 200ms
```

### Sheets (Bottom / Side)
```
Enter: translateY(100% → 0), 200ms, ease.enter
Exit:  translateY(0 → 100%), 200ms, ease.exit
```

### Page Transitions
```
Next.js App Router — no native page transitions configured.
Pages render immediately with SSR/ISR.
```

### Loading / Skeleton
```
Skeleton shimmer: gradient sweep, 1.5s loop, infinite
Opacity fade-in for content replacing skeleton: 200ms
```

### Dropdowns & Menus
```
Enter: translateY(-4px → 0) + fade(0 → 1), 150ms
Exit:  fade(1 → 0), 100ms (no translate on exit)
```

### Button Feedback
```
Tap: scale(1 → 0.97), 100ms
Hover: subtle background shift, 150ms
```

### List Items
```
Mount: fade(0 → 1) + translateX(-8px → 0), 200ms, staggered by 30ms
Reorder: layout animation, 300ms
```

---

## Heavy Animations (Dynamically Imported)

Components using framer-motion for complex animations are dynamically imported with `ssr: false`:

| Component | Animation | Import Strategy |
|-----------|-----------|-----------------|
| `PaymentPanel` | Card flip, payment method transitions | `next/dynamic` — not in initial bundle |
| `PromotionPanel` | Price change, discount reveal | `next/dynamic` — not in initial bundle |
| `MobilePOSWrapper` | Product grid, checkout flow | `next/dynamic` — not in initial bundle |

**Why:** Framer Motion adds ~30 KB to the JS bundle. The POS page stays fast by loading it only when these panels are opened.

---

## Accessibility

```css
/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations use CSS `@media (prefers-reduced-motion: reduce)` as the universal fallback. Framer Motion respects this automatically when `useReducedMotion()` is used (not yet implemented — **flagged**).

---

## ✅ What Exists
- Skeleton loading shimmer
- Dialog/modal enter/exit
- Button tap/hover feedback
- Sheet slide animations
- Dynamic import of heavy animation components

## ❌ What's Missing (Flagged)
- `useReducedMotion()` hook not yet used in animation components
- Page transitions between routes not configured (Next.js App Router doesn't support them natively without special setup)
- List reorder with `layout` animation not verified
- No animation testing (visual regression)

---

*D-07 Motion — last updated 2026-07-14.*
