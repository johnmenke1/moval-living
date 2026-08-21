import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { Calendar, MapPin, Sparkles, Award, Send, Building2 } from 'lucide-react'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildEvent, type Event as EventSchema } from '@/lib/seo-schema'
import CategoryFilter from './CategoryFilter'
import LanguageFilter from './LanguageFilter'
import MonthNav from './MonthNav'
import EventsToolbar from './EventsToolbar'
import { EventsHero } from '@/components/events/EventsHero'
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
    // archivedAt: null hides soft-deleted events from public listings.
    archivedAt: null,
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

  // View-aware hero. Each view window gets its own `tier=HERO` event so the
  // hero strip is always relevant to what the user is looking at:
  //   - Today    → events happening today
  //   - Weekend  → events happening Friday-Sunday
  //   - Week     → events in the next 7 days
  //   - Month    → events in the current month
  // Fallback chain for the MONTH view (the default):
  //   1. HERO event in the current month
  //   2. Any upcoming HERO event within 90 days — this surfaces the next
  //      month's marquee pick when the current month has no HERO scheduled
  //      yet. (e.g. viewing August when September's "Taste of the Valley"
  //      is the next tier=HERO event.)
  // For Today / Weekend / Week views the fallback is stricter — if there's
  // no HERO event in that narrow window, the strip is hidden rather than
  // showing a marquee pick that's not actually relevant to the view.
  const heroFindInWindow = async (windowStart: Date, windowEnd: Date) => {
    const tierHero = await prisma.event.findFirst({
      where: {
        tier: 'HERO',
        archivedAt: null,
        startsAt: { gte: windowStart, lt: windowEnd },
      },
      orderBy: { startsAt: 'asc' },
      include: { business: { select: { slug: true, name: true } } },
    })
    if (tierHero) return { event: tierHero, source: 'tier-hero' }
    return null
  }

  let heroResult: { event: any; source: string } | null = null

  // Step 1: HERO in the active view window.
  heroResult = await heroFindInWindow(range.start, range.end)

  if (!heroResult) {
    const fallbackHero = await prisma.event.findFirst({
      where: {
        tier: 'HERO',
        archivedAt: null,
        startsAt: { gt: now },
      },
      orderBy: { startsAt: 'asc' },
      include: { business: { select: { slug: true, name: true } } },
    })
    if (fallbackHero && fallbackHero.startsAt.getTime() - now.getTime() < 90 * 86400000) {
      heroResult = { event: fallbackHero, source: 'tier-hero-future' }
    }
  }

  const hero = heroResult?.event ?? null

  const honorable = events.filter((e) => e.tier === 'HONORABLE_MENTION')
  const standard = events.filter((e) => e.tier === 'STANDARD')

  const isMonthView = view === 'month'

  return (
    <>
      {/* Schema.org Event JSON-LD for every visible event. Multiple
          <script type="application/ld+json"> tags are valid — Google
          parses each one independently. AI crawlers (GPTBot, ClaudeBot,
          PerplexityBot) read raw HTML so this lands in their initial
          payload too. For the richest indexing, each Event also needs
          its own detail page — see /events/[slug] (separate commit). */}
      {events.flatMap((ev) => {
        const schema = eventToSchema(ev)
        return schema ? [{ key: ev.id, schema }] : []
      }).map(({ key, schema }) => (
        <JsonLd key={`evt-${key}`} schema={buildEvent(schema)} />
      ))}
      <div className="min-h-screen bg-background">
        {/* Full-bleed immersive hero above filters */}
      <EventsHero
        event={
          hero
            ? {
                id: hero.id,
                title: hero.title,
                heroImageUrl: hero.heroImageUrl,
                startsAt: hero.startsAt,
                venueName: hero.venueName ?? null,
                city: hero.city ?? null,
                category: hero.category ?? null,
                description: hero.description ?? null,
                isFree: hero.isFree ?? null,
                shareUrl: hero.shareUrl ?? null,
                ticketUrl: hero.ticketUrl ?? null,
                sourceUrl: hero.sourceUrl ?? null,
                business: hero.business
                  ? { slug: hero.business.slug, name: hero.business.name }
                  : null,
              }
            : null
        }
        viewLabel={range.label}
      />

      {/* Slim sticky filter toolbar */}
      <Suspense fallback={null}>
        <EventsToolbar
          view={view}
          searchQuery={searchQuery}
          selectedCats={selectedCats}
          langEs={langEs}
        />
      </Suspense>

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
            {/* Honorable mentions */}
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

            {/* Standards */}
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
    </>
  )
}

// ── Event → Schema.org JSON-LD ─────────────────────────────────────────────

// Map a Prisma Event row to the input shape that buildEvent() expects, then
// emit the schema. Returns null when the event is missing fields Google
// requires (startDate). The shape follows schema.org/Event strictly so we
// stay eligible for Event rich results.
function eventToSchema(event: any): EventSchema | null {
  if (!event.startsAt) return null
  const startIso = event.startsAt.toISOString()
  const endIso = event.endsAt ? event.endsAt.toISOString() : startIso

  // Address is stored as denormalized strings (street, city, state, zip).
  // Schema.org wants a PostalAddress; build one only when at least one
  // component is populated so we don't emit empty nested objects.
  const hasAddress =
    event.address || event.city || event.state || event.zip || event.venueName
  const location = hasAddress
    ? {
        type: 'Place' as const,
        name: event.venueName ?? undefined,
        address: {
          streetAddress: event.address ?? '',
          addressLocality: event.city ?? '',
          addressRegion: event.state ?? '',
          postalCode: event.zip ?? '',
          addressCountry: 'US',
        },
      }
    : undefined

  return {
    type: 'Event',
    name: event.title,
    description: event.description ?? event.title,
    startDate: startIso,
    endDate: endIso,
    eventStatus: 'EventScheduled',
    eventAttendanceMode: 'OfflineEventAttendanceMode',
    location,
    organizer: event.business?.name
      ? {
          type: 'Organization' as const,
          name: event.business.name,
          url: event.business.slug
            ? `https://www.moval.living/business/${event.business.slug}`
            : undefined,
        }
      : undefined,
    image: event.heroImageUrl ?? undefined,
    offers:
      event.ticketUrl && !event.isFree
        ? {
            price: '0',
            priceCurrency: 'USD',
            url: event.ticketUrl,
            availability: 'https://schema.org/InStock',
          }
        : event.isFree
          ? {
              price: '0',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
            }
          : undefined,
  }
}

// ── Card components ─────────────────────────────────────────────────────

function cardHref(event: any): { href: string; external: boolean } {
  if (event.shareUrl) {
    return { href: event.shareUrl, external: true }
  }
  if (event.ticketUrl) {
    return { href: event.ticketUrl, external: true }
  }
  if (event.business?.slug) {
    return { href: `/business/${event.business.slug}`, external: false }
  }
  return { href: event.sourceUrl ?? '#', external: !!event.sourceUrl }
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
