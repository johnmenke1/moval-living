import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Calendar, MapPin, ExternalLink, ArrowRight, Sparkles, Award, Send } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hour

interface PageProps {
  searchParams: Promise<{ view?: string; region?: string }>
}

type View = 'today' | 'weekend' | 'week' | 'month'

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function viewRange(view: View, now: Date): { start: Date; end: Date; label: string } {
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
      const inAMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      return { start: today, end: inAMonth, label: 'This Month' }
    }
  }
}

// Venue tags that count as "local region" (MoVal + curated regional venues)
const REGIONAL_VENUE_TAGS = new Set([
  'FOX_RIVERSIDE',
  'RIVERSIDE_MUNICIPAL_AUDITORIUM',
  'RIVERSIDE_CONVENTION_CENTER',
  'UCR',
  'CBU',
  'RIVERSIDE_ART_MUSEUM',
  'RIVERSIDE_METROPOLITAN_MUSEUM',
  'REDLANDS_BOWL',
  'REDLANDS_THEATER_FESTIVAL',
  'MOVAL_HIGH_SCHOOL',
])

const REGIONAL_CITIES = new Set([
  'Moreno Valley',
  'Beaumont',
  'Perris',
])

export default async function EventsPage({ searchParams }: PageProps) {
  const { view: rawView, region: rawRegion } = await searchParams
  const view: View = (['today', 'weekend', 'week', 'month'] as View[]).includes(
    rawView as View
  )
    ? (rawView as View)
    : 'month'
  const region: 'local' | 'all' = rawRegion === 'all' ? 'all' : 'local'

  const now = new Date()
  const range = viewRange(view, now)

  // Build the where clause. Local region = MoVal cities + curated regional venues.
  // All = everything.
  const where: any = {
    startsAt: { gte: range.start, lt: range.end },
  }
  if (region === 'local') {
    where.OR = [
      { city: { in: [...REGIONAL_CITIES] } },
      { venueTag: { in: [...REGIONAL_VENUE_TAGS] } },
    ]
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { startsAt: 'asc' }],
  })

  const hero = events.find((e) => e.tier === 'HERO')
  const honorable = events.filter((e) => e.tier === 'HONORABLE_MENTION')
  const standard = events.filter((e) => e.tier === 'STANDARD')

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

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container-max py-4 flex flex-wrap items-center justify-between gap-4">
          {/* View tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {(['today', 'weekend', 'week', 'month'] as View[]).map((v) => {
              const isActive = view === v
              const href = v === 'month' ? '/events' : `/events?view=${v}${region === 'all' ? '&region=all' : ''}`
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

          {/* Region toggle */}
          <div className="flex gap-1">
            <Link
              href={view === 'month' ? '/events' : `/events?view=${view}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                region === 'local'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
              }`}
            >
              Local Region
            </Link>
            <Link
              href={view === 'month' ? '/events?region=all' : `/events?view=${view}&region=all`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                region === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
              }`}
            >
              All Events
            </Link>
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
            {/* Hero — full width */}
            {hero && <HeroCard event={hero} />}

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

function HeroCard({ event }: { event: any }) {
  const dateLabel = formatEventDate(event.startsAt)
  const venue = event.venueName ?? 'Venue TBD'

  return (
    <Link
      href={event.sourceUrl ?? '#'}
      target={event.sourceUrl ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="block bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Image */}
        <div className="aspect-[4/3] lg:aspect-auto bg-gradient-to-br from-primary/20 to-secondary/20 relative">
          {event.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.heroImageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="w-20 h-20 text-primary/30" />
            </div>
          )}
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
            <Award className="w-3.5 h-3.5" /> This Week&apos;s Pick
          </div>
        </div>

        {/* Copy */}
        <div className="p-8 lg:p-10 flex flex-col justify-center">
          <p className="text-sm font-semibold text-primary mb-2">{dateLabel}</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-text mb-4 leading-tight">{event.title}</h2>
          <div className="flex items-center gap-2 text-text-secondary mb-4">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{venue}</span>
            {event.city && event.city !== 'Moreno Valley' && (
              <span className="text-sm text-text-secondary">· {event.city}</span>
            )}
          </div>
          {event.description && (
            <p className="text-text-secondary leading-relaxed line-clamp-4 mb-6">{event.description}</p>
          )}
          <div className="inline-flex items-center gap-2 text-primary font-semibold">
            Learn more <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
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
