'use client'

import { useState } from 'react'
import {
  Trophy, Star, Plus, Trash2, Edit2, Save, X,
  RefreshCw, ExternalLink, AlertCircle, CheckCircle, Search,
  PlusCircle, ChevronDown, ChevronUp, ImagePlus, Loader2, Link as LinkIcon,
} from 'lucide-react'

// Locale-stable number formatter for hydration safety. Without an explicit
// locale, toLocaleString() can produce different output on the server (en-US)
// vs the client (browser locale), causing React hydration mismatch (#418).
function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// ── Types ───────────────────────────────────────────────────────────────────

interface Nominee {
  id: string
  categoryId: string
  businessId: string
  winner: boolean
  notes: string | null
  displayOrder: number
  business: {
    id: string
    name: string
    slug: string
    address: string
    website: string | null
    logo: string | null
    googleRating: number | null
    googleReviewCount: number | null
  }
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  tagHints: string[]
  published: boolean
  isSection: boolean
  imageUrl: string | null
  parentCategoryId: string | null
  nominees: Nominee[]
  subCategories: Array<{ id: string; name: string; nomineeCount: number }>
}

interface BusinessSearchResult {
  id: string
  name: string
  address: string
  googleRating: number | null
  googleReviewCount: number | null
  bestOfTags: string[]
}

interface Props {
  initialCategories: Category[]
}

// ── Category Editor Modal ───────────────────────────────────────────────────

