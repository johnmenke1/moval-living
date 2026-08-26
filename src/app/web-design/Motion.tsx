'use client'

/**
 * Motion primitives for the /web-design page.
 *
 * Everything is pure CSS + a small IntersectionObserver wrapper. No
 * animation libraries, no JS state per-frame — animations run on the
 * compositor (transform + opacity) so they don't trigger layout or
 * paint on the rest of the page.
 *
 * All motion respects `prefers-reduced-motion` — animations are skipped
 * entirely and elements render in their final state.
 */

import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type MouseEvent } from 'react'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ──────────────────────────────────────────────────────────────────────
   Reveal — fade + slide up when the child enters the viewport
   ──────────────────────────────────────────────────────────────────── */

export function Reveal({
  children,
  delay = 0,
  className = '',
  y = 24,
}: {
  children: ReactNode
  delay?: number
  className?: string
  /** pixels to translate from on entry */
  y?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(true)
      return
    }
    const node = ref.current
    if (!node) return
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  const style: CSSProperties = {
    opacity: shown ? 1 : 0,
    transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `opacity 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
    willChange: shown ? 'auto' : 'opacity, transform',
  }

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   AnimatedNumber — counts up from 0 to `value` once on enter
   ──────────────────────────────────────────────────────────────────── */

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 1400,
}: {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    const node = ref.current
    if (!node) return
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            io.disconnect()
            const start = performance.now()
            const tick = (now: number) => {
              const elapsed = now - start
              const progress = Math.min(elapsed / duration, 1)
              // easeOutQuint — fast start, gentle settle
              const eased = 1 - Math.pow(1 - progress, 5)
              setDisplay(value * eased)
              if (progress < 1) requestAnimationFrame(tick)
              else setDisplay(value)
            }
            requestAnimationFrame(tick)
          }
        }
      },
      { threshold: 0.4 }
    )
    io.observe(node)
    return () => io.disconnect()
  }, [value, duration])

  let shown: string
  if (Number.isInteger(value)) {
    shown = Math.round(display).toString()
  } else {
    shown = display.toFixed(1)
  }

  return (
    <span ref={ref}>
      {prefix}
      {shown}
      {suffix}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   MagneticButton — anchor that nudges toward the cursor on hover
   ──────────────────────────────────────────────────────────────────── */

export function MagneticButton({
  children,
  className = '',
  strength = 12,
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
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion()) return
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setOffset({ x: x * strength, y: y * strength })
  }

  const reset = () => setOffset({ x: 0, y: 0 })

  const style: CSSProperties = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    transition: offset.x === 0 && offset.y === 0 ? 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
  }

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={style}
      className={className}
      {...rest}
    >
      {children}
    </a>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   Marquee — infinite horizontal ticker of pills
   ──────────────────────────────────────────────────────────────────── */

export function Marquee({
  items,
  speed = 30,
  className = '',
}: {
  items: string[]
  /** seconds for one full pass across the viewport */
  speed?: number
  className?: string
}) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const animation = reduced ? 'none' : `marquee ${speed}s linear infinite`

  return (
    <div className={`overflow-hidden border-y border-slate-200 bg-white ${className}`}>
      <div
        className="flex whitespace-nowrap py-5"
        style={{
          animation,
          width: 'max-content',
        }}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9786d]" />
            <span className="text-sm font-semibold uppercase tracking-[0.15em] text-[#1a2e35]">{item}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   AmbientOrbs — soft drifting background blobs (pure CSS animation)
   ──────────────────────────────────────────────────────────────────── */

export function AmbientOrbs({ className = '' }: { className?: string }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return null
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div
        className="absolute h-[420px] w-[420px] rounded-full blur-3xl opacity-30"
        style={{
          background: 'radial-gradient(circle, #c9786d 0%, transparent 70%)',
          top: '-120px',
          left: '-100px',
          animation: 'orb-float-a 14s ease-in-out infinite',
        }}
      />
      <div
        className="absolute h-[360px] w-[360px] rounded-full blur-3xl opacity-25"
        style={{
          background: 'radial-gradient(circle, #007a7f 0%, transparent 70%)',
          top: '40%',
          right: '-80px',
          animation: 'orb-float-b 18s ease-in-out infinite',
        }}
      />
      <div
        className="absolute h-[300px] w-[300px] rounded-full blur-3xl opacity-20"
        style={{
          background: 'radial-gradient(circle, #c9786d 0%, transparent 70%)',
          bottom: '-80px',
          left: '30%',
          animation: 'orb-float-c 22s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes orb-float-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.1); }
        }
        @keyframes orb-float-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -30px) scale(0.9); }
        }
        @keyframes orb-float-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -50px) scale(1.15); }
        }
      `}</style>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   ShimmerText — animated gradient sweep over text
   ──────────────────────────────────────────────────────────────────── */

export function ShimmerText({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return <span className={className}>{children}</span>

  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, #1a2e35 0%, #c9786d 25%, #007a7f 50%, #c9786d 75%, #1a2e35 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer-sweep 6s linear infinite',
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
