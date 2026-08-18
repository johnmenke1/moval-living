import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { Calendar, MapPin, ExternalLink, ArrowRight, Sparkles, Award, Send, Building2, Ticket, CheckCircle } from 'lucide-react'
import CategoryFilter from './CategoryFilter'
import LanguageFilter from './LanguageFilter'
import SearchBar from './SearchBar'
import MonthNav from './MonthNav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Moreno Valley Community Events Calendar',
  description: 'Find concerts, school sports, fundraisers, festivals, and other community events in Moreno Valley and nearby Inland Empire venues.',
  alternates: { canonical: 'https://www.moval.living/events' },
  openGraph: {
    title: 'Moreno Valley Community Events Calendar',
    description: 'What is happening in and around Moreno Valley, curated by the moval.living team.',
    url: 'https://www.moval.living/events',
    type: 'website',
  },
}

export const revalidate = 3600 // 1 hour

interface PageProps {
  searchParams: Promise<{ view?: string; month?: string; cat?: string; lang?: string; q?: string }>
}

type View = 'today' | 'weekend' | 'week' | 'month'

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}

/** Returns the {start, end, label} range for the given view. */
function viewRange(
  view: View,
  now: Date,
  monthParam?: string,
): { start: Date; end: Date; label: string } {
  const today = startOfDayUTC(now)
  switch (view) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        label: 'Today',
      }
    case 'weekend': {
      const dayOfWeek = today.getUTCDay()
      const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6
      const friday = new Date(today.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000)
      const monday = new Date(friday.getTime() + 3 * 24 * 60 * 60 * 1000)
      return { start: friday, end: monday, label: 'This Weekend' }
    }
    case 'week': {
      const inAWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      return { start: today, end: inAWeek, label: 'This Week' }
    }
    case 'month':
    default: {
      // Default to the current month (UTC) unless monthParam specifies otherwise.
      const baseDate = parseMonthParam(monthParam) ?? today
      const start = startOfMonthUTC(baseDate)
      const end = endOfMonthUTC(baseDate)
      return { start, end, label: formatMonthLabel(baseDate) }
    }
  }
}

function parseMonthParam(s?: string): Date | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10) - 1
  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return null
  return new Date(Date.UTC(year, month, 1))
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const VALID_CATEGORIES = new Set([
  'HS_SPORTS',
  'COLLEGE_SPORTS',
  'LEAGUE_SPORTS',
  'POLITICAL',
  'MUSIC',
  'ARTS',
  'EDUCATIONAL',
  'FAMILY',
  'FOOD_DRINK',
  'COMMUNITY',
  'FUNDRAISERS',
  'HOLIDAY_CELEBRATIONS',
])

