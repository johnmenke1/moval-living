'use client'

import { useState } from 'react'
import { Search, MapPin, Phone, Globe, Clock, CheckCircle, ChevronRight, Loader2, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlaceResult {
  placeId: string
  name: string
  address: string
  phone: string
  website: string
  type: string
  hours: Record<string, { open: string; close: string; closed: boolean }> | null
  photos: { name: string }[]
  location: { lat: number; lng: number } | null
}

interface GMBImporterProps {
  onSelect: (place: PlaceResult) => void
  onSkip: () => void
}

export default function GMBImporter({ onSelect, onSkip }: GMBImporterProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setSelectedId(null)

    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Search failed'); return }
      setResults(data.places || [])
      if (data.places?.length === 0) setError('No businesses found. Try a different name or address.')
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-text mb-1">Find Your Business on Google</h2>
        <p className="text-text-secondary text-sm">
          Search for your business and we&apos;ll auto-fill most of the form — no re-typing needed.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={search} className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Business name or address in Moreno Valley..."
            className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Searching Google...' : 'Search Google'}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Select your business</p>
          {results.map(place => (
            <button
              key={place.placeId}
              type="button"
              onClick={() => setSelectedId(place.placeId)}
              className={cn(
                'w-full text-left p-4 rounded-xl border-2 transition-all',
                selectedId === place.placeId
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-100 hover:border-slate-200 bg-white'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Place thumbnail */}
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {place.photos[0] ? (
                    // We can't show the actual photo without a proxy URL, show placeholder
                    <img
                      src={`/api/places/photos?ref=${place.photos[0].name}&maxWidth=200`}
                      alt={place.name}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text text-sm truncate">{place.name}</p>
                  <p className="text-xs text-text-secondary truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />{place.address}
                  </p>
                  {place.phone && (
                    <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 shrink-0" />{place.phone}
                    </p>
                  )}
                  {place.website && (
                    <p className="text-xs text-primary flex items-center gap-1 mt-0.5 truncate">
                      <Globe className="w-3 h-3 shrink-0" />{new URL(place.website).hostname}
                    </p>
                  )}
                  {place.hours && (
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      Open on Google
                    </p>
                  )}
                </div>

                {selectedId === place.placeId && (
                  <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                )}
              </div>
            </button>
          ))}

          {/* Import button */}
          <button
            onClick={() => {
              const place = results.find(p => p.placeId === selectedId)
              if (place) onSelect(place)
            }}
            disabled={!selectedId}
            className="w-full py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Use This Business <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Skip */}
      <button
        onClick={onSkip}
        className="w-full text-center text-sm text-text-secondary hover:text-primary transition-colors py-1"
      >
        Skip — I&apos;ll enter details manually
      </button>
    </div>
  )
}
