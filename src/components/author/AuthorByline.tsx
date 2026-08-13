import Link from 'next/link'
import { Calendar, Building2 } from 'lucide-react'

// Shared byline component for /life and /insights post pages.
// Both pages render the same author card structure:
//   - clickable card → /authors/[author.slug]
//   - author photo (or initials fallback)
//   - author name (bold, link-colored)
//   - author.title (the line under the name, e.g. "Founder, moval.living.")
//   - author.companyName (small line with Building2 icon)
//   - publish date on the right (desktop only)
//
// Centralizing here means a fix to one place propagates to both post
// surfaces. Before this existed, /life had a hardcoded "John Menke /
// eXP of California Realty" block that wasn't linked anywhere, so
// readers couldn't click through to the author page.

interface Author {
  slug: string
  displayName: string
  title: string | null
  companyName: string | null
  photoUrl: string | null
}

interface AuthorBylineProps {
  author: Author
  publishedAt: Date | null | undefined
  variant?: 'header' | 'footer'
}

export default function AuthorByline({ author, publishedAt, variant = 'header' }: AuthorBylineProps) {
  const initials = author.displayName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const dateStr = publishedAt
    ? new Date(publishedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const authorHref = `/authors/${author.slug}`

  if (variant === 'footer') {
    // Footer variant — large clickable card with photo, "About the author"
    // label, name, title, and a chevron affordance. Mirrors the
    // /life post footer byline for visual consistency.
    return (
      <Link
        href={authorHref}
        className="flex items-center gap-4 group p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-primary transition-colors w-full"
      >
        <div className="w-16 h-16 rounded-full bg-primary overflow-hidden flex-shrink-0">
          {author.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.photoUrl}
              alt={author.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">
            About the author
          </div>
          <div className="text-lg font-semibold text-text group-hover:text-primary transition-colors">
            {author.displayName}
          </div>
          {author.title && (
            <div className="text-sm text-text-secondary">{author.title}</div>
          )}
        </div>
        <svg
          className="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    )
  }

  // Default header variant — full clickable byline card at the top.
  return (
    <Link
      href={authorHref}
      className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-primary transition-colors"
    >
      <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
        {author.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.photoUrl}
            alt={author.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-semibold">
            {initials}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-text">{author.displayName}</div>
        {author.title && (
          <div className="text-sm text-text-secondary">{author.title}</div>
        )}
        {author.companyName && (
          <div className="text-xs text-text-secondary inline-flex items-center gap-1 mt-0.5">
            <Building2 className="w-3 h-3" />
            {author.companyName}
          </div>
        )}
      </div>
      {dateStr && (
        <div className="text-xs text-text-secondary hidden sm:block">
          <Calendar className="w-3 h-3 inline mr-1" />
          {dateStr}
        </div>
      )}
    </Link>
  )
}