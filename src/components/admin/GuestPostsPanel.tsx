'use client'

import { useState } from 'react'
import {
  FileText, Plus, Trash2, ChevronDown, ChevronUp,
  Loader2, Search, X, Eye, Clock, CheckCircle, XCircle, Calendar
} from 'lucide-react'
import MarkdownEditor from '@/components/admin/MarkdownEditor'

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  draft:       { label: 'Draft',       icon: FileText,  color: 'text-slate-600', bg: 'bg-slate-100' },
  submitted:   { label: 'Submitted',   icon: Clock,     color: 'text-amber-600', bg: 'bg-amber-50' },
  in_review:  { label: 'In Review',   icon: Clock,     color: 'text-blue-600',  bg: 'bg-blue-50' },
  scheduled:  { label: 'Scheduled',   icon: Calendar,  color: 'text-purple-600', bg: 'bg-purple-50' },
  published:  { label: 'Published',  icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  rejected:   { label: 'Rejected',   icon: XCircle,   color: 'text-red-600',   bg: 'bg-red-50' },
}

interface GuestPost {
  id: string
  slug: string
  postType: 'LIFE' | 'GUEST' | 'OUTING' | 'SPOTLIGHT'
  title: string
  excerpt: string
  heroImageUrl: string | null
  status: string
  publishedAt: string | null
  scheduledFor: string | null
  rejectionReason: string | null
  author: {
    id: string
    displayName: string
    slug: string
    photoUrl: string | null
    title: string | null
  }
  createdAt: string
}

interface Author {
  id: string
  displayName: string
  slug: string
}

const POST_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  LIFE:       { label: 'Life in MoVal',     color: 'text-emerald-700 bg-emerald-50' },
  GUEST:      { label: 'Guest Expert',       color: 'text-violet-700 bg-violet-50' },
  OUTING:     { label: 'Live Curiously',     color: 'text-amber-700 bg-amber-50' },
  SPOTLIGHT:  { label: 'Business Spotlight',  color: 'text-blue-700 bg-blue-50' },
}

interface FormState {
  postType: 'LIFE' | 'GUEST' | 'OUTING' | 'SPOTLIGHT'
  slug: string
  title: string
  excerpt: string
  body: string
  heroImageUrl: string
  authorId: string
  status: string
  scheduledFor: string
  metaTitle: string
  metaDescription: string
  // LIFE
  spotifyTrack1: string
  spotifyTrack2: string
  // GUEST
  faqItems: { question: string; answer: string }[]
  // OUTING
  outingPhotos: { url: string; caption?: string }[] 
  // OUTING & SPOTLIGHT
  youtubeVideoId: string
}

const blankForm = (): FormState => ({
  postType: 'LIFE',
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  heroImageUrl: '',
  authorId: '',
  status: 'draft',
  scheduledFor: '',
  metaTitle: '',
  metaDescription: '',
  // LIFE
  spotifyTrack1: '',
  spotifyTrack2: '',
  // GUEST
  faqItems: [],
  // OUTING
  outingPhotos: [],
  // OUTING & SPOTLIGHT
  youtubeVideoId: '',
})

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function postTypeUrl(postType: string): string {
  switch (postType) {
    case 'LIFE':      return '/life'
    case 'GUEST':     return '/insights'
    case 'OUTING':    return '/outings'
    case 'SPOTLIGHT': return '/spotlights'
    default:          return '/insights'
  }
}

