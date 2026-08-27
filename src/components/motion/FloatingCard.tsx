'use client'

/**
 * FloatingCard — 3D tilt on hover with a gloss reflection that follows
 * the cursor.
 *
 * Wraps any card in a perspective-1000 transform-style preserve-3d parent.
 * Hover to tilt toward your cursor; the radial gloss highlight tracks
 * the cursor within the card bounds.
 *
 * Usage:
 *   <FloatingCard intensity={8} className="rounded-2xl">
 *     <div className="card-content">...</div>
 *   </FloatingCard>
 */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { prefersReducedMotion } from './shared'

export function FloatingCard({
  children,
  className = '',
  intensity = 8,
}: {
  children: ReactNode
  className?: string
  intensity?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [rotate, setRotate] = useState({ x: 0, y: 0 })
  const [glow, setGlow] = useState({ x: 50, y: 50 })

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setRotate({
      x: (0.5 - y) * intensity,
      y: (x - 0.5) * intensity,
    })
    setGlow({ x: x * 100, y: y * 100 })
  }

  const reset = () => {
    setRotate({ x: 0, y: 0 })
    setGlow({ x: 50, y: 50 })
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      animate={{ rotateX: rotate.x, rotateY: rotate.y }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
    >
      {children}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(255,255,255,0.15), transparent 60%)`,
        }}
      />
    </motion.div>
  )
}