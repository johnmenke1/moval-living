import Link from 'next/link'
import {
  Calendar,
  MapPin,
  ArrowRight,
  Clock,
} from 'lucide-react'

interface HeroEvent {
  id: string
  slug: string
  title: string
  heroImageUrl: string | null
  startsAt: Date | null
  venueName: string | null
  city: string | null
  category: string | null
  description: string | null
  isFree: boolean | null
  shareUrl: string | null
  ticketUrl: string | null
  sourceUrl: string | null
  business: { slug: string; name: string } | null
}

interface EventsHeroProps {
  event: HeroEvent | null
  viewLabel: string
  /** Total events in the current view (today/week/weekend/month) — used
   *  in the no-hero branch as the answer capsule for AI engines. */
  eventCount: number
  /** Title of the next upcoming event in the current view (or null) —
   *  named explicitly so the capsule reads as a complete answer. */
  nextEventTitle: string | null
  /** Short category hint for the next event (e.g. "concert", "fundraiser") */
  nextEventCategory: string | null
}

function cardHref(event: HeroEvent): { href: string; external: boolean; label: string } {
  // Internal /events/[slug] is now the primary click target so each event
  // earns its own indexed URL. shareUrl/ticketUrl/sourceUrl still live on
  // the detail page as CTAs (see /events/[slug]/page.tsx). External link
  // target (ticket sites etc.) stays one click away but Google indexes
  // the internal page first, capturing the long-tail traffic.
  if (event.slug) return { href: `/events/${event.slug}`, external: false, label: event.isFree ? 'RSVP — Free' : 'View event details' }
  if (event.shareUrl) return { href: event.shareUrl, external: true, label: 'Event details' }
  if (event.ticketUrl) return { href: event.ticketUrl, external: true, label: 'Get tickets' }
  if (event.business?.slug) return { href: `/business/${event.business.slug}`, external: false, label: 'Visit host' }
  return { href: event.sourceUrl ?? '#', external: !!event.sourceUrl, label: event.sourceUrl ? 'Event details' : 'Event details' }
}

function formatHeroDate(d: Date | null): { day: string; time: string } {
  if (!d) return { day: 'Date TBA', time: '' }
  const day = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
  return { day, time }
}

export function EventsHero({ event, viewLabel, eventCount, nextEventTitle, nextEventCategory }: EventsHeroProps) {
  if (!event) {
    return (
      <section className="relative min-h-[50vh] sm:min-h-[55vh] flex items-center overflow-hidden bg-secondary">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary to-primary/30" aria-hidden="true" />
        <div className="relative z-10 w-full">
          <div className="container-max py-20 sm:py-28">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] tracking-tight mb-4"
              style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
            >
              Community <span className="text-[#4dd0d8]">Events</span>
            </h1>

            {/* Answer capsule — server-rendered, first ~150 words of HTML.
                AI engines lift this when answering queries like "what is
                happening in Moreno Valley this weekend?" The shape is a
                complete factual answer: count + venue scope + named next
                event when available. */}
            <p className="text-lg sm:text-xl text-white/90 max-w-3xl leading-relaxed">
              {viewLabel} in Moreno Valley has
              {' '}{eventCount.toLocaleString()} community event{eventCount === 1 ? '' : 's'}
              {' '}— concerts, school sports, fundraisers, festivals, and more, all
              curated by the moval.living team.
              {nextEventTitle && (
                <> Next up: <strong>{nextEventTitle}</strong>{nextEventCategory && ` (${nextEventCategory.toLowerCase()})`}.</>
              )}
              {eventCount === 0 && (
                <> No events scheduled for this window yet — try the month view to see what's coming.</>
              )}
            </p>
          </div>
        </div>
      </section>
    )
  }

  const { day, time } = formatHeroDate(event.startsAt)
  const target = cardHref(event)
  const category = event.category?.replace(/_/g, ' ') ?? null
  const venue = [event.venueName, event.city && event.city !== 'Moreno Valley' ? event.city : null].filter(Boolean).join(' · ')

  return (
    <section className="relative min-h-[70vh] sm:min-h-[75vh] flex items-center overflow-hidden bg-slate-950 text-white">
      {/* Background photo */}
      <div className="absolute inset-0 z-0">
        {event.heroImageUrl ? (
          <img
            src={event.heroImageUrl}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/50 to-secondary/60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/30" />
      </div>

      {/* Left-aligned content */}
      <div className="relative z-10 w-full">
        <div className="container-max px-6 sm:px-8 py-20 sm:py-28">
          <div className="max-w-4xl">
            {/* Metadata pills immediately above title */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-white text-[10px] uppercase tracking-[0.22em] font-semibold shadow-sm">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                {viewLabel}&apos;s Pick
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[10px] uppercase tracking-[0.22em] font-semibold">
                <Calendar className="w-3 h-3" />
                {day}
              </span>
              {time && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[10px] uppercase tracking-[0.22em] font-semibold">
                  <Clock className="w-3 h-3" />
                  {time}
                </span>
              )}
              {category && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[10px] uppercase tracking-[0.22em] font-semibold">
                  {category}
                </span>
              )}
              {event.isFree && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] uppercase tracking-[0.22em] font-semibold">
                  Free
                </span>
              )}
            </div>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] tracking-tight mb-3"
              style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
            >
              {event.title}
            </h1>
            {venue && (
              <div className="flex items-center gap-2 text-white/85 mb-5 text-sm sm:text-base">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{venue}</span>
              </div>
            )}
            {event.description && (
              <p className="text-white/80 leading-relaxed line-clamp-2 mb-6 max-w-2xl text-base sm:text-lg">
                {event.description}
              </p>
            )}
            <Link
              href={target.href}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-lg"
            >
              <span>{event.isFree ? 'RSVP — Free' : target.label}</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
