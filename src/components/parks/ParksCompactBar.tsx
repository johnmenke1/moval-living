'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { MapPin, Search, X, Loader2, MapPinOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParksCompactBarProps {
  query: string
  onQueryChange: (next: string) => void
  /** When set, the bar shows the user's location chip + a "Clear" pill.
   *  When null, the bar shows the "Find parks near me" button. */
  userLocation: { latitude: number; longitude: number; label: string } | null
  onRequestLocation: () => Promise<void>
  onClearLocation: () => void
  /** True if any filter (amenity, type, query) is currently active — shows
   *  the Clear-all button. */
  hasActiveFilters: boolean
  onClearAll: () => void
}

/**
 * ParksCompactBar — sticky top-bar with the search input, the
 * "Find parks near me" geolocation trigger (and Clear-my-location pill
 * once active), and a Clear-all button.
 *
 * Mirrors the /search page's CompactSearchBar split:
 *   - Brand chrome + non-frequent filters (amenity chips, type tabs)
 *     live in the non-sticky ParksHeadCard + ParkFilters.
 *   - Search + geolocation + clear live here in the sticky bar so the
 *     user can re-query without scrolling back up.
 *
 * Search input follows the 4-path clear pattern (4 ways to clear all
 * must reset listings) — see references/2026-08-16-search-input-clear-paths.md.
 */
export function ParksCompactBar({
  query,
  onQueryChange,
  userLocation,
  onRequestLocation,
  onClearLocation,
  hasActiveFilters,
  onClearAll,
}: ParksCompactBarProps) {
  const [value, setValue] = useState(query)
  const [isPending, startTransition] = useTransition()
  const [geoState, setGeoState] = useState<'idle' | 'requesting' | 'denied'>('idle')

  // Sync the input if the URL changes externally (clear-all, browser back).
  useEffect(() => {
    setValue(query)
  }, [query])

  const submitQuery = useCallback(
    (next: string) => {
      onQueryChange(next.trim())
    },
    [onQueryChange],
  )

  const requestLocation = async () => {
    setGeoState('requesting')
    try {
      await onRequestLocation()
      setGeoState('idle')
    } catch {
      setGeoState('denied')
      // Reset the denied chip back to idle after 3s so the user can retry.
      setTimeout(() => setGeoState('idle'), 3000)
    }
  }

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/85 backdrop-blur-md border-b border-slate-200/70">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Search input — 4-path clear pattern */}
        <div className="flex-1 min-w-[200px] relative">
          <Search
            className={cn(
              'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none',
              isPending ? 'text-primary animate-pulse' : 'text-slate-400',
            )}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const next = e.target.value
              setValue(next)
              // Path 4: backspace-to-empty auto-submits
              if (next === '' && query !== '') submitQuery('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitQuery((e.target as HTMLInputElement).value)
                return
              }
              if (e.key === 'Escape') {
                if (value) {
                  setValue('')
                  submitQuery('')
                }
                ;(e.currentTarget as HTMLInputElement).blur()
              }
            }}
            placeholder="Search parks, addresses, amenities…"
            aria-label="Search parks"
            className={cn(
              'w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-text placeholder:text-slate-400 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors',
              isPending && 'opacity-60',
            )}
          />
          {value && (
            <button
              type="button"
              onClick={() => submitQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-text hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Geolocation trigger or active-location pill */}
        {userLocation ? (
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/15 border border-accent/30 text-sm text-accent font-semibold">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Near {userLocation.label}</span>
            <span className="sm:hidden">Near me</span>
            <button
              type="button"
              onClick={onClearLocation}
              aria-label="Clear my location"
              className="ml-0.5 w-5 h-5 rounded-full flex items-center justify-center hover:bg-accent/20 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={requestLocation}
            disabled={geoState === 'requesting'}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap',
              geoState === 'denied'
                ? 'border-error/30 bg-error/10 text-error'
                : geoState === 'requesting'
                  ? 'border-slate-200 bg-slate-50 text-text-secondary cursor-progress'
                  : 'border-slate-200 bg-white text-text-secondary hover:bg-slate-50 hover:text-primary',
            )}
          >
            {geoState === 'requesting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Locating…
              </>
            ) : geoState === 'denied' ? (
              <>
                <MapPinOff className="w-4 h-4" />
                Denied
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                <span className="hidden sm:inline">Find parks near me</span>
                <span className="sm:hidden">Near me</span>
              </>
            )}
          </button>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-error hover:bg-white transition-colors whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
