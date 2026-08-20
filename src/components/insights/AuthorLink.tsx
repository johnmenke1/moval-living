'use client'

import Link from 'next/link'

interface AuthorLinkProps {
  slug: string
  displayName: string
  companyName: string | null
  photoUrl: string | null
}

export function AuthorLink({ slug, displayName, companyName, photoUrl }: AuthorLinkProps) {
  const initials = displayName
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <Link
      href={`/authors/${slug}`}
      className="flex items-center gap-2 text-sm group/author"
      onClick={e => e.stopPropagation()}
    >
      <span className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
            {initials}
          </span>
        )}
      </span>
      <span className="flex flex-col">
        <span className="font-semibold text-text group-hover/author:text-primary transition-colors">
          {displayName}
        </span>
        {companyName && <span className="text-xs text-text-secondary">{companyName}</span>}
      </span>
    </Link>
  )
}
