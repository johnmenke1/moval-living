'use client'

import { useState } from 'react'
import {
  User, Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  Loader2, Search, X, Globe, Link2, Sparkles
} from 'lucide-react'
import {
  LinkedinIcon,
  TwitterIcon,
  FacebookIcon,
  InstagramIcon,
} from '@/components/social/SocialIcons'

interface BusinessOption {
  id: string
  name: string
  slug: string
  logo: string | null
  isExpertPartner: boolean
  category: { name: string; slug: string }
}

interface GuestAuthor {
  id: string
  slug: string
  displayName: string
  title: string | null
  bio: string
  photoUrl: string | null
  personalSiteUrl: string | null
  companyName: string | null
  companyUrl: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  isActive: boolean
  postCount: number
  business: { id: string; name: string; slug: string; logo: string | null } | null
}

interface FormState {
  slug: string
  displayName: string
  title: string
  bio: string
  photoUrl: string
  personalSiteUrl: string
  companyName: string
  companyUrl: string
  linkedinUrl: string
  twitterUrl: string
  facebookUrl: string
  instagramUrl: string
  isActive: boolean
  businessId: string
}

const blankForm = (): FormState => ({
  slug: '',
  displayName: '',
  title: '',
  bio: '',
  photoUrl: '',
  personalSiteUrl: '',
  companyName: '',
  companyUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  facebookUrl: '',
  instagramUrl: '',
  isActive: true,
  businessId: '',
})

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function LinkIcon({ url }: { url: string | null }) {
  if (!url) return null
  const lower = url.toLowerCase()
  if (lower.includes('linkedin')) return <LinkedinIcon className="w-3.5 h-3.5 text-blue-600" />
  if (lower.includes('twitter') || lower.includes('x.com')) return <TwitterIcon className="w-3.5 h-3.5 text-sky-500" />
  if (lower.includes('facebook')) return <FacebookIcon className="w-3.5 h-3.5 text-blue-700" />
  if (lower.includes('instagram')) return <InstagramIcon className="w-3.5 h-3.5 text-pink-500" />
  return <Globe className="w-3.5 h-3.5 text-slate-400" />
}

