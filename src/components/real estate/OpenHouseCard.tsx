import { MapPin, Bed, Bath, Square, Calendar, Car } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OpenHouseListing } from '@/app/api/trestle/open-houses/route'

interface OpenHouseCardProps {
  listing: OpenHouseListing
  highlighted?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price)
}

function formatSqFt(sqft: number | null): string {
  if (!sqft) return '—'
  return new Intl.NumberFormat('en-US').format(sqft)
}

function formatOHDate(dateStr: string, timeStr: string | null): { day: string; time: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  let time = ''
  if (timeStr) {
    // timeStr is ISO offset string like "2026-08-08T11:00:00-07:00"
    const match = timeStr.match(/T(\d{2}:\d{2})/)
    if (match) {
      const [h, m] = match[1].split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      time = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
    }
  }
  return { day: dayStr, time }
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  Active: { label: 'Active', className: 'bg-success text-white' },
  Pending: { label: 'Pending', className: 'bg-amber-500 text-white' },
  Closed: { label: 'Sold', className: 'bg-secondary text-white' },
  'Active Under Contract': {
    label: 'Under Contract',
    className: 'bg-primary text-white',
  },
}

const PLACEHOLDER_SVG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
      '<rect fill="%23e2e8f0" width="400" height="300"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
      'fill="%2394a3b8" font-size="14" font-family="sans-serif">No Photo</text>' +
      '</svg>'
  )

export function OpenHouseCard({
  listing,
  highlighted = false,
  onMouseEnter,
  onMouseLeave,
}: OpenHouseCardProps) {
  const statusInfo = STATUS_LABELS[listing.status] ?? {
    label: listing.status,
    className: 'bg-slate-500 text-white',
  }

  const primaryOH = listing.openHouses[0]
  const { day, time } = primaryOH
    ? formatOHDate(primaryOH.openHouseDate, primaryOH.openHouseStartTime)
    : { day: '', time: '' }

  return (
    <div
      className={cn(
        'card overflow-hidden group transition-all duration-200',
        highlighted && 'ring-2 ring-primary shadow-lg'
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Image */}
      <div className="relative w-full h-52 overflow-hidden bg-slate-100">
        <img
          src={listing.photoUrl ?? PLACEHOLDER_SVG}
          alt={`Home at ${listing.address}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.src = PLACEHOLDER_SVG
          }}
        />
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              'text-xs font-bold px-2.5 py-1 rounded-full',
              statusInfo.className
            )}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Open House badge — always visible */}
        {primaryOH && (
          <div className="absolute bottom-3 left-3 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Open House: {day} {time}
          </div>
        )}

        {listing.daysOnMarket !== null && listing.daysOnMarket > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {listing.daysOnMarket} days on market
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Price */}
        <div className="text-2xl font-bold text-text mb-1">{formatPrice(listing.listPrice)}</div>

        {/* Address */}
        <div className="flex items-start gap-1.5 mb-3">
          <MapPin className="w-4 h-4 text-text-secondary mt-0.5 flex-shrink-0" />
          <span className="text-sm text-text-secondary">{listing.address}</span>
        </div>

        {/* Specs */}
        <div className="flex items-center gap-4 text-sm text-text-secondary mb-4">
          {listing.bedrooms && (
            <div className="flex items-center gap-1.5">
              <Bed className="w-4 h-4" />
              <span>{listing.bedrooms} bed</span>
            </div>
          )}
          {listing.bathrooms && (
            <div className="flex items-center gap-1.5">
              <Bath className="w-4 h-4" />
              <span>{listing.bathrooms} bath</span>
            </div>
          )}
          {listing.livingArea && (
            <div className="flex items-center gap-1.5">
              <Square className="w-4 h-4" />
              <span>{formatSqFt(listing.livingArea)} sqft</span>
            </div>
          )}
        </div>

        {/* Open House schedule — all upcoming */}
        {listing.openHouses.length > 0 && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs font-semibold text-primary mb-1.5 uppercase tracking-wide">
              Open House Schedule
            </p>
            <div className="flex flex-wrap gap-2">
              {listing.openHouses.map((oh, i) => {
                const { day: d, time: t } = formatOHDate(oh.openHouseDate, oh.openHouseStartTime)
                return (
                  <span
                    key={i}
                    className="text-xs font-medium bg-white border border-primary/20 text-text px-2 py-1 rounded"
                  >
                    {d} {t}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            {listing.yearBuilt && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{listing.yearBuilt}</span>
              </div>
            )}
          </div>
          {listing.listingId && (
            <span className="text-xs text-text-secondary font-mono">#{listing.listingId}</span>
          )}
        </div>
      </div>
    </div>
  )
}
