import { MapPin, Bed, Bath, Square, Calendar, Car } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Listing {
  listingKey: string
  listingId: string
  address: string
  listPrice: number
  closePrice: number | null
  status: string
  bedrooms: number | null
  bathrooms: number | null
  livingArea: number | null
  lotSizeAcres: number | null
  garageSpaces: number | null
  yearBuilt: number | null
  pool: boolean
  city: string | null
  state: string | null
  zip: string | null
  daysOnMarket: number | null
  listAgent: string | null
  listOffice: string | null
  showAddress: boolean | null
  photoUrl: string | null
}

interface ListingCardProps {
  listing: Listing
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

function formatAcres(acres: number | null): string {
  if (!acres) return '—'
  return `${acres.toFixed(2)} ac`
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  Active: { label: 'Active', className: 'bg-success text-white' },
  Pending: { label: 'Pending', className: 'bg-amber-500 text-white' },
  Closed: { label: 'Sold', className: 'bg-secondary text-white' },
  'Active Under Contract': { label: 'Under Contract', className: 'bg-primary text-white' },
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

export function ListingCard({ listing }: ListingCardProps) {
  const statusInfo = STATUS_LABELS[listing.status] ?? {
    label: listing.status,
    className: 'bg-slate-500 text-white',
  }

  return (
    <div className="card overflow-hidden group">
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
          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', statusInfo.className)}>
            {statusInfo.label}
          </span>
        </div>
        {listing.pool && (
          <div className="absolute top-3 right-3 bg-primary/90 text-white text-xs font-bold px-2 py-1 rounded-full">
            Pool
          </div>
        )}
        {listing.daysOnMarket !== null && listing.daysOnMarket > 0 && (
          <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {listing.daysOnMarket} days on market
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Price */}
        <div className="text-2xl font-bold text-text mb-1">
          {formatPrice(listing.listPrice)}
        </div>

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

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            {listing.yearBuilt && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{listing.yearBuilt}</span>
              </div>
            )}
            {listing.garageSpaces !== null && listing.garageSpaces > 0 && (
              <div className="flex items-center gap-1">
                <Car className="w-3.5 h-3.5" />
                <span>{listing.garageSpaces} garage</span>
              </div>
            )}
            {listing.lotSizeAcres && <span>{formatAcres(listing.lotSizeAcres)}</span>}
          </div>
          {listing.listingId && (
            <span className="text-xs text-text-secondary font-mono">#{listing.listingId}</span>
          )}
        </div>
      </div>
    </div>
  )
}
