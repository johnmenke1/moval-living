import { prisma } from '@/lib/prisma'
import { ExternalLink, Calendar } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/social/SocialIcons'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ businessId?: string }>
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--background, #f0efeb)' }}>
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
                {/* Media */}
                {post.mediaUrl ? (
                  <div className="aspect-square bg-slate-100 overflow-hidden">
                    <img
                      src={post.mediaUrl}
                      alt={post.caption || 'Social post'}
                      className="w-full h-full object-cover"
                    />
                  </div>
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