function CategoryModal({
  category,
  categories,
  onSave,
  onClose,
}: {
  category?: Category
  categories: Category[]
  onSave: (data: { name: string; slug: string; description: string; icon: string; tagHints: string; published: boolean; isSection: boolean; imageUrl: string; parentCategoryId: string | null }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'Trophy')
  const [tagHints, setTagHints] = useState(category?.tagHints.join(', ') ?? '')
  const [published, setPublished] = useState(category?.published ?? false)
  const [isSection, setIsSection] = useState(category?.isSection ?? false)
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? '')
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(category?.parentCategoryId ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Cover-image upload state. `useUrlMode` flips the UI between the upload
  // widget (default) and a plain text input — Johnny can still paste an
  // external URL when he has one.
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [useUrlMode, setUseUrlMode] = useState(false)

  const handleCoverUpload = async (file: File) => {
    setUploadError('')
    // Client-side gate: 10MB max, JPEG/PNG/WEBP/GIF only. The endpoint
    // re-validates, but failing fast here avoids a useless round-trip.
    const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    const MAX_BYTES = 10 * 1024 * 1024
    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError(`Unsupported file type: ${file.type || 'unknown'}. Use JPEG, PNG, WEBP, or GIF.`)
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 10MB.`)
      return
    }
    setUploadingCover(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      // Pass categoryId when editing an existing row so the Blob lands at
      // best-of/categories/{slug}/cover-{ts}.{ext} (predictable path).
      // For new rows we omit it; the slug will be set on save.
      if (category?.id) fd.append('categoryId', category.id)
      const res = await fetch('/api/admin/best-of/categories/upload-image', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`)
      if (!data?.url) throw new Error('Upload succeeded but no URL returned.')
      setImageUrl(data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) { setError('Name and slug required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), slug: slug.trim(), description: description.trim(), icon, tagHints, published, isSection, imageUrl: imageUrl.trim(), parentCategoryId })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-text">{category ? 'Edit Category' : 'New Category'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-text-secondary"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Category Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Best Coffee" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Slug *</label>
            <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="best-coffee" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What makes a great [category]?" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Icon</label>
            <select value={icon} onChange={e => setIcon(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary">
              <option value="Trophy">🏆 Trophy</option>
              <option value="Coffee">☕ Coffee</option>
              <option value="Beef">🍔 Beef</option>
              <option value="Pizza">🍕 Pizza</option>
              <option value="Taco">🌮 Taco</option>
              <option value="Flame">🔥 Flame</option>
              <option value="Heart">💑 Heart</option>
              <option value="ShoppingBag">🛍️ ShoppingBag</option>
              <option value="Sunrise">🌅 Sunrise</option>
              <option value="Trees">🌳 Trees</option>
              <option value="Building">🏢 Building</option>
              <option value="PawPrint">🐾 PawPrint</option>
              <option value="Home">🏠 Home</option>
              <option value="Car">🚗 Car</option>
              <option value="Briefcase">💼 Briefcase</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Sub-category of{' '}
              <span className="font-normal text-text-secondary">(leave blank to create a top-level category)</span>
            </label>
            {/* Build set of all descendant IDs to prevent circular references */}
            {(() => {
              const descendantIds = new Set<string>()
              if (category) {
                const findDescendants = (catId: string) => {
                  categories.filter(c => c.parentCategoryId === catId).forEach(c => {
                    descendantIds.add(c.id)
                    findDescendants(c.id)
                  })
                }
                findDescendants(category.id)
              }
              // Show ALL categories (sections + non-sections) that can be parents —
              // only exclude the current item and its descendants (prevents circular ref).
              // Categories that already have a parent CAN be parents of other items.
              const topLevel = categories.filter(c => c.id !== category?.id && !descendantIds.has(c.id))
              return (
                <select
                  value={parentCategoryId ?? ''}
                  onChange={e => setParentCategoryId(e.target.value || null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">— Top-level category —</option>
                  {topLevel.filter(c => c.isSection).length > 0 && (
                    <optgroup label="Sections">
                      {topLevel.filter(c => c.isSection).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {topLevel.filter(c => !c.isSection).length > 0 && (
                    <optgroup label="Categories">
                      {topLevel.filter(c => !c.isSection).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )
            })()}
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Tag Hints <span className="font-normal">(comma-separated, advisory only)</span></label>
            <input value={tagHints} onChange={e => setTagHints(e.target.value)} placeholder="e.g. coffee, cafe, espresso" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="accent-primary" />
            <span className="text-sm text-text">Published (visible on site)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isSection} onChange={e => setIsSection(e.target.checked)} className="accent-primary" />
            <span className="text-sm text-text">Section Header <span className="text-text-secondary text-xs">(visual group header, not a clickable card)</span></span>
          </label>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Cover Image <span className="font-normal text-text-secondary">(shown on the category block)</span>
            </label>
            {useUrlMode ? (
              <div className="space-y-2">
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setUseUrlMode(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Upload an image instead
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt="Cover preview"
                      className="w-24 h-24 rounded-lg object-cover bg-slate-100"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-slate-100 flex items-center justify-center text-text-secondary text-xs">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {uploadError && (
                    <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 cursor-pointer transition-colors">
                      {uploadingCover ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="w-3.5 h-3.5" />
                      )}
                      {uploadingCover ? 'Uploading…' : imageUrl ? 'Replace image' : 'Upload image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleCoverUpload(file)
                          // Reset so re-selecting the same file fires onChange again.
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-text text-xs font-medium hover:bg-slate-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseUrlMode(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-primary"
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Or paste a URL
                  </button>
                  <p className="text-xs text-text-secondary">
                    JPEG / PNG / WEBP / GIF. Max 10MB. Stored on Vercel Blob.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-slate-100 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Category'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function BestOfAdmin({ initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialCategories[0]?.id ?? '')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | undefined>()
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BusinessSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [editingNominee, setEditingNominee] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const activeCategory = categories.find(c => c.id === activeCategoryId)

  // ── Search businesses ───────────────────────────────────────────────────

  const searchBusinesses = async (q: string, categoryId: string, tagHints: string[]) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/businesses/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const existingIds = new Set(
        categories.find(c => c.id === categoryId)?.nominees.map(n => n.business.id) ?? []
      )
      const results = (data.businesses ?? []).filter((b: BusinessSearchResult) => !existingIds.has(b.id))
      // Sort: tag matches first, then by rating
      const sorted = results.sort((a: BusinessSearchResult, b: BusinessSearchResult) => {
        const aMatch = tagHints.some(t => a.bestOfTags.includes(t))
        const bMatch = tagHints.some(t => b.bestOfTags.includes(t))
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
        return (b.googleRating ?? 0) - (a.googleRating ?? 0)
      })
      setSearchResults(sorted)
    } catch {
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleSearchInput = (q: string, categoryId: string, tagHints: string[]) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    clearTimeout((window as unknown as Record<string, unknown>).__searchTimeout as number)
    ;(window as unknown as Record<string, unknown>).__searchTimeout = setTimeout(
      () => searchBusinesses(q, categoryId, tagHints), 350
    ) as unknown as number
  }

  // ── Add nominee ─────────────────────────────────────────────────────────

  const addNominee = async (categoryId: string, businessId: string) => {
    setAddingId(businessId)
    try {
      const res = await fetch('/api/admin/best-of/nominees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, businessId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to add')
      }
      const nominee = await res.json()
      setCategories(prev => prev.map(cat =>
        cat.id === categoryId
          ? { ...cat, nominees: [...cat.nominees, { ...nominee, business: nominee.business }] }
          : cat
      ))
      setSearchResults(prev => prev.filter(b => b.id !== businessId))
      setSearchQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAddingId(null)
    }
  }

  // ── Toggle winner ─────────────────────────────────────────────────────

  const toggleWinner = async (nomineeId: string, currentWinner: boolean) => {
    setSaving(nomineeId)
    try {
      const res = await fetch(`/api/admin/best-of/nominees/${nomineeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner: !currentWinner }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      const updated = await res.json()
      setCategories(prev => prev.map(cat => ({
        ...cat,
        nominees: cat.nominees.map(n =>
          n.id === nomineeId
            ? { ...n, winner: updated.winner }
            : !currentWinner && updated.winner // if setting winner=true, clear other winners
              ? { ...n, winner: false }
              : n
        ),
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  // ── Save notes ─────────────────────────────────────────────────────────

  const saveNotes = async (nomineeId: string) => {
    setSaving(nomineeId)
    try {
      const res = await fetch(`/api/admin/best-of/nominees/${nomineeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editingNotes[nomineeId] ?? '' }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      const updated = await res.json()
      setCategories(prev => prev.map(cat => ({
        ...cat,
        nominees: cat.nominees.map(n => n.id === nomineeId ? { ...n, notes: updated.notes } : n),
      })))
      setEditingNominee(null)
      setSuccess('Notes saved')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  // ── Delete nominee ─────────────────────────────────────────────────────

  const deleteNominee = async (nomineeId: string) => {
    try {
      const res = await fetch(`/api/admin/best-of/nominees/${nomineeId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setCategories(prev => prev.map(cat => ({
        ...cat,
        nominees: cat.nominees.filter(n => n.id !== nomineeId),
      })))
      setConfirmDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── Create / update category ────────────────────────────────────────────

  const saveCategory = async (data: { name: string; slug: string; description: string; icon: string; tagHints: string; published: boolean; isSection: boolean; imageUrl: string; parentCategoryId: string | null }) => {
    const hints = data.tagHints.split(',').map(t => t.trim()).filter(Boolean)
    if (editingCategory) {
      const res = await fetch(`/api/admin/best-of/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tagHints: hints }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      const updated = await res.json()
      setCategories(prev => prev.map(cat =>
        cat.id === editingCategory.id
          ? { ...cat, ...updated }
          : cat
      ))
    } else {
      const res = await fetch('/api/admin/best-of/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tagHints: hints }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      const created = await res.json()
      setCategories(prev => [...prev, { ...created, nominees: [], subCategories: [] }])
      setActiveCategoryId(created.id)
    }
  }

  const deleteCategory = async (categoryId: string) => {
    if (!confirm('Delete this category and all its nominees?')) return
    try {
      const res = await fetch(`/api/admin/best-of/categories/${categoryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      if (activeCategoryId === categoryId) {
        setActiveCategoryId(categories.find(c => c.id !== categoryId)?.id ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-text text-lg">Best Of</h2>
            <p className="text-xs text-text-secondary">{categories.length} categories</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditingCategory(undefined); setShowCategoryModal(true) }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" /> New Category
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="border-b border-slate-100 px-6 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {categories.map(cat => (
              <div key={cat.id} className="relative group">
                <button
                  onClick={() => { setActiveCategoryId(cat.id); setAddingToCategory(null); setSearchQuery(''); setSearchResults([]) }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                    activeCategoryId === cat.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text'
                  }`}
                >
                  {cat.parentCategoryId && <span className="text-xs text-slate-400">↳</span>}
                  {cat.name}
                  {cat.nominees.length > 0 && (
                    <span className="text-xs bg-slate-100 rounded-full px-1.5 py-0.5">{cat.nominees.length}</span>
                  )}
                  {cat.subCategories.length > 0 && (
                    <span className="text-xs bg-amber-50 text-amber-600 rounded-full px-1.5 py-0.5">
                      {cat.subCategories.length}
                    </span>
                  )}
                  {!cat.published && <span className="text-xs text-amber-500">(draft)</span>}
                </button>
                <div className="absolute top-full left-0 hidden group-hover:flex gap-1 mt-1 z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setShowCategoryModal(true) }}
                    className="p-1 rounded bg-white border border-slate-200 shadow text-text-secondary hover:text-primary"
                    title="Edit category"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id) }}
                    className="p-1 rounded bg-white border border-slate-200 shadow text-text-secondary hover:text-red-600"
                    title="Delete category"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active category panel */}
      {activeCategory && (
        <div>
          {/* Category header bar */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {activeCategory.parentCategoryId && (
                  <span className="text-xs text-slate-400">↳</span>
                )}
                <h3 className="font-semibold text-text text-base">{activeCategory.name}</h3>
                {!activeCategory.published && (
                  <span className="text-xs text-amber-500 font-medium">(draft)</span>
                )}
              </div>
              {activeCategory.description && (
                <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{activeCategory.description}</p>
              )}
            </div>

            {/* Always-visible Edit + Delete for active category */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setEditingCategory(activeCategory); setShowCategoryModal(true) }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Category
              </button>
              <button
                onClick={() => deleteCategory(activeCategory.id)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>

          {/* Sub-category controls (if active category has sub-categories) */}
          {activeCategory.subCategories.length > 0 && (
            <div className="px-6 py-3 border-b border-slate-100 bg-amber-50/50">
              <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wider">Sub-categories</p>
              <div className="flex flex-wrap gap-2">
                {activeCategory.subCategories.map(sub => (
                  <div key={sub.id} className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 px-3 py-1.5">
                    <span className="text-xs text-text font-medium">{sub.name}</span>
                    <span className="text-xs text-slate-400 ml-1">({sub.nomineeCount})</span>
                    <button
                      onClick={() => {
                        const cat = categories.find(c => c.id === sub.id)
                        if (cat) { setEditingCategory(cat); setShowCategoryModal(true) }
                      }}
                      className="ml-1 p-0.5 rounded text-slate-400 hover:text-primary transition-colors"
                      title="Edit sub-category"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteCategory(sub.id)}
                      className="p-0.5 rounded text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete sub-category"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add business bar */}
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => {
                  setAddingToCategory(addingToCategory === activeCategory.id ? null : activeCategory.id)
                  if (addingToCategory !== activeCategory.id) { setSearchQuery(''); setSearchResults([]) }
                }}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  addingToCategory === activeCategory.id ? 'bg-slate-200 text-text-secondary' : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {addingToCategory === activeCategory.id ? 'Cancel' : 'Add Business'}
              </button>
              <p className="text-xs text-text-secondary">Add a nominee to <strong>{activeCategory.name}</strong></p>
            </div>

            {addingToCategory === activeCategory.id && (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value, activeCategory.id, activeCategory.tagHints)}
                    placeholder="Search businesses by name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    autoFocus
                  />
                  {searching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                </div>

                {searchResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map(b => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-text">{b.name}</p>
                          <p className="text-xs text-text-secondary">{b.address}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {b.googleRating != null && (
                            <span className="flex items-center gap-0.5 text-xs">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              {b.googleRating.toFixed(1)}
                            </span>
                          )}
                          <button
                            onClick={() => addNominee(activeCategory.id, b.id)}
                            disabled={addingId === b.id}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            {addingId === b.id ? '...' : 'Add'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <p className="text-xs text-text-secondary mt-2">No unlisted businesses found</p>
                )}
              </div>
            )}
          </div>

          {/* Nominees list */}
          {activeCategory.nominees.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="font-medium text-text mb-1">No nominees yet</p>
              <p className="text-sm text-text-secondary">Use &quot;Add Business&quot; above to add a nominee.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {[...activeCategory.nominees]
                .sort((a, b) => {
                  if (a.winner !== b.winner) return a.winner ? -1 : 1
                  return a.displayOrder - b.displayOrder
                })
                .map((nominee) => {
                  const isEditing = editingNominee === nominee.id
                  const isSaving = saving === nominee.id

                  return (
                    <div key={nominee.id} className={`p-4 ${isEditing ? 'bg-primary/5' : ''}`}>
                      {/* Row */}
                      <div className="flex items-start gap-3">
                        {/* Winner badge */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                          {nominee.winner ? (
                            <img src="/best-of-badge.svg" alt="Winner" className="w-8 h-8" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">
                              #{activeCategory.nominees.indexOf(nominee) + 1}
                            </div>
                          )}
                        </div>

                        {/* Business info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-text text-sm">{nominee.business.name}</p>
                            {nominee.business.website && (
                              <a href={nominee.business.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-0.5">
                                <ExternalLink className="w-3 h-3" /> Web
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary">{nominee.business.address}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {nominee.business.googleRating != null && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                {nominee.business.googleRating.toFixed(1)}
                              </span>
                            )}
                            {nominee.business.googleReviewCount != null && (
                              <span className="text-xs text-text-secondary">{formatCount(nominee.business.googleReviewCount)} reviews</span>
                            )}
                          </div>
                          {nominee.notes && (
                            <p className="text-xs text-text-secondary italic mt-2 line-clamp-2">{nominee.notes}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Winner toggle */}
                          <button
                            onClick={() => toggleWinner(nominee.id, nominee.winner)}
                            disabled={isSaving}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                              nominee.winner
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-slate-100 text-text-secondary hover:bg-primary/10 hover:text-primary'
                            } disabled:opacity-50`}
                            title={nominee.winner ? 'Remove winner status' : 'Mark as winner'}
                          >
                            <Trophy className="w-3.5 h-3.5" />
                            {nominee.winner ? 'Winner' : 'Mark Winner'}
                          </button>

                          {/* Notes */}
                          <button
                            onClick={() => {
                              setEditingNominee(isEditing ? null : nominee.id)
                              setEditingNotes(prev => ({ ...prev, [nominee.id]: nominee.notes ?? '' }))
                            }}
                            className={`p-1.5 rounded-lg transition-all ${isEditing ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-primary hover:bg-primary/10'}`}
                            title="Edit notes"
                          >
                            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                          </button>

                          {/* Delete */}
                          {confirmDelete === nominee.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deleteNominee(nominee.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" title="Confirm delete">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg text-text-secondary hover:bg-slate-100">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(nominee.id)}
                              className="p-1.5 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 transition-all"
                              title="Remove nominee"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notes editor */}
                      {isEditing && (
                        <div className="mt-4 pl-13 space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-text-secondary mb-1">Editorial Notes <span className="font-normal">(why this business wins — shown on BestOf page)</span></label>
                            <textarea
                              value={editingNotes[nominee.id] ?? ''}
                              onChange={e => setEditingNotes(prev => ({ ...prev, [nominee.id]: e.target.value }))}
                              rows={3}
                              placeholder="e.g. Handmade tortillas, local institution since 1998, consistent 4.5+ stars..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary resize-none"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setEditingNominee(null); setEditingNotes(prev => { const n = { ...prev }; delete n[nominee.id]; return n }) }}
                              className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-slate-100 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveNotes(nominee.id)}
                              disabled={isSaving}
                              className="btn-primary text-sm flex items-center gap-2"
                            >
                              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              Save Notes
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
      )}

      {categories.length === 0 && (
        <div className="p-12 text-center">
          <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-text mb-1">No categories yet</p>
          <p className="text-sm text-text-secondary mb-4">Create your first BestOf category to get started.</p>
          <button
            onClick={() => { setEditingCategory(undefined); setShowCategoryModal(true) }}
            className="btn-primary text-sm inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> New Category
          </button>
        </div>
      )}

      {/* Category create/edit modal */}
      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          categories={categories}
          onSave={saveCategory}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(undefined) }}
        />
      )}
    </div>
  )
}
