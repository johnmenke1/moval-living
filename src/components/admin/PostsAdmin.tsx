'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Pencil,
  Trash2,
  ExternalLink,
  Search,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Eye,
} from 'lucide-react'

interface Author {
  id: string
  slug: string
  displayName: string
  photoUrl: string | null
}

interface Post {
  id: string
  slug: string
  title: string
  excerpt: string
  status: 'draft' | 'submitted' | 'in_review' | 'scheduled' | 'published' | 'rejected'
  scheduledFor: string | null
  publishedAt: string | null
  rejectionReason: string | null
  updatedAt: string | Date
  author: Author
}

interface Props {
  initialPosts: Post[]
  authors: Author[]
}

const STATUS_TABS: { key: 'all' | Post['status']; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_review', label: 'In review' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
]

const STATUS_BADGE: Record<Post['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-800',
  in_review: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-purple-100 text-purple-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function PostsAdmin({ initialPosts, authors }: Props) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [tab, setTab] = useState<'all' | Post['status']>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (tab !== 'all' && p.status !== tab) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        p.title.toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q)
      )
    })
  }, [posts, tab, search])

  async function transition(id: string, status: Post['status'], opts?: { scheduledFor?: string; rejectionReason?: string }) {
    setLoading(id)
    try {
      const res = await fetch(`/api/admin/posts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...opts }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || 'Transition failed')
      }
      const updated = await res.json()
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transition failed')
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(post: Post) {
    if (!confirm(`Permanently delete "${post.title}"? This cannot be undone.`)) {
      return
    }
    setLoading(post.id)
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-1 min-w-max px-2" role="tablist">
          {STATUS_TABS.map(({ key, label }) => {
            const count =
              key === 'all'
                ? posts.length
                : posts.filter((p) => p.status === key).length
            const isActive = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-slate-300'
                }`}
              >
                {label}
                {count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold ${
                      isActive ? 'bg-primary text-white' : 'bg-slate-200 text-text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, author, or excerpt"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-sm text-text-secondary">
          {filtered.length} {filtered.length === 1 ? 'post' : 'posts'}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-text-secondary">
          {posts.length === 0
            ? 'No posts yet. Click "New Post" to start one.'
            : 'No posts match this filter.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((post) => (
            <div key={post.id} className="p-4">
              <div className="flex items-start gap-4">
                {/* Author avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                  {post.author.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.author.photoUrl}
                      alt={post.author.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                      {post.author.displayName
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link
                      href={`/dashboard/posts-queue/${post.slug}`}
                      className="font-semibold text-text hover:text-primary"
                    >
                      {post.title}
                    </Link>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[post.status]}`}
                    >
                      {post.status.replace('_', ' ')}
                    </span>
                    {post.scheduledFor && post.status === 'scheduled' && (
                      <span className="text-xs text-text-secondary">
                        → {new Date(post.scheduledFor).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-secondary line-clamp-2">
                    {post.excerpt}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                    <span>by {post.author.displayName}</span>
                    <span>·</span>
                    <span>updated {relativeTime(post.updatedAt)}</span>
                  </div>
                  {post.rejectionReason && (
                    <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1">
                      Rejected: {post.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {post.status === 'published' && (
                    <Link
                      href={`/insights/${post.slug}`}
                      target="_blank"
                      className="p-2 text-text-secondary hover:text-primary"
                      title="View live"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/posts-queue/${post.slug}`}
                    className="p-2 text-text-secondary hover:text-primary"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(post)}
                    disabled={loading === post.id}
                    className="p-2 text-text-secondary hover:text-error disabled:opacity-50"
                    title="Delete"
                  >
                    {loading === post.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Workflow shortcuts */}
              {(post.status === 'draft' || post.status === 'submitted' || post.status === 'in_review') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.status === 'draft' && (
                    <button
                      onClick={() => transition(post.id, 'submitted')}
                      disabled={loading === post.id}
                      className="text-xs px-3 py-1.5 rounded-md bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200 disabled:opacity-50"
                    >
                      <Send className="w-3 h-3 inline mr-1" />
                      Submit for review
                    </button>
                  )}
                  {post.status === 'submitted' && (
                    <button
                      onClick={() => transition(post.id, 'in_review')}
                      disabled={loading === post.id}
                      className="text-xs px-3 py-1.5 rounded-md bg-blue-100 text-blue-800 font-semibold hover:bg-blue-200 disabled:opacity-50"
                    >
                      <Eye className="w-3 h-3 inline mr-1" />
                      Start review
                    </button>
                  )}
                  {(post.status === 'submitted' || post.status === 'in_review') && (
                    <>
                      <button
                        onClick={() => transition(post.id, 'published')}
                        disabled={loading === post.id}
                        className="text-xs px-3 py-1.5 rounded-md bg-green-100 text-green-800 font-semibold hover:bg-green-200 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        Publish
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for rejection (visible to Johnny only):')
                          if (reason) transition(post.id, 'rejected', { rejectionReason: reason })
                        }}
                        disabled={loading === post.id}
                        className="text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-800 font-semibold hover:bg-red-200 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3 inline mr-1" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function relativeTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}