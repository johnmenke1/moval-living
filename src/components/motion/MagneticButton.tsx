'use client'

/**
 * MagneticButton — anchor that nudges toward the cursor on hover.
 *
 * Designed for outbound CTAs only (renders <a>, not <button>). For form
 * submit buttons, use a plain <button> with the same Tailwind classes.
 *
 * Usage:
 *   <MagneticButton href="https://..." className="btn-accent ...">
 *     Book a call
 *   </MagneticButton>
 */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { prefersReducedMotion } from './shared'

export function MagneticButton({
  children,
  className = '',
  strength = 16,
  href,
  ...rest
}: {
  children: ReactNode
  className?: string
  strength?: number
  href: string
  target?: string
  rel?: string
}) {
  const ref = useRef<HTMLAnchorElement | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handleMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion) return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setOffset({ x: x * strength, y: y * strength })
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.a>
  )
}