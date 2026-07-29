import { prisma } from '@/lib/prisma'
import { extractInstagramMedia } from '@/lib/instagram-media'
import { ExternalLink, Calendar, Clock } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/social/SocialIcons'
import Link from 'next/link'
import Script from 'next/script'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hour

interface PageProps {
  searchParams: Promise<{ businessId?: string; view?: string }>
}

type View = 'upcoming' | 'all' | 'past' | 'undated'

async function getOembedHtml(postUrl: string): Promise<string | null> {
  if (!/instagram\.com\/(?:p|reel|tv|reels?)\//.test(postUrl)) return null
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&maxwidth=540&omitscript=true`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { html?: string }
    return data.html ?? null
  } catch {
    return null
  }
}

function formatEventDate(d: Date): string {
  // UTC-pinned to avoid hydration mismatches (systematic-debugging pitfall #1)
  const month = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  return `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export default async function EventsPage({ searchParams }: PageProps) {
  const { businessId, view: rawView } = await searchParams
  const view: View = (['upcoming', 'all', 'past', 'undated'] as View[]).includes(rawView as View)
    ? (rawView as View)
    : 'upcoming'

  const today = startOfDayUTC(new Date())

  // ── Data fetch ─────────────────────────────────────────────────────
  // Pull all approved posts. Filter + sort in JS (set is small enough).
  const allPosts = await prisma.socialPost.findMany({
    where: {
      status: 'APPROVED',
      ...(businessId ? { businessId } : {}),
    },
    include: {
      business: { select: { id: true, slug: true, name: true, logo: true, address: true, city: true } },
    },
  })

  const dated = allPosts.filter(p => p.eventDate)
  const undated = allPosts.filter(p => !p.eventDate)
  const upcoming = dated
    .filter(p => startOfDayUTC(p.eventDate!).getTime() >= today.getTime())
    .sort((a, b) => a.eventDate!.getTime() - b.eventDate!.getTime())
  const past = dated
    .filter(p => startOfDayUTC(p.eventDate!).getTime() < today.getTime())
    .sort((a, b) => b.eventDate!.getTime() - a.eventDate!.getTime())
  const allDated = [...upcoming, ...past] // sorted by eventDate ascending

  // ── Pick the set to render based on view ───────────────────────────
  let posts: typeof allPosts
  let groupByMonth = false
  let emptyMessage = 'No posts yet'

  switch (view) {
    case 'upcoming':
      posts = upcoming
      emptyMessage = 'No upcoming events'
      break
    case 'past':
      posts = past
      groupByMonth = true
      emptyMessage = 'No past events'
      break
    case 'undated':
      posts = undated
      emptyMessage = 'No undated posts'
      break
    case 'all':
    default:
      posts = allDated
      groupByMonth = true
      emptyMessage = 'No events yet'
      break
  }

  // ── Fetch oEmbed HTML for posts missing mediaUrl (only for views that render cards) ──
  const oembedByPostId = new Map<string, string>()
  await Promise.all(
    posts.map(async (post) => {
      if (!post.mediaUrl) {
        const html = await getOembedHtml(post.postUrl)
        if (html) oembedByPostId.set(post.id, html)
      }
    })
  )
  const needsEmbedScript = oembedByPostId.size > 0

  // ── Group by month if applicable ───────────────────────────────────
  const groups: { key: string; label: string; posts: typeof posts }[] = []
  if (groupByMonth) {
    const byKey = new Map<string, { label: string; posts: typeof posts }>()
    for (const post of posts) {
      const d = post.eventDate!
      const key = monthKey(d)
      if (!byKey.has(key)) {
        byKey.set(key, { label: monthLabel(d), posts: [] as typeof posts })
      }
      byKey.get(key)!.posts.push(post)
    }
    for (const [key, value] of byKey) {
      groups.push({ key, label: value.label, posts: value.posts })
    }
  }

  // ── Counts for tab badges ──────────────────────────────────────────
  const counts = {
    upcoming: upcoming.length,
    all: allDated.length,
    past: past.length,
    undated: undated.length,
  }

  const tabs: { id: View; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'all', label: 'All Events', count: counts.all },
    { id: 'past', label: 'Past Events', count: counts.past },
    { id: 'undated', label: 'Posts', count: counts.undated },
  ]

  // Helper to render a single post card
  const renderCard = (post: typeof posts[number]) => (
    <article
      key={post.id}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Media: mediaUrl → image/video; oembed HTML → Instagram embed; fallback → gradient */}
      {post.mediaUrl ? (
        /\.(mp4|webm|mov|m4v)(\?|$)/i.test(post.mediaUrl) ? (
          <div className="aspect-square bg-slate-100 overflow-hidden">
            <video
              src={post.mediaUrl}
              controls
              playsInline
              className="w-full h-full object-cover"
              preload="metadata"
            />
          </div>
        ) : (
          <div className="aspect-square bg-slate-100 overflow-hidden">
            <img
              src={post.mediaUrl}
              alt={post.caption || 'Social post'}
              className="w-full h-full object-cover"
            />
          </div>
        )
      ) : oembedByPostId.has(post.id) ? (
        <div
          className="bg-white flex items-center justify-center"
          style={{ minHeight: '320px' }}
          dangerouslySetInnerHTML={{ __html: oembedByPostId.get(post.id)! }}
        />
      ) : (
        <div
          className="aspect-square flex flex-col items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, var(--primary, #007a7f) 0%, var(--secondary, #00405c) 100%)' }}
        >
          {post.platform === 'INSTAGRAM' ? (
            <InstagramIcon className="w-12 h-12 text-white/80" />
          ) : (
            <FacebookIcon className="w-12 h-12 text-white/80" />
          )}
          <span className="text-white/60 text-sm font-medium">
            {post.platform === 'INSTAGRAM' ? 'Instagram' : 'Facebook'}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Event date badge */}
        {post.eventDate && (
          <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-1 bg-primary/10 rounded-md">
            <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--primary, #007a7f)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--primary, #007a7f)' }}>
              {formatEventDate(post.eventDate)}
            </span>
          </div>
        )}
        {!post.eventDate && (
          <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-1 bg-slate-100 rounded-md">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-500">No event date</span>
          </div>
        )}

        {/* Platform + author */}
        <div className="flex items-center gap-2 mb-3">
          {post.platform === 'INSTAGRAM' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E1306C]">
              <InstagramIcon className="w-3.5 h-3.5" /> Instagram
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1877F2]">
              <FacebookIcon className="w-3.5 h-3.5" /> Facebook
            </span>
          )}
          {post.authorName && (
            <span className="text-xs text-slate-400">• {post.authorName}</span>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p
            className="text-sm mb-4 line-clamp-4"
            style={{ color: 'var(--text-secondary, #5a6c72)' }}
          >
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
              <img
                src={post.business.logo}
                alt={post.business.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary, #007a7f)', opacity: 0.1 }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--primary, #007a7f)' }}>
                  {post.business.name[0]}
                </span>
              </div>
            )}
            <span className="text-sm font-medium text-text truncate">
              {post.business.name}
            </span>
          </Link>
        )}

        {/* View original link */}
        <a
          href={post.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--primary, #007a7f)' }}
        >
          View Original Post <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </article>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--background, #f0efeb)' }}>
      {/* Instagram's embed.js — only loaded when we have at least one oEmbed card */}
      {needsEmbedScript && (
        <Script
          src="//www.instagram.com/embed.js"
          strategy="lazyOnload"
        />
      )}

      {/* Header */}
      <div style={{ background: 'var(--surface, #fff)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container-max py-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary, #1a2e35)' }}>
            Community Events & Opportunities
          </h1>
          <p style={{ color: 'var(--text-secondary, #5a6c72)', maxWidth: '600px' }}>
            Discover what&apos;s happening in Moreno Valley — curated from local businesses and community
            members. Have an event or opportunity?{' '}
            <Link href="/submit/social-posts" className="font-semibold" style={{ color: 'var(--primary, #007a7f)' }}>
              Submit a post
            </Link>
            .
          </p>
        </div>

        {/* Tabs */}
        <div className="container-max">
          <div className="flex gap-1 -mb-px">
            {tabs.map(tab => {
              const isActive = view === tab.id
              const href = tab.id === 'upcoming' ? '/events' : `/events?view=${tab.id}`
              return (
                <Link
                  key={tab.id}
                  href={href}
                  className="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
                  style={{
                    color: isActive ? 'var(--primary, #007a7f)' : 'var(--text-secondary, #5a6c72)',
                    borderBottomColor: isActive ? 'var(--primary, #007a7f)' : 'transparent',
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive ? 'var(--primary, #007a7f)' : '#e2e8f0',
                        color: isActive ? '#fff' : 'var(--text-secondary, #5a6c72)',
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container-max py-8">
        {posts.length === 0 ? (
          <div className="text-center py-20" style={{ background: 'var(--surface, #fff)', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#f0f0f0' }}
            >
              <Calendar className="w-8 h-8" style={{ color: 'var(--text-secondary, #5a6c72)' }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary, #1a2e35)' }}>
              {emptyMessage}
            </h2>
            <p style={{ color: 'var(--text-secondary, #5a6c72)', marginBottom: '24px' }}>
              Have an event or opportunity to share?
            </p>
            <Link
              href="/submit/social-posts"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Submit a Post
            </Link>
          </div>
        ) : groupByMonth ? (
          // Grouped by month
          <div className="space-y-10">
            {groups.map(group => (
              <section key={group.key}>
                <h2
                  className="text-xl font-bold mb-4 pb-2 border-b"
                  style={{ color: 'var(--text-primary, #1a2e35)', borderColor: '#e2e8f0' }}
                >
                  {group.label}
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    ({group.posts.length} {group.posts.length === 1 ? 'event' : 'events'})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.posts.map(renderCard)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          // Single flat grid (Upcoming and Posts views)
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  )
}