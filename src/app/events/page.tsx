import { prisma } from '@/lib/prisma'
import { extractInstagramMedia } from '@/lib/instagram-media'
import { ExternalLink, Calendar } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/social/SocialIcons'
import Link from 'next/link'
import Script from 'next/script'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hour

interface PageProps {
  searchParams: Promise<{ businessId?: string }>
}

/**
 * Server-side: fetch the Instagram embed HTML for posts missing mediaUrl.
 * Cached for 1 hour via Next.js fetch revalidation.
 */
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

export default async function EventsPage({ searchParams }: PageProps) {
  const { businessId } = await searchParams

  const posts = await prisma.socialPost.findMany({
    where: {
      status: 'APPROVED',
      ...(businessId ? { businessId } : {}),
    },
    include: {
      business: { select: { id: true, slug: true, name: true, logo: true, address: true, city: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // For posts with no mediaUrl, fetch the oEmbed HTML server-side so we can
  // render a real Instagram embed. Done in parallel.
  const oembedByPostId = new Map<string, string>()
  await Promise.all(
    posts.map(async (post) => {
      if (!post.mediaUrl) {
        const html = await getOembedHtml(post.postUrl)
        if (html) oembedByPostId.set(post.id, html)
      }
    })
  )

  // Track whether any post needs embed.js so we only load the script once
  const needsEmbedScript = oembedByPostId.size > 0

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
              No posts yet
            </h2>
            <p style={{ color: 'var(--text-secondary, #5a6c72)', marginBottom: '24px' }}>
              Be the first to share a local event or opportunity!
            </p>
            <Link
              href="/submit/social-posts"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Submit a Post
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}