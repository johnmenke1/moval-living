/**
 * Barrel re-export for the site-wide motion primitives.
 *
 * Import like:
 *   import { Reveal, ShimmerText, AmbientOrbs } from '@/components/motion'
 *
 * Page-specific components (e.g. SplitReveal on /web-design) stay in their
 * own page directory — only put primitives that ANY page might reuse here.
 *
 * Promotion history: this lib was extracted from `src/app/web-design/Motion.tsx`
 * on 2026-08-27 when the homepage Hero started using it. See the
 * landing-page-motion-pattern doc (2026-08-26) for the design rationale
 * and the prefers-reduced-motion / SSR-hydration pitfalls.
 */

export { Reveal, StaggerContainer, StaggerItem } from './Reveal'
export { AnimatedNumber } from './AnimatedNumber'
export { MagneticButton } from './MagneticButton'
export { Marquee } from './Marquee'
export { AmbientOrbs } from './AmbientOrbs'
export { ShimmerText } from './ShimmerText'
export { ParallaxSection } from './ParallaxSection'
export { FloatingCard } from './FloatingCard'
export { PulseRing } from './PulseRing'

export { springTransition, prefersReducedMotion } from './shared'