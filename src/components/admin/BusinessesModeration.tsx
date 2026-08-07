'use client'

import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Trash2, ExternalLink, Building2, Star, Pencil, ChevronDown, ChevronUp, RefreshCw, Loader2, Search, X, Zap } from 'lucide-react'

type BusinessStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface Business {
  id: string
  name: string
  slug: string
  tagline: string | null
  status: BusinessStatus
  tier: 'FREE' | 'FEATURED' | 'EXPERT_PARTNER'
  address: string
  city: string
  state: string
  zip: string
  website: string | null
  phone: string | null
  email: string | null
  createdAt: string | Date
  category: { name: string; slug: string }
  owner: { id: string; name: string | null; email: string } | null
  _count: { reviews: number }
  googleBusiness: string | null
  googleRating: number | null
  googleReviewCount: number | null
  isExpertPartner?: boolean
  expertPartnerSlug?: string | null
  foundingPartnerSince?: string | Date | null
  liveQaZoomUrl?: string | null
  liveQaNextDate?: string | Date | null
}

interface BusinessesModerationProps {
  initialBusinesses: Business[]
}

export default function BusinessesModeration({ initialBusinesses }: BusinessesModerationProps) {
  const [businesses, setBusinesses] = useState<Business[]>(initialBusinesses)
  const [filter, setFilter] = useState<'ALL' | BusinessStatus>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [testingGhlId, setTestingGhlId] = useState<string | null>(null)
  const [ghlTestResult, setGhlTestResult] = useState<Record<string, { ok: boolean; summary: string; nextSteps: string[] }>>({})
  // Inline edit state per business
  const [editGoogle, setEditGoogle] = useState<Record<string, {
    googleBusiness: string
    googleRating: string
    googleReviewCount: string
    tier: 'FREE' | 'FEATURED' | 'EXPERT_PARTNER'
  }>>({})

  const reportFailure = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({})) as { error?: string }
    setError(data.error || fallback)
  }

  const filtered = filter === 'ALL' ? businesses : businesses.filter(b => b.status === filter)
  const searchLower = search.toLowerCase().trim()
  const displayed = searchLower
    ? filtered.filter(b =>
        b.name.toLowerCase().includes(searchLower) ||
        b.address.toLowerCase().includes(searchLower) ||
        b.city.toLowerCase().includes(searchLower) ||
        b.email?.toLowerCase().includes(searchLower) ||
        b.owner?.email?.toLowerCase().includes(searchLower) ||
        b.category.name.toLowerCase().includes(searchLower)
      )
    : filtered

  const counts: Record<string, number> = {
    ALL: businesses.length,
    PENDING: businesses.filter(b => b.status === 'PENDING').length,
    APPROVED: businesses.filter(b => b.status === 'APPROVED').length,
    REJECTED: businesses.filter(b => b.status === 'REJECTED').length,
  }

  const moderate = async (id: string, patch: Record<string, unknown>) => {
    setLoading(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        await reportFailure(res, 'Unable to update this business')
        return
      }
      const updated = await res.json()
      setBusinesses(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b))
    } catch {
      setError('Unable to update this business')
    } finally {
      setLoading(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Permanently delete this business listing? This cannot be undone.')) return
    setLoading(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        await reportFailure(res, 'Unable to delete this business')
        return
      }
      setBusinesses(prev => prev.filter(b => b.id !== id))
    } catch {
      setError('Unable to delete this business')
    } finally {
      setLoading(null)
    }
  }

  const refreshGoogleReviews = async (id: string) => {
    setRefreshingId(id)
    try {
      const res = await fetch(`/api/businesses/${businesses.find(b => b.id === id)?.slug}/google-reviews?refresh=true`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Refresh failed')
      const data = await res.json()
      setBusinesses(prev => prev.map(b => b.id === id ? {
        ...b,
        googleRating: data.googleRating,
        googleReviewCount: data.googleReviewCount,
      } : b))
    } catch {
      setError('Failed to refresh Google reviews')
    } finally {
      setRefreshingId(null)
    }
  }
  const testGhl = async (id: string) => {
    setTestingGhlId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/partners/${id}/test-ghl`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({})) as {
        ok?: boolean
        results?: Array<{ step: string; ok: boolean; detail: string }>
        next_steps?: string[]
        error?: string
      }
      const summaryParts = (data.results || []).map((r) =>
        r.ok ? `✓ ${r.step}` : `✗ ${r.step}: ${r.detail}`
      )
      const summary = summaryParts.join(' | ')
      setGhlTestResult(prev => ({
        ...prev,
        [id]: {
          ok: !!data.ok,
          summary,
          nextSteps: data.next_steps || [],
        },
      }))
      if (!res.ok && data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError('Test request failed — check Vercel logs')
    } finally {
      setTestingGhlId(null)
    }
  }


  const saveGoogleFields = async (id: string) => {
    const edits = editGoogle[id]
    if (!edits) return
    const patch: Record<string, unknown> = {}
    if (edits.googleBusiness !== undefined) patch.googleBusiness = edits.googleBusiness || null
    if (edits.googleRating !== undefined) {
      const v = parseFloat(edits.googleRating)
      patch.googleRating = isNaN(v) ? null : Math.round(v * 10) / 10
    }
    if (edits.googleReviewCount !== undefined) {
      const v = parseInt(edits.googleReviewCount)
      patch.googleReviewCount = isNaN(v) ? null : v
    }
    if (edits.tier !== undefined) {
      patch.tier = edits.tier
    }
    await moderate(id, patch)
    setEditGoogle(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const deleteReviews = async (id: string, businessName: string) => {
    if (!confirm(`Delete ALL reviews for "${businessName}"? This cannot be undone.`)) return
    setLoading(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/businesses/${id}/reviews`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to delete reviews')
        return
      }
      setBusinesses(prev => prev.map(b => b.id === id ? { ...b, _count: { ...b._count, reviews: 0 } } : b))
    } catch {
      setError('Failed to delete reviews')
    } finally {
      setLoading(null)
    }
  }

  const openEdit = (b: Business) => {
    setEditGoogle(prev => ({
      ...prev,
      [b.id]: {
        googleBusiness: b.googleBusiness || '',
        googleRating: b.googleRating?.toString() || '',
        googleReviewCount: b.googleReviewCount?.toString() || '',
        tier: b.tier || 'FREE',
      },
    }))
    setExpandedId(expandedId === b.id ? null : b.id)
  }

  const statusConfig = {
    PENDING: { label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50', border: 'border-amber-200' },
    APPROVED: { label: 'Published', icon: CheckCircle, color: 'text-green-600 bg-green-50', border: 'border-green-200' },
    REJECTED: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50', border: 'border-red-200' },
  } as const

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary, #1a2e35)' }}>
            Business Listings
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary, #5a6c72)' }}>
            Review, approve, or reject business submissions
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, address, city, email, category…"
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* Result count when searching */}
      {searchLower && (
        <p className="text-xs text-text-secondary mb-4">
          {displayed.length} of {filtered.length} {filtered.length === 1 ? 'business' : 'businesses'} match “{search}”
        </p>
      )}

      {/* Filter tabs */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: filter === f ? 'var(--primary, #007a7f)' : '#f1f5f9',
              color: filter === f ? '#fff' : 'var(--text-secondary, #5a6c72)',
            }}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            <span
              className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: filter === f ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              }}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Businesses list */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
          <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">
            {search ? `No businesses matching "${search}"` : filter === 'ALL' ? 'No businesses yet' : `No ${filter.toLowerCase()} businesses`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(business => {
            const cfg = statusConfig[business.status]
            const Icon = cfg.icon
            const isExpanded = expandedId === business.id
            const edits = editGoogle[business.id]
            return (
              <div key={business.id}>
                <div
                  className={`bg-white rounded-xl border ${cfg.border} p-5 ${isExpanded ? 'rounded-b-none' : ''}`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-slate-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <h3 className="font-bold text-text">{business.name}</h3>
                          {business.tagline && (
                            <p className="text-sm text-text-secondary">{business.tagline}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${cfg.color}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {cfg.label}
                          </span>
                          {/* Expand for Google fields */}
                          <button
                            onClick={() => openEdit(business)}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            title="Admin settings"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary mb-3">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          {business.category.name}
                        </span>
                        <span>{business.address}, {business.city} {business.state} {business.zip}</span>
                        {business.phone && <span>📞 {business.phone}</span>}
                        {business.email && <span>✉️ {business.email}</span>}
                        {business.website && <span>🌐 {business.website}</span>}
                      </div>

                      {business.owner && (
                        <div className="text-xs text-text-secondary mb-3">
                          Owner: <span className="font-medium text-text">{business.owner.name || 'Unnamed'}</span> ({business.owner.email})
                          {business.status === 'PENDING' && !business.owner.name && (
                            <span className="ml-2 text-amber-600">⚠️ No owner account yet — pending claim</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        {business.status === 'APPROVED' ? (
                          <a
                            href={`/business/${business.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium hover:underline"
                            style={{ color: 'var(--primary, #007a7f)' }}
                          >
                            View Live <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Not publicly visible</span>
                        )}
                        {business._count.reviews > 0 && (
                          <span className="flex items-center gap-1 text-xs text-text-secondary">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            {business._count.reviews} review{business._count.reviews !== 1 ? 's' : ''}
                          </span>
                        )}
                        {business.googleRating != null && (
                          <span className="flex items-center gap-1 text-xs text-text-secondary">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            {business.googleRating.toFixed(1)} ({business.googleReviewCount?.toLocaleString()} Google)
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          Added {new Date(business.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {business.status === 'PENDING' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <a
                          href={`/dashboard/edit?id=${business.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </a>
                        <button
                          onClick={() => moderate(business.id, { status: 'APPROVED' })}
                          disabled={loading === business.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => moderate(business.id, { status: 'REJECTED' })}
                          disabled={loading === business.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => remove(business.id)}
                          disabled={loading === business.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                    {business.status !== 'PENDING' && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <a
                          href={`/dashboard/edit?id=${business.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </a>
                        <button
                          onClick={() => remove(business.id)}
                          disabled={loading === business.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded admin panel */}
                {isExpanded && (
                  <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Google Business ID */}
                      <div>
                        <label className="label text-xs">Google Business Place ID</label>
                        <input
                          value={edits?.googleBusiness ?? business.googleBusiness ?? ''}
                          onChange={e => setEditGoogle(prev => ({
                            ...prev,
                            [business.id]: { ...prev[business.id], googleBusiness: e.target.value },
                          }))}
                          className="input text-sm py-1.5"
                          placeholder="e.g. ChIJrTLr-GyuEmsRBfy61i59si0"
                        />
                      </div>
                      {/* Google Rating */}
                      <div>
                        <label className="label text-xs">Google Rating (0–5)</label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={edits?.googleRating ?? business.googleRating ?? ''}
                          onChange={e => setEditGoogle(prev => ({
                            ...prev,
                            [business.id]: { ...prev[business.id], googleRating: e.target.value },
                          }))}
                          className="input text-sm py-1.5"
                          placeholder="4.5"
                        />
                      </div>
                      {/* Google Review Count */}
                      <div>
                        <label className="label text-xs">Google Review Count</label>
                        <input
                          type="number"
                          min="0"
                          value={edits?.googleReviewCount ?? business.googleReviewCount ?? ''}
                          onChange={e => setEditGoogle(prev => ({
                            ...prev,
                            [business.id]: { ...prev[business.id], googleReviewCount: e.target.value },
                          }))}
                          className="input text-sm py-1.5"
                          placeholder="127"
                        />
                      </div>
                      {/* Tier */}
                      <div>
                        <label className="label text-xs">Listing Tier</label>
                        <select
                          value={edits?.tier ?? business.tier ?? 'FREE'}
                          onChange={e => setEditGoogle(prev => ({
                            ...prev,
                            [business.id]: { ...prev[business.id], tier: e.target.value as 'FREE' | 'FEATURED' | 'EXPERT_PARTNER' },
                          }))}
                          className="input text-sm py-1.5"
                        >
                          <option value="FREE">Free</option>
                          <option value="FEATURED">Featured ★</option>
                            <option value="EXPERT_PARTNER">Expert Partner ✨</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => saveGoogleFields(business.id)}
                        disabled={loading === business.id}
                        className="btn-primary text-xs py-1.5 px-4"
                      >
                        Save Changes
                      </button>
                      {business.googleBusiness && (
                        <button
                          onClick={() => refreshGoogleReviews(business.id)}
                          disabled={refreshingId === business.id}
                          className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                          {refreshingId === business.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Refresh from Google
                        </button>
                      )}
                      {business.tier === 'EXPERT_PARTNER' && (
                        <button
                          onClick={() => testGhl(business.id)}
                          disabled={testingGhlId === business.id}
                          className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
                          title="Fires a synthetic lead through the full GHL pipeline (no DB write, no email)"
                        >
                          {testingGhlId === business.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          Test GHL
                        </button>
                      )}
                      {business.tier === 'EXPERT_PARTNER' && ghlTestResult[business.id] && (
                        <div className={`w-full mt-2 text-xs rounded-lg p-3 ${
                          ghlTestResult[business.id].ok
                            ? 'bg-green-50 border border-green-200 text-green-800'
                            : 'bg-red-50 border border-red-200 text-red-800'
                        }`}>
                          <div className="font-mono mb-1">
                            {ghlTestResult[business.id].ok ? '✓ All steps passed' : '✗ Some steps failed'}:
                            {' '}{ghlTestResult[business.id].summary}
                          </div>
                          <div className="text-[11px] opacity-80">
                            {ghlTestResult[business.id].nextSteps.map((s, i) => (
                              <div key={i}>• {s}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(business._count?.reviews ?? 0) > 0 && (
                        <button
                          onClick={() => deleteReviews(business.id, business.name)}
                          disabled={loading === business.id}
                          className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete {business._count.reviews} Review{(business._count.reviews ?? 0) !== 1 ? 's' : ''}
                        </button>
                      )}
                      <button
                        onClick={() => { setExpandedId(null); setEditGoogle(prev => { const n = { ...prev }; delete n[business.id]; return n }) }}
                        className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
