'use client'

/**
 * Marquee — infinite horizontal pill ticker.
 *
 * Items are rendered THREE times ([...items, ...items, ...items]) so the
 * 33.333% translate keyframe loops seamlessly. With only two copies, the
 * end-of-cycle wrap is visible as a stutter. See landing-page-motion-pattern
 * doc (2026-08-26) for the original diagnosis.
 *
 * Usage:
 *   <Marquee items={['Restaurants', 'Contractors', ...]} speed={40} />
 */

import { motion } from 'framer-motion'
import { prefersReducedMotion } from './shared'

export function Marquee({
  items,
  speed = 40,
  className = '',
  dark = false,
}: {
  items: string[]
  speed?: number
  className?: string
  dark?: boolean
}) {
  return (
    <div
      className={`overflow-hidden max-w-[100vw] border-y ${
        dark ? 'border-white/10 bg-[#061f2e]' : 'border-slate-200 bg-white'
      } ${className}`}
    >
      <motion.div
        className="flex whitespace-nowrap py-5"
        animate={prefersReducedMotion ? {} : { x: ['0%', '-33.333%'] }}
        transition={{
          x: { repeat: Infinity, duration: speed, ease: 'linear' },
        }}
        style={{ width: 'max-content' }}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-6">
            <span className={`h-1.5 w-1.5 rounded-full bg-[#ff7a66]`} />
            <span
              className={`text-sm font-semibold uppercase tracking-[0.15em] ${
                dark ? 'text-white/80' : 'text-[#081820]'
              }`}
            >
              {item}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}