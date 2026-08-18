import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Calendar, MapPin, ExternalLink, ArrowRight, Sparkles, Award, Send, Ticket, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hour

interface PageProps {
  searchParams: Promise<{ view?: string; cat?: string; month?: string }>
}

type View = 'today' | 'weekend' | 'week' | 'month'
type EventCategory = 'SPORTS' | 'HS_SPORTS' | 'COLLEGE_SPORTS' | 'LEAGUE_SPORTS' | 'MUSIC' | 'EDUCATIONAL' | 'FUNDRAISERS' | 'COMMUNITY' | 'ARTS' | 'FAMILY' | 'HOLIDAY_CELEBRATIONS' | 'FOOD_DRINK' | 'POLITICAL'

const CATEGORY_LABELS: Record<EventCategory, string> = {
  SPORTS: 'Sports',
  HS_SPORTS: 'HS Sports',
  COLLEGE_SPORTS: 'College Sports',
  LEAGUE_SPORTS: 'League Sports',
  MUSIC: 'Music',
  EDUCATIONAL: 'Educational',
  FUNDRAISERS: 'Fundraisers',
  COMMUNITY: 'Community',
  ARTS: 'Arts',
  FAMILY: 'Family',
  HOLIDAY_CELEBRATIONS: 'Holiday',
  FOOD_DRINK: 'Food & Drink',
  POLITICAL: 'Political',
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function viewRange(view: View, now: Date, monthParam?: string): { start: Date; end: Date; label: string } {
  const today = startOfDayUTC(now)
  switch (view) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        label: 'Today',
      }
    case 'weekend': {
      // Fri-Sun: find the next Friday at-or-after today
      const dayOfWeek = today.getUTCDay() // 0=Sun, 5=Fri, 6=Sat
      const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6 // wrap-around
      const friday = new Date(today.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000)
      const monday = new Date(friday.getTime() + 3 * 24 * 60 * 60 * 1000)
      return { start: friday, end: monday, label: 'This Weekend' }
    }
    case 'week': {
      const sunday = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      return { start: today, end: sunday, label: 'This Week' }
    }
    case 'month':
    default: {
      // Parse month param (YYYY-MM) or default to current month
      let year: number, month: number
      if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
        const [y, m] = monthParam.split('-').map(Number)
        year = y
        month = m - 1 // JS months are 0-indexed
      } else {
        year = today.getUTCFullYear()
        month = today.getUTCMonth()
      }
      const start = new Date(Date.UTC(year, month, 1))
      const end = new Date(Date.UTC(year, month + 1, 1))
      const monthLabel = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Los_Angeles' })
      return { start, end, label: monthLabel }
    }
  }
}

