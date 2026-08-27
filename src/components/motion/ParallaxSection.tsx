'use client'

/**
 * ParallaxSection — subtle Y-translate tied to scroll position.
 *
 * Wraps children in a `relative overflow-hidden` container and translates
 * the inner layer from `+offset` to `-offset` over the section's full
 * scroll range. Spring-eased for natural settle.
 *
 * Usage:
 *   <ParallaxSection offset={80}>
 *     <img src="..." />
 *   </ParallaxSection>
 */

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { prefersReducedMotion } from './shared'

export function ParallaxSection({
  children,
  className = '',
  offset = 80,
}: {
  children: ReactNode
  className?: string
  offset?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset])
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 })

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ y: prefersReducedMotion ? 0 : smoothY }}>
        {children}
      </motion.div>
    </div>
  )
}