'use client'

import { useEffect, useState } from 'react'
import { Activity, Clock, Star, UserPlus, Sparkles, ChevronRight } from 'lucide-react'
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

// Type-tinted background + accent. Designed so the eye can tell a nomination
// from a review at a glance without reading the label.
const TINT: Record<ActivityEvent['type'], { bg: string; text: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  claim:     { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: UserPlus,  label: 'Claimed' },
  featured:  { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: Sparkles,  label: 'Featured' },
  review:    { bg: 'bg-green-50',  text: 'text-green-700',  icon: Star,      label: 'Review' },
  nominate:  { bg: 'bg-purple-50', text: 'text-purple-700', icon: Activity,  label: 'Nominated' },
}

function renderEvent(e: ActivityEvent): { sentence: string; href: string } {
  const link = e.businessSlug ? `/business/${e.businessSlug}` : '#'
  switch (e.type) {
    case 'claim':
      return {
        sentence: `${e.actorName} claimed ${e.businessName}`,
        href: link,
      }
    case 'featured':
      return {
        sentence: `${e.businessName} upgraded to ${e.detail ?? 'Featured'}`,
        href: link,
      }
    case 'review':
      return {
        sentence: `${e.actorName} left a ${e.rating ?? 5}★ review on ${e.businessName}`,
        href: link,
      }
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
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function LiveActivityTicker() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [error, setError] = useState(false)

  // Fetch on mount + every 30s. Skips if the tab is hidden — saves DB
  // pressure on idle visitors.
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
          setActiveIdx(0)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }

    const start = () => {
      if (document.hidden) return
      void fetchEvents()
      interval = setInterval(fetchEvents, 30_000)
    }
    const stop = () => {
      if (interval) clearInterval(interval)
      interval = null
    }

    start()
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop()
      else start()
    })

    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', () => {})
    }
  }, [])

  // Auto-rotate the visible card every 7s if we have more than one.
  useEffect(() => {
    if (events.length <= 1) return
    const t = setInterval(() => {
      setActiveIdx(i => (i + 1) % events.length)
    }, 7_000)
    return () => clearInterval(t)
  }, [events.length])

  // Nothing to show yet (still fetching, fetch failed, or feed empty) —
  // render nothing. A visible "Loading recent activity…" strip on first
  // paint reads as broken; the ticker should only exist once it has news.
  if (error || events.length === 0) {
    return null
  }

  // Active event formatting. Cap showing to 1 visible at a time — the
  // row is just-a-glance, not a feed.
  const active = events[activeIdx]
  const tint = TINT[active.type]
  const Icon = tint.icon
  const { sentence, href } = renderEvent(active)

  return (
    <section
      aria-label="MoVal right now — recent activity on the site"
      className="bg-gradient-to-r from-slate-50 to-white border-y border-slate-200"
    >
      <div className="container-max py-4 sm:py-5">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Header — fixed label on the left */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 shrink-0">
            <Activity className="w-3.5 h-3.5" />
            MoVal right now
          </div>

          {/* Active event card — fades in on index change via key */}
          <Link
            key={active.id}
            href={href}
            className={`flex-1 min-w-0 inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full ${tint.bg} ${tint.text} text-sm font-medium hover:opacity-90 transition-opacity group animate-in fade-in duration-500`}
          >
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${tint.bg} ring-1 ring-current/20 shrink-0`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold text-[10px] uppercase tracking-wider opacity-80 shrink-0">
              {tint.label}
            </span>
            <span className="truncate font-medium text-slate-800">
              {sentence}
            </span>
            <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 hidden sm:inline" />
          </Link>

          {/* Time-ago + position indicator — quiet on the right */}
          <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(active.createdAt)}
            </span>
            {events.length > 1 && (
              <span className="tabular-nums">
                {activeIdx + 1}/{events.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}