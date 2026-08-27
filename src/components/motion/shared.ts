'use client'

/**
 * Shared motion primitives and helpers used by every primitive in
 * src/components/motion. Keeping `prefersReducedMotion` and the
 * default spring in one place lets each primitive file stay focused
 * on its own animation logic.
 *
 * NOTE: this module is intended for use inside the `src/components/motion/`
 * barrel. Importing it directly from a page is allowed but discouraged.
 */

import type { Transition } from 'framer-motion'

/**
 * Module-snapshot of `prefers-reduced-motion: reduce`. Reads at module load
 * so the value is stable across renders for SSR safety (no `window` access
 * on the server). Per the landing-page-motion-pattern doc (2026-08-26),
 * this lazy snapshot pattern is what avoids the SSR hydration mismatch
 * that originally hit /web-design.
 *
 * The trade-off: components can't react to live changes in the OS-level
 * setting until the page reloads. For a sales/landing page that's fine —
 * a user toggling reduced-motion mid-scroll is rare enough that a one-shot
 * snapshot is the right trade.
 */
export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Default spring transition for all reveal-style motion. Light enough to
 * feel snappy on enter, heavy enough to avoid the "twitchy" feeling of
 * default ease. Used by Reveal / StaggerItem / MagneticButton / etc.
 */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 18,
  mass: 1,
}