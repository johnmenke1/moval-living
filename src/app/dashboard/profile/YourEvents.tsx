'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Loader2, MapPin, Trash2 } from 'lucide-react'

export interface ProfileEventItem {
  id: string
  attendeeId: string
  slug: string
  title: string
  startsAt: string
  venueName: string | null
  city: string | null
  heroImageUrl: string | null
}

interface YourEventsProps {
  initialAttending: ProfileEventItem[]
  initialInterested: ProfileEventItem[]
}

export function YourEvents({ initialAttending, initialInterested }: YourEventsProps) {
  const [attending, setAttending] = useState<ProfileEventItem[]>(initialAttending)
  const [interested, setInterested] = useState<ProfileEventItem[]>(initialInterested)
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Poll every 30s so RSVPs made from event detail pages appear here.
  useEffect(() => {
    const poll = () => {
      fetch('/api/profile/events')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.attending)) setAttending(data.attending)
          if (Array.isArray(data.interested)) setInterested(data.interested)
        })
        .catch(() => {
          // Silent fail on polling errors.
        })
    }
    const id = setInterval(poll, 30000)
    return () => clearInterval(id)
  }, [])

  async function remove(attendeeId: string, slug: string) {
    if (removingId) return
    setRemovingId(attendeeId)
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/rsvp`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not remove RSVP')
      }
      setAttending((prev) => prev.filter((e) => e.attendeeId !== attendeeId))
      setInterested((prev) => prev.filter((e) => e.attendeeId !== attendeeId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not remove RSVP')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <EventSection
        title="Events I'm attending"
        emptyText="You haven't marked any events as attending yet."
        events={attending}
        onRemove={remove}
        removingId={removingId}
      />
      <EventSection
        title="Events I'm interested in"
        emptyText="You haven't marked any events as interested yet."
        events={interested}
        onRemove={remove}
        removingId={removingId}
      />
    </div>
  )
}

function EventSection({
  title,
  emptyText,
  events,
  onRemove,
  removingId,
}: {
  title: string
  emptyText: string
  events: ProfileEventItem[]
  onRemove: (attendeeId: string, slug: string) => void
  removingId: string | null
}) {
  return (
    <section>
      <h3 className="text-lg font-bold text-text mb-3">{title}</h3>
      {events.length === 0 ? (
        <p className="text-sm text-text-secondary">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col"
            >
              <Link href={`/events/${ev.slug}`} className="group block">
                <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-secondary/10 relative">
                  {ev.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.heroImageUrl}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-primary/30" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-primary uppercase mb-1 tracking-wide">
                    {formatEventDate(ev.startsAt)}
                  </p>
                  <p className="text-sm font-semibold text-text line-clamp-2 group-hover:text-primary transition-colors">
                    {ev.title}
                  </p>
                  {ev.venueName && (
                    <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {ev.venueName}
                      {ev.city && ev.city !== 'Moreno Valley' && ` · ${ev.city}`}
                    </p>
                  )}
                </div>
              </Link>
              <div className="px-4 pb-4 mt-auto">
                <button
                  type="button"
                  onClick={() => onRemove(ev.attendeeId, ev.slug)}
                  disabled={removingId === ev.attendeeId}
                  className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  {removingId === ev.attendeeId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}
