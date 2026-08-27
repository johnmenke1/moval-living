'use client'

/**
 * AmbientOrbs — three drifting blurred radial blobs.
 *
 * IMPORTANT: parent MUST be `relative overflow-hidden`, otherwise the orbs
 * render relative to the nearest positioned ancestor (often <body>) and
 * either disappear or bleed across the page. Returns null on
 * prefers-reduced-motion.
 *
 * Usage:
 *   <section className="relative overflow-hidden">
 *     <AmbientOrbs dark />
 *     <div className="relative">{content}</div>
 *   </section>
 */

import { motion } from 'framer-motion'
import { prefersReducedMotion } from './shared'

export function AmbientOrbs({
  className = '',
  dark = false,
}: {
  className?: string
  dark?: boolean
}) {
  if (prefersReducedMotion) return null
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <motion.div
        className="absolute h-[520px] w-[520px] rounded-full blur-[120px] opacity-30"
        style={{
          background: dark
            ? 'radial-gradient(circle, #00a8a8 0%, transparent 70%)'
            : 'radial-gradient(circle, #ff7a66 0%, transparent 70%)',
          top: '-160px',
          left: '-140px',
        }}
        animate={{ x: [0, 80, 0], y: [0, 60, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute h-[440px] w-[440px] rounded-full blur-[100px] opacity-25"
        style={{
          background: dark
            ? 'radial-gradient(circle, #ff7a66 0%, transparent 70%)'
            : 'radial-gradient(circle, #00a8a8 0%, transparent 70%)',
          top: '30%',
          right: '-120px',
        }}
        animate={{ x: [0, -70, 0], y: [0, -50, 0], scale: [1, 0.9, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute h-[380px] w-[380px] rounded-full blur-[90px] opacity-20"
        style={{
          background: 'radial-gradient(circle, #f3c46c 0%, transparent 70%)',
          bottom: '-120px',
          left: '20%',
        }}
        animate={{ x: [0, 60, 0], y: [0, -60, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}