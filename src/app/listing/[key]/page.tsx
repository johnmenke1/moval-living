import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, MapPin, Bed, Bath, Square, Calendar, Car, Phone, Mail, Home, ArrowLeft, Trees } from 'lucide-react'
import type { Metadata } from 'next'
import { ListingMapWrapper } from '@/components/map/ListingMapWrapper'

interface ListingDetailPageProps {
  params: Promise<{ key: string }>
}

interface OpenHouseEntry {
  openHouseId: string
  openHouseDate: string
  openHouseStartTime: string | null
  openHouseEndTime: string | null
  openHouseStatus: string | null
  openHouseType: string | null
  remarks: string | null
}

interface ListingDetail {
  listingKey: string
  listingId: string
  address: string
  listPrice: number
  closePrice: number | null
  status: string
  propertyType: string
  propertySubType: string
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
  listingContractDate: string | null
  listAgent: string | null
  listOffice: string | null
  listAgentLicense: string | null
  coListAgent: string | null
  coListOffice: string | null
  showingInstructions: string | null
  publicRemarks: string | null
  latitude: number | null
  longitude: number | null
  taxLot: string | null
  zoning: string | null
  ownership: string | null
  internetDisplay: boolean | null
  photoCount: number | null
  photoUrls: string[]
}

async function getListing(key: string): Promise<{ listing: ListingDetail; openHouses: OpenHouseEntry[] } | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://www.moval.living'

  const [listingRes, ohRes] = await Promise.all([
    fetch(`${base}/api/trestle/listing/${key}`, { cache: 'no-store' }),
    fetch(`${base}/api/trestle/open-houses?key=${key}`, { cache: 'no-store' }),
  ])

  if (!listingRes.ok) return null

  const listingData = await listingRes.json()
  let openHouses: OpenHouseEntry[] = []

  if (ohRes.ok) {
    const ohData = await ohRes.json()
    const allListings: { listingKey: string; openHouses: OpenHouseEntry[] }[] = ohData.listings ?? []
    const match = allListings.find((l) => l.listingKey === key)
    if (match) openHouses = match.openHouses
  }

  return { listing: listingData.listing, openHouses }
}

export async function generateMetadata({ params }: ListingDetailPageProps): Promise<Metadata> {
  const { key } = await params
  const data = await getListing(key)
  if (!data) return { title: 'Listing Not Found' }
  const { listing } = data
  return {
    title: `${listing.address} — ${listing.listPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} | Moval Living`,
    description: listing.publicRemarks?.slice(0, 160) ?? `${listing.bedrooms ?? ''} bed, ${listing.bathrooms ?? ''} bath home in ${listing.city}, ${listing.state}`,
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price)
}

function formatSqFt(sqft: number | null): string {
  if (!sqft) return '—'
  return new Intl.NumberFormat('en-US').format(sqft)
}

function formatAcres(acres: number | null): string {
  if (!acres) return '—'
  return `${acres.toFixed(2)} ac`
}

