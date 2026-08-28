import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Business Spotlights',
  description:
    'Short-form video spotlights featuring the people and businesses that make Moreno Valley special.',
  alternates: { canonical: 'https://www.moval.living/spotlights' },
}

export default async function SpotlightsIndexPage() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: 'SPOTLIGHT' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })

  // Answer capsule — server-rendered, first ~150 words of HTML.
  // AI engines lift this for queries like 'Moreno Valley business
  // video spotlights'. Shape: count + most recent title.
  const spotlightCount = posts.length
  const spotlightCapsule = spotlightCount === 0
    ? 'Spotlights launches soon — short-form video profiles of the people and businesses that make Moreno Valley special.'
    : `Spotlights are short-form video profiles of the people and businesses that make Moreno Valley special. ${spotlightCount} video${spotlightCount === 1 ? '' : 's'} published so far — newest: “${posts[0].title}”.`

  return (
    <div className="bg-background min-h-screen">
      <div className="container-max py-12">
        <header className="max-w-2xl mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-text mb-3">Business Spotlights</h1>
          <p className="text-lg text-text-secondary mb-6">
            Short-form video spotlights featuring the people and businesses that make Moreno Valley
            worth talking about.
          </p>
          <p className="text-base sm:text-lg text-text leading-relaxed">
            {spotlightCapsule}
          </p>
          {posts.length > 0 && (
            <p className="mt-4 text-sm text-text-secondary">
              Featuring the City of Moreno Valley's{' '}
              <a
                href="https://www.youtube.com/playlist?list=PLmdmVBb42qYhA-xJugxmokFo-xZNVF_1Q"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Spotlight on Moreno Valley Business
              </a>{' '}
              program. Original moval.living video spotlights coming soon.
            </p>
          )}
        </header>

        {posts.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-text-secondary">
            No spotlights published yet. Check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-white border border-slate-100 rounded-xl overflow-hidden hover:border-primary transition-colors"
              >
                {post.heroImageUrl && (
                  <Link
                    href={`/spotlights/${post.slug}`}
                    className="block aspect-video overflow-hidden bg-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.heroImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                )}
                <div className="p-5">
                  <h2 className="text-lg font-bold text-text mb-1">
                    <Link href={`/spotlights/${post.slug}`} className="hover:text-primary">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-text-secondary line-clamp-2">{post.excerpt}</p>
                  {post.publishedAt && (
                    <div className="flex items-center gap-1 text-xs text-text-secondary mt-3">
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
