'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, MapPin, Star, Tag, TreePine, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParkSummary } from '@/lib/parks'
import { amenityLabel, amenityIcon, typeLabel } from '@/lib/parks'
import { AMENITY_BY_SLUG } from '@/lib/park-amenities'

interface ParkCardProps {
  park: ParkSummary
  /** Miles from user if geolocation is active. */
  distanceLabel?: string
  /** True when the parent has scrolled this card into view (for anim). */
  highlighted?: boolean
  onClick?: () => void
}

/**
 * ParkCard — expandable card for /parks. Shows the essentials (hero,
 * name, type, address, top amenities, optional distance pill) collapsed;
 * reveals full amenities, description, hours link, and photos on click.
 *
 * The expand chevron is a `<button>` so keyboard users can toggle. The
 * entire card surface is also clickable via the wrapper's `<button>` —
 * but per WAI-ARIA we use `aria-expanded` so screen readers know.
 */
export function ParkCard({ park, distanceLabel, highlighted = false, onClick }: ParkCardProps) {
  const [expanded, setExpanded] = useState(false)
  const topAmenities = park.amenities.slice(0, 4)
  const extraCount = Math.max(0, park.amenities.length - topAmenities.length)

  const headerId = `park-header-${park.id}`
  const bodyId = `park-body-${park.id}`

  return (
    <article
      className={cn(
        'group rounded-2xl border bg-white shadow-sm transition-all overflow-hidden',
        highlighted
          ? 'border-primary ring-2 ring-primary/30 shadow-md'
          : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <button
        type="button"
        id={headerId}
        onClick={() => {
          setExpanded((v) => !v)
          onClick?.()
        }}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="w-full text-left"
      >
        {/* Hero — uses next/image with a fallback gradient placeholder.
            Photos arrive in step 9 (Vercel Blob capture pipeline). */}
        <div className="relative h-32 bg-gradient-to-br from-secondary/90 via-secondary to-primary overflow-hidden">
          {park.heroPhotoUrl ? (
            <Image
              src={park.heroPhotoUrl}
              alt={park.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/30">
              <TreePine className="w-12 h-12" />
            </div>
          )}
          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/95 text-text shadow-sm">
            {typeLabel(park.type)}
          </div>
          {distanceLabel && (
            <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-accent text-white shadow-sm">
              <MapPin className="w-3 h-3" />
              {distanceLabel}
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className="text-base font-bold text-text leading-tight truncate"
                style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
              >
                {park.name}
              </h3>
              {park.address && (
                <p className="text-xs text-text-secondary mt-1 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{park.address}</span>
                </p>
              )}
            </div>
            <ChevronDown
              className={cn(
                'w-5 h-5 text-text-secondary shrink-0 transition-transform mt-0.5',
                expanded && 'rotate-180',
              )}
            />
          </div>

          {/* Amenities row — top 4 with "+N more" pill */}
          {topAmenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {topAmenities.map((slug) => (
                <span
                  key={`amen-${slug}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-text-secondary"
                >
                  {amenityLabel(slug)}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-text-secondary">
                  +{extraCount} more
                </span>
              )}
            </div>
          )}

          {/* Google reputation strip — populated by step 9 enrich pass */}
          {park.googleRating != null && (
            <div className="flex items-center gap-1 mt-3 text-xs text-text-secondary">
              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              <span className="font-bold text-text">{park.googleRating.toFixed(1)}</span>
              <span>({park.googleReviewCount ?? 0})</span>
            </div>
          )}
        </div>
      </button>

      {/* Expandable body */}
      <div
        id={bodyId}
        role="region"
        aria-labelledby={headerId}
        hidden={!expanded}
        className={cn('border-t border-slate-200 bg-background/30', expanded ? 'p-4' : '')}
      >
        {expanded && (
          <div className="flex flex-col gap-3 text-sm">
            {park.amenities.length > 0 ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                  All amenities ({park.amenities.length})
                </h4>
                <ul className="flex flex-wrap gap-1.5">
                  {park.amenities.map((slug) => (
                    <li
                      key={`all-amen-${slug}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-text-secondary"
                    >
                      <span className="text-text">{amenityLabel(slug)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {park.photoUrls.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  Photos
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {park.photoUrls.slice(0, 6).map((src, i) => (
                    <div
                      key={`photo-${i}-${src.slice(-12)}`}
                      className="aspect-square rounded-md overflow-hidden bg-slate-100"
                    >
                      <Image
                        src={src}
                        alt={`${park.name} photo ${i + 1}`}
                        width={120}
                        height={120}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {park.activeNetReservationUrl && (
              <a
                href={park.activeNetReservationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors w-fit"
              >
                <Tag className="w-3.5 h-3.5" />
                Reserve a picnic shelter
              </a>
            )}

            {park.googleMapUrl && (
              <a
                href={park.googleMapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline font-medium"
              >
                Open in Google Maps →
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
