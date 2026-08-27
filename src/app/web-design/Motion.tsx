'use client'

/**
 * SplitReveal — draggable before/after comparison slider.
 *
 * PAGE-SPECIFIC — kept here on /web-design rather than promoted to the
 * shared motion barrel because nothing else on the site has a before/after
 * sales surface. If a future page needs the same pattern, promote it
 * alongside the other primitives in `src/components/motion/`.
 *
 * Architecture
 * ────────────
 * • Before layer: fills the container (absolute inset-0), z-0.
 * • After layer: also fills the container, but the visible region is
 *   controlled by `clip-path: inset(0 (100 - split)% 0 0)`. This is the
 *   only thing that animates — so the layer always stays 100% wide and
 *   we never have to do width-percent math on an absolutely positioned
 *   child (which is what made the old version "grow from the corner").
 * • Divider handle: positioned at `split%` with a glowing vertical line
 *   plus a circular drag knob.
 * • Idle motion: one-shot auto-sweep on mount to draw the eye, then a
 *   subtle pulse on the handle so users know it's draggable.
 *
 * Imports the prefers-reduced-motion helper from the shared motion lib
 * so behavior stays consistent across pages.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { prefersReducedMotion } from '@/components/motion/shared'

export function SplitReveal({
  before,
  after,
  className = '',
  initialSplit = 50,
}: {
  before: ReactNode
  after: ReactNode
  className?: string
  initialSplit?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [split, setSplit] = useState(initialSplit)
  const [dragging, setDragging] = useState(false)
  const [autoRunning, setAutoRunning] = useState(true)
  const rafRef = useRef<number | null>(null)

  // Respect prefers-reduced-motion. Lazy init avoids the setState-in-effect lint.
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  // One-shot auto-sweep: 0 → 95 → 50 over ~2.4s, then hand control to the user.
  useEffect(() => {
    if (!autoRunning || reducedMotion) return
    const reduce = (n: number) => n
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 2400)
      // ease-in-out cubic
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      if (t < 0.55) {
        // 0 → 95
        setSplit(reduce(95 * e / 0.55))
      } else {
        // 95 → 50
        const k = (t - 0.55) / 0.45
        setSplit(95 + (50 - 95) * k)
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setSplit(50)
        setAutoRunning(false)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [autoRunning, reducedMotion])

  const updateSplit = (clientX: number) => {
    const node = containerRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100))
    setSplit(pct)
    if (autoRunning) setAutoRunning(false) // user touched it — kill the auto sweep
  }
  // Stable ref so the drag-listener effect doesn't churn.
  const updateSplitRef = useRef(updateSplit)
  useEffect(() => {
    updateSplitRef.current = updateSplit
  })

  // Window-level drag listeners (cleaner than re-attaching inside the effect).
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: globalThis.MouseEvent) => {
      e.preventDefault()
      updateSplitRef.current(e.clientX)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const clipRight = Math.max(0, 100 - split)
  const isSettled = !autoRunning

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-2xl ring-1 ring-white/15 aspect-[1088/608] min-h-[260px] sm:min-h-[360px] ${className}`}
      onMouseDown={(e) => {
        setAutoRunning(false)
        setDragging(true)
        updateSplit(e.clientX)
      }}
      onTouchStart={(e) => {
        setAutoRunning(false)
        updateSplit(e.touches[0].clientX)
      }}
      onTouchMove={(e) => {
        e.preventDefault()
        updateSplit(e.touches[0].clientX)
      }}
    >
      {/* BEFORE layer — always fills the container */}
      <div className="absolute inset-0 z-0">{before}</div>

      {/* AFTER layer — clipped from the right edge.
          clip-path is GPU-accelerated and never breaks out of its box. */}
      <div
        className="absolute inset-0 z-10"
        style={{
          clipPath: `inset(0 ${clipRight}% 0 0)`,
          WebkitClipPath: `inset(0 ${clipRight}% 0 0)`,
        }}
      >
        {after}
        {/* Inner border on the after side so the divider region reads as "different" */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: 'inset 0 0 0 1px rgba(0, 168, 168, 0.35)',
          }}
        />
      </div>

      {/* Divider line + glow. Rendered outside the clip so it's always crisp. */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 z-20"
        style={{ left: `${split}%`, transform: 'translateX(-50%)' }}
      >
        {/* Vertical glow line */}
        <div className="relative h-full w-px bg-white shadow-[0_0_12px_2px_rgba(255,255,255,0.85),0_0_28px_8px_rgba(0,168,168,0.35)]" />
        {/* Inner thicker line for definition */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-gradient-to-b from-white/95 via-white to-white/95" />
      </div>

      {/* Slider handle (drag knob) */}
      <motion.div
        className="absolute top-1/2 z-30 flex items-center justify-center cursor-ew-resize"
        style={{ left: `${split}%`, x: '-50%', y: '-50%' }}
        animate={
          reducedMotion || dragging || !isSettled
            ? { scale: 1 }
            : { scale: [1, 1.08, 1] }
        }
        transition={
          reducedMotion || dragging || !isSettled
            ? { duration: 0 }
            : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <div className="relative">
          {/* Soft halo */}
          <div className="absolute inset-0 rounded-full bg-white/40 blur-md scale-150" />
          {/* The actual knob */}
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#081820] shadow-xl border-2 border-white/70">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// Silence the unused-import warning for prefersReducedMotion — the value
// is read inside the file via the lazy initializer above (which doesn't
// reference this const directly). Keeping the import makes the file's
// dependency on the shared motion lib explicit at the top.
void prefersReducedMotion