'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Phone, Globe, Clock, CheckCircle, ChevronRight, Loader2, Building2, X, AlertCircle, ChevronLeft } from 'lucide-react'
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

interface Category {
  id: string
  name: string
  slug: string
}

interface Props {
  categories: Category[]
  onCancel: () => void
}

export default function PlacesSearchClient({ categories, onCancel }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pageToken, setPageToken] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [importedSlug, setImportedSlug] = useState<string | null>(null)

  const search = useCallback(async (q: string, token?: string | null) => {
    setLoading(true)
    setError('')
    if (!token) setResults([])

    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (token) params.set('pageToken', token)
      const res = await fetch(`/api/admin/places/search?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(prev => token ? prev : data.places, data.places)
      setResults(prev => token ? prev : data.places)
      setHasMore(!!data.nextPageToken)
      setPageToken(data.nextPageToken || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setPageToken(null)
    setHasMore(false)
    search(query.trim())
  }

  const handleImport = async () => {
    const place = results.find(p => p.placeId === selectedId)
    if (!place) return
    setImporting(true)
    setImportError('')

    try {
      const res = await fetch('/api/admin/places/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...place,
          categoryId: selectedCategory || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setImported(place.name)
      setImportedSlug(data.business.slug)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (imported && importedSlug) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-text mb-2">"{imported}" imported!</h2>
        <p className="text-text-secondary text-sm mb-6">The listing is now live on moval.living.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { setImported(null); setSelectedId(null); setResults([]); setQuery(''); setImportedSlug(null) }}
            className="btn-outline text-sm"
          >
            Import Another
          </button>
          <a href={`/business/${importedSlug}`} target="_blank" className="btn-primary text-sm flex items-center gap-2">
            View Live <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-text">Import from Google</h2>
          <p className="text-sm text-text-secondary mt-1">Search for a business and add it directly to the directory.</p>
        </div>
        <button onClick={onCancel} className="text-text-secondary hover:text-text transition-colors p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search businesses in Moreno Valley..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-primary px-4 flex items-center gap-2 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {importError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {importError}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              {results.length} result{results.length !== 1 ? 's' : ''}
              {hasMore && ' (more available)'}
            </p>
          </div>

          {results.map(place => (
            <button
              key={place.placeId}
              type="button"
              onClick={() => setSelectedId(place.placeId === selectedId ? null : place.placeId)}
              className={cn(
                'w-full text-left p-4 rounded-xl border-2 transition-all',
                selectedId === place.placeId
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-100 hover:border-slate-200 bg-white'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  {place.photos[0] ? (
                    <img
                      src={`/api/places/photos?ref=${encodeURIComponent(place.photos[0].name)}&maxWidth=200`}
                      alt={place.name}
                      className="w-full h-full object-cover rounded-lg"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text text-sm">{place.name}</p>
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
                          <Globe className="w-3 h-3 shrink-0" />{(() => { try { return new URL(place.website).hostname } catch { return place.website } })()}
                        </p>
                      )}
                      {place.hours && (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />Has hours on Google
                        </p>
                      )}
                    </div>
                    {selectedId === place.placeId && (
                      <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {/* Import form */}
          {selectedId && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-4">
              <div>
                <label className="label text-xs">Category</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="input text-sm py-2"
                >
                  <option value="">Auto-detect (Other)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Import This Business</>
                )}
              </button>
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => search(query, pageToken)}
              disabled={loading}
              className="w-full py-2.5 text-sm text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Load more results
            </button>
          )}
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <div className="text-center py-8 text-sm text-text-secondary">
          No results found for "{query}". Try a different search.
        </div>
      )}
    </div>
  )
}
