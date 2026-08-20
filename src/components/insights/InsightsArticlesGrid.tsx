import Link from 'next/link'
import { Calendar, ArrowRight } from 'lucide-react'

interface InsightsAuthor {
  id: string
  slug: string
  displayName: string
  title: string | null
  companyName: string | null
  photoUrl: string | null
}

interface InsightsPost {
  slug: string
  title: string
  excerpt: string
  heroImageUrl: string | null
  publishedAt: Date | null
  author: InsightsAuthor | null
}

interface InsightsArticlesGridProps {
  posts: InsightsPost[]
}

function formatDate(date: Date | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function AuthorLine({ author }: { author: InsightsAuthor | null }) {
  if (!author) return null

  const initials = author.displayName
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Link
      href={`/authors/${author.slug}`}
      className="flex items-center gap-2 text-sm group/author"
      onClick={e => e.stopPropagation()}
    >
      <span className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
        {author.photoUrl ? (
          <img
            src={author.photoUrl}
            alt={author.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
            {initials}
          </span>
        )}
      </span>
      <span className="flex flex-col">
        <span className="font-semibold text-text group-hover/author:text-primary transition-colors">
          {author.displayName}
        </span>
        {author.companyName && (
          <span className="text-xs text-text-secondary">{author.companyName}</span>
        )}
      </span>
    </Link>
  )
}

export function InsightsArticlesGrid({ posts }: InsightsArticlesGridProps) {
  if (posts.length === 0) {
    return (
      <div className="container-max py-24 text-center">
        <p className="text-lg text-text-secondary">
          No insights published yet. Check back soon.
        </p>
      </div>
    )
  }

  const [featured, ...rest] = posts

  return (
    <section id="insights-articles" className="bg-background py-16 sm:py-24">
      <div className="container-max">
        {/* Section masthead */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 sm:mb-16">
          <div>
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-primary mb-2 block">
              Expert Perspectives
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-text font-heading">
              Voices from the community
            </h2>
          </div>
          <p className="text-text-secondary max-w-md text-base sm:text-lg leading-relaxed">
            Local leaders share what they see happening in their industries and neighborhoods.
          </p>
        </div>

        {/* Featured post */}
        {featured && (
          <article className="group relative overflow-hidden bg-surface border border-slate-100 rounded-2xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 mb-10 sm:mb-14">
            <Link href={`/insights/${featured.slug}`} className="block">
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
                    <span>Featured Insight</span>
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
                  <div className="flex flex-wrap items-center gap-4">
                    <AuthorLine author={featured.author} />
                    {featured.publishedAt && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Calendar className="w-4 h-4" />
                        <time dateTime={new Date(featured.publishedAt).toISOString()}>
                          {formatDate(featured.publishedAt)}
                        </time>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                    Read the insight
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
            {rest.map(post => (
              <article
                key={post.slug}
                className="group relative overflow-hidden bg-surface border border-slate-100 rounded-2xl transition-all duration-500 hover:shadow-xl hover:-translate-y-1 flex flex-col"
              >
                <Link href={`/insights/${post.slug}`} className="block h-full flex flex-col">
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
                    <div className="mt-4">
                      <AuthorLine author={post.author} />
                    </div>
                    {post.publishedAt && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-text-secondary">
                        <Calendar className="w-4 h-4" />
                        <time dateTime={new Date(post.publishedAt).toISOString()}>
                          {formatDate(post.publishedAt)}
                        </time>
                      </div>
                    )}
                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      Read the insight
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