export default async function EventsPage({ searchParams }: PageProps) {
  const { view: rawView, month: rawMonth, cat: rawCat, lang: rawLang, q: rawQ } = await searchParams
  const langEs = rawLang === 'es'
  const searchQuery = (rawQ ?? '').trim()
  const view: View = (['today', 'weekend', 'week', 'month'] as View[]).includes(
    rawView as View,
  )
    ? (rawView as View)
    : 'month'

  // For month view, use the URL month param; otherwise default to "today's month"
  // so the MonthNav shows the right initial state.
  const now = new Date()
  const range = viewRange(view, now, rawMonth)
  const navMonth = view === 'month'
    ? (parseMonthParam(rawMonth) ?? startOfMonthUTC(now))
    : startOfMonthUTC(now)

  // Parse categories
  const selectedCats = (rawCat ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((c) => VALID_CATEGORIES.has(c))

  // Build the where clause. All approved events; category filter optional.
  // When a text search is active (?q=...), we broaden the date window to
  // today + 90 days so searchers see relevant upcoming events regardless
  // of which view tab they're on ("Ravens football" should surface the
  // next Ravens game, not be hidden by the Today/Weekend/This Week filters).
  const searchDateEnd = searchQuery
    ? new Date(now.getTime() + 90 * 86400000)
    : range.end
  const where: any = {
    startsAt: { gte: searchQuery ? startOfDayUTC(now) : range.start, lt: searchDateEnd },
  }
  if (selectedCats.length > 0) {
    where.category = { in: selectedCats }
  }
  if (langEs) {
    where.esEnEspanol = true
  }
  if (searchQuery) {
    // Case-insensitive substring match across the user-visible text fields.
    // Same OR-shape as /search page so behavior is consistent end-to-end.
    where.OR = [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      { description: { contains: searchQuery, mode: 'insensitive' } },
      { venueName: { contains: searchQuery, mode: 'insensitive' } },
      { address: { contains: searchQuery, mode: 'insensitive' } },
      { city: { contains: searchQuery, mode: 'insensitive' } },
    ]
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { startsAt: 'asc' }],
  })

  const heroInRange = events.find((e) => e.tier === 'HERO')

  // Month view falls back to the NEXT hero event if no hero exists in the
  // current month. This keeps the section visible across months — e.g. if
  // September's hero is set up while we're still in August, /events still
  // shows it at the top. Today/week views stay strict (they mean "now").
  let heroOverride: typeof events[number] | null = null
  if (view === 'month' && !heroInRange) {
    const now = new Date()
    const fallback = await prisma.event.findFirst({
      where: {
        tier: 'HERO',
        startsAt: { gt: range.end },
      },
      orderBy: { startsAt: 'asc' },
    })
    // Only fall back to a hero that's within 90 days — anything further
    // out is too speculative to render above the current month.
    if (fallback && fallback.startsAt.getTime() - now.getTime() < 90 * 86400000) {
      heroOverride = fallback
    }
  }

  const hero = heroInRange ?? heroOverride

  const honorable = events.filter((e) => e.tier === 'HONORABLE_MENTION')
  const standard = events.filter((e) => e.tier === 'STANDARD')

  const isMonthView = view === 'month'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Head section — single cohesive card with brand wash + dotted calendar overlay.
          Replaces 3 stacked 'bg-white border-b' slabs. Sticky so filters follow scroll. */}
      <div className="sticky top-0 z-10">
        <div className="container-max pt-6 pb-2">
          <div
            className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-secondary/8 via-white to-primary/5"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='1' cy='1' r='1' fill='%23015a6b' fill-opacity='0.10'/></svg>\"), linear-gradient(to bottom right, rgba(1,90,107,0.06), white, rgba(0,122,127,0.04))",
            }}
          >
            <div className="relative px-5 sm:px-8 pt-6 pb-5">
              {/* Title row */}
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary shrink-0">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  {/* Eyebrow — small primary chip that establishes the page's
                      identity ("Community Calendar") before the title. */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    <Sparkles className="w-3 h-3" />
                    Community Calendar
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-bold text-text leading-tight">
                    Community{' '}
                    <span className="text-primary">Events</span>
                  </h1>
                  <p className="text-sm sm:text-base text-text-secondary mt-1 max-w-2xl">
                    What&apos;s happening in and around Moreno Valley — curated by the
                    moval.living team.
                  </p>
                </div>
              </div>

              {/* Search bar — case-insensitive text search across title,
                  description, venue, address, and city. Widens the date
                  window to today + 90 days while q is active. */}
              <div className="mt-4">
                <Suspense fallback={null}>
                  <SearchBar initialQuery={searchQuery} />
                </Suspense>
              </div>

              {/* Filter rows */}
              <div className="mt-4 space-y-3">
                {/* View pills — segmented control. Active tab is the only
                    colored interior so the current view is unmistakable. */}
                <div className="bg-slate-100/80 rounded-xl p-1 flex gap-1 w-fit max-w-full overflow-x-auto">
                  {(['today', 'weekend', 'week', 'month'] as View[]).map((v) => {
                    const isActive = view === v
                    const href = v === 'month' ? '/events' : `/events?view=${v}`
                    return (
                      <Link
                        key={v}
                        href={href}
                        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-secondary hover:text-text'
                        }`}
                      >
                        {v === 'today'
                          ? 'Today'
                          : v === 'weekend'
                            ? 'Weekend'
                            : v === 'week'
                              ? 'This Week'
                              : 'Month'}
                      </Link>
                    )
                  })}
                </div>

                {/* Category chips + language toggle on one row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <Suspense fallback={null}>
                      <CategoryFilter selected={selectedCats} />
                    </Suspense>
                  </div>
                  <Suspense fallback={null}>
                    <LanguageFilter active={langEs} />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Month nav (only on month view) */}
      {isMonthView && (
        <div className="bg-white border-b border-slate-200">
          <div className="container-max py-4">
            <Suspense fallback={null}>
              <MonthNav currentMonth={navMonth} />
            </Suspense>
          </div>
        </div>
      )}

      <div className="container-max py-10">
        {/* Empty state */}
        {events.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">
              {searchQuery
                ? `No events matching "${searchQuery}"`
                : `No events ${range.label.toLowerCase()}${
                    selectedCats.length > 0 ? ' with selected filters' : ''
                  }`}
            </h2>
            <p className="text-text-secondary max-w-md mx-auto mb-6">
              {searchQuery
                ? 'Try a different search term, clear the search, or browse the calendar.'
                : 'Know something happening? Submit an event and we\u2019ll add it to the calendar after a quick review.'}
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
            {/* Hero — full width */}
            {hero && <HeroSection event={hero} />}

            {/* Honorable mentions — 2-3 cards in a row */}
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

// When an event is linked to a Business, the card clicks through to the
// business profile instead of the external source URL. Returning a plain
// href string keeps the Link wrapper in each card clean.
function cardHref(event: any): { href: string; external: boolean } {
  if (event.business?.slug) {
    return { href: `/business/${event.business.slug}`, external: false }
  }
  return { href: event.sourceUrl ?? '#', external: !!event.sourceUrl }
}

// Full-bleed hero section for the tier=HERO event. Image fills the
// background with a dark gradient overlay so text stays legible on any
// photo. CTA button is wired to ticketUrl when present; free events get
// an RSVP-style copy change. Linked-business events keep the Hosted by
// badge.
function HeroSection({ event }: { event: any }) {
  const dateLabel = formatEventDate(event.startsAt)
  const venue = event.venueName ?? 'Venue TBD'
  const target = cardHref(event)

  // Primary CTA: prefer event.shareUrl (admin-set, full URL or path slug)
  // over event.sourceUrl (the provenance URL where this event info was
  // originally scraped from). Falls back to event.ticketUrl (legacy), then
  // to the event detail page link.
  const primaryHref = event.shareUrl || event.sourceUrl || event.ticketUrl || target.href
  const primaryExternal = !!(event.shareUrl || event.sourceUrl || event.ticketUrl) ? true : target.external
  const primaryLabel = primaryHref
    ? event.isFree ? 'RSVP — Free' : 'Event details'
    : 'Event details'
  const PrimaryIcon = primaryHref ? (event.isFree ? CheckCircle : ArrowRight) : ArrowRight

  return (
    <section className="relative rounded-2xl overflow-hidden bg-slate-900 text-white shadow-lg">
      {/* Background image */}
      <div className="absolute inset-0">
        {event.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.heroImageUrl}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/40 to-secondary/40" />
        )}
        {/* Dark overlay so text is legible on any image */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/55 to-slate-950/25" />
      </div>

      {/* Content */}
      <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-20 flex flex-col justify-end min-h-[420px] sm:min-h-[480px] lg:min-h-[560px]">
        {/* Top-left chip row: badge + category */}
        <div className="flex flex-wrap items-center gap-2 mb-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
            <Award className="w-3.5 h-3.5" /> This Week&apos;s Pick
          </span>
          {event.category && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-white text-xs font-semibold uppercase tracking-wider">
              {event.category.replace(/_/g, ' ')}
            </span>
          )}
          {event.esEnEspanol && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-white text-xs font-semibold uppercase tracking-wider">
              En Español
            </span>
          )}
        </div>

        {/* Date pill */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-white text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            {dateLabel}
          </span>
        </div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-3 max-w-3xl">
          {event.title}
        </h2>

        {/* Venue */}
        <div className="flex items-center gap-2 text-white/85 mb-3">
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="text-sm">{venue}</span>
          {event.city && event.city !== 'Moreno Valley' && (
            <span className="text-sm text-white/85">· {event.city}</span>
          )}
        </div>

        {/* Linked business badge */}
        {event.business && (
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-white text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              Hosted by {event.business.name}
            </span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-white/80 leading-relaxed line-clamp-3 mb-6 max-w-2xl">
            {event.description}
          </p>
        )}

        {/* CTA row */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={primaryHref}
            target={primaryExternal ? '_blank' : undefined}
            rel={primaryExternal ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary/90 transition-colors shadow-lg"
          >
            <PrimaryIcon className="w-5 h-5" />
            {primaryLabel}
            {primaryExternal && <ExternalLink className="w-3.5 h-3.5 opacity-75" />}
          </a>
          {/* Secondary link to host (only when we have a separate ticket CTA) */}
          {event.ticketUrl && target.href !== primaryHref && (
            <Link
              href={target.href}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 backdrop-blur text-white font-semibold text-base hover:bg-white/20 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              Visit host
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

function HonorableCard({ event }: { event: any }) {
  const dateLabel = formatEventDate(event.startsAt)
  const target = cardHref(event)

  return (
    <Link
      href={target.href}
      target={target.external ? '_blank' : undefined}
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
        {event.business && (
          <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {event.business.name}
          </p>
        )}
      </div>
    </Link>
  )
}

function StandardCard({ event }: { event: any }) {
  const dateLabel = formatEventDate(event.startsAt)
  const target = cardHref(event)

  return (
    <Link
      href={target.href}
      target={target.external ? '_blank' : undefined}
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
        {event.business && (
          <p className="text-xs text-primary font-semibold mb-2 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            Hosted by {event.business.name}
          </p>
        )}
        {event.description && (
          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{event.description}</p>
        )}
      </div>
    </Link>
  )
}

function formatEventDate(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}
