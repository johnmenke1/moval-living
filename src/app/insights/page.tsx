import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Insights — Voices from MoVal Living',
  description:
    'Curated takes from local professionals, business owners, and community voices on Moreno Valley living, working, and growing.',
}

export default async function InsightsIndexPage() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: 'GUEST' },
    orderBy: { publishedAt: 'desc' },
    include: {
      author: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          title: true,
          companyName: true,
          photoUrl: true,
        },
      },
    },
    take: 50,
  })

  return (
    <div className="bg-background min-h-screen">
      <div className="container-max py-12">
        <header className="max-w-2xl mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-text mb-3">Insights</h1>
          <p className="text-lg text-text-secondary">
            Curated takes from local professionals and community voices on life in
            Moreno Valley.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-text-secondary">
            No insights published yet. Check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-white border border-slate-100 rounded-xl overflow-hidden hover:border-primary transition-colors"
              >
                {post.heroImageUrl && (
                  <Link
                    href={`/insights/${post.slug}`}
                    className="block aspect-[16/9] overflow-hidden bg-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.heroImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                )}
                <div className="p-6">
                  <h2 className="text-xl font-bold text-text mb-2">
                    <Link
                      href={`/insights/${post.slug}`}
                      className="hover:text-primary"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-text-secondary mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>

                  <Link
                    href={`/authors/${post.author!.slug}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                      {post.author!.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.author!.photoUrl}
                          alt={post.author!.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                          {post.author!.displayName
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-semibold text-text">
                        {post.author!.displayName}
                      </span>
                      {post.author!.companyName && (
                        <span className="text-xs text-text-secondary">
                          {post.author!.companyName}
                        </span>
                      )}
                    </span>
                  </Link>

                  {post.publishedAt && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-text-secondary">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.publishedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}