function formatOHDate(dateStr: string, timeStr: string | null): { day: string; time: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const dayStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  let time = ''
  if (timeStr) {
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
  'Active Under Contract': { label: 'Under Contract', className: 'bg-primary text-white' },
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { key } = await params
  const data = await getListing(key)
  if (!data) notFound()

  const { listing, openHouses } = data
  const statusInfo = STATUS_LABELS[listing.status] ?? { label: listing.status, className: 'bg-slate-500 text-white' }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-3">
          <nav className="flex items-center gap-2 text-sm text-text-secondary">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/homes" className="hover:text-primary transition-colors">Homes</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-text font-medium truncate max-w-xs">{listing.address}</span>
          </nav>
        </div>
      </div>

      {/* Back link */}
      <div className="container-max py-4">
        <Link href="/homes" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Listings
        </Link>
      </div>

      {/* Photo Gallery */}
      <div className="container-max pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {listing.photoUrls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-1 p-1">
              {/* Main large photo */}
              <div className="md:col-span-2 md:row-span-2 relative aspect-square md:aspect-auto overflow-hidden rounded-xl">
                <img
                  src={listing.photoUrls[0]}
                  alt={`Home at ${listing.address}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Thumbnail grid */}
              {listing.photoUrls.slice(1, 5).map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl hidden md:block">
                  <img src={url} alt={`Photo ${i + 2}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-72 bg-slate-100 flex items-center justify-center">
              <Home className="w-12 h-12 text-slate-300" />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container-max pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── LEFT ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                    {listing.daysOnMarket !== null && listing.daysOnMarket > 0 && (
                      <span className="text-xs text-text-secondary bg-slate-100 px-2 py-1 rounded-full">
                        {listing.daysOnMarket} days on market
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-text mb-1">{formatPrice(listing.listPrice)}</h1>
                  <div className="flex items-start gap-1.5 text-text-secondary">
                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                    <span className="text-sm">{listing.address}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-secondary font-mono">MLS #{listing.listingId}</p>
                </div>
              </div>

              {/* Quick specs */}
              <div className="flex flex-wrap gap-4 py-4 border-t border-slate-100">
                {listing.bedrooms && (
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <Bed className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{listing.bedrooms}</span> bed
                  </div>
                )}
                {listing.bathrooms && (
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <Bath className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{listing.bathrooms}</span> bath
                  </div>
                )}
                {listing.livingArea && (
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <Square className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{formatSqFt(listing.livingArea)}</span> sqft
                  </div>
                )}
                {listing.lotSizeAcres && (
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <Trees className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{formatAcres(listing.lotSizeAcres)}</span> lot
                  </div>
                )}
                {listing.garageSpaces !== null && listing.garageSpaces > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <Car className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{listing.garageSpaces}</span> garage
                  </div>
                )}
                {listing.yearBuilt && (
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <Calendar className="w-4 h-4 text-primary" />
                    Built <span className="font-semibold">{listing.yearBuilt}</span>
                  </div>
                )}
                {listing.pool && (
                  <div className="flex items-center gap-1.5 text-sm text-text">
                    <span className="text-primary font-bold">🏊</span> Pool
                  </div>
                )}
              </div>

              {/* Property Type badge */}
              {(listing.propertyType || listing.propertySubType) && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                    {listing.propertySubType || listing.propertyType}
                  </span>
                </div>
              )}
            </div>

            {/* Open House Schedule */}
            {openHouses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Open House Schedule
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {openHouses.map((oh, i) => {
                    const { day, time } = formatOHDate(oh.openHouseDate, oh.openHouseStartTime)
                    const endTime = oh.openHouseEndTime
                      ? (() => {
                          const m = oh.openHouseEndTime!.match(/T(\d{2}:\d{2})/)
                          if (!m) return ''
                          const [h, min] = m[1].split(':').map(Number)
                          const ampm = h >= 12 ? 'PM' : 'AM'
                          return `${h % 12 || 12}:${min.toString().padStart(2, '0')} ${ampm}`
                        })()
                      : ''
                    return (
                      <div key={i} className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <p className="font-semibold text-text">{day}</p>
                        <p className="text-sm text-text-secondary">
                          {time}{endTime ? ` – ${endTime}` : ''}
                        </p>
                        {oh.openHouseType && (
                          <p className="text-xs text-text-secondary mt-1">{oh.openHouseType}</p>
                        )}
                        {oh.remarks && (
                          <p className="text-xs text-text-secondary mt-2 italic">{oh.remarks}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Public Remarks / Description */}
            {listing.publicRemarks && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                <h2 className="text-lg font-bold text-text mb-4">About This Home</h2>
                <p className="text-text-secondary leading-relaxed whitespace-pre-line">{listing.publicRemarks}</p>
              </div>
            )}

            {/* Property Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-text mb-4">Property Details</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {listing.yearBuilt && (
                  <DetailRow label="Year Built" value={String(listing.yearBuilt)} />
                )}
                {listing.propertyType && (
                  <DetailRow label="Property Type" value={listing.propertyType} />
                )}
                {listing.propertySubType && (
                  <DetailRow label="Style" value={listing.propertySubType} />
                )}
                {listing.lotSizeAcres && (
                  <DetailRow label="Lot Size" value={formatAcres(listing.lotSizeAcres)} />
                )}
                {listing.livingArea && (
                  <DetailRow label="Living Area" value={`${formatSqFt(listing.livingArea)} sqft`} />
                )}
                {listing.garageSpaces !== null && listing.garageSpaces > 0 && (
                  <DetailRow label="Garage" value={`${listing.garageSpaces} car`} />
                )}
                {listing.pool && <DetailRow label="Pool" value="Private" />}
                {listing.zoning && <DetailRow label="Zoning" value={listing.zoning} />}
                {listing.ownership && <DetailRow label="Ownership" value={listing.ownership} />}
                {listing.taxLot && <DetailRow label="Tax Lot" value={listing.taxLot} />}
                {listing.daysOnMarket !== null && (
                  <DetailRow label="Days on Market" value={`${listing.daysOnMarket} days`} />
                )}
                {listing.listingContractDate && (
                  <DetailRow
                    label="Listed"
                    value={new Date(listing.listingContractDate).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  />
                )}
                {listing.internetDisplay !== null && (
                  <DetailRow
                    label="Address Displayed"
                    value={listing.internetDisplay ? 'Yes' : 'No'}
                  />
                )}
              </div>
            </div>

            {/* Map */}
            {(listing.latitude && listing.longitude) ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Location
                  </h2>
                </div>
                <div className="h-72">
                  <ListingMapWrapper
                    lat={listing.latitude}
                    lng={listing.longitude}
                    address={listing.address}
                    apiKey={apiKey}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* ─── SIDEBAR ─── */}
          <div className="space-y-6">
            {/* Agent Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-base font-bold text-text mb-4">Listing Agent</h3>
              {listing.listAgent ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {listing.listAgent.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-text">{listing.listAgent}</p>
                      {listing.listOffice && (
                        <p className="text-sm text-text-secondary">{listing.listOffice}</p>
                      )}
                    </div>
                  </div>
                  {listing.listAgentLicense && (
                    <p className="text-xs text-text-secondary">Lic. #{listing.listAgentLicense}</p>
                  )}
                  <div className="flex flex-col gap-2 pt-2">
                    <a
                      href={`tel:+19515551234`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors text-sm"
                    >
                      <Phone className="w-4 h-4" /> Call Agent
                    </a>
                    <a
                      href={`mailto:john@menke.re?subject=Inquiry: ${encodeURIComponent(listing.address)}&body=Hi, I'm interested in the property at ${encodeURIComponent(listing.address)} (MLS #${listing.listingId}).`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-text hover:bg-slate-50 transition-colors text-sm"
                    >
                      <Mail className="w-4 h-4" /> Send Email
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Agent information not available.</p>
              )}

              {listing.coListAgent && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-text-secondary mb-2">Co-Listing Agent</p>
                  <p className="font-semibold text-text text-sm">{listing.coListAgent}</p>
                  {listing.coListOffice && (
                    <p className="text-xs text-text-secondary">{listing.coListOffice}</p>
                  )}
                </div>
              )}
            </div>

            {/* Showing Instructions */}
            {listing.showingInstructions && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-base font-bold text-text mb-3">Showing Instructions</h3>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {listing.showingInstructions}
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-sm p-6 text-white">
              <p className="text-sm font-medium mb-1">Interested in this property?</p>
              <p className="text-2xl font-bold mb-3">Schedule a Tour</p>
              <p className="text-white/80 text-sm mb-4">
                Contact {listing.listAgent?.split(' ')[0] ?? 'your agent'} for a private showing.
              </p>
              <a
                href={`mailto:john@menke.re?subject=Tour Request: ${encodeURIComponent(listing.address)}&body=Hi, I'd like to schedule a tour of ${encodeURIComponent(listing.address)} (MLS #${listing.listingId}).`}
                className="block w-full text-center px-4 py-2.5 bg-white text-primary rounded-xl font-semibold hover:bg-white/90 transition-colors text-sm"
              >
                Request Tour
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* IDX Disclaimer */}
      <div className="container-max pb-8">
        <p className="text-xs text-text-secondary italic text-center">
          Based on information from CRMLS. All data should be independently verified.
          Some data may be suppressed due to privacy restrictions.
          Listing data provided by John Menke, Licensed Real Estate Broker (DRE #01959317) —{' '}
          <Link href="/about-moreno-valley" className="underline hover:text-primary">
            Learn about the Moreno Valley market →
          </Link>
        </p>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-slate-50 last:border-0">
      <span className="text-text-secondary text-sm">{label}</span>
      <span className="text-text font-medium text-sm text-right">{value}</span>
    </div>
  )
}
