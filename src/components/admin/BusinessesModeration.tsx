'use client'

import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Trash2, ExternalLink, Building2, Star, Pencil, ChevronDown, ChevronUp, RefreshCw, Loader2, Search, X, ImagePlus, Link as LinkIcon, ArrowUpDown } from 'lucide-react'

type BusinessStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
type SortKey = 'NEWEST' | 'OLDEST' | 'AZ' | 'ZA'

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
    // set the first time ownerId is populated. null until then. Drives the
    // CLAIMED filter chip + quick visual signal of which listings are owned.
    claimedAt: string | Date | null
    isExpertPartner?: boolean
  expertPartnerSlug?: string | null
  foundingPartnerSince?: string | Date | null
  liveQaZoomUrl?: string | null
  liveQaNextDate?: string | Date | null
  // Languages & Chamber affiliation badges (admin-editable)
  seHablaEspanol?: boolean
  chamberMember?: boolean
  hispanicChamberMember?: boolean
  // Deal — first active deal (most recent). Replaces the legacy
  // Business.coupon Json blob. Powers the admin "Add Deal on behalf"
  // panel in this component. Multi-deal management lives at
  // /dashboard/deals for owners and the Deals tab inside
  // /dashboard/edit?id=... for admins.
  deals?: Array<{
    id: string
    headline: string
    description: string | null
    code: string | null
    imageUrl: string | null
    expiresAt: string | Date | null
  }>
}

interface BusinessesModerationProps {
  initialBusinesses: Business[]
}

