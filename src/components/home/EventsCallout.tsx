'use client'

import Link from 'next/link'
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, MapPin, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * EventsCallout — homepage band promoting the /events page. Shows the next
 * 4 imminent events as a horizontally-scrollable carousel. The carousel
 * pattern (rather than a 4-column grid) lets users peek at the date pills
 * bleeding off the right edge, which signals "more to explore" and
 * dramatically raises click-through vs. a flat grid.
 *
 * Layout:
 *   • Header row (eyebrow + title + 'See all events') on top.
 *   • Horizontal scroll-snap carousel of event cards below.
 *   • Prev/next chevrons appear on hover (desktop) or always (mobile).
 *   • Dot pagination below the rail — fills out the visual rhythm.
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

        <EventsCarousel events={events} />

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

/**
 * Horizontal scroll-snap carousel for the event cards. Smaller than a
 * full-width grid card so 3-4 cards are visible at once on desktop, with
 * the next card peeking in to signal scrollability. Chevron buttons appear
 * on hover (desktop) or always-on (touch). Dots below the rail show
 * position.
 */
function EventsCarousel({ events }: { events: UpcomingEvent[] }) {
  const railRef = useRef<HTMLDivElement | null>(null)
  // Index of the card currently snapped to the start of the rail. Drives
  // the dot indicator and which chevrons are enabled.
  const [activeIndex, setActiveIndex] = useState(0)
  // Force re-render on resize so the chevron-enabled logic reads the new
  // scroll dimensions. Cheap — no debounce, no ResizeObserver, just a
  // window listener.
  const [, setTick] = useState(0)

  // Compute scroll position of each card so we can map scrollLeft →
  // activeIndex without a ResizeObserver.
  const cardOffsetsRef = useRef<number[]>([])

  const recomputeOffsets = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const offsets: number[] = []
    for (const child of Array.from(rail.children) as HTMLElement[]) {
      offsets.push(child.offsetLeft - rail.offsetLeft)
    }
    cardOffsetsRef.current = offsets
  }, [])

  // Track scroll position → activeIndex. We pick the card whose offset is
  // closest to (scrollLeft + a small threshold) so a tiny scroll doesn't
  // immediately flip the dot.
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    recomputeOffsets()
    const onScroll = () => {
      const x = rail.scrollLeft
      const offsets = cardOffsetsRef.current
      // Threshold: within 80px of the card's start counts as "on it".
      let bestIdx = 0
      let bestDelta = Infinity
      for (let i = 0; i < offsets.length; i++) {
        const delta = Math.abs(offsets[i] - x)
        if (delta < bestDelta) {
          bestDelta = delta
          bestIdx = i
        }
      }
      setActiveIndex(bestIdx)
    }
    rail.addEventListener('scroll', onScroll, { passive: true })
    const onResize = () => {
      recomputeOffsets()
      setTick((t) => t + 1)
    }
    window.addEventListener('resize', onResize)
    return () => {
      rail.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [recomputeOffsets, events.length])

  // Scroll the rail so the given card index sits at the start. Uses
  // scroll-snap CSS so the rail animates smoothly.
  const scrollToIndex = useCallback((idx: number) => {
    const rail = railRef.current
    if (!rail) return
    const offsets = cardOffsetsRef.current
    const target = offsets[idx]
    if (typeof target === 'number') {
      rail.scrollTo({ left: target, behavior: 'smooth' })
    }
  }, [])

  const canPrev = activeIndex > 0
  const canNext = activeIndex < events.length - 1

  return (
    <div className="relative group/carousel">
      {/* Carousel rail — hidden scrollbar, snap-x mandatory. Each card is
          18rem wide (w-72) so 3 fit comfortably on a 1280px viewport with
          the next card peeking in. On smaller screens fewer cards fit and
          the user scrolls horizontally. */}
      <div
        ref={railRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {events.map((event) => {
          const { day, month } = formatDay(event.startsAt)
          const weekday = formatWeekday(event.startsAt)
          const time = formatTime(event.startsAt)
          const isHero = event.tier === 'HERO'
          return (
            <Link
              key={event.id}
              href="/events"
              className="group relative w-64 sm:w-72 shrink-0 snap-start bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all flex flex-col"
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
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm text-center leading-none">
                  <div className="text-[8px] font-bold text-primary tracking-wider">
                    {weekday}
                  </div>
                  <div className="text-sm font-bold text-text mt-0.5">{day}</div>
                  <div className="text-[8px] font-semibold text-text-secondary tracking-wider mt-0.5">
                    {month}
                  </div>
                </div>
              ) : (
                <div className="px-3 pt-3">
                  <div className="inline-flex flex-col items-center justify-center bg-primary/10 text-primary rounded-lg px-2.5 py-1.5 leading-none">
                    <span className="text-[9px] font-bold tracking-wider">
                      {weekday}
                    </span>
                    <span className="text-xl font-bold mt-1">{day}</span>
                    <span className="text-[9px] font-semibold tracking-wider mt-1">
                      {month}
                    </span>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-3 flex-1 flex flex-col">
                {event.category && (
                  <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-slate-100 text-text-secondary text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    {event.category.replace(/_/g, ' ')}
                  </span>
                )}
                <h3
                  className={cn(
                    'font-bold text-text leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors',
                    isHero ? 'text-sm' : 'text-xs',
                  )}
                >
                  {event.title}
                </h3>
                <div className="mt-auto pt-2 space-y-0.5 text-[11px] text-text-secondary">
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

      {/* Prev chevron — desktop: appears on hover. Touch: always visible. */}
      <button
        type="button"
        onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
        disabled={!canPrev}
        aria-label="Previous events"
        className={cn(
          'hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-text-secondary hover:text-primary hover:border-primary/40 transition-all disabled:opacity-0 disabled:pointer-events-none',
          'sm:opacity-0 sm:group-hover/carousel:opacity-100',
        )}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Next chevron — same hover/visibility rules. */}
      <button
        type="button"
        onClick={() => scrollToIndex(Math.min(events.length - 1, activeIndex + 1))}
        disabled={!canNext}
        aria-label="Next events"
        className={cn(
          'hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-text-secondary hover:text-primary hover:border-primary/40 transition-all disabled:opacity-0 disabled:pointer-events-none',
          'sm:opacity-0 sm:group-hover/carousel:opacity-100',
        )}
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dot pagination — only when there's more than one card. Each dot
          scrolls the rail to that card's offset on click. */}
      {events.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {events.map((event, idx) => (
            <button
              key={event.id}
              type="button"
              onClick={() => scrollToIndex(idx)}
              aria-label={`Jump to event ${idx + 1}: ${event.title}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === activeIndex
                  ? 'w-6 bg-primary'
                  : 'w-1.5 bg-slate-300 hover:bg-slate-400',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}