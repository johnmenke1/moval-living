'use client'

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ParksHeadCard } from '@/components/parks/ParksHeadCard'
import { ParksCompactBar } from '@/components/parks/ParksCompactBar'
import { ParkFiltersPanel } from '@/components/parks/ParkFilters'
import { ParkCard } from '@/components/parks/ParkCard'
import { ParkMap } from '@/components/parks/ParkMap'
import {
  type ParkSummary,
  type ParkFilters as ParkFiltersT,
  type UserLocation,
  applyParkFilters,
  sortParksForView,
  formatDistance,
  haversine,
} from '@/lib/parks'
import type { AmenitySlug } from '@/lib/park-amenities'

interface ParksClientProps {
  parks: ParkSummary[]
}

/**
 * /parks client orchestrator.
 *
 * URL is the source of truth:
 *   ?q=<text>                      name/address/amenity text filter
 *   ?amenity=<slug,slug>           multi-select amenities (AND semantics)
 *   ?type=PARK|GOLF|REC_CENTER     optional type scope
 *
 * Geolocation is stored in sessionStorage (per-tab) so the user's
 * "near me" persists across navigations within the site but doesn't
 * get shared in URLs.
 */
export function ParksClient({ parks }: ParksClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  // Read URL params on mount
  const query = searchParams.get('q') ?? ''
  const typeFromUrl = searchParams.get('type') as ParkSummary['type'] | null
  const amenitiesFromUrl = (searchParams.get('amenity') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0) as AmenitySlug[]

  // Geolocation (sessionStorage so it doesn't survive hard close)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = sessionStorage.getItem('parks-user-location')
    if (saved) {
      try {
        setUserLocation(JSON.parse(saved))
      } catch {
        sessionStorage.removeItem('parks-user-location')
      }
    }
  }, [])

  const counts = {
    park: parks.filter((p) => p.type === 'PARK').length,
    golf: parks.filter((p) => p.type === 'GOLF').length,
    rec: parks.filter((p) => p.type === 'REC_CENTER').length,
  }

  // Update URL without scroll, preserving path
  const updateParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname],
  )

  const setQuery = (v: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (v) next.set('q', v)
    else next.delete('q')
    updateParams(next)
  }

  const toggleAmenity = (slug: AmenitySlug) => {
    const next = new URLSearchParams(searchParams.toString())
    const cur = amenitiesFromUrl
    const updated = cur.includes(slug)
      ? cur.filter((s) => s !== slug)
      : [...cur, slug]
    if (updated.length > 0) next.set('amenity', updated.join(','))
    else next.delete('amenity')
    updateParams(next)
  }

  const clearAmenities = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('amenity')
    updateParams(next)
  }

  const setType = (t: ParkSummary['type'] | undefined) => {
    const next = new URLSearchParams(searchParams.toString())
    if (t) next.set('type', t)
    else next.delete('type')
    updateParams(next)
  }

  const clearAll = () => {
    setUserLocation(null)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('parks-user-location')
    }
    updateParams(new URLSearchParams())
  }

  const requestLocation = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      throw new Error('Geolocation not supported')
    }
    return new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            label: 'you',
          }
          setUserLocation(loc)
          sessionStorage.setItem('parks-user-location', JSON.stringify(loc))
          resolve()
        },
        () => reject(new Error('Permission denied')),
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }

  const clearLocation = () => {
    setUserLocation(null)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('parks-user-location')
    }
  }

  // Amenity occurrence counts — computed once for the filter chip badges
  const amenityCounts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const p of parks) {
      for (const slug of p.amenities) {
        acc[slug] = (acc[slug] ?? 0) + 1
      }
    }
    return acc
  }, [parks])

  // Filter + sort the visible park set
  const visibleParks = useMemo(() => {
    const filters: ParkFiltersT = {
      amenities: amenitiesFromUrl,
      type: typeFromUrl ?? undefined,
      query,
    }
    const filtered = applyParkFilters(parks, filters)
    return sortParksForView(filtered, userLocation)
  }, [parks, amenitiesFromUrl, typeFromUrl, query, userLocation])

  // Distance labels keyed by park slug — used by the card pill and
  // the map (so they share the same numbers).
  const distanceLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    if (!userLocation) return labels
    for (const p of parks) {
      if (p.latitude == null || p.longitude == null) continue
      const d = haversine(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: p.latitude, longitude: p.longitude },
      )
      labels[p.slug] = formatDistance(d)
    }
    return labels
  }, [userLocation, parks])

  // Highlight sync between cards and the map
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null)
  const handleCardClick = (slug: string) => {
    setHighlightedSlug((cur) => (cur === slug ? null : slug))
  }

  const hasActiveFilters = Boolean(query || typeFromUrl || amenitiesFromUrl.length > 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <ParksHeadCard
        parkCount={counts.park}
        golfCount={counts.golf}
        recCount={counts.rec}
      />

      <ParksCompactBar
        query={query}
        onQueryChange={setQuery}
        userLocation={userLocation}
        onRequestLocation={requestLocation}
        onClearLocation={clearLocation}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearAll}
      />

      {/* Non-sticky head card content (scrolls with listings): type tabs + amenity chips */}
      <div className="mt-6 mb-4 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
        <ParkFiltersPanel
          selectedAmenities={amenitiesFromUrl}
          selectedType={typeFromUrl ?? undefined}
          amenityCounts={amenityCounts}
          onToggleAmenity={toggleAmenity}
          onClearAmenities={clearAmenities}
          onSetType={setType}
        />
      </div>

      {/* Result count strip */}
      <div className="flex items-center justify-between mb-4 text-sm text-text-secondary">
        <span className="font-medium">
          {visibleParks.length} {visibleParks.length === 1 ? 'facility' : 'facilities'}
          {hasActiveFilters ? ' matching' : ''}
        </span>
        {userLocation && (
          <span className="text-xs text-accent font-semibold">
            Sorted by distance from your location
          </span>
        )}
      </div>

      {/* Two-pane body — sticky map on lg+, stacked on smaller */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Cards column */}
        <div className="order-2 lg:order-1 flex flex-col gap-4">
          {visibleParks.length === 0 ? (
            <EmptyParksState onClearFilters={clearAll} />
          ) : (
            visibleParks.map((p) => (
              <ParkCard
                key={p.id}
                park={p}
                distanceLabel={distanceLabels[p.slug]}
                highlighted={highlightedSlug === p.slug}
                onClick={() => handleCardClick(p.slug)}
              />
            ))
          )}
        </div>

        {/* Map column */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-[120px] lg:self-start">
          <ParkMap
            parks={visibleParks}
            highlightedSlug={highlightedSlug}
            userLocation={userLocation}
            onMarkerClick={(slug) => {
              setHighlightedSlug(slug)
              if (typeof document !== 'undefined') {
                const target = parks.find((p) => p.slug === slug)
                if (target) {
                  const el = document.getElementById(`park-header-${target.id}`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

/** Small empty-state block — when no parks match the filters. */
function EmptyParksState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-4xl mb-3">🗺️</div>
      <h3
        className="text-lg font-bold text-text mb-1"
        style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
      >
        No parks match your filters
      </h3>
      <p className="text-sm text-text-secondary mb-4">
        Try removing an amenity, switching the type, or clearing your search.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        Clear all filters
      </button>
    </div>
  )
}
