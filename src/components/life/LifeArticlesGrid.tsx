import Link from 'next/link'
import { Calendar, ArrowRight } from 'lucide-react'

interface LifePost {
  slug: string
  title: string
  excerpt: string
  heroImageUrl: string | null
  publishedAt: Date | null
}

interface LifeArticlesGridProps {
  posts: LifePost[]
}

function formatDate(date: Date | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function LifeArticlesGrid({ posts }: LifeArticlesGridProps) {
  if (posts.length === 0) {
    return (
      <div className="container-max py-24 text-center">
        <p className="text-lg text-text-secondary">Nothing published yet. Check back soon.</p>
      </div>
    )
  }

  const [featured, ...rest] = posts

  return (
    <section id="life-articles" className="bg-background py-16 sm:py-24">
      <div className="container-max">
        {/* Section masthead */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 sm:mb-16">
          <div>
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-2 block">
              Latest Essays
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text font-heading">
              From the notebook
            </h2>
          </div>
          <p className="text-text-secondary max-w-md text-base sm:text-lg leading-relaxed">
            Thoughts on place, community, and the small details that make Moreno Valley feel like home.
          </p>
        </div>

        {/* Featured post */}
        {featured && (
          <article className="group relative overflow-hidden bg-surface border border-slate-100 rounded-2xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 mb-10 sm:mb-14">
            <Link href={`/life/${featured.slug}`} className="block">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {featured.heroImageUrl && (
                  <div className="aspect-[16/10] lg:aspect-auto overflow-hidden bg-slate-100">
                    <img
                      src={featured.heroImageUrl}
                      alt={featured.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="eager"
                    />
                  </div>
                )}
                <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-primary mb-3">
                    <span className="w-8 h-[2px] bg-primary" />
                    <span>Featured Essay</span>
                  </div>
                  <h3
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4 text-text"
                    style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
                  >
                    {featured.title}
                  </h3>
                  <p className="text-text-secondary text-base sm:text-lg leading-relaxed line-clamp-4 mb-5">
                    {featured.excerpt}
                  </p>
                  {featured.publishedAt && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Calendar className="w-4 h-4" />
                      <time dateTime={new Date(featured.publishedAt).toISOString()}>
                        {formatDate(featured.publishedAt)}
                      </time>
                    </div>
                  )}
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                    Read the essay
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          </article>
        )}

        {/* Remaining posts grid */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {rest.map((post) => (
              <article
                key={post.slug}
                className="group relative overflow-hidden bg-surface border border-slate-100 rounded-2xl transition-all duration-500 hover:shadow-xl hover:-translate-y-1 flex flex-col"
              >
                <Link href={`/life/${post.slug}`} className="block h-full flex flex-col">
                  {post.heroImageUrl && (
                    <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                      <img
                        src={post.heroImageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-5 sm:p-6 flex flex-col flex-grow">
                    <h3
                      className="text-xl sm:text-2xl font-bold leading-tight mb-2 text-text"
                      style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
                    >
                      {post.title}
                    </h3>
                    <p className="text-text-secondary text-sm sm:text-base leading-relaxed line-clamp-3 flex-grow">
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
                      Read the essay
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
