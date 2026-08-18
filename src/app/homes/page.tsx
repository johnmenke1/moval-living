'use client'

import { useState, useEffect, useCallback } from 'react'
import { ListingCard } from '@/components/real estate/ListingCard'
import { Search, X, ChevronDown, Loader2 } from 'lucide-react'
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

interface ListingsResponse {
  listings: Listing[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface MarketStats {
  scope: string
  active: { count: number; medianListPrice: number; newLast7Days: number }
}

const PRICE_RANGES = [
  { label: 'Any', min: '', max: '' },
  { label: 'Under $400K', min: '', max: '400000' },
  { label: '$400K - $550K', min: '400000', max: '550000' },
  { label: '$550K - $700K', min: '550000', max: '700000' },
  { label: '$700K - $900K', min: '700000', max: '900000' },
  { label: 'Over $900K', min: '900000', max: '' },
]

const BED_OPTIONS = [
  { label: 'Any', value: '' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
  { label: '4+', value: '4' },
  { label: '5+', value: '5' },
]

const BATH_OPTIONS = [
  { label: 'Any', value: '' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
  { label: '4+', value: '4' },
]

const PROPERTY_TYPE_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Single Family', value: 'SingleFamilyResidence' },
  { label: 'Condo', value: 'Condominium' },
  { label: 'Townhouse', value: 'Townhouse' },
  // Multi-Family is a label that maps to multiple Trestle PropertySubType values
  // (Duplex / Triplex / Quadruplex). The page sends the value list, the backend ORs them.
  { label: 'Multi-Family', value: 'Duplex,Triplex,Quadruplex' },
]

const SORT_OPTIONS = [
  { label: 'Newest Listed', value: 'ListingContractDate desc' },
  { label: 'Price: Low to High', value: 'ListPrice asc' },
  { label: 'Price: High to Low', value: 'ListPrice desc' },
  { label: 'Days on Market', value: 'DaysOnMarket desc' },
]

export default function HomesPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [priceRange, setPriceRange] = useState(PRICE_RANGES[0])
  const [beds, setBeds] = useState(BED_OPTIONS[0])
  const [baths, setBaths] = useState(BATH_OPTIONS[0])
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPE_OPTIONS[0])
  const [sort, setSort] = useState(SORT_OPTIONS[0])
  const [searchQ, setSearchQ] = useState('')

  // Market stats from /api/trestle/stats
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (searchQ.trim()) params.set('q', searchQ.trim())
    fetch(`/api/trestle/stats?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MarketStats | null) => {
        if (!cancelled && data) setMarketStats(data)
      })
      .catch(() => {
        /* non-fatal — hero falls back to em-dashes */
      })
    return () => {
      cancelled = true
    }
  }, [searchQ])

  const fetchListings = useCallback(async (pg = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        status: 'Active',
        page: String(pg),
        limit: '12',
        sort: sort.value,
      })
      if (priceRange.min) params.set('minPrice', priceRange.min)
      if (priceRange.max) params.set('maxPrice', priceRange.max)
      if (beds.value) params.set('minBeds', beds.value)
      if (baths.value) params.set('minBaths', baths.value)
      if (propertyType.value) params.set('propertyType', propertyType.value)
      if (searchQ) params.set('q', searchQ)

      const res = await fetch(`/api/trestle/listings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch listings')
      const data: ListingsResponse = await res.json()
      setListings(data.listings)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPage(pg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [priceRange, beds, baths, propertyType, sort, searchQ])

  useEffect(() => {
    // The request synchronizes remote listing data with the selected filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchListings(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRange, beds, baths, propertyType, sort])

  const clearFilters = () => {
    setPriceRange(PRICE_RANGES[0])
    setBeds(BED_OPTIONS[0])
    setBaths(BATH_OPTIONS[0])
    setPropertyType(PROPERTY_TYPE_OPTIONS[0])
    setSearchQ('')
    setSort(SORT_OPTIONS[0])
  }

  const hasActiveFilters =
    priceRange.label !== 'Any' ||
    beds.label !== 'Any' ||
    baths.label !== 'Any' ||
    propertyType.label !== 'Any' ||
    searchQ !== ''

  // Scope label — "Riverside", "92501", or "Moreno Valley" by default.
  // Used by the headline, chip, and page title.
  const scope = searchQ.trim() || 'Moreno Valley'

  // Dynamic headline — reflected from the search scope.
  const dynamicHeadline = `Find your place in ${scope}.`
  const dynamicChip = `The ${scope} home search`

  // Update the document title as the scope changes.
  useEffect(() => {
    const prev = document.title
    document.title = `Homes for Sale in ${scope} | moval.living`
    return () => {
      document.title = prev
    }
  }, [scope])

  // Dynamic subtitle — reflects the active search so the hero feels responsive.
  const dynamicSubtitle = (): string => {
    if (loading) return 'Searching the latest listings…'
    if (error) return 'Showing what we have while the search reconnects.'
    if (total === 0 && hasActiveFilters) return 'No homes match these filters yet — try widening the price or location.'

    const parts: string[] = []
    const count = total.toLocaleString()
    if (searchQ) parts.push(`matching “${searchQ}”`)
    if (beds.value) parts.push(`${beds.value}+ bed`)
    if (baths.value) parts.push(`${baths.value}+ bath`)
    if (priceRange.label !== 'Any') parts.push(priceRange.label)
    if (propertyType.label !== 'Any') parts.push(propertyType.label.toLowerCase())

    if (parts.length === 0) {
      const count = marketStats ? marketStats.active.count.toLocaleString() : ''
      return count
        ? `${count} active homes in ${scope}, refreshed daily.`
        : `Active homes in ${scope}, refreshed daily.`
    }
    const filterPhrase = parts.join(' · ')
    return `${count} ${count === '1' ? 'home' : 'homes'} — ${filterPhrase}.`
  }

  return (
    <div className="min-h-screen bg-[#eef3f2]">
      {/* Hero — full-bleed image with text overlay */}
      <section className="relative flex min-h-[28rem] items-center overflow-hidden text-white sm:min-h-[36rem] lg:min-h-[44rem]">
        <picture>
          <source srcSet="/homes/hero.webp" type="image/webp" />
          <img
            src="/homes/hero.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
        <div className="relative container-max w-full py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-accent">{dynamicChip}</p>
            <h1 className="mb-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">{dynamicHeadline}</h1>
            <p className="mb-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
              {dynamicSubtitle()}
            </p>
          </div>

          {/* Hero search bar — wider than the text column on desktop so the inputs breathe */}
          <div className="mt-2 w-full max-w-5xl">
            <div className="rounded-2xl bg-white/95 p-3 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="flex flex-wrap items-stretch gap-2">
                {/* Location — address/city/zip free text */}
                <div className="relative flex-1 min-w-[12rem]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <input
                    type="text"
                    role="searchbox"
                    placeholder="Address, city, or zip..."
                    value={searchQ}
                    onChange={(e) => {
                      const next = e.target.value
                      setSearchQ(next)
                      if (next === '' && searchQ !== '') fetchListings(1)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (searchQ === '') {
                          // explicit Enter on empty clears the search
                          fetchListings(1)
                        } else {
                          fetchListings(1)
                        }
                        return
                      }
                      if (e.key === 'Escape') {
                        if (searchQ) {
                          setSearchQ('')
                          fetchListings(1)
                        }
                        ;(e.currentTarget as HTMLInputElement).blur()
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-text placeholder:text-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {searchQ && (
                    <button
                      onClick={() => { setSearchQ(''); fetchListings(1) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Price */}
                <div className="relative">
                  <select
                    aria-label="Price range"
                    value={priceRange.label}
                    onChange={(e) => {
                      const r = PRICE_RANGES.find(r => r.label === e.target.value)
                      if (r) setPriceRange(r)
                    }}
                    className="h-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-8 text-sm text-text cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {PRICE_RANGES.map(r => (
                      <option key={r.label} value={r.label}>
                        {r.label === 'Any' ? 'Any Price' : r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                </div>

                {/* Beds */}
                <div className="relative">
                  <select
                    aria-label="Bedrooms"
                    value={beds.label}
                    onChange={(e) => {
                      const b = BED_OPTIONS.find(b => b.label === e.target.value)
                      if (b) setBeds(b)
                    }}
                    className="h-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-8 text-sm text-text cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {BED_OPTIONS.map(b => (
                      <option key={b.label} value={b.label}>
                        {b.label === 'Any' ? 'Any Beds' : b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                </div>

                {/* Baths */}
                <div className="relative">
                  <select
                    aria-label="Bathrooms"
                    value={baths.label}
                    onChange={(e) => {
                      const b = BATH_OPTIONS.find(b => b.label === e.target.value)
                      if (b) setBaths(b)
                    }}
                    className="h-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-8 text-sm text-text cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {BATH_OPTIONS.map(b => (
                      <option key={b.label} value={b.label}>
                        {b.label === 'Any' ? 'Any Baths' : b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                </div>

                {/* Property type */}
                <div className="relative">
                  <select
                    aria-label="Property type"
                    value={propertyType.label}
                    onChange={(e) => {
                      const p = PROPERTY_TYPE_OPTIONS.find(p => p.label === e.target.value)
                      if (p) setPropertyType(p)
                    }}
                    className="h-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-8 text-sm text-text cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {PROPERTY_TYPE_OPTIONS.map(p => (
                      <option key={p.label} value={p.label}>
                        {p.label === 'Any' ? 'Any Type' : p.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                </div>

                {/* Sort */}
                <div className="relative">
                  <select
                    aria-label="Sort"
                    value={sort.label}
                    onChange={(e) => {
                      const s = SORT_OPTIONS.find(s => s.label === e.target.value)
                      if (s) setSort(s)
                    }}
                    className="h-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-8 text-sm text-text cursor-pointer focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {SORT_OPTIONS.map(s => (
                      <option key={s.label} value={s.label}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                </div>

                {/* Search button — explicit submit */}
                <button
                  type="button"
                  onClick={() => fetchListings(1)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>

              {hasActiveFilters && (
                <div className="mt-2 flex items-center justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Stats strip — brand-green band below the hero image */}
      <section className="bg-secondary text-white">
        <div className="container-max py-10 sm:py-12">
          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="border-l border-white/25 pl-4">
              <p className="text-2xl font-bold">{hasActiveFilters ? total.toLocaleString() : (marketStats ? marketStats.active.count.toLocaleString() : '\u2014')}</p>
              <p className="text-xs text-white/60">{hasActiveFilters ? 'matching your search' : 'active homes for sale'}</p>
            </div>
            <div className="border-l border-white/25 pl-4"><p className="text-2xl font-bold">{marketStats ? marketStats.active.newLast7Days.toLocaleString() : '\u2014'}</p><p className="text-xs text-white/60">new in last 7 days</p></div>
            <div className="hidden border-l border-white/25 pl-4 sm:block"><p className="text-2xl font-bold">{marketStats ? `$${(marketStats.active.medianListPrice / 1000).toFixed(0)}K` : '\u2014'}</p><p className="text-xs text-white/60">median list price</p></div>
          </div>
        </div>
      </section>

      {/* Results */}
      <div className="container-max py-9">
        {/* Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-text-secondary">
            {!loading && !error && (
              <>
                <span className="font-bold text-primary">{total.toLocaleString()}</span>{' '}
                {total === 1 ? 'listing' : 'listings'} found
              </>
            )}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-error font-medium mb-2">Failed to load listings</p>
            <p className="text-text-secondary text-sm mb-4">{error}</p>
            <button onClick={() => fetchListings(page)} className="btn-outline text-sm">
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && listings.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text font-medium mb-2">No listings match your filters</p>
            <p className="text-text-secondary text-sm mb-4">
              Try adjusting your search criteria or clearing filters.
            </p>
            <button onClick={clearFilters} className="btn-outline text-sm">
              Clear All Filters
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && listings.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-10">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.listingKey}
                  listing={listing}
                  href={`/listing/${listing.listingKey}`}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 items-center">
                <button
                  onClick={() => fetchListings(page - 1)}
                  disabled={page <= 1}
                  className={cn(
                    'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    page <= 1
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 bg-white text-text hover:bg-slate-50'
                  )}
                >
                  ← Previous
                </button>
                <span className="px-4 py-2 text-sm text-text-secondary">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => fetchListings(page + 1)}
                  disabled={page >= totalPages}
                  className={cn(
                    'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    page >= totalPages
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 bg-white text-text hover:bg-slate-50'
                  )}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* IDX Disclaimer */}
      <div className="container-max pb-8">
        <p className="text-xs text-text-secondary italic text-center">
          Based on information from CRMLS. All data should be independently verified. Some data may be suppressed due to privacy restrictions.
          Listing data provided by John Menke, Licensed Real Estate Broker (DRE #01959317) —{' '}
          <a href="/about-moreno-valley" className="underline hover:text-primary">
            Learn about the Moreno Valley market →
          </a>
        </p>
      </div>
    </div>
  )
}
