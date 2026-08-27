'use client'

/**
 * AnimatedNumber — counts up from 0 to `value` once the element scrolls
 * into view. Pure RAF + easeOutQuint, no Framer Motion dependency.
 *
 * Usage:
 *   <AnimatedNumber value={497} prefix="$" suffix="/mo" />
 */

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { prefersReducedMotion } from './shared'

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 1.6,
}: {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 5)
      setDisplay(value * eased)
      if (progress < 1) requestAnimationFrame(tick)
      else setDisplay(value)
    }
    requestAnimationFrame(tick)
  }, [inView, value, duration])

  const shown = Number.isInteger(value)
    ? Math.round(display).toString()
    : display.toFixed(1)

  return (
    <span ref={ref}>
      {prefix}
      {shown}
      {suffix}
    </span>
  )
}