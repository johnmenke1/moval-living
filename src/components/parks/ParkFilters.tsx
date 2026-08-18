'use client'

import { cn } from '@/lib/utils'
import { AMENITIES } from '@/lib/park-amenities'
import type { AmenitySlug } from '@/lib/park-amenities'

interface ParkFiltersPanelProps {
  selectedAmenities: AmenitySlug[]
  selectedType?: 'PARK' | 'GOLF' | 'REC_CENTER'
  /** Amenity → # of parks with that amenity (for the badge count). Pass
   *  [] until the parent has run the count query, otherwise we hide the
   *  counts. */
  amenityCounts?: Record<string, number>
  onToggleAmenity: (slug: AmenitySlug) => void
  onClearAmenities: () => void
  onSetType: (t: 'PARK' | 'GOLF' | 'REC_CENTER' | undefined) => void
}

/**
 * ParkFilters — horizontal-scroll row of amenity chips + 3-segment type
 * selector.
 *
 * Lives in the non-sticky head card area (not the compact bar) — like
 * the /search search-page-brand-treatment rule, set-and-forget filters
 * scroll away once the user is reading the listings.
 */
export function ParkFiltersPanel({
  selectedAmenities,
  selectedType,
  amenityCounts,
  onToggleAmenity,
  onClearAmenities,
  onSetType,
}: ParkFiltersPanelProps) {
  const hasAnyAmenity = selectedAmenities.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Type
        </span>
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 gap-1">
          {(
            [
              ['PARK', 'Parks'],
              ['GOLF', 'Golf'],
              ['REC_CENTER', 'Rec Center'],
            ] as const
          ).map(([t, label]) => {
            const active = selectedType === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => onSetType(active ? undefined : t)}
                aria-pressed={active}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        {selectedType && (
          <button
            type="button"
            onClick={() => onSetType(undefined)}
            className="text-xs text-text-secondary hover:text-primary"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Amenities
        </span>
        {AMENITIES.map((a) => {
          const active = selectedAmenities.includes(a.slug)
          const count = amenityCounts?.[a.slug]
          return (
            <button
              key={a.slug}
              type="button"
              onClick={() => onToggleAmenity(a.slug)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors active:scale-95',
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-secondary border-slate-200 hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              <span>{a.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={cn(
                    'ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-text-secondary',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
        {hasAnyAmenity && (
          <button
            type="button"
            onClick={onClearAmenities}
            className="text-xs font-medium text-text-secondary hover:text-error px-2"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
