'use client'

import { useEffect, useRef } from 'react'

/**
 * Scroll-driven reveal for the magazine spreads. Each child gets a gentle
 * 2px translate-up + fade-in when it enters the viewport. Respects
 * prefers-reduced-motion. The children are passed as a render-prop or as
 * direct children (we just wrap them in a single observed container).
 */
export function MagazineReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement
            target.style.transition = `opacity 700ms ease-out ${delay}ms, transform 700ms ease-out ${delay}ms`
            target.style.opacity = '1'
            target.style.transform = 'translateY(0)'
            observer.unobserve(target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: 0, transform: 'translateY(8px)' }}
    >
      {children}
    </div>
  )
}