export default function GuestPostsPanel({
  initialPosts,
  authors,
}: {
  initialPosts: GuestPost[]
  authors: Author[]
}) {
  const [posts, setPosts] = useState<GuestPost[]>(initialPosts)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<FormState>(blankForm())
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const filtered = posts.filter(p => {
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.author?.displayName?.toLowerCase().includes(search.toLowerCase()) ?? false)
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts: Record<string, number> = {
    ALL: posts.length,
    ...Object.fromEntries(
      Object.keys(STATUS_CONFIG).map(s => [s, posts.filter(p => p.status === s).length])
    ),
  }

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
        postType: createForm.postType,
        slug: createForm.slug,
        title: createForm.title,
        excerpt: createForm.excerpt,
        body: createForm.body,
        heroImageUrl: createForm.heroImageUrl || null,
        scheduledFor: createForm.scheduledFor || null,
        metaTitle: createForm.metaTitle || null,
        metaDescription: createForm.metaDescription || null,
        authorId: createForm.postType === 'GUEST' ? createForm.authorId || undefined : undefined,
        // LIFE
        spotifyTrack1: createForm.postType === 'LIFE' ? (createForm.spotifyTrack1 || null) : undefined,
        spotifyTrack2: createForm.postType === 'LIFE' ? (createForm.spotifyTrack2 || null) : undefined,
        // GUEST
        faqItems: createForm.postType === 'GUEST' ? (createForm.faqItems || []) : undefined,
        // OUTING
        outingPhotos: createForm.postType === 'OUTING' ? (createForm.outingPhotos || []) : undefined,
        youtubeVideoId:
          (createForm.postType === 'OUTING' || createForm.postType === 'SPOTLIGHT')
            ? (createForm.youtubeVideoId || null)
            : undefined,
      }
      const res = await fetch('/api/admin/guest-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        await reportFailure(res, 'Failed to create post')
        return
      }
      const post = await res.json()
      setPosts(prev => [post, ...prev])
      setShowCreate(false)
      setCreateForm(blankForm())
    } catch {
      setCreateError('Something went wrong')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return
    setLoading(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/guest-posts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        await reportFailure(res, 'Failed to delete post')
        return
      }
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch {
      setError('Failed to delete post')
    } finally {
      setLoading(null)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    setLoading(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/guest-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        await reportFailure(res, 'Failed to update status')
        return
      }
      const updated = await res.json()
      setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
    } catch {
      setError('Failed to update status')
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
        <div className="flex items-center gap-2 flex-wrap">
          {['ALL', ...Object.keys(STATUS_CONFIG)].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-white border-primary'
                  : 'border-slate-200 text-text-secondary hover:border-slate-300'
              }`}
            >
              {STATUS_CONFIG[s]?.label ?? s} ({counts[s] ?? 0})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-primary/30 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-text">New Post</h3>
          {createError && <p className="text-red-600 text-sm">{createError}</p>}

          {/* Post type selector */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Post type</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(POST_TYPE_CONFIG).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCreateForm(f => ({ ...f, postType: k as FormState['postType'] }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    createForm.postType === k
                      ? `${v.color} border-current`
                      : 'border-slate-200 text-text-secondary hover:border-slate-300'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Title *</label>
              <input
                required
                value={createForm.title}
                onChange={e => setCreateForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Is Now the Right Time to Buy in Moreno Valley?"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">URL Slug</label>
              <input
                value={createForm.slug}
                onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="auto-generated-from-title"
              />
            </div>
            {createForm.postType === 'GUEST' && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Author *</label>
                <select
                  required
                  value={createForm.authorId}
                  onChange={e => setCreateForm(f => ({ ...f, authorId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                  <option value="">Select author...</option>
                  {authors.map(a => (
                    <option key={a.id} value={a.id}>{a.displayName}</option>
                  ))}
                </select>
              </div>
            )}
            {createForm.postType !== 'GUEST' && <div />}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
              <select
                value={createForm.status}
                onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Scheduled For</label>
              <input
                type="datetime-local"
                value={createForm.scheduledFor}
                onChange={e => setCreateForm(f => ({ ...f, scheduledFor: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Excerpt *</label>
              <textarea
                required
                rows={2}
                value={createForm.excerpt}
                onChange={e => setCreateForm(f => ({ ...f, excerpt: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="1-2 sentences shown in cards and meta description fallback"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Body (Markdown) *</label>
              <MarkdownEditor
                value={createForm.body}
                onChange={v => setCreateForm(f => ({ ...f, body: v }))}
                minRows={12}
                placeholder="Write here, or paste formatted text from Google Docs / Word…"
              />
            </div>

            {/* LIFE: Spotify tracks */}
            {createForm.postType === 'LIFE' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  What I'm listening to <span className="text-slate-400">(Spotify track IDs)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={createForm.spotifyTrack1}
                    onChange={e => setCreateForm(f => ({ ...f, spotifyTrack1: e.target.value }))}
                    placeholder="Track 1 — Spotify track ID"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <input
                    value={createForm.spotifyTrack2}
                    onChange={e => setCreateForm(f => ({ ...f, spotifyTrack2: e.target.value }))}
                    placeholder="Track 2 — Spotify track ID"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* GUEST: FAQ editor */}
            {createForm.postType === 'GUEST' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  FAQ items <span className="text-slate-400">(optional — emits FAQPage JSON-LD)</span>
                </label>
                <div className="space-y-2">
                  {createForm.faqItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          value={item.question}
                          onChange={e => {
                            const items = [...createForm.faqItems]
                            items[i] = { ...items[i], question: e.target.value }
                            setCreateForm(f => ({ ...f, faqItems: items }))
                          }}
                          placeholder="Question"
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <input
                          value={item.answer}
                          onChange={e => {
                            const items = [...createForm.faqItems]
                            items[i] = { ...items[i], answer: e.target.value }
                            setCreateForm(f => ({ ...f, faqItems: items }))
                          }}
                          placeholder="Answer"
                          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreateForm(f => ({ ...f, faqItems: f.faqItems.filter((_, j) => j !== i) }))}
                        className="text-slate-400 hover:text-red-500 text-sm mt-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCreateForm(f => ({ ...f, faqItems: [...f.faqItems, { question: '', answer: '' }] }))}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add FAQ
                  </button>
                </div>
              </div>
            )}

            {/* OUTING: Photo gallery */}
            {createForm.postType === 'OUTING' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Trip photos <span className="text-slate-400">(each with optional caption)</span>
                </label>
                <div className="space-y-2">
                  {createForm.outingPhotos.map((photo, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-2 space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          value={photo.url}
                          onChange={e => {
                            const photos = [...createForm.outingPhotos]
                            photos[i] = { ...photos[i], url: e.target.value }
                            setCreateForm(f => ({ ...f, outingPhotos: photos }))
                          }}
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setCreateForm(f => ({ ...f, outingPhotos: f.outingPhotos.filter((_, j) => j !== i) }))}
                          className="text-slate-400 hover:text-red-500 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                      <input
                        value={photo.caption ?? ''}
                        onChange={e => {
                          const photos = [...createForm.outingPhotos]
                          photos[i] = { ...photos[i], caption: e.target.value }
                          setCreateForm(f => ({ ...f, outingPhotos: photos }))
                        }}
                        placeholder="Caption (optional)"
                        maxLength={280}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCreateForm(f => ({ ...f, outingPhotos: [...f.outingPhotos, { url: '', caption: '' }] }))}
                    className="text-sm text-primary hover:underline"
                  >
                    + Add photo
                  </button>
                </div>
              </div>
            )}

            {/* OUTING & SPOTLIGHT: YouTube */}
            {(createForm.postType === 'OUTING' || createForm.postType === 'SPOTLIGHT') && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  YouTube video ID <span className="text-slate-400">(the part after ?v=)</span>
                </label>
                <input
                  value={createForm.youtubeVideoId}
                  onChange={e => setCreateForm(f => ({ ...f, youtubeVideoId: e.target.value }))}
                  placeholder="dQw4w9WgXcQ"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Hero Image URL</label>
              <input
                type="url"
                value={createForm.heroImageUrl}
                onChange={e => setCreateForm(f => ({ ...f, heroImageUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Meta Title</label>
              <input
                value={createForm.metaTitle}
                onChange={e => setCreateForm(f => ({ ...f, metaTitle: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="SEO title override"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Meta Description</label>
              <textarea
                rows={2}
                value={createForm.metaDescription}
                onChange={e => setCreateForm(f => ({ ...f, metaDescription: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="SEO meta description"
              />
            </div>
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
              Create Post
            </button>
          </div>
        </form>
      )}

      {/* Posts list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-secondary">No posts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => {
            const statusCfg = STATUS_CONFIG[post.status] ?? STATUS_CONFIG.draft
            const StatusIcon = statusCfg.icon
            return (
              <div key={post.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* Hero thumbnail */}
                  {post.heroImageUrl ? (
                    <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={post.heroImageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-slate-300" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-text text-sm">{post.title}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
                      {post.author ? <span>by {post.author.displayName}</span> : <span className="text-slate-400">John Menke</span>}
                      <span>·</span>
                      <span>{formatDate(post.createdAt)}</span>
                      {post.publishedAt && (
                        <>
                          <span>·</span>
                          <span className="text-green-600">Published {formatDate(post.publishedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {statusCfg.label}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                      className="p-2 text-slate-400 hover:text-text hover:bg-slate-100 rounded-lg transition-colors"
                      title="Expand"
                    >
                      {expandedId === post.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={loading === post.id}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: quick status change */}
                {expandedId === post.id && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50">
                    <p className="text-xs font-medium text-text-secondary mb-3">Change status:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => {
                        const Icon = v.icon
                        return (
                          <button
                            key={k}
                            onClick={() => handleStatusChange(post.id, k)}
                            disabled={loading === post.id || post.status === k}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${v.bg} ${v.color} border-transparent hover:border-current/20`}
                          >
                            {loading === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                            {v.label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-3 text-xs text-text-secondary">
                      <a href={`/${postTypeUrl(post.postType)}/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Eye className="w-3.5 h-3.5" /> View live
                      </a>
                      {post.author && (
                        <>
                          <span className="mx-2">·</span>
                          <a href={`/authors/${post.author.slug}`} target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline">
                            View author page
                          </a>
                        </>
                      )}
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
