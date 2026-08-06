import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Life in MoVal — John Menke',
  description:
    'Observations, outings, and reflections on what makes Moreno Valley a remarkable place to live.',
}

export default async function LifeIndexPage() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: 'LIFE' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })

  return (
    <div className="bg-background min-h-screen">
      <div className="container-max py-12">
        <header className="max-w-2xl mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-text mb-3">Life in MoVal</h1>
          <p className="text-lg text-text-secondary">
            Observations and reflections from John Menke — what's worth noticing, celebrating,
            and doing in Moreno Valley.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-text-secondary">
            Nothing published yet. Check back soon.
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
                    href={`/life/${post.slug}`}
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
                    <Link href={`/life/${post.slug}`} className="hover:text-primary">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-text-secondary mb-4 line-clamp-3">
                    {post.excerpt}
                  </p>
                  {post.publishedAt && (
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
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