function BusinessPicker({
  value,
  onChange,
  businesses,
  id = 'businessId',
}: {
  value: string
  onChange: (id: string) => void
  businesses: BusinessOption[]
  id?: string
}) {
  const partners = businesses.filter(b => b.isExpertPartner)
  const rest = businesses.filter(b => !b.isExpertPartner)

  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
    >
      <option value="">— None —</option>
      {partners.length > 0 && (
        <optgroup label="✨ Expert Partners">
          {partners.map(b => (
            <option key={b.id} value={b.id}>
              ✨ {b.name} ({b.category.name})
            </option>
          ))}
        </optgroup>
      )}
      {rest.length > 0 && (
        <optgroup label="Other Businesses">
          {rest.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.category.name})
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

export default function GuestAuthorsPanel({
  initialAuthors,
  approvedBusinesses = [],
}: {
  initialAuthors: GuestAuthor[]
  approvedBusinesses?: BusinessOption[]
}) {
  const [authors, setAuthors] = useState<GuestAuthor[]>(initialAuthors)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<FormState>(blankForm())
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const filtered = authors.filter(a =>
    a.displayName.toLowerCase().includes(search.toLowerCase()) ||
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.companyName?.toLowerCase().includes(search.toLowerCase())
  )

  const reportFailure = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => ({})) as { error?: string }
    setError(data.error || fallback)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError('')
    try {
      const payload = {
        ...createForm,
        photoUrl: createForm.photoUrl || null,
        personalSiteUrl: createForm.personalSiteUrl || null,
        companyUrl: createForm.companyUrl || null,
        linkedinUrl: createForm.linkedinUrl || null,
        twitterUrl: createForm.twitterUrl || null,
        facebookUrl: createForm.facebookUrl || null,
        instagramUrl: createForm.instagramUrl || null,
        businessId: createForm.businessId || null,
      }
      const res = await fetch('/api/admin/guest-authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        await reportFailure(res, 'Failed to create author')
        return
      }
      const author = await res.json()
      setAuthors(prev => [...prev, author])
      setShowCreate(false)
      setCreateForm(blankForm())
    } catch {
      setCreateError('Something went wrong')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this author and all their posts?')) return
    setLoading(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/guest-authors/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        await reportFailure(res, 'Failed to delete author')
        return
      }
      setAuthors(prev => prev.filter(a => a.id !== id))
    } catch {
      setError('Failed to delete author')
    } finally {
      setLoading(null)
    }
  }

  const handleToggleActive = async (author: GuestAuthor) => {
    setLoading(author.id)
    setError('')
    try {
      const res = await fetch(`/api/admin/guest-authors/${author.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !author.isActive }),
      })
      if (!res.ok) {
        await reportFailure(res, 'Failed to update author')
        return
      }
      const updated = await res.json()
      setAuthors(prev => prev.map(a => a.id === author.id ? { ...a, ...updated } : a))
    } catch {
      setError('Failed to update author')
    } finally {
      setLoading(null)
    }
  }

  const handleEditSave = async (id: string, form: FormState) => {
    setLoading(id)
    setError('')
    try {
      const payload = {
        ...form,
        photoUrl: form.photoUrl || null,
        personalSiteUrl: form.personalSiteUrl || null,
        companyUrl: form.companyUrl || null,
        linkedinUrl: form.linkedinUrl || null,
        twitterUrl: form.twitterUrl || null,
        facebookUrl: form.facebookUrl || null,
        instagramUrl: form.instagramUrl || null,
        businessId: form.businessId || null,
      }
      const res = await fetch(`/api/admin/guest-authors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        await reportFailure(res, 'Failed to save changes')
        return
      }
      const updated = await res.json()
      setAuthors(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a))
      setEditingId(null)
    } catch {
      setError('Failed to save changes')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search authors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Author
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-primary/30 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-text">New Guest Author</h3>
          {createError && <p className="text-red-600 text-sm">{createError}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Display Name *</label>
              <input
                required
                value={createForm.displayName}
                onChange={e => setCreateForm(f => ({ ...f, displayName: e.target.value, slug: slugify(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Chris Leeper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">URL Slug</label>
              <input
                value={createForm.slug}
                onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="chris-leeper"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Title / Role</label>
              <input
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Realtor, Leeper Realty Group"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Company Name</label>
              <input
                value={createForm.companyName}
                onChange={e => setCreateForm(f => ({ ...f, companyName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Leeper Realty Group"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Bio *</label>
            <textarea
              required
              rows={3}
              value={createForm.bio}
              onChange={e => setCreateForm(f => ({ ...f, bio: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="2-3 sentences about this author..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Linked Business
              <span className="text-text-secondary/70 font-normal"> (optional)</span>
            </label>
            <BusinessPicker
              value={createForm.businessId}
              onChange={(v) => setCreateForm(f => ({ ...f, businessId: v }))}
              businesses={approvedBusinesses}
              id="create-businessId"
            />
            <p className="text-xs text-text-secondary mt-1">
              If the linked business is an Expert Partner, the public author page will display their Expert Partner badge.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Photo URL</label>
              <input
                type="url"
                value={createForm.photoUrl}
                onChange={e => setCreateForm(f => ({ ...f, photoUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Personal Website</label>
              <input
                type="url"
                value={createForm.personalSiteUrl}
                onChange={e => setCreateForm(f => ({ ...f, personalSiteUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">LinkedIn</label>
              <input
                type="url"
                value={createForm.linkedinUrl}
                onChange={e => setCreateForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Twitter / X</label>
              <input
                type="url"
                value={createForm.twitterUrl}
                onChange={e => setCreateForm(f => ({ ...f, twitterUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://x.com/..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Facebook</label>
              <input
                type="url"
                value={createForm.facebookUrl}
                onChange={e => setCreateForm(f => ({ ...f, facebookUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Instagram</label>
              <input
                type="url"
                value={createForm.instagramUrl}
                onChange={e => setCreateForm(f => ({ ...f, instagramUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://instagram.com/..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={createForm.isActive}
                onChange={e => setCreateForm(f => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-slate-300 text-primary focus:ring-primary"
              />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Author
            </button>
          </div>
        </form>
      )}

      {/* Authors list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-secondary">No authors yet</p>
          <p className="text-sm">Add your first guest author above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(author => (
            <div key={author.id} className={`bg-white rounded-xl border ${author.isActive ? 'border-slate-100' : 'border-slate-200 opacity-60'} overflow-hidden`}>
              {/* Card header */}
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-primary/10 flex-shrink-0 overflow-hidden">
                  {author.photoUrl ? (
                    <img src={author.photoUrl} alt={author.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary text-lg font-bold">
                      {author.displayName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-text">{author.displayName}</p>
                    {!author.isActive && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {author.postCount} {author.postCount === 1 ? 'post' : 'posts'}
                    </span>
                    {author.business && (
                      <a
                        href={`/business/${author.business.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
                        title={`Linked to ${author.business.name} — view listing`}
                      >
                        <Link2 className="w-3 h-3" />
                        {author.business.name}
                      </a>
                    )}
                  </div>
                  {author.title && (
                    <p className="text-sm text-text-secondary">{author.title}</p>
                  )}
                  {author.companyName && (
                    <p className="text-xs text-text-secondary">{author.companyName}</p>
                  )}
                </div>

                {/* Social icons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {[
                    author.linkedinUrl,
                    author.twitterUrl,
                    author.facebookUrl,
                    author.instagramUrl,
                    author.personalSiteUrl,
                  ].map((url, i) => url ? (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-slate-100 rounded">
                      <LinkIcon url={url} />
                    </a>
                  ) : null)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === author.id ? null : author.id)}
                    className="p-2 text-slate-400 hover:text-text hover:bg-slate-100 rounded-lg transition-colors"
                    title="View details"
                  >
                    {expandedId === author.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleToggleActive(author)}
                    disabled={loading === author.id}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      author.isActive
                        ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                        : 'border-green-200 text-green-700 hover:bg-green-50'
                    }`}
                    title={author.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {loading === author.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (author.isActive ? 'Deactivate' : 'Activate')}
                  </button>
                  <button
                    onClick={() => handleDelete(author.id)}
                    disabled={loading === author.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete author"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded edit form */}
              {expandedId === author.id && (
                <InlineEditForm
                  author={author}
                  businesses={approvedBusinesses}
                  onSave={(form) => handleEditSave(author.id, form)}
                  onCancel={() => setExpandedId(null)}
                  loading={loading === author.id}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InlineEditForm({
  author,
  onSave,
  onCancel,
  loading,
  businesses,
}: {
  author: GuestAuthor
  onSave: (form: FormState) => void
  onCancel: () => void
  loading: boolean
  businesses: BusinessOption[]
}) {
  const [form, setForm] = useState<FormState>({
    slug: author.slug,
    displayName: author.displayName,
    title: author.title ?? '',
    bio: author.bio,
    photoUrl: author.photoUrl ?? '',
    personalSiteUrl: author.personalSiteUrl ?? '',
    companyName: author.companyName ?? '',
    companyUrl: author.companyUrl ?? '',
    linkedinUrl: author.linkedinUrl ?? '',
    twitterUrl: author.twitterUrl ?? '',
    facebookUrl: author.facebookUrl ?? '',
    instagramUrl: author.instagramUrl ?? '',
    isActive: author.isActive,
    businessId: author.business?.id ?? '',
  })

  return (
    <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Display Name *</label>
          <input
            required
            value={form.displayName}
            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Title / Role</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Company Name</label>
          <input
            value={form.companyName}
            onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Photo URL</label>
          <input
            type="url"
            value={form.photoUrl}
            onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Bio *</label>
        <textarea
          required
          rows={3}
          value={form.bio}
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none bg-white"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">LinkedIn</label>
          <input
            type="url"
            value={form.linkedinUrl}
            onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Twitter / X</label>
          <input
            type="url"
            value={form.twitterUrl}
            onChange={e => setForm(f => ({ ...f, twitterUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Personal Website</label>
          <input
            type="url"
            value={form.personalSiteUrl}
            onChange={e => setForm(f => ({ ...f, personalSiteUrl: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Linked Business
          <span className="text-text-secondary/70 font-normal"> (optional)</span>
        </label>
        <BusinessPicker
          value={form.businessId}
          onChange={(v) => setForm(f => ({ ...f, businessId: v }))}
          businesses={businesses}
          id={`edit-businessId-${author.id}`}
        />
        <p className="text-xs text-text-secondary mt-1">
          Pick “None” to unlink.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-secondary hover:text-text">
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  )
}