export default function BusinessesModeration({ initialBusinesses }: BusinessesModerationProps) {
  const [businesses, setBusinesses] = useState<Business[]>(initialBusinesses)
  const [filter, setFilter] = useState<'ALL' | BusinessStatus | 'CHAMBER' | 'CLAIMED' | 'UNCLAIMED'>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('NEWEST')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  // Admin deal-image upload widget state (per business).
  const [dealUploadingId, setDealUploadingId] = useState<string | null>(null)
  const [dealErrorById, setDealErrorById] = useState<Record<string, string>>({})

  const handleAdminDealImageUpload = async (businessId: string, file: File) => {
  setDealErrorById(prev => { const n = { ...prev }; delete n[businessId]; return n })
  setDealUploadingId(businessId)
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('businessId', businessId)
    const res = await fetch('/api/businesses/upload-deal-image', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Upload failed')
    setEditGoogle(prev => ({
      ...prev,
      [businessId]: { ...prev[businessId], dealImageUrl: data.url },
    }))
  } catch (err) {
    setDealErrorById(prev => ({ ...prev, [businessId]: err instanceof Error ? err.message : 'Upload failed' }))
  } finally {
    setDealUploadingId(null)
  }
}
  // Inline edit state per business
  const [editGoogle, setEditGoogle] = useState<Record<string, {
    googleBusiness: string
    googleRating: string
    googleReviewCount: string
    tier: 'FREE' | 'FEATURED' | 'EXPERT_PARTNER'
    isExpertPartner: boolean
    expertPartnerSlug: string
    seHablaEspanol: boolean
    chamberMember: boolean
    hispanicChamberMember: boolean
    // Admin 'Add Deal on behalf' fields. Empty headline = no deal on save.
    // `dealId` tracks the existing Deal row so we know whether to POST (new)
    // or PATCH (existing) when the admin clicks Save.
    hasDeal: boolean
    dealId: string | null
    dealHeadline: string
    dealDescription: string
    dealCode: string
    dealExpiresAt: string
    dealImageUrl: string
  }>>({})

  const reportFailure = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({})) as { error?: string }
    setError(data.error || fallback)
  }

  const searchLower = search.toLowerCase().trim()
  const filtered = useMemo(() => {
    if (filter === 'ALL') return businesses
    if (filter === 'CHAMBER') return businesses.filter(b => b.chamberMember || b.hispanicChamberMember)
    if (filter === 'CLAIMED') return businesses.filter(b => b.claimedAt != null || b.owner != null)
    if (filter === 'UNCLAIMED') return businesses.filter(b => b.claimedAt == null && b.owner == null)
    return businesses.filter(b => b.status === filter)
  }, [businesses, filter])
  const displayed = useMemo(() => {
    const matched = searchLower
      ? filtered.filter(b =>
          b.name.toLowerCase().includes(searchLower) ||
          b.address.toLowerCase().includes(searchLower) ||
          b.city.toLowerCase().includes(searchLower) ||
          b.email?.toLowerCase().includes(searchLower) ||
          b.owner?.email?.toLowerCase().includes(searchLower) ||
          b.category.name.toLowerCase().includes(searchLower)
        )
      : filtered
    // Sort runs on the already-filtered/searched set so the user's
    // sort choice applies WITHIN the active filter chip (e.g. "A → Z
    // pending only"). Server already returns newest-first; resort
    // when sortBy != NEWEST.
    if (sortBy === 'NEWEST') return matched
    const sorted = [...matched]
    if (sortBy === 'OLDEST') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } else {
      // A → Z / Z → A — case-insensitive locale compare on business
      // name, ties broken by createdAt desc so duplicate names still
      // have a stable, intuitive order.
      const dir = sortBy === 'AZ' ? 1 : -1
      sorted.sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        if (cmp !== 0) return cmp * dir
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    }
    return sorted
  }, [filtered, searchLower, sortBy])

  const counts: Record<string, number> = {
      ALL: businesses.length,
      PENDING: businesses.filter(b => b.status === 'PENDING').length,
      APPROVED: businesses.filter(b => b.status === 'APPROVED').length,
      REJECTED: businesses.filter(b => b.status === 'REJECTED').length,
      CHAMBER: businesses.filter(b => b.chamberMember || b.hispanicChamberMember).length,
      CLAIMED: businesses.filter(b => b.claimedAt != null || b.owner != null).length,
      UNCLAIMED: businesses.filter(b => b.claimedAt == null && b.owner == null).length,
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
    // Only send Expert Partner fields when the user opened the panel and
    // the checkbox is set. The checkbox is always seeded from the DB in
    // openEdit(), so this always fires when the panel was opened — but it
    // is correctly a no-op for anyone who doesn't touch it because the
    // state value equals the existing DB value.
    if (edits.isExpertPartner !== undefined) {
      patch.isExpertPartner = edits.isExpertPartner
      if (!edits.isExpertPartner) {
        // Toggling the badge off — clear the slug too so /partners/[slug]
        // doesn't keep resolving an orphaned Expert Partner page.
        patch.expertPartnerSlug = null
      } else {
        // Toggling on — slug is required for /partners/[slug] and JSON-LD.
        // Send whatever the admin typed; empty clears it.
        patch.expertPartnerSlug = edits.expertPartnerSlug.trim() || null
      }
    }
    // Languages & Chamber badges — sent only when the panel was opened
    // (state exists), so an admin who never expanded the row won't accidentally
    // wipe a previously-saved value.
    if (edits.seHablaEspanol !== undefined) patch.seHablaEspanol = edits.seHablaEspanol
    if (edits.chamberMember !== undefined) patch.chamberMember = edits.chamberMember
    if (edits.hispanicChamberMember !== undefined) patch.hispanicChamberMember = edits.hispanicChamberMember
    // Deal handling moved out of this PATCH call — the admin PATCH route
    // no longer accepts hasCoupon/coupon (those fields were dropped with
    // the Business.coupon column). The deal sync runs as a separate
    // /api/deals request below, sequenced after the Business update.
    setLoading(id)
    setError('')
    try {
      if (Object.keys(patch).length > 0) {
        await moderate(id, patch)
      }

      // Sync the deal to the new Deal table via /api/deals.
      if (!edits.hasDeal) {
        // Toggle off: delete the existing deal if there was one.
        if (edits.dealId) {
          const del = await fetch(`/api/deals/${edits.dealId}`, { method: 'DELETE' })
          if (!del.ok) {
            const data = await del.json().catch(() => ({}))
            setError(data.error || 'Failed to remove deal')
            return
          }
          // Update local state so the panel reflects the deletion
          setBusinesses(prev => prev.map(b => b.id === id
            ? { ...b, deals: [] }
            : b))
        }
      } else if (edits.dealHeadline && edits.dealHeadline.trim()) {
        const dealPayload = {
          businessId: id,
          headline: edits.dealHeadline.trim(),
          description: edits.dealDescription,
          code: edits.dealCode.trim() || null,
          imageUrl: edits.dealImageUrl.trim() || null,
          expiresAt: edits.dealExpiresAt
            ? new Date(edits.dealExpiresAt).toISOString()
            : null,
          isActive: true,
        }
        const endpoint = edits.dealId
          ? `/api/deals/${edits.dealId}`
          : '/api/deals'
        const method = edits.dealId ? 'PATCH' : 'POST'
        const dealRes = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dealPayload),
        })
        if (!dealRes.ok) {
          const data = await dealRes.json().catch(() => ({}))
          setError(data.error || 'Failed to save deal')
          return
        }
        const saved = await dealRes.json()
        // Remember the id for subsequent saves; refresh local deals list
        // so the panel UI matches the server.
        setEditGoogle(prev => prev[id]
          ? { ...prev, [id]: { ...prev[id], dealId: saved.id } }
          : prev)
        setBusinesses(prev => prev.map(b => b.id === id
          ? { ...b, deals: [{
              id: saved.id,
              headline: saved.headline,
              description: saved.description,
              code: saved.code,
              imageUrl: saved.imageUrl,
              expiresAt: saved.expiresAt,
            }] }
          : b))
      }
      // Toggle on but no headline → treat as "no deal yet", nothing to do.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save deal')
      return
    } finally {
      setLoading(null)
    }
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
    const firstDeal = b.deals?.[0]
    setEditGoogle(prev => ({
      ...prev,
      [b.id]: {
        googleBusiness: b.googleBusiness || '',
        googleRating: b.googleRating?.toString() || '',
        googleReviewCount: b.googleReviewCount?.toString() || '',
        tier: b.tier || 'FREE',
        isExpertPartner: !!b.isExpertPartner,
        expertPartnerSlug: b.expertPartnerSlug || '',
        seHablaEspanol: !!b.seHablaEspanol,
        chamberMember: !!b.chamberMember,
        hispanicChamberMember: !!b.hispanicChamberMember,
        // Pre-populate from the first Deal row, not the legacy
        // Business.coupon Json blob. Image URL is uploaded via the deal
        // image upload widget and stored on the Deal row directly.
        hasDeal: !!firstDeal,
        dealId: firstDeal?.id ?? null,
        dealHeadline: firstDeal?.headline || '',
        dealDescription: firstDeal?.description || '',
        dealCode: firstDeal?.code || '',
        dealExpiresAt: firstDeal?.expiresAt
          ? new Date(firstDeal.expiresAt).toISOString().slice(0, 10)
          : '',
        dealImageUrl: firstDeal?.imageUrl || '',
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div className="flex gap-2 overflow-x-auto pb-1">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CHAMBER', 'CLAIMED', 'UNCLAIMED'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    background: filter === f ? 'var(--primary, #007a7f)' : '#f1f5f9',
                    color: filter === f ? '#fff' : 'var(--text-secondary, #5a6c72)',
                  }}
                >
                  {f === 'ALL'
                    ? 'All'
                    : f === 'CHAMBER'
                    ? 'Chamber Imports'
                    : f === 'CLAIMED'
                    ? 'Claimed'
                    : f === 'UNCLAIMED'
                    ? 'Unclaimed'
                    : f.charAt(0) + f.slice(1).toLowerCase()}
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
              {/* Sort dropdown — client-side sort over the already-filtered
                  list. Default is "Newest first" to match the server's
                  pre-sorted fetch; "A → Z" is the alphabetical option
                  Johnny asked for (plus Z → A / Oldest as the natural
                  siblings). Lives on the right of the filter row at sm+,
                  wraps below the chips on narrow viewports. */}
              <label className="inline-flex items-center gap-2 shrink-0 text-xs font-medium text-text-secondary">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow cursor-pointer"
                  aria-label="Sort businesses"
                >
                  <option value="NEWEST">Newest first</option>
                  <option value="OLDEST">Oldest first</option>
                  <option value="AZ">A → Z</option>
                  <option value="ZA">Z → A</option>
                </select>
              </label>
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

                      {/* Expert Partner toggle + slug */}
                      <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-text cursor-pointer">
                          <input
                            type="checkbox"
                            checked={edits?.isExpertPartner ?? false}
                            onChange={e => setEditGoogle(prev => ({
                              ...prev,
                              [business.id]: {
                                ...prev[business.id],
                                isExpertPartner: e.target.checked,
                                // When enabling, default the slug to the
                                // business slug so the public URL works out
                                // of the box. Johnny can rename it freely.
                                ...(e.target.checked && !prev[business.id]?.expertPartnerSlug
                                  ? { expertPartnerSlug: business.slug }
                                  : {}),
                              },
                            }))}
                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span>
                            ✨ Expert Partner
                            <span className="ml-1 text-xs font-normal text-text-secondary">
                              (manual override — normally set by Stripe)
                            </span>
                          </span>
                        </label>
                        {edits?.isExpertPartner && (
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">
                              Expert Partner Slug
                              <span className="text-text-secondary/70 font-normal"> (used in /partners/[slug])</span>
                            </label>
                            <input
                              value={edits?.expertPartnerSlug ?? ''}
                              onChange={e => setEditGoogle(prev => ({
                                ...prev,
                                [business.id]: { ...prev[business.id], expertPartnerSlug: e.target.value },
                              }))}
                              className="input text-sm py-1.5"
                              placeholder="leeper-realty-group"
                            />
                            <p className="text-xs text-text-secondary mt-1">
                              Must be unique. Lowercase, hyphens, no spaces. Changing this breaks any existing /partners/[slug] links.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Languages & Chamber affiliation badges */}
                      <div className="sm:col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                          Languages & Chamber Affiliations
                        </p>
                        <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                          <input
                            type="checkbox"
                            checked={edits?.seHablaEspanol ?? false}
                            onChange={e => setEditGoogle(prev => ({
                              ...prev,
                              [business.id]: { ...prev[business.id], seHablaEspanol: e.target.checked },
                            }))}
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span>
                            <span className="font-medium">Se Habla Español</span>
                            <span className="ml-1 text-xs text-text-secondary">
                              (owner-toggleable; admins can override)
                            </span>
                          </span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                          <input
                            type="checkbox"
                            checked={edits?.chamberMember ?? false}
                            onChange={e => setEditGoogle(prev => ({
                              ...prev,
                              [business.id]: { ...prev[business.id], chamberMember: e.target.checked },
                            }))}
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span>
                            <span className="font-medium">Moreno Valley Chamber of Commerce member</span>
                          </span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                          <input
                            type="checkbox"
                            checked={edits?.hispanicChamberMember ?? false}
                            onChange={e => setEditGoogle(prev => ({
                              ...prev,
                              [business.id]: { ...prev[business.id], hispanicChamberMember: e.target.checked },
                            }))}
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span>
                            <span className="font-medium">Moreno Valley Hispanic Chamber of Commerce member</span>
                          </span>
                        </label>
                      </div>

                      {/* Admin: Add Deal on behalf — writes to the first-class
                          Deal table via /api/deals (POST for new, PATCH for
                          edit, DELETE for toggle-off). The toggle, fields,
                          and image upload all target the Deal row, not the
                          legacy Business.coupon Json blob. */}
                      <div className="sm:col-span-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                            Deal / Special Offer
                          </p>
                          <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={edits?.hasDeal ?? false}
                              onChange={e => setEditGoogle(prev => ({
                                ...prev,
                                [business.id]: { ...prev[business.id], hasDeal: e.target.checked },
                              }))}
                              className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span>{edits?.hasDeal ? 'Active' : 'Inactive'}</span>
                          </label>
                        </div>
                        {edits?.hasDeal && (
                          <div className="space-y-3">
                            <div>
                              <label className="label text-xs">Deal Headline</label>
                              <input
                                value={edits?.dealHeadline ?? ''}
                                onChange={e => setEditGoogle(prev => ({
                                  ...prev,
                                  [business.id]: { ...prev[business.id], dealHeadline: e.target.value },
                                }))}
                                className="input text-sm py-1.5"
                                placeholder="e.g. 20% off first service"
                                maxLength={80}
                              />
                            </div>
                            <div>
                              <label className="label text-xs">Details</label>
                              <textarea
                                value={edits?.dealDescription ?? ''}
                                onChange={e => setEditGoogle(prev => ({
                                  ...prev,
                                  [business.id]: { ...prev[business.id], dealDescription: e.target.value },
                                }))}
                                className="input text-sm py-1.5 min-h-[60px] resize-none"
                                placeholder="Terms and conditions..."
                                maxLength={300}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label text-xs">Promo Code <span className="text-text-secondary font-normal">(optional)</span></label>
                                <input
                                  value={edits?.dealCode ?? ''}
                                  onChange={e => setEditGoogle(prev => ({
                                    ...prev,
                                    [business.id]: { ...prev[business.id], dealCode: e.target.value.toUpperCase() },
                                  }))}
                                  className="input text-sm py-1.5 font-mono"
                                  placeholder="SAVE20"
                                  maxLength={20}
                                />
                              </div>
                              <div>
                                <label className="label text-xs">Expires <span className="text-text-secondary font-normal">(optional)</span></label>
                                <input
                                  type="date"
                                  value={edits?.dealExpiresAt ?? ''}
                                  onChange={e => setEditGoogle(prev => ({
                                    ...prev,
                                    [business.id]: { ...prev[business.id], dealExpiresAt: e.target.value },
                                  }))}
                                  className="input text-sm py-1.5"
                                />
                              </div>
                            </div>
                            {/* Deal image upload widget — mirrors /dashboard/edit.
                                Image goes to Vercel Blob via /api/businesses/upload-deal-image
                                and the returned URL is stored on the Deal row. */}
                            <div>
                              <label className="label text-xs">Deal Image <span className="text-text-secondary font-normal">(optional)</span></label>
                              <div className="flex items-start gap-3">
                                <div className="shrink-0">
                                  {edits?.dealImageUrl ? (
                                    <img src={edits.dealImageUrl} alt="Deal preview" className="w-20 h-20 rounded-lg object-cover bg-slate-100" />
                                  ) : (
                                    <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-text-secondary text-[10px]">No image</div>
                                  )}
                                </div>
                                <div className="flex-1 space-y-2">
                                  {dealErrorById[business.id] && (
                                    <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                                      <span>{dealErrorById[business.id]}</span>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 cursor-pointer transition-colors">
                                      {dealUploadingId === business.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                                      {dealUploadingId === business.id ? 'Uploading…' : edits?.dealImageUrl ? 'Replace' : 'Upload'}
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleAdminDealImageUpload(business.id, file)
                                          e.target.value = ''
                                        }}
                                      />
                                    </label>
                                    {edits?.dealImageUrl && (
                                      <button
                                        type="button"
                                        onClick={() => setEditGoogle(prev => ({
                                          ...prev,
                                          [business.id]: { ...prev[business.id], dealImageUrl: '' },
                                        }))}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-text text-xs font-medium hover:bg-slate-50 transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" /> Remove
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-text-secondary">JPEG / PNG / WEBP / GIF. Max 10MB. Vercel Blob.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
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
