'use client'

/**
 * Premium motion primitives for the /web-design page.
 *
 * Built on Framer Motion for spring physics, scroll-linked effects,
 * staggered reveals, and 3D transforms. All motion respects
 * prefers-reduced-motion via the global reduced-motion query.
 */

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
  type Transition,
  type UseInViewOptions,
} from 'framer-motion'

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 18,
  mass: 1,
}

/* ──────────────────────────────────────────────────────────────────────
   Reveal — fade + slide up when the child enters the viewport
   ──────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────
   StaggerContainer — reveals children with staggered delays
   ──────────────────────────────────────────────────────────────────── */

export function StaggerContainer({
  children,
  className = '',
  stagger = 0.1,
  y = 32,
}: {
  children: ReactNode
  className?: string
  stagger?: number
  y?: number
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

/* ──────────────────────────────────────────────────────────────────────
   AnimatedNumber — counts up from 0 to `value` once on enter
   ──────────────────────────────────────────────────────────────────── */

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 1.6,
}: {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 5)
      setDisplay(value * eased)
      if (progress < 1) requestAnimationFrame(tick)
      else setDisplay(value)
    }
    requestAnimationFrame(tick)
  }, [inView, value, duration])

  const shown = Number.isInteger(value) ? Math.round(display).toString() : display.toFixed(1)

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

/* ──────────────────────────────────────────────────────────────────────
   Marquee — infinite horizontal ticker of pills
   ──────────────────────────────────────────────────────────────────── */

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
      className={`overflow-hidden border-y ${dark ? 'border-white/10 bg-[#061f2e]' : 'border-slate-200 bg-white'} ${className}`}
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
            <span className={`h-1.5 w-1.5 rounded-full ${dark ? 'bg-[#ff7a66]' : 'bg-[#ff7a66]'}`} />
            <span
              className={`text-sm font-semibold uppercase tracking-[0.15em] ${dark ? 'text-white/80' : 'text-[#081820]'}`}
            >
              {item}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   AmbientOrbs — soft drifting background blobs
   ──────────────────────────────────────────────────────────────────── */

export function AmbientOrbs({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  if (prefersReducedMotion) return null
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
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

/* ──────────────────────────────────────────────────────────────────────
   ShimmerText — animated gradient sweep over text
   ──────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────
   ParallaxSection — subtle Y parallax for section children
   ──────────────────────────────────────────────────────────────────── */

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
      <motion.div style={{ y: prefersReducedMotion ? 0 : smoothY }}>{children}</motion.div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   FloatingCard — 3D tilt on hover with gloss reflection
   ──────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────
   PulseRing — animated pulsing ring around an element
   ──────────────────────────────────────────────────────────────────── */

export function PulseRing({ children, className = '' }: { children: ReactNode; className?: string }) {
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

/* ──────────────────────────────────────────────────────────────────────
   SplitReveal — draggable before/after comparison slider
   ──────────────────────────────────────────────────────────────────── */

export function SplitReveal({
  before,
  after,
  className = '',
  initialSplit = 35,
}: {
  before: ReactNode
  after: ReactNode
  className?: string
  initialSplit?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [split, setSplit] = useState(initialSplit)
  const [dragging, setDragging] = useState(false)

  const updateSplit = (clientX: number) => {
    const node = containerRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const pct = Math.max(10, Math.min(90, ((clientX - rect.left) / rect.width) * 100))
    setSplit(pct)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: globalThis.MouseEvent) => updateSplit(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden min-h-[420px] sm:min-h-[520px] ${className}`}
      onMouseDown={(e) => {
        setDragging(true)
        updateSplit(e.clientX)
      }}
      onTouchMove={(e) => updateSplit(e.touches[0].clientX)}
      onTouchStart={(e) => updateSplit(e.touches[0].clientX)}
    >
      {/* Before layer */}
      <div className="absolute inset-0">{before}</div>

      {/* After layer clipped by split */}
      <motion.div
        className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-white/40 shadow-[4px_0_24px_rgba(0,0,0,0.25)]"
        style={{ width: `${split}%` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {after}
      </motion.div>

      {/* Slider handle */}
      <motion.div
        className="absolute top-0 bottom-0 z-10 flex items-center justify-center cursor-ew-resize"
        style={{ left: `${split}%`, x: '-50%' }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#081820] shadow-xl border-2 border-white/50 backdrop-blur-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </motion.div>
    </div>
  )
}
