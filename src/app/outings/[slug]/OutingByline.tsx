import Link from 'next/link'

interface OutingAuthor {
  slug: string
  displayName: string
  title: string | null
  companyName: string | null
  photoUrl: string | null
}

interface Props {
  author: OutingAuthor | null
}

/**
 * Byline block at the bottom of an Outings article.
 *
 * Matches the /life article pattern (commit 8c4c798 / 14c2... — see
 * LifePostContent.tsx for the canonical shape):
 *  - When the post has a GuestAuthor: full clickable card linking to
 *    /authors/<slug>, with avatar, "About the author" eyebrow, name,
 *    title, chevron, and hover state
 *  - When the post has no author (the common case for OUTING posts
 *    written by John Menke): non-link card with his initials + name +
 *    company line, no link
 */
export default function OutingByline({ author }: Props) {
  return (
    <footer className="container-max mt-12">
      <div className="max-w-3xl">
        <div className="pt-8 border-t border-slate-200 mb-24">
          <div className="flex items-center gap-4">
            {author ? (
              <Link
                href={`/authors/${author.slug}`}
                className="flex items-center gap-4 group p-3 -m-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-primary transition-colors w-full"
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
                    <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                      {author.displayName
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
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
                    <div className="text-sm text-text-secondary">
                      {author.title}
                    </div>
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
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  JM
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">
                    About the author
                  </div>
                  <div className="text-lg font-semibold text-text">John Menke</div>
                  <div className="text-sm text-text-secondary">
                    eXP of California Realty · Moreno Valley
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}