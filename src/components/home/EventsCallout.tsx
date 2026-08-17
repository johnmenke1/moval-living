import Link from 'next/link'
import { ArrowRight, Calendar, MapPin, Sparkles } from 'lucide-react'

/**
 * EventsCallout — homepage band between Hero and Featured & Best Of that
 * promotes the /events page. Shows the next 4 imminent events with date
 * pills, venue, and time. Brand-tinted background matches the events
 * page head card so visitors see the visual cue that connects them.
 *
 * Layout: header row (eyebrow + title + 'See all events' link) on top,
 * then a 4-column grid of event cards on desktop, 2-column on tablet,
 * 1-column on mobile. Section is hidden entirely if there are no
 * upcoming events.
 */
export interface UpcomingEvent {
  id: string
  slug: string
  title: string
  venueName: string | null
  city: string | null
  startsAt: string // ISO
  tier: 'HERO' | 'HONORABLE_MENTION'
  heroImageUrl: string | null
  category: string | null
  isFree: boolean
  esEnEspanol?: boolean
  ticketUrl?: string | null
  business?: { slug: string; name: string } | null
}

interface EventsCalloutProps {
  events: UpcomingEvent[]
}

const formatDay = (iso: string): { day: string; month: string } => {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('en-US', { day: 'numeric' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  }
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const formatWeekday = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

export function EventsCallout({ events }: EventsCalloutProps) {
  // Hide the entire band if there are no upcoming events.
  if (events.length === 0) return null

  return (
    <section
      className="relative overflow-hidden border-y border-primary/10"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='1' cy='1' r='1' fill='%23015a6b' fill-opacity='0.08'/></svg>\"), linear-gradient(to bottom right, rgba(1,90,107,0.06), white, rgba(0,122,127,0.04))",
      }}
    >
      <div className="container-max py-12 md:py-16">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/10 text-primary shrink-0">
              <Calendar className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <Sparkles className="w-3 h-3" />
                Community Calendar
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-text leading-tight">
                Don&apos;t miss what&apos;s{' '}
                <span className="text-primary">happening in MoVal</span>
              </h2>
              <p className="text-text-secondary text-sm md:text-base mt-1">
                Live music, high school sports, fundraisers, and more — curated by locals.
              </p>
            </div>
          </div>
          <Link
            href="/events"
            className="hidden sm:inline-flex items-center gap-1 text-primary font-semibold hover:gap-2 transition-all whitespace-nowrap"
          >
            See all events <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Event cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {events.map((event) => {
            const { day, month } = formatDay(event.startsAt)
            const weekday = formatWeekday(event.startsAt)
            const time = formatTime(event.startsAt)
            const isHero = event.tier === 'HERO'
            return (
              <Link
                key={event.id}
                href="/events"
                className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all flex flex-col"
              >
                {/* Hero image (if any) — small 16:9 thumbnail */}
                {event.heroImageUrl && (
                  <div className="block aspect-[16/9] overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={event.heroImageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Date pill — absolute over the image if there is one, else at top */}
                {event.heroImageUrl ? (
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-sm text-center leading-none">
                    <div className="text-[9px] font-bold text-primary tracking-wider">
                      {weekday}
                    </div>
                    <div className="text-base font-bold text-text mt-0.5">{day}</div>
                    <div className="text-[9px] font-semibold text-text-secondary tracking-wider mt-0.5">
                      {month}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pt-4">
                    <div className="inline-flex flex-col items-center justify-center bg-primary/10 text-primary rounded-xl px-3 py-2 leading-none">
                      <span className="text-[10px] font-bold tracking-wider">
                        {weekday}
                      </span>
                      <span className="text-2xl font-bold mt-1">{day}</span>
                      <span className="text-[10px] font-semibold tracking-wider mt-1">
                        {month}
                      </span>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  {event.category && (
                    <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-slate-100 text-text-secondary text-[10px] font-bold uppercase tracking-wider mb-2">
                      {event.category.replace(/_/g, ' ')}
                    </span>
                  )}
                  <h3
                    className={`font-bold text-text leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors ${
                      isHero ? 'text-base' : 'text-sm'
                    }`}
                  >
                    {event.title}
                  </h3>
                  <div className="mt-auto pt-2 space-y-1 text-xs text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>{time}</span>
                    </div>
                    {event.venueName && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{event.venueName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Mobile 'See all events' link */}
        <div className="sm:hidden mt-6 text-center">
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-primary font-semibold hover:gap-2 transition-all"
          >
            See all events <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}