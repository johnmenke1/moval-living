import Link from 'next/link'
import { ArrowRight, Calendar, MapPin } from 'lucide-react'

/**
 * EventsCallout — homepage band promoting /events. Shows the next few
 * curated events (HERO + HONORABLE_MENTION tier) as a static, dated grid.
 * Static on purpose: nothing auto-advances, so nothing needs a pause control
 * and a distracted visitor can read a card without it sliding away.
 *
 * Section is hidden entirely when there are no upcoming events.
 */
export interface UpcomingEvent {
  id: string
  slug: string
  title: string
  venueName: string | null
  startsAt: string // ISO
  tier: 'STANDARD' | 'HONORABLE_MENTION' | 'HERO'
  heroImageUrl: string | null
  category: string | null
  isFree: boolean
}

interface EventsCalloutProps {
  events: UpcomingEvent[]
}

// Rendered in Pacific time so server and client agree (no hydration drift)
// and the date a Moreno Valley visitor sees is the date of the event there.
const TZ = 'America/Los_Angeles'

const formatDay = (iso: string): { day: string; month: string; weekday: string } => {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: TZ }),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: TZ }).toUpperCase(),
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }).toUpperCase(),
  }
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })

export function EventsCallout({ events }: EventsCalloutProps) {
  if (events.length === 0) return null
  const shown = events.slice(0, 4)

  return (
    <section className="border-y border-primary-dark/10 bg-white" aria-labelledby="events-heading">
      <div className="container-max py-12 md:py-16">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 id="events-heading" className="text-3xl font-bold leading-tight text-text md:text-4xl">
              Coming up in the Valley
            </h2>
            <p className="mt-2 max-w-xl text-text-secondary">
              Live music, high school sports, fundraisers, and more, picked by locals.
            </p>
          </div>
          <Link
            href="/events"
            className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-primary hover:gap-2 transition-all"
          >
            See all events <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((event) => {
            const { day, month, weekday } = formatDay(event.startsAt)
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg motion-reduce:hover:translate-y-0"
                >
                  {event.heroImageUrl && (
                    <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.heroImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 gap-4 p-4">
                    <div
                      className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 leading-none text-primary"
                      aria-hidden
                    >
                      <span className="text-xs font-bold tracking-wider">{weekday}</span>
                      <span className="mt-1 text-2xl font-bold text-text">{day}</span>
                      <span className="mt-1 text-xs font-semibold tracking-wider">{month}</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="line-clamp-2 text-base font-bold leading-snug text-text transition-colors group-hover:text-primary">
                        {event.title}
                      </h3>
                      <div className="mt-auto space-y-1 pt-3 text-sm text-text-secondary">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                          <span>
                            {weekday} {month} {day}, {formatTime(event.startsAt)}
                            {event.isFree ? ' · Free' : ''}
                          </span>
                        </div>
                        {event.venueName && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                            <span className="line-clamp-1">{event.venueName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
