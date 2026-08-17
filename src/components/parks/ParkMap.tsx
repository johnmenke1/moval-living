'use client'

import { TreePine, Flag, Building2, MapPin } from 'lucide-react'
import { typeLabel } from '@/lib/parks'
import type { ParkSummary } from '@/lib/parks'

interface ParkMapProps {
  parks: ParkSummary[]
  /** The slug of the highlighted card → flip the matching row to highlight. */
  highlightedSlug?: string | null
  onMarkerClick?: (slug: string) => void
}

/**
 * ParkMap — Google Maps shell for /parks.
 *
 * V1 placeholder (Aug 17, 2026): renders a translucent "coming soon"
 * overlay over a no-map fallback panel that summarizes the matching parks
 * by type. The real Google Maps instance lands in step 4 of the parks
 * roadmap — same component boundary, swapped internals.
 *
 * The placeholder is intentionally information-dense (counts by type +
 * the first 5 lat/lng tuples) so the page is functional even before the
 * map arrives. Once the Map is live, this header becomes redundant, but
 * keeping it here as a no-script / slow-network fallback is cheap.
 */
export function ParkMap({ parks, highlightedSlug, onMarkerClick }: ParkMapProps) {
  const byType = parks.reduce<Record<string, ParkSummary[]>>((acc, p) => {
    ;(acc[p.type] ||= []).push(p)
    return acc
  }, {})

  const withCoords = parks.filter(
    (p) => p.latitude != null && p.longitude != null,
  ) as Array<ParkSummary & { latitude: number; longitude: number }>

  const fivePointSpread = withCoords.length > 0 && (
    <>
      <span className="font-mono text-[10px] text-text-secondary">
        {withCoords[0].latitude.toFixed(4)}, {withCoords[0].longitude.toFixed(4)}
      </span>
      {withCoords.length > 1 && (
        <span className="text-text-secondary">…</span>
      )}
    </>
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-secondary/5 via-white to-primary/5 shadow-sm overflow-hidden">
      <div className="relative min-h-[480px] h-full">
        {/* "Map placeholder" — translucent gradient slab. The real
            Map component replaces this in step 4. */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,122,127,0.08),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(0,64,92,0.10),transparent_55%)] flex items-center justify-center pointer-events-none">
          <div className="text-center px-6 pointer-events-auto">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary text-white mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text mb-1" style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}>
              Map coming in the next update
            </h3>
            <p className="text-xs text-text-secondary max-w-xs">
              Live Google Maps with pins, hover-to-highlight, and the &quot;near me&quot; blue dot.
              The cards on the right work right now.
            </p>
          </div>
        </div>

        {/* Stats + marker list — overlayed top-left so the placeholder
            doesn't hide useful info. */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-sm max-w-[260px]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
            Map summary
          </h4>
          <ul className="text-xs space-y-1.5">
            {(['PARK', 'GOLF', 'REC_CENTER'] as const).map((t) => {
              const list = byType[t] ?? []
              if (list.length === 0) return null
              const Icon = t === 'PARK' ? TreePine : t === 'GOLF' ? Flag : Building2
              return (
                <li key={t} className="flex items-center gap-2 text-text">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold">{list.length}</span>
                  <span className="text-text-secondary">{typeLabel(t)}{list.length === 1 ? '' : 's'}</span>
                </li>
              )
            })}
          </ul>
          {fivePointSpread && (
            <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-1">
              {fivePointSpread}
            </div>
          )}
        </div>

        {/* Marker list — pre-step-4 fallback so users can see which parks
            are in the result set even before the map itself loads. */}
        {withCoords.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 max-h-44 overflow-y-auto bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 sticky top-0 bg-white/95">
              Pins ({withCoords.length})
            </h4>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {withCoords.slice(0, 12).map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    onClick={() => onMarkerClick?.(p.slug)}
                    className={
                      'w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium ' +
                      (highlightedSlug === p.slug
                        ? 'bg-primary text-white'
                        : 'bg-slate-50 hover:bg-slate-100 text-text-secondary')
                    }
                  >
                    <span className="truncate block">{p.name}</span>
                    <span className="font-mono text-[9px] opacity-70 truncate block">
                      {p.latitude.toFixed(3)}, {p.longitude.toFixed(3)}
                    </span>
                  </button>
                </li>
              ))}
              {withCoords.length > 12 && (
                <li className="text-[10px] text-text-secondary px-2 py-1.5 italic">
                  +{withCoords.length - 12} more (map view)
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
