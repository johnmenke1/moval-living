'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Star, MapPin, Image as ImageIcon, Search } from 'lucide-react'
import type { ParkType } from '@/lib/parks'
import { typeLabel } from '@/lib/parks'

interface ParkRow {
  id: string
  slug: string
  name: string
  type: ParkType
  address: string | null
  amenities: string[]
  latitude: number | null
  longitude: number | null
  googlePlaceId: string | null
  googleRating: number | null
  googleReviewCount: number | null
  heroPhotoUrl: string | null
  photoCount: number
  hasCoords: boolean
  featured: boolean
  isActive: boolean
  updatedAt: string
}

interface Props {
  initialParks: ParkRow[]
}

const TYPE_OPTIONS: Array<{ key: ParkType | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'PARK', label: 'Parks' },
  { key: 'GOLF', label: 'Golf' },
  { key: 'REC_CENTER', label: 'Rec Centers' },
]

export function ParksAdminClient({ initialParks }: Props) {
  const router = useRouter()
  const [parks] = useState<ParkRow[]>(initialParks)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ParkType | 'ALL'>('ALL')
  const [activeOnly, setActiveOnly] = useState(false)
  const [missingCoordsOnly, setMissingCoordsOnly] = useState(false)

  const filtered = useMemo(() => {
    return parks.filter((p) => {
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false
      if (activeOnly && !p.isActive) return false
      if (missingCoordsOnly && p.hasCoords) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [p.name, p.address ?? '', p.slug, ...p.amenities]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [parks, search, typeFilter, activeOnly, missingCoordsOnly])

  const counts = {
    PARK: parks.filter((p) => p.type === 'PARK').length,
    GOLF: parks.filter((p) => p.type === 'GOLF').length,
    REC_CENTER: parks.filter((p) => p.type === 'REC_CENTER').length,
    missingCoords: parks.filter((p) => !p.hasCoords).length,
    missingPhotos: parks.filter((p) => p.photoCount === 0).length,
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </button>
          <h1 className="mt-2 text-2xl font-bold text-text" style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}>
            Parks & Recreation Admin
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {parks.length} total · {parks.filter((p) => p.isActive).length} active ·{' '}
            <span className={counts.missingCoords > 0 ? 'text-amber-600 font-semibold' : ''}>
              {counts.missingCoords} missing coordinates
            </span>{' '}
            ·{' '}
            <span className={counts.missingPhotos > 0 ? 'text-amber-600 font-semibold' : ''}>
              {counts.missingPhotos} missing photos
            </span>
          </p>
        </div>
        <Link
          href="/parks"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-text"
        >
          <ExternalLink className="w-4 h-4" />
          View public page
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search by name, address, amenity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTypeFilter(opt.key)}
                className={
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ' +
                  (typeFilter === opt.key
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-text-secondary hover:bg-slate-200')
                }
              >
                {opt.label}
                {opt.key === 'PARK' && ` (${counts.PARK})`}
                {opt.key === 'GOLF' && ` (${counts.GOLF})`}
                {opt.key === 'REC_CENTER' && ` (${counts.REC_CENTER})`}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Active only</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={missingCoordsOnly}
              onChange={(e) => setMissingCoordsOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>Missing coordinates only ({counts.missingCoords})</span>
          </label>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-text-secondary">
            No parks match the current filters.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/parks/${p.slug}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    {p.heroPhotoUrl ? (
                      <Image
                        src={p.heroPhotoUrl}
                        alt={p.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-text truncate">{p.name}</h3>
                      {!p.isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-slate-200 text-text-secondary">
                          Inactive
                        </span>
                      )}
                      {p.featured && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-100 text-amber-700">
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase tracking-wide text-[10px]">
                          {typeLabel(p.type)}
                        </span>
                      </span>
                      {p.address && (
                        <span className="truncate">{p.address}</span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        {p.photoCount}
                      </span>
                      {!p.hasCoords && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                          <MapPin className="w-3 h-3" />
                          No coords
                        </span>
                      )}
                      {p.googleRating != null && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {p.googleRating.toFixed(1)}
                          {p.googleReviewCount != null && ` (${p.googleReviewCount})`}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-text-secondary">
        Showing {filtered.length} of {parks.length} parks. Click any row to edit.
      </p>
    </div>
  )
}
