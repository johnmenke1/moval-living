'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, MapPin, Loader2 } from 'lucide-react'
import { OpenHouseMapWrapper } from '@/components/map/OpenHouseMapWrapper'
import { OpenHouseCard } from '@/components/real estate/OpenHouseCard'
import type { OpenHouseListing } from '@/app/api/trestle/open-houses/route'

export default function OpenHousesPage() {
  const [listings, setListings] = useState<OpenHouseListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

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

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-text">Open Houses</h1>
          </div>
          <p className="text-text-secondary ml-11">
            Upcoming open house dates in Moreno Valley, CA — powered by CRMLS.
          </p>
        </div>
      </div>

      {/* Map — full width, above the listings */}
      <div className="container-max py-6">
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
          <div className="h-[420px] rounded-xl overflow-hidden shadow-sm">
            <OpenHouseMapWrapper
              listings={listings}
              highlightedKey={highlightedKey}
              apiKey={apiKey}
            />
          </div>
        )}
      </div>

      {/* Listings Grid */}
      <div className="container-max pb-10">
        {/* Count */}
        {!loading && !error && listings.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xl font-semibold text-text">
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
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-error font-medium mb-2">Failed to load open houses</p>
            <p className="text-text-secondary text-sm mb-4">{error}</p>
            <button onClick={fetchOpenHouses} className="btn-outline text-sm">
              Try Again
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && listings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
          Listing data provided by Johnny Menke, Licensed Real Estate Broker —{' '}
          <a href="/about-moreno-valley" className="underline hover:text-primary">
            Learn about the Moreno Valley market →
          </a>
        </p>
      </div>
    </div>
  )
}
