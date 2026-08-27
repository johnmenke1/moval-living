'use client'

/**
 * PulseRing — animated pulsing ring around an element.
 *
 * Wraps children in a relative container and overlays a single teal ring
 * that expands + fades on a 1.8s ease-out infinite loop. Useful for
 * drawing the eye to a CTA or badge.
 *
 * Usage:
 *   <PulseRing className="rounded-xl">
 *     <button>Sign up</button>
 *   </PulseRing>
 */

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { prefersReducedMotion } from './shared'

export function PulseRing({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  if (prefersReducedMotion) return <div className={className}>{children}</div>
  return (
    <div className={`relative ${className}`}>
      {children}
      <motion.span
        className="absolute inset-0 rounded-[inherit] border-2 border-[#00a8a8]/40"
        initial={{ opacity: 0.6, scale: 1 }}
        animate={{ opacity: 0, scale: 1.4 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
    </div>
  )
}