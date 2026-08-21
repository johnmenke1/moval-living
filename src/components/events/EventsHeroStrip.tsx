import Link from 'next/link'
import { Calendar, MapPin, ArrowRight, Clock } from 'lucide-react'

/**
 * EventsHeroStrip — the full-bleed photo hero that sits above the sticky
 * filter card on /events. Picks a different `tier=HERO` event depending on
 * which view the user is on (Today / Weekend / This Week / Month), so the
 * hero is always relevant to what they're looking at. When no hero exists
 * in the current window, the server falls back to the next upcoming hero
 * within 90 days — this component just renders whatever it's given.
 *
 * Visual language matches the rest of the publication:
 *   - Full-bleed photo (no card chrome, no rounded corners)
 *   - Soft slate-950 lower-third gradient for legibility
 *   - Mono metadata (date · time · category) in the top-left
 *   - Small terracotta "This [view]'s Pick" pill
 *   - Fraunces serif headline, Inter sans subtitle
 *   - Mono "Details →" CTA in the bottom-right
 *
 * Renders nothing when `event` is null so the page falls back gracefully
 * to the existing HONORABLE_MENTION grid as the first visible content.
 */
interface HeroEvent {
  id: string
  slug: string
  title: string
  heroImageUrl: string | null
  startsAt: string | null // ISO string
  venueName: string | null
  category: string | null
  shareUrl: string | null
  ticketUrl: string | null
  sourceUrl: string | null
  business: { slug: string; name: string } | null
}

interface EventsHeroStripProps {
  event: HeroEvent | null
  viewLabel: string // "Today" | "This Weekend" | "This Week" | "August 2026"
}

function formatHeroDate(iso: string | null): { day: string; time: string } {
  if (!iso) return { day: 'Date TBA', time: '' }
  const d = new Date(iso)
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

function heroHref(event: HeroEvent): { href: string; external: boolean } {
  if (event.shareUrl) return { href: event.shareUrl, external: true }
  if (event.ticketUrl) return { href: event.ticketUrl, external: true }
  if (event.business?.slug) return { href: `/business/${event.business.slug}`, external: false }
  return { href: event.sourceUrl ?? '#', external: !!event.sourceUrl }
}

export function EventsHeroStrip({ event, viewLabel }: EventsHeroStripProps) {
  if (!event) return null

  const { day, time } = formatHeroDate(event.startsAt)
  const target = heroHref(event)
  const category = event.category?.replace(/_/g, ' ') ?? null

  return (
    <section
      aria-label="Featured event"
      className="relative w-full overflow-hidden bg-slate-950 text-white"
      style={{ height: 'clamp(360px, 60vh, 620px)' }}
    >
      {/* Background photo */}
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
          <div className="w-full h-full bg-gradient-to-br from-primary/50 to-secondary/60" />
        )}
        {/* Lower-third gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/15" />
      </div>

      {/* Top rail: mono metadata */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="container-max pt-6 sm:pt-8">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-white font-mono text-[10px] uppercase tracking-[0.22em] font-semibold shadow-sm">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              {viewLabel}&apos;s Pick
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white font-mono text-[10px] uppercase tracking-[0.22em]">
              <Calendar className="w-3 h-3" />
              {day}
            </span>
            {time && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white font-mono text-[10px] uppercase tracking-[0.22em]">
                <Clock className="w-3 h-3" />
                {time}
              </span>
            )}
            {category && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white font-mono text-[10px] uppercase tracking-[0.22em]">
                {category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lower content: title + venue + CTA */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="container-max pb-8 sm:pb-12">
          <div className="max-w-4xl">
            <h2
              className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.02] tracking-tight text-white mb-3"
              style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
            >
              {event.title}
            </h2>
            {event.venueName && (
              <div className="flex items-center gap-2 text-white/80 mb-5 text-sm sm:text-base">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>{event.venueName}</span>
              </div>
            )}
            <a
              href={target.href}
              target={target.external ? '_blank' : undefined}
              rel={target.external ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white border-b-2 border-accent pb-1 hover:gap-3 transition-all"
            >
              Event details
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}