// ─── WINNMATT Motion Design System ───────────────────────────────────────
// Purposeful motion that serves business intent — no flashy effects.
// CSS animations for performance-critical UI (hovers, transitions, counters).
// framer-motion for complex orchestration (page transitions, stagger, chart animations).

// ─── Duration tokens (seconds) ───────────────────────────────────────────
export const durations = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  deliberate: 0.4,
  pageTransition: 0.25,
  stagger: 0.05,
  counter: 0.6,
} as const

// ─── Easing curves ───────────────────────────────────────────────────────
export const easings = {
  /** Smooth deceleration — good for elements entering the screen */
  easeOut: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Acceleration — good for elements leaving the screen */
  easeIn: [0.4, 0, 1, 1] as [number, number, number, number],
  /** Natural feel — good for most UI motion */
  easeInOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  /** Spring-like bounce for counters and badges */
  spring: { type: 'spring' as const, stiffness: 300, damping: 25, mass: 0.8 },
} as const

// ─── Hover / tap scale presets ───────────────────────────────────────────
export const hoverScale = { scale: 1.02, transition: { duration: durations.fast, ease: easings.easeOut } }
export const tapScale = { scale: 0.98, transition: { duration: durations.instant } }

// ─── Card hover effect (used by card-hover CSS class in globals.css) ─────
export const cardHover = {
  rest: { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' },
  hover: {
    boxShadow: '0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)',
    y: -2,
    transition: { duration: durations.normal, ease: easings.easeOut },
  },
}

// ─── Page transition variants (for <PageTransition> wrapper) ─────────────
export const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.pageTransition, ease: easings.easeOut },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: durations.fast, ease: easings.easeIn },
  },
}

// ─── Stagger container — wrap children that should fade in sequentially ──
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: durations.stagger,
      delayChildren: 0.03,
    },
  },
}

// ─── Individual fade-up item (child of staggerContainer) ─────────────────
export const fadeUpItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.normal, ease: easings.easeOut },
  },
}

// ─── Chart animation presets ─────────────────────────────────────────────
export const chartAnimations = {
  bar: {
    initial: { scaleY: 0, opacity: 0 },
    animate: { scaleY: 1, opacity: 1 },
    exit: { scaleY: 0, opacity: 0 },
    transition: { duration: durations.slow, ease: easings.easeOut },
  },
  pie: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: durations.deliberate, ease: easings.easeOut },
  },
  countUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: durations.counter, ease: easings.easeOut },
  },
}

// ─── Animated counter helper (returns steps for AnimatedCounter) ─────────
export function animateCounter(
  start: number,
  end: number,
  durationMs = 600
): { value: number; done: boolean }[] {
  const steps = Math.min(Math.floor(durationMs / 16), 60)
  const increment = (end - start) / steps
  const result: { value: number; done: boolean }[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
    result.push({
      value: Math.round(start + (end - start) * eased),
      done: i === steps,
    })
  }
  return result
}

// ─── Reduced motion support ──────────────────────────────────────────────
export const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

// ─── CSS animation classes (applied via className, no JS runtime cost) ───
// These are already defined in globals.css as utility classes:
//   .fade-in        — opacity 0→1, 0.3s ease-out
//   .slide-up       — y 8px→0 + fade-in
//   .card-hover     — lifted shadow + translateY on hover
//   .smooth-scroll  — scroll-behavior: smooth
