'use client'

import Link from 'next/link'
import { Calendar, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface Outing {
  slug: string
  title: string
  excerpt: string
  heroImageUrl: string | null
  publishedAt: Date | null
}

interface OutingsMagazineGridProps {
  posts: Outing[]
}

function formatDate(date: Date | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function Card({
  post,
  size,
}: {
  post: Outing
  size: 'featured' | 'wide' | 'standard'
}) {
  const isFeatured = size === 'featured'
  const isWide = size === 'wide'

  const image = (
    <>
      {post.heroImageUrl ? (
        <div
          className={[
            'overflow-hidden bg-slate-100',
            isFeatured ? 'aspect-[4/3] md:aspect-auto md:absolute md:inset-0' : 'aspect-[16/10]',
          ].join(' ')}
        >
          <img
            src={post.heroImageUrl}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading={size === 'featured' ? 'eager' : 'lazy'}
          />
          {isFeatured && <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/30 to-transparent" />}
        </div>
      ) : null}
    </>
  )

  const content: ReactNode = (
    <>
      {isFeatured ? (
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm w-fit">
            <span className="text-xs font-bold tracking-widest uppercase text-white">Latest Dispatch</span>
          </div>
          <h3
            className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-3"
            style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
          >
            {post.title}
          </h3>
          <p className="text-white/80 text-base sm:text-lg line-clamp-3 leading-relaxed">
            {post.excerpt}
          </p>
          {post.publishedAt && (
            <div className="flex items-center gap-2 mt-4 text-sm text-white/70">
              <Calendar className="w-4 h-4" />
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {formatDate(post.publishedAt)}
              </time>
            </div>
          )}
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white w-fit">
            <span>Read the full story</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-primary mb-3">
            <span className="w-8 h-[2px] bg-primary" />
            <span>Outing</span>
          </div>
          <h3
            className="text-xl sm:text-2xl font-bold leading-tight mb-2"
            style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
          >
            {post.title}
          </h3>
          <p className="text-text-secondary text-sm sm:text-base line-clamp-3 leading-relaxed flex-grow">
            {post.excerpt}
          </p>
          {post.publishedAt && (
            <div className="flex items-center gap-2 mt-4 text-sm text-text-secondary">
              <Calendar className="w-4 h-4" />
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {formatDate(post.publishedAt)}
              </time>
            </div>
          )}
          <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
            Read the story
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}
    </>
  )

  return (
    <Link
      href={`/outings/${post.slug}`}
      className="block h-full"
    >
      {image}
      {content}
    </Link>
  )
}

/**
 * Magazine layout assigns each card a role based on its index.
 *
 * Pattern for the first 3 posts:
 *   [ featured (8 cols, 2 rows) ] [ wide (4 cols) ]
 *   [                             ] [ wide (4 cols) ]
 *
 * Remaining posts render as 4-column standard cards below.
 */
function cardRole(index: number): 'featured' | 'wide' | 'standard' {
  if (index === 0) return 'featured'
  if (index === 1 || index === 2) return 'wide'
  return 'standard'
}

function cardClass(index: number): string {
  const role = cardRole(index)
  if (role === 'featured') return 'md:col-span-8 md:row-span-2'
  if (role === 'wide') return 'md:col-span-4'
  return 'md:col-span-4'
}

export function OutingsMagazineGrid({ posts }: OutingsMagazineGridProps) {
  if (posts.length === 0) {
    return (
      <div className="container-max py-24 text-center">
        <p className="text-lg text-text-secondary">No outings published yet. Check back soon.</p>
      </div>
    )
  }

  return (
    <section id="outings-grid" className="bg-background py-16 sm:py-24">
      <div className="container-max">
        {/* Section masthead */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 sm:mb-16">
          <div>
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-2 block">
              Recent Dispatches
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text font-heading">
              Where curiosity leads
            </h2>
          </div>
          <p className="text-text-secondary max-w-md text-base sm:text-lg leading-relaxed">
            Each outing is a short escape — by car, by train, or by trail — from Moreno Valley to somewhere worth remembering.
          </p>
        </div>

        {/* Magazine staggered grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 auto-rows-fr">
          {posts.map((post, index) => {
            const size = cardRole(index)
            const wrapperClass = cardClass(index)

            return (
              <article
                key={post.slug}
                className={[
                  'group relative overflow-hidden bg-surface border border-slate-100 rounded-2xl transition-all duration-500',
                  'hover:shadow-2xl hover:-translate-y-1',
                  wrapperClass,
                ].join(' ')}
              >
                <Card post={post} size={size} />
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
