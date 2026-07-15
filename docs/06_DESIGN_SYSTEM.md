# WINNMATT POS — Design System

author: OpenWork
verified_by: Repository Audit (Phase 1B)
verification_status: Verified
last_verified: 2026-07-14
confidence: High
stable_id: D-05
**Freshness:** 180 days (permanent)

**@see** [INDEX.md](INDEX.md) · [07_MOTION.md](07_MOTION.md) (animation patterns) · [08_COPYWRITING.md](08_COPYWRITING.md) (UX copy guidelines)

---

## Executive Summary

WINNMATT POS uses **shadcn/ui** components built on **Radix UI** primitives with **Tailwind CSS** for styling. The design system consists of 42 UI primitive components in `components/ui/` plus domain-specific component directories. The visual identity uses a light theme with a blue primary color, custom CSS variables in `globals.css`, and framer-motion for animations.

---

## Component Library

### UI Primitives (42 components in `components/ui/`)

```
accordion.tsx       dialog.tsx          popover.tsx       skeleton.tsx
alert-dialog.tsx    dropdown-menu.tsx   progress.tsx      slider.tsx
alert.tsx           empty-state.tsx     scroll-area.tsx   switch.tsx
animated-counter.tsx field.tsx          select.tsx        table.tsx
avatar.tsx          form.tsx            separator.tsx     tabs.tsx
badge.tsx           input-group.tsx     sheet.tsx         textarea.tsx
button.tsx          input.tsx           sidebar.tsx       toast.tsx
calendar.tsx        kbd.tsx             pagination.tsx    toaster.tsx
card.tsx            label.tsx           page-transition.tsx tooltip.tsx
checkbox.tsx        collapsible.tsx     command.tsx       data-table.tsx
```

Additional non-primitive components:
- `ai-assistant-interface.tsx` — AI chat interface wrapper
- ~~`use-mobile.tsx`~~ — ~~Deleted Phase 2 (was deprecated re-export of `hooks/use-mobile.ts`)~~

### Domain-Specific Components

| Directory | Purpose | Key Components |
|-----------|---------|----------------|
| `components/ai/` | AI assistant | floating-ai-button, ai-assistant-chat, ai-action-card, ai-action-result |
| `components/pos/` | POS interface | mobile-pos-wrapper, quick-shift-dialog, mobile-receipt |
| `components/employees/` | Employee management | employee-form-dialog, employee-detail |
| `components/reports/` | Report widgets | widget-renderer, scheduled-reports |
| `components/shifts/` | Shift management | shift-dashboard, shift-operations |
| `components/import/` | CSV import | publish-dialog |
| `components/departments/` | Department management | create-department-dialog |
| `components/` (root) | Cross-cutting | global-search, command-palette, pwa-registration |

### Key Implementation Conventions

1. **shadcn/ui CLI** — Components are created via `npx shadcn-ui@latest add` and committed as editable code (not node_modules)
2. **Radix UI underlay** — Each shadcn component wraps a Radix UI primitive for accessibility (WAI-ARIA)
3. **`cn()` utility** — `clsx` + `tailwind-merge` for conditional className merging
4. **No CSS modules** — All styling via Tailwind utility classes + CSS variables
5. **`globals.css`** — CSS custom properties for colors, border radii, shadows, fonts

---

## Visual Identity

### Typography
- **Font:** System font stack (Tailwind `font-sans` default)
- **Scale:** Tailwind default scale (text-xs through text-4xl)
- **Monospace:** Tailwind `font-mono` for code and financial values

### Color Palette (from globals.css)

| Role | Variable | Value | Usage |
|------|----------|-------|-------|
| Primary | `--primary` | Blue (#2563eb / hsl) | Buttons, links, active states |
| Primary foreground | `--primary-foreground` | White | Text on primary backgrounds |
| Background | `--background` | White | Page backgrounds |
| Foreground | `--foreground` | Near-black (#09090b) | Body text |
| Muted | `--muted` | Light gray | Secondary backgrounds |
| Destructive | `--destructive` | Red | Delete, error states |
| Border | `--border` | Light gray (#e5e7eb) | Card borders, dividers |
| Ring | `--ring` | Primary blue | Focus rings |

### Dark Mode
- Not implemented. All variables currently define light theme only.
- Tailwind `dark:` variants are not used anywhere.

---

## Spacing & Layout

- **Gap/Spacing:** Tailwind scale (p-2 = 8px, p-4 = 16px, p-6 = 24px)
- **Container:** Custom `.container` utility, max-width 1400px for full-width pages
- **Sidebar:** Fixed left sidebar (250px) with shadcn sidebar component
- **Dashboard layout:** `app/(dashboard)/layout.tsx` — sidebar + header + main content area
- **Responsive breakpoints:** sm (640px), md (768px — mobile POS breakpoint), lg (1024px), xl (1280px)

---

## Mobile Design

- **`useIsMobile()` —** 768px breakpoint via `use-mobile.ts` hook
- **Mobile POS —** `MobilePOSWrapper` (dynamic import, SSR disabled) renders a touch-optimized interface
- **Animations —** framer-motion `AnimatePresence` for page transitions, sheet panels on mobile

---

## Icon System

- **Lucide React** — Primary icon library, imported directly (e.g., `import { ShoppingCart } from 'lucide-react'`)
- No custom SVG icons or sprite sheets

---

## PWA

- **Service worker:** `public/sw.js` — minimal offline fallback
- **Offline page:** `app/offline/page.tsx`
- **Icons:** 12 sizes + 2 screenshots generated from `public/icon.svg` via sharp

---

## Known Limitations

1. **No dark mode** — CSS variables define light theme only. All `dark:` variants unused.
2. **No component preview tool** — No Storybook, Ladle, or similar component explorer.
3. **No accessibility audit** — shadcn/Radix provides WAI-ARIA compliance, but no formal a11y audit exists.
4. **Icons are unorganized** — Lucide imports are ad-hoc across files; no centralized icon registry.
5. ~~`use-mobile.tsx` in ui/ — Deleted Phase 2 (was deprecated re-export). Canonical hook at `hooks/use-mobile.ts`.~~

---

## Future Direction

1. Add dark mode support with CSS variable overrides
2. Create a Storybook instance for component documentation
3. Implement icon registry for consistent icon usage
4. Run a formal accessibility audit
