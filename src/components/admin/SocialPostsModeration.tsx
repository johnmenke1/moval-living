'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink, Clock, Trash2 } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/social/SocialIcons'

interface Post {
  id: string
  platform: 'INSTAGRAM' | 'FACEBOOK'
  postUrl: string
  caption?: string | null
  mediaUrl?: string | null
  authorName?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
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
        setPosts(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      }
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
                {post.status === 'PENDING' && (
                  <div className="flex flex-col gap-2 shrink-0">
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
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
