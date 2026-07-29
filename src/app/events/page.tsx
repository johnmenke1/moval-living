'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/social/SocialIcons'
import Link from 'next/link'
import Script from 'next/script'

interface Post {
  id: string
  platform: 'INSTAGRAM' | 'FACEBOOK'
  postUrl: string
  caption?: string | null
  mediaUrl?: string | null
  thumbnailUrl?: string | null
  oembedHtml?: string | null
  authorName?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  eventDate?: string | null
  eventEndDate?: string | null
  createdAt: string
  business?: { id: string; slug: string; name: string; logo?: string | null } | null
}

interface MonthGroup {
  label: string          // "September 2026"
  key: string            // "2026-09"
  posts: Post[]
  isPast: boolean
  isCurrent: boolean
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

function toKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseKey(key: string) {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m }
}

function formatLabel(key: string) {
  const { year, month } = parseKey(key)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function isPastMonth(key: string) {
  const now = new Date()
  const currentKey = toKey(now.getFullYear(), now.getMonth() + 1)
  return key < currentKey
}

function groupPostsByMonth(posts: Post[]): MonthGroup[] {
  const groups: Record<string, Post[]> = {}

  for (const post of posts) {
    if (!post.eventDate) continue
    const d = new Date(post.eventDate)
    const key = toKey(d.getFullYear(), d.getMonth() + 1)
    if (!groups[key]) groups[key] = []
    groups[key].push(post)
  }

  // Sort groups newest-first
  const sortedKeys = Object.keys(groups).sort()

  return sortedKeys.map(key => ({
    label: formatLabel(key),
    key,
    posts: groups[key].sort((a, b) =>
      new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime()
    ),
    isPast: isPastMonth(key),
    isCurrent: key === toKey(new Date().getFullYear(), new Date().getMonth() + 1),
  }))
}

function PostCard({ post, oembedHtml }: { post: Post; oembedHtml?: string | null }) {
  return (
    <article className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Media */}
      {post.mediaUrl ? (
        /\.(mp4|webm|mov|m4v)(\?|$)/i.test(post.mediaUrl) ? (
          <div className="relative aspect-video bg-slate-100 overflow-hidden">
            <video
              src={post.mediaUrl}
              poster={post.thumbnailUrl ?? undefined}
              controls
              playsInline
              className="w-full h-full object-cover"
              preload="metadata"
            />
          </div>
        ) : (
          <div className="aspect-square bg-slate-100 overflow-hidden">
            <img src={post.mediaUrl} alt={post.caption || 'Post'} className="w-full h-full object-cover" />
          </div>
        )
      ) : oembedHtml ? (
        <div
          className="bg-white flex items-center justify-center"
          style={{ minHeight: '320px' }}
          dangerouslySetInnerHTML={{ __html: oembedHtml }}
        />
      ) : (
        <div
          className="aspect-square flex flex-col items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, var(--primary, #007a7f) 0%, var(--secondary, #00405c) 100%)' }}
        >
          {post.platform === 'INSTAGRAM'
            ? <InstagramIcon className="w-12 h-12 text-white/80" />
            : <FacebookIcon className="w-12 h-12 text-white/80" />}
          <span className="text-white/60 text-sm font-medium">
            {post.platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Date badge + platform */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {post.eventDate && (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={{ background: 'var(--primary, #007a7f)', color: '#fff' }}>
              {new Date(post.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {post.eventEndDate && new Date(post.eventEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) !== new Date(post.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                ? ` – ${new Date(post.eventEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : ''}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {post.platform === 'INSTAGRAM' ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E1306C]">
                <InstagramIcon className="w-3.5 h-3.5" /> Instagram
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1877F2]">
                <FacebookIcon className="w-3.5 h-3.5" /> Facebook
              </span>
            )}
          </div>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm mb-4 line-clamp-4" style={{ color: 'var(--text-secondary, #5a6c72)' }}>
            {post.caption}
          </p>
        )}

        {/* Business link */}
        {post.business && (
          <Link
            href={`/business/${post.business.slug}`}
            className="flex items-center gap-2 mb-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {post.business.logo ? (
              <img src={post.business.logo!} alt={post.business.name} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--primary, #007a7f)', opacity: 0.1 }}>
                <span className="text-xs font-bold" style={{ color: 'var(--primary, #007a7f)' }}>{post.business.name[0]}</span>
              </div>
            )}
            <span className="text-sm font-medium text-text truncate">{post.business.name}</span>
          </Link>
        )}

        {/* View original */}
        <a
          href={post.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--primary, #007a7f)' }}
        >
          View Original <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  )
}

export default function EventsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [oembedMap, setOembedMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [embedScriptLoaded, setEmbedScriptLoaded] = useState(false)

  const activeMonth = searchParams.get('month') ?? toKey(new Date().getFullYear(), new Date().getMonth() + 1)

  useEffect(() => {
    setLoading(true)
    fetch('/api/social-posts?status=APPROVED')
      .then(r => r.json())
      .then(async (data: Post[]) => {
        setPosts(data)
        // Fetch oEmbed HTML for posts that need it (no mediaUrl)
        const needsEmbed = data.filter(p => !p.mediaUrl && /instagram\.com\/(?:p|reel|tv|reels?)\//.test(p.postUrl))
        const embeds: Record<string, string> = {}
        await Promise.all(needsEmbed.map(async p => {
          try {
            const res = await fetch(
              `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(p.postUrl)}&maxwidth=540&omitscript=true`
            )
            if (res.ok) {
              const d = await res.json() as { html?: string }
              if (d.html) embeds[p.id] = d.html
            }
          } catch {}
        }))
        setOembedMap(embeds)
        setLoading(false)
      })
  }, [])

  // Month tabs: show current month + up to 3 future months that have events
  const allGroups = groupPostsByMonth(posts)
  const now = new Date()
  const currentKey = toKey(now.getFullYear(), now.getMonth() + 1)

  // Determine which months to show as tabs: current + any future months that have events
  const visibleKeys = [
    ...new Set([
      currentKey,
      ...allGroups
        .filter(g => g.key >= currentKey)
        .map(g => g.key)
    ])
  ].sort()

  // Past months with events also shown (greyed) so user can navigate back
  const pastWithEvents = allGroups.filter(g => g.key < currentKey).map(g => g.key).sort()
  const allTabKeys = [...pastWithEvents, ...visibleKeys].sort()

  function navigateMonth(delta: number) {
    const idx = visibleKeys.indexOf(activeMonth)
    const next = visibleKeys[idx + delta]
    if (next) router.push(`/events?month=${next}`)
  }

  function navigateToMonth(key: string) {
    router.push(`/events?month=${key}`)
  }

  const currentGroup = allGroups.find(g => g.key === activeMonth)

  const hasOEmbed = Object.keys(oembedMap).length > 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background, #f0efeb)' }}>
      {hasOEmbed && !embedScriptLoaded && (
        <Script
          src="//www.instagram.com/embed.js"
          strategy="lazyOnload"
          onLoad={() => setEmbedScriptLoaded(true)}
        />
      )}

      {/* Header */}
      <div style={{ background: 'var(--surface, #fff)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container-max py-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary, #1a2e35)' }}>
            Community Events & Opportunities
          </h1>
          <p style={{ color: 'var(--text-secondary, #5a6c72)', maxWidth: '600px' }}>
            Discover what&apos;s happening in Moreno Valley. Have an event or opportunity?{' '}
            <Link href="/submit/social-posts" className="font-semibold" style={{ color: 'var(--primary, #007a7f)' }}>
              Submit a post
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="container-max py-8">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateMonth(-1)}
              disabled={visibleKeys.indexOf(activeMonth) <= 0}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 overflow-x-auto max-w-[400px] scrollbar-hide">
              {allTabKeys.map(key => {
                const group = allGroups.find(g => g.key === key)
                const isActive = key === activeMonth
                return (
                  <button
                    key={key}
                    onClick={() => navigateToMonth(key)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
                    style={{
                      background: isActive ? 'var(--primary, #007a7f)' : group?.isPast ? '#f1f5f9' : '#e2e8f0',
                      color: isActive ? '#fff' : group?.isPast ? '#94a3b8' : 'var(--text-primary, #1a2e35)',
                    }}
                  >
                    {formatLabel(key)}
                    {group && (
                      <span className="ml-1.5 text-xs opacity-60">({group.posts.length})</span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => navigateMonth(1)}
              disabled={visibleKeys.indexOf(activeMonth) >= visibleKeys.length - 1}
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Past month notice */}
        {currentGroup?.isPast && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-slate-100 text-sm text-slate-500 border border-slate-200">
            This month has passed. Showing events for reference.
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400">Loading events...</p>
          </div>
        ) : !currentGroup ? (
          <div className="text-center py-20" style={{ background: 'var(--surface, #fff)', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#f0f0f0' }}>
              <Calendar className="w-8 h-8" style={{ color: 'var(--text-secondary, #5a6c72)' }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary, #1a2e35)' }}>
              No events this month
            </h2>
            <p style={{ color: 'var(--text-secondary, #5a6c72)', marginBottom: '24px' }}>
              No events scheduled for {formatLabel(activeMonth)}. Check back soon or{' '}
              <Link href="/submit/social-posts" className="font-semibold" style={{ color: 'var(--primary, #007a7f)' }}>
                submit one
              </Link>
              !
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary, #1a2e35)' }}>
                {currentGroup.label}
              </h2>
              <span className="text-sm text-slate-400">{currentGroup.posts.length} event{currentGroup.posts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentGroup.posts.map(post => (
                <PostCard key={post.id} post={post} oembedHtml={oembedMap[post.id]} />
              ))}
            </div>
          </>
        )}

        {/* Undated posts section — always visible at the bottom */}
        {(() => {
          const undated = posts.filter(p => !p.eventDate)
          if (undated.length === 0) return null
          return (
            <div className="mt-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-sm text-slate-400 px-3">Other posts</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {undated.map(post => (
                  <PostCard key={post.id} post={post} oembedHtml={oembedMap[post.id]} />
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
