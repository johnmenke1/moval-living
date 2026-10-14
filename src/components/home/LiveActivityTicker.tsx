'use client'

import { useEffect, useState } from 'react'
import { Activity, Star, UserPlus, Sparkles } from 'lucide-react'
import Link from 'next/link'

type ActivityEvent = {
  id: string
  type: 'claim' | 'featured' | 'review' | 'nominate'
  createdAt: string
  actorName: string
  businessName: string
  businessSlug: string
  detail?: string
  rating?: number
  categoryName?: string
}

// Brand-only tints: teal for the everyday signals, gold reserved for Best Of
// (nominations). No second accent hue.
const TINT: Record<ActivityEvent['type'], { bg: string; text: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  claim:     { bg: 'bg-primary/10', text: 'text-primary-dark', icon: UserPlus, label: 'Claimed' },
  featured:  { bg: 'bg-primary/10', text: 'text-primary-dark', icon: Sparkles, label: 'Featured' },
  review:    { bg: 'bg-primary/10', text: 'text-primary-dark', icon: Star,     label: 'Review' },
  nominate:  { bg: 'bg-gold/30',    text: 'text-secondary',    icon: Activity, label: 'Nominated' },
}

function renderEvent(e: ActivityEvent): { sentence: string; href: string } {
  const link = e.businessSlug ? `/business/${e.businessSlug}` : '#'
  switch (e.type) {
    case 'claim':
      return { sentence: `${e.actorName} claimed ${e.businessName}`, href: link }
    case 'featured':
      return { sentence: `${e.businessName} upgraded to ${e.detail ?? 'Featured'}`, href: link }
    case 'review':
      return { sentence: `${e.actorName} left a ${e.rating ?? 5}★ review on ${e.businessName}`, href: link }
    case 'nominate':
      return {
        sentence: `${e.actorName} nominated ${e.businessName} for ${e.categoryName ?? 'Best Of'}`,
        href: e.businessSlug ? `/business/${e.businessSlug}` : '/best-of',
      }
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const MAX_SHOWN = 3

/**
 * "MoVal right now": the latest few claims, upgrades, reviews and
 * nominations as a static list. It used to auto-rotate one item at a time;
 * a static list needs no pause control and can be read at the visitor's pace.
 * Renders nothing until it has news.
 */
export default function LiveActivityTicker() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [error, setError] = useState(false)

  // Fetch on mount + every 60s while the tab is visible.
  useEffect(() => {
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/public/live-activity', { cache: 'no-store' })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data: ActivityEvent[] = await res.json()
        if (!cancelled) {
          setEvents(data)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    const stop = () => {
      if (interval) clearInterval(interval)
      interval = null
    }
    const start = () => {
      if (document.hidden || interval) return
      void fetchEvents()
      interval = setInterval(fetchEvents, 60_000)
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (error || events.length === 0) return null

  return (
    <section aria-labelledby="activity-heading" className="border-y border-slate-200 bg-slate-50">
      <div className="container-max py-8">
        <h2 id="activity-heading" className="mb-4 text-xl font-bold text-text">
          MoVal right now
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {events.slice(0, MAX_SHOWN).map(event => {
            const tint = TINT[event.type]
            const Icon = tint.icon
            const { sentence, href } = renderEvent(event)
            return (
              <li key={event.id}>
                <Link
                  href={href}
                  className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm transition-colors hover:border-primary/40"
                >
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint.bg} ${tint.text}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-semibold uppercase tracking-wider ${tint.text}`}>
                      {tint.label} · {timeAgo(event.createdAt)}
                    </span>
                    <span className="mt-0.5 block font-medium text-text">{sentence}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
