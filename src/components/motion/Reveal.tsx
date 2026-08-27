'use client'

/**
 * Reveal + StaggerContainer + StaggerItem — fade-up-on-enter primitives.
 *
 * Use on every section/block for a scroll-triggered entry animation.
 * Skips entirely on prefers-reduced-motion.
 *
 * Usage:
 *   <Reveal delay={120}>{...}</Reveal>
 *   <StaggerContainer stagger={0.1}>
 *     <StaggerItem>...</StaggerItem>
 *     <StaggerItem>...</StaggerItem>
 *   </StaggerContainer>
 */

import { useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { prefersReducedMotion, springTransition } from './shared'

export function Reveal({
  children,
  delay = 0,
  className = '',
  y = 32,
  once = true,
}: {
  children: ReactNode
  delay?: number
  className?: string
  y?: number
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { once, amount: 0.2 })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ ...springTransition, delay }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerContainer({
  children,
  className = '',
  stagger = 0.1,
}: {
  children: ReactNode
  className?: string
  stagger?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, { once: true, amount: 0.15 })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{
        visible: { transition: { staggerChildren: stagger } },
        hidden: {},
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className = '',
  y = 32,
}: {
  children: ReactNode
  className?: string
  y?: number
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: prefersReducedMotion ? 0 : y },
        visible: { opacity: 1, y: 0, transition: springTransition },
      }}
    >
      {children}
    </motion.div>
  )
}