/** Build a YYYY-MM string for the month containing `d`. */
function monthParamFor(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Shift a YYYY-MM string by `delta` months (-1 for prev, +1 for next). */
function shiftMonth(monthParam: string, delta: number): string {
  const [y, m] = monthParam.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return monthParamFor(d)
}

/** Parse `cat` URL param into a validated category list. */
function parseCategories(cat?: string): EventCategory[] {
  if (!cat) return []
  const valid = new Set<string>(Object.keys(CATEGORY_LABELS))
  return cat.split(',').filter((c) => valid.has(c)) as EventCategory[]
}

/** Build a clean URL for filter links. */
function buildHref({
  view,
  cat,
  month,
}: {
  view?: View
  cat?: EventCategory[]
  month?: string | undefined
}): string {
  const params = new URLSearchParams()
  if (view && view !== 'month') params.set('view', view)
  if (cat && cat.length > 0) params.set('cat', cat.join(','))
  if (month) params.set('month', month)
  const qs = params.toString()
  return qs ? `/events?${qs}` : '/events'
}

export default async function EventsPage({ searchParams }: PageProps) {
  const { view: rawView, cat: rawCat, month: rawMonth } = await searchParams
  const view: View = (['today', 'weekend', 'week', 'month'] as View[]).includes(
    rawView as View
  )
    ? (rawView as View)
    : 'month'

  const now = new Date()
  const range = viewRange(view, now, rawMonth)

  // Build the where clause. All approved events within the date range,
  // optionally narrowed by category.
  const selectedCategories = parseCategories(rawCat)
  const where: any = {
    startsAt: { gte: range.start, lt: range.end },
  }
  if (selectedCategories.length > 0) {
    where.category = { in: selectedCategories }
  }

  // Counts per category for chip badges (independent of selected filter).
  const categoryCounts: Record<EventCategory, number> = {
    SPORTS: 0, HS_SPORTS: 0, COLLEGE_SPORTS: 0, LEAGUE_SPORTS: 0,
    MUSIC: 0, EDUCATIONAL: 0, FUNDRAISERS: 0,
    COMMUNITY: 0, ARTS: 0, FAMILY: 0,
    HOLIDAY_CELEBRATIONS: 0, FOOD_DRINK: 0, POLITICAL: 0,
  }
  const allInRange = await prisma.event.findMany({
    where: { startsAt: { gte: range.start, lt: range.end } },
    select: { category: true },
  })
  for (const e of allInRange) {
    if (e.category && e.category in categoryCounts) {
      categoryCounts[e.category as EventCategory]++
    }
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { startsAt: 'asc' }],
  })

  const hero = events.find((e) => e.tier === 'HERO')
  const honorable = events.filter((e) => e.tier === 'HONORABLE_MENTION')
  const standard = events.filter((e) => e.tier === 'STANDARD')

  // Hero roll-forward: if no HERO event in the visible range, find the
  // next future HERO event (regardless of category filter) and surface it
  // with a "next month" badge so the section always has something to show
  // when curation exists somewhere in the calendar.
  let heroRollForward: typeof events[number] | null = null
  if (!hero) {
    const nextHero = await prisma.event.findFirst({
      where: {
        tier: 'HERO',
        startsAt: { gte: now },
      },
      orderBy: { startsAt: 'asc' },
    })
    heroRollForward = nextHero
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container-max py-10">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-text">Community Events</h1>
          </div>
          <p className="text-text-secondary max-w-2xl">
            What&apos;s happening in and around Moreno Valley — from local community gatherings
            to regional shows worth the drive. Curated by the moval.living team.
          </p>
        </div>
      </div>

      {/* Hero section — always above the filter bar. Shows the featured event
          for the current view; falls back to the next future HERO with a
          "next month" badge when none exist in the visible range. */}
      {(hero || heroRollForward) && (
        <div className="container-max pt-10">
          <HeroCard
            event={(hero ?? heroRollForward)!}
            rollForward={!hero && !!heroRollForward}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 mt-10">
        <div className="container-max py-4 space-y-3">
          {/* View tabs + month navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-1 overflow-x-auto">
              {(['today', 'weekend', 'week', 'month'] as View[]).map((v) => {
                const isActive = view === v
                const href = buildHref({ view: v, cat: selectedCategories, month: view === 'month' && v === 'month' ? rawMonth : undefined })
                return (
                  <Link
                    key={v}
                    href={href}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
                    }`}
                  >
                    {v === 'today'
                      ? 'Today'
                      : v === 'weekend'
                        ? 'Weekend'
                        : v === 'week'
                          ? 'This Week'
                          : 'This Month'}
                  </Link>
                )
              })}
            </div>

            {/* Month picker — only visible when view=month */}
            {view === 'month' && (
              <div className="flex items-center gap-2">
                <Link
                  href={buildHref({ view: 'month', cat: selectedCategories, month: shiftMonth(rawMonth || monthParamFor(now), -1) })}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-text-secondary hover:bg-slate-200 text-sm"
                  aria-label="Previous month"
                >
                  ←
                </Link>
                <span className="text-sm font-semibold text-text min-w-[140px] text-center">{range.label}</span>
                <Link
                  href={buildHref({ view: 'month', cat: selectedCategories, month: shiftMonth(rawMonth || monthParamFor(now), 1) })}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-text-secondary hover:bg-slate-200 text-sm"
                  aria-label="Next month"
                >
                  →
                </Link>
                <Link
                  href={buildHref({ view: 'month', cat: selectedCategories })}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-text-secondary hover:bg-slate-200 text-xs font-semibold"
                >
                  Today
                </Link>
              </div>
            )}
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2">
            {(Object['entries'](CATEGORY_LABELS) as [EventCategory, string][]).map(([key, label]) => {
              const isActive = selectedCategories.includes(key)
              const next = isActive
                ? selectedCategories.filter((c) => c !== key)
                : [...selectedCategories, key]
              return (
                <Link
                  key={key}
                  href={buildHref({ view, cat: next, month: rawMonth })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    isActive
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-secondary border-slate-200 hover:border-primary/50'
                  }`}
                >
                  {label} ({categoryCounts[key]})
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container-max py-10">
        {/* Empty state */}
        {events.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">No events {range.label.toLowerCase()}</h2>
            <p className="text-text-secondary max-w-md mx-auto mb-6">
              Know something happening? Submit an event and we&apos;ll add it to the calendar after a quick review.
            </p>
            <Link
              href="/submit/event"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
            >
              <Send className="w-4 h-4" /> Submit an event
            </Link>
          </div>
        )}

        {/* Bento grid */}
        {events.length > 0 && (
          <div className="space-y-6">
            {/* Honorable mentions — 2-3 cards in a row. Skipped when the hero
                is the visible-range one because that event is already shown
                at the top; roll-forward heroes are listed below too. */}
            {honorable.length > 0 && (
              <section>
                <h2 className="text-xs uppercase font-bold tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Honorable Mentions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {honorable.map((ev) => (
                    <HonorableCard key={ev.id} event={ev} />
                  ))}
                </div>
              </section>
            )}

            {/* Standards — 2-column grid */}
            {standard.length > 0 && (
              <section>
                {honorable.length > 0 && (
                  <h2 className="text-xs uppercase font-bold tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> More Events
                  </h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {standard.map((ev) => (
                    <StandardCard key={ev.id} event={ev} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Submit CTA at the bottom */}
        {events.length > 0 && (
          <div className="mt-12 bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-semibold text-text">Know something we&apos;re missing?</p>
              <p className="text-sm text-text-secondary">
                Submit an event and we&apos;ll add it to the calendar after a quick review.
              </p>
            </div>
            <Link
              href="/submit/event"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Send className="w-4 h-4" /> Submit an event
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card components ─────────────────────────────────────────────────────

function HeroCard({ event, rollForward }: { event: any; rollForward?: boolean }) {
  const dateLabel = formatEventDate(event.startsAt)
  const venue = event.venueName ?? 'Venue TBD'

  // CTA logic: ticketUrl → "Get Tickets", sourceUrl → "View Details", else no button
  const ctaUrl = event.ticketUrl ?? event.sourceUrl ?? null
  const ctaLabel = event.ticketUrl
    ? 'Get Tickets'
    : event.sourceUrl
      ? 'View Details'
      : null
  const ctaIcon = event.ticketUrl ? Ticket : ExternalLink

  return (
    <section
      aria-label="Featured event"
      className="relative bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
    >
      {/* Background image — fills the card with a tinted gradient fallback */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] bg-gradient-to-br from-primary/30 via-primary/10 to-secondary/20">
        {event.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.heroImageUrl}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Calendar className="w-24 h-24 text-primary/30" />
          </div>
        )}

        {/* Top-left badge */}
        <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
          <Award className="w-3.5 h-3.5" /> Featured Event
        </div>

        {/* Bottom gradient + content overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 md:p-10 pt-24">
          <div className="max-w-3xl">
            {/* Date pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold mb-3">
              <Clock className="w-3.5 h-3.5" />
              {dateLabel}
            </div>

            {/* Title */}
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 leading-tight">
              {event.title}
            </h2>

            {/* Venue */}
            <div className="flex items-center gap-2 text-white/85 mb-4">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="text-sm">{venue}</span>
              {event.city && event.city !== 'Moreno Valley' && (
                <span className="text-sm text-white/70">· {event.city}</span>
              )}
            </div>

            {/* Description (only when present) */}
            {event.description && (
              <p className="text-white/85 text-sm md:text-base leading-relaxed mb-5 line-clamp-3 max-w-2xl">
                {event.description}
              </p>
            )}

            {/* CTA button + roll-forward badge row */}
            <div className="flex flex-wrap items-center gap-3">
              {ctaUrl && ctaLabel && (
                <a
                  href={ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg"
                >
                  {(() => {
                    const Icon = ctaIcon
                    return <Icon className="w-4 h-4" />
                  })()}
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
              {rollForward && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Next featured event
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HonorableCard({ event }: { event: any }) {
  const dateLabel = formatEventDate(event.startsAt)

  return (
    <Link
      href={event.sourceUrl ?? '#'}
      target={event.sourceUrl ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="block bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-secondary/10 relative">
        {event.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.heroImageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar className="w-10 h-10 text-primary/30" />
          </div>
        )}
      </div>
      <div className="p-5">
        <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wide">{dateLabel}</p>
        <h3 className="font-bold text-text mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {event.title}
        </h3>
        {event.venueName && (
          <p className="text-sm text-text-secondary flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {event.venueName}
          </p>
        )}
      </div>
    </Link>
  )
}

function StandardCard({ event }: { event: any }) {
  const dateLabel = formatEventDate(event.startsAt)

  return (
    <Link
      href={event.sourceUrl ?? '#'}
      target={event.sourceUrl ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="block bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all group"
    >
      {event.heroImageUrl && (
        <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-secondary/10 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.heroImageUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-5">
        <p className="text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">{dateLabel}</p>
        <h3 className="font-semibold text-text mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {event.title}
        </h3>
        {event.venueName && (
          <p className="text-xs text-text-secondary flex items-center gap-1 mb-2">
            <MapPin className="w-3 h-3" />
            {event.venueName}
            {event.city && event.city !== 'Moreno Valley' && ` · ${event.city}`}
          </p>
        )}
        {event.description && (
          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{event.description}</p>
        )}
      </div>
    </Link>
  )
}

function formatEventDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}