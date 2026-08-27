'use client'

/**
 * ShimmerText — animated linear-gradient sweep over text.
 *
 * Uses `background-clip: text` (with -webkit- prefix for Safari). The 5s
 * linear infinite sweep is a CSS @keyframes injected inline per instance
 * so each ShimmerText gets its own animation timer (no flash on first
 * paint).
 *
 * Falls back to a plain <span> on prefers-reduced-motion.
 *
 * Usage:
 *   <h1>
 *     <ShimmerText>Your neighbors' guide to Moreno Valley</ShimmerText>
 *   </h1>
 */

import type { ReactNode } from 'react'
import { prefersReducedMotion } from './shared'

export function ShimmerText({
  children,
  className = '',
  dark = false,
}: {
  children: ReactNode
  className?: string
  dark?: boolean
}) {
  if (prefersReducedMotion) return <span className={className}>{children}</span>

  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: dark
          ? 'linear-gradient(90deg, #ffffff 0%, #00a8a8 25%, #ff7a66 50%, #00a8a8 75%, #ffffff 100%)'
          : 'linear-gradient(90deg, #081820 0%, #00a8a8 25%, #ff7a66 50%, #00a8a8 75%, #081820 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer-sweep 5s linear infinite',
        WebkitBackgroundClip: 'text',
      }}
    >
      {children}
      <style>{`
        @keyframes shimmer-sweep {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
      `}</style>
    </span>
  )
}