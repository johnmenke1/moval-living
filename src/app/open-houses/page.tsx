'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, MapPin, Loader2, Clock, Home } from 'lucide-react'
import { OpenHouseMapWrapper } from '@/components/map/OpenHouseMapWrapper'
import { OpenHouseCard } from '@/components/real estate/OpenHouseCard'
import type { OpenHouseListing } from '@/app/api/trestle/open-houses/route'

export default function OpenHousesPage() {
  const [listings, setListings] = useState<OpenHouseListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const fetchOpenHouses = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/trestle/open-houses')
      if (!res.ok) throw new Error('Failed to load open houses')
      const data = await res.json()
      setListings(data.listings ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch remote listing data when the page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOpenHouses()
  }, [fetchOpenHouses])

  // Listen for map marker clicks → scroll card into view
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail.key
      setHighlightedKey(key)
      const el = cardRefs.current.get(key)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
    window.addEventListener('oh:highlight', handler)
    return () => window.removeEventListener('oh:highlight', handler)
  }, [])

  // Compute next open house window for the hero subtitle.
  const nextOpenHouse = (() => {
    if (listings.length === 0) return null
    const now = new Date()
    const all = listings.flatMap((l) =>
      l.openHouses.map((oh) => ({
        date: new Date(oh.openHouseDate + 'T00:00:00'),
      })),
    )
    const future = all.filter((d) => d.date >= now)
    if (future.length === 0) return null
    future.sort((a, b) => a.date.getTime() - b.date.getTime())
    return future[0]
  })()

  const formatHeroDate = (d: Date) => {
    const today = new Date()
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    if (isToday) return 'today'
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const isTomorrow =
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate()
    if (isTomorrow) return 'tomorrow'
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#eef3f2]">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/open-houses-hero-collage.png"
          alt="Moreno Valley open houses — home exterior, welcoming front door, modern kitchen, and agent showing buyers a home"
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/65 to-primary/25" />
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-accent/15" />

        <div className="relative container-max py-16 sm:py-20 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/15 backdrop-blur-sm border border-white/20 text-white mb-5">
              <Home className="w-3.5 h-3.5" />
              Open Houses
            </span>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.05] mb-5"
              style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
            >
              Tour a home in MoVal{' '}
              <span className="italic font-semibold text-[#8fd4d7]">this weekend.</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/85 leading-relaxed mb-8 max-w-2xl mx-auto">
              {loading ? (
                'Loading the latest open house schedule…'
              ) : error ? (
                'See what is open this week, explore the map, and find a home that feels right in person.'
              ) : listings.length === 0 ? (
                'No open houses are scheduled right now. Check back soon, or browse all active listings.'
              ) : nextOpenHouse ? (
                <>
                  Next open house is {formatHeroDate(nextOpenHouse.date)}.{' '}
                  {listings.length} listing{listings.length !== 1 ? 's' : ''} with upcoming tours —
                  use the map to plan your route.
                </>
              ) : (
                <>
                  {listings.length} listing{listings.length !== 1 ? 's' : ''} with upcoming tours —
                  see what is open this week and find a home that feels right in person.
                </>
              )}
            </p>

            {/* Stats chips */}
            <div className="flex flex-wrap justify-center gap-3 text-sm font-medium">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
                <Calendar className="w-3.5 h-3.5" />
                {loading ? '—' : listings.length} {listings.length === 1 ? 'listing' : 'listings'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
                <Clock className="w-3.5 h-3.5" />
                Updated weekly
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
                <MapPin className="w-3.5 h-3.5" />
                Moreno Valley
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Map — full width, above the listings */}
      <div className="container-max py-7">
        {loading ? (
          <div className="w-full h-[420px] bg-slate-100 animate-pulse rounded-xl flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="w-full h-[420px] bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-3">
            <p className="text-error font-medium">Failed to load open houses</p>
            <p className="text-text-secondary text-sm">{error}</p>
            <button onClick={fetchOpenHouses} className="btn-outline text-sm">
              Try Again
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="w-full h-[420px] bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-3">
            <MapPin className="w-10 h-10 text-slate-300" />
            <p className="text-text font-medium">No open houses scheduled</p>
            <p className="text-text-secondary text-sm">
              There are no upcoming open houses in the MLS at this time.
              <br />Check back soon, or{' '}
              <a href="/homes" className="text-primary hover:underline">
                browse all active listings
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="h-[420px] overflow-hidden rounded-2xl border-4 border-white shadow-xl shadow-secondary/10">
            <OpenHouseMapWrapper
              listings={listings}
              highlightedKey={highlightedKey}
            />
          </div>
        )}
      </div>

      {/* Listings Grid */}
      <div className="container-max pb-10">
        {/* Count */}
        {!loading && !error && listings.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-bold text-text">
              {listings.length} Listing{listings.length !== 1 ? 's' : ''} with Open Houses
            </h2>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse">
                <div className="w-full h-52 bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-7 bg-slate-200 rounded w-2/3" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {/* Grid */}
        {!loading && !error && listings.length > 0 && (
          <div className="grid grid-cols-1 sm:cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <div
                key={listing.listingKey}
                ref={(el) => {
                  if (el) cardRefs.current.set(listing.listingKey, el)
                  else cardRefs.current.delete(listing.listingKey)
                }}
              >
                <OpenHouseCard
                  listing={listing}
                  highlighted={highlightedKey === listing.listingKey}
                  onMouseEnter={() => setHighlightedKey(listing.listingKey)}
                  onMouseLeave={() => setHighlightedKey(null)}
                  href={`/listing/${listing.listingKey}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && listings.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text font-medium mb-2">No open houses found</p>
            <p className="text-text-secondary text-sm">
              Check back soon for upcoming open house dates.
            </p>
          </div>
        )}
      </div>

      {/* IDX Disclaimer */}
      <div className="container-max pb-8">
        <p className="text-xs text-text-secondary italic text-center">
          Based on information from CRMLS. All data should be independently verified.
          Some data may be suppressed due to privacy restrictions.
          Listing data provided by John Menke, Licensed Real Estate Broker (DRE #01959317) —{' '}
          <a href="/about-moreno-valley" className="underline hover:text-primary">
            Learn about the Moreno Valley market →
          </a>
        </p>
      </div>
    </div>
  )
}
