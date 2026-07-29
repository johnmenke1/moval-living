'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink, Clock, Trash2, RefreshCw, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/social/SocialIcons'

interface Post {
  id: string
  platform: 'INSTAGRAM' | 'FACEBOOK'
  postUrl: string
  caption?: string | null
  mediaUrl?: string | null
  thumbnailUrl?: string | null
  authorName?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  eventDate?: string | null
  eventEndDate?: string | null
  createdAt: string | Date
  business?: { id: string; slug: string; name: string; logo?: string | null } | null
}

interface SocialPostsModerationProps {
  initialPosts: Post[]
}

export default function SocialPostsModeration({ initialPosts }: SocialPostsModerationProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING')
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const filtered = filter === 'ALL' ? posts : posts.filter(p => p.status === filter)

  const moderate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setLoading(id)
    try {
      const res = await fetch(`/api/social-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
      }
    } finally {
      setLoading(null)
    }
  }

  const reextract = async (id: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/social-posts/${id}/extract`, { method: 'POST' })
      const data = await res.json()
      // Update local state with the result
      setPosts(prev => prev.map(p => p.id === id ? { ...p, ...(data.post ?? data.result ?? {}), mediaUrl: data.result?.mediaUrl ?? p.mediaUrl } : p))
    } finally {
      setLoading(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this post permanently?')) return
    setLoading(id)
    try {
      const res = await fetch(`/api/social-posts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id))
      }
    } finally {
      setLoading(null)
    }
  }

  const toggleDateEditor = (id: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveDates = async (id: string, eventDate: string, eventEndDate: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/social-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventDate: eventDate || null,
          eventEndDate: eventEndDate || null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPosts(prev => prev.map(p => p.id === id ? { ...p, eventDate: updated.eventDate, eventEndDate: updated.eventEndDate } : p))
        setExpandedDates(prev => { const next = new Set(prev); next.delete(id); return next })
      }
    } finally {
      setLoading(null)
    }
  }

  const counts = {
    PENDING: posts.filter(p => p.status === 'PENDING').length,
    APPROVED: posts.filter(p => p.status === 'APPROVED').length,
    REJECTED: posts.filter(p => p.status === 'REJECTED').length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary, #1a2e35)' }}>
            Social Post Moderation
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary, #5a6c72)' }}>
            Review submitted posts and approve or reject them
          </p>
        </div>
        <a
          href="/submit/social-posts"
          target="_blank"
          className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          style={{ color: 'var(--primary, #007a7f)' }}
        >
          Submit a Post ↗
        </a>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(f => (
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
            {counts[f as keyof typeof counts] !== undefined && (
              <span
                className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: filter === f ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                }}
              >
                {counts[f as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
          <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}posts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(post => (
            <div
              key={post.id}
              className="bg-white rounded-xl border border-slate-100 p-5"
            >
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                  {post.mediaUrl ? (
                    <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    post.platform === 'INSTAGRAM'
                      ? <InstagramIcon className="w-8 h-8 text-slate-300" />
                      : <FacebookIcon className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {post.platform === 'INSTAGRAM' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E1306C]">
                          <InstagramIcon className="w-3.5 h-3.5" /> Instagram
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1877F2]">
                          <FacebookIcon className="w-3.5 h-3.5" /> Facebook
                        </span>
                      )}
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: post.status === 'PENDING' ? '#fef3c7' : post.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                          color: post.status === 'PENDING' ? '#92400e' : post.status === 'APPROVED' ? '#166534' : '#991b1b',
                        }}
                      >
                        {post.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {post.caption && (
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">{post.caption}</p>
                  )}

                  {post.business && (
                    <p className="text-xs text-slate-500 mb-2">
                      Business: <span className="font-medium">{post.business.name}</span>
                    </p>
                  )}

                  {post.authorName && (
                    <p className="text-xs text-slate-400 mb-2">Submitted by: {post.authorName}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <a
                      href={post.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium hover:underline"
                      style={{ color: 'var(--primary, #007a7f)' }}
                    >
                      View Original <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  {post.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => moderate(post.id, 'APPROVED')}
                        disabled={loading === post.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => moderate(post.id, 'REJECTED')}
                        disabled={loading === post.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                      <button
                        onClick={() => remove(post.id)}
                        disabled={loading === post.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                  {post.status === 'APPROVED' && !post.mediaUrl && (
                    <button
                      onClick={() => reextract(post.id)}
                      disabled={loading === post.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {loading === post.id ? 'Extracting...' : 'Re-extract media'}
                    </button>
                  )}
                  {post.status === 'APPROVED' && (
                    <button
                      onClick={() => moderate(post.id, 'REJECTED')}
                      disabled={loading === post.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  )}
                  <button
                    onClick={() => toggleDateEditor(post.id)}
                    disabled={loading === post.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-50"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {expandedDates.has(post.id) ? 'Cancel' : 'Set Date'}
                  </button>
                </div>
              </div>

              {/* Date editor — inline expandable panel */}
              {expandedDates.has(post.id) && (
                <DateEditor
                  post={post}
                  onSave={(eventDate, eventEndDate) => saveDates(post.id, eventDate, eventEndDate)}
                  onCancel={() => toggleDateEditor(post.id)}
                  loading={loading === post.id}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DateEditor({ post, onSave, onCancel, loading }: {
  post: Post
  onSave: (eventDate: string, eventEndDate: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const formatDateValue = (d: string | null | undefined) => {
    if (!d) return ''
    const date = new Date(d)
    return date.toISOString().split('T')[0]
  }

  const [eventDate, setEventDate] = useState(formatDateValue(post.eventDate))
  const [eventEndDate, setEventEndDate] = useState(formatDateValue(post.eventEndDate))

  return (
    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <p className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" />
        Set Event Date(s) — determines where this post appears on the calendar
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-amber-600 mb-1">Start Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs text-amber-600 mb-1">End Date <span className="font-normal">(optional)</span></label>
          <input
            type="date"
            value={eventEndDate}
            onChange={e => setEventEndDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(eventDate, eventEndDate)}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Dates'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
