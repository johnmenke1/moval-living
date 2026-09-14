import Link from 'next/link'
import { Tag, Calendar, Sparkles } from 'lucide-react'

// Public deal card — used on /deals. Renders ONE card per Deal row
// (one business with 3 deals → 3 cards). This replaces the per-
// business BusinessCard that the legacy /deals page used (one card per
// business, regardless of how many coupons they had).

export interface DealPublicBusiness {
  id: string
  slug: string
  name: string
  tagline: string | null
  logo: string | null
  coverImage: string | null
  category: { name: string; slug: string }
  _count: { reviews: number }
}

export interface DealPublic {
  id: string
  headline: string
  description: string | null
  code: string | null
  imageUrl: string | null
  startsAt: string | Date | null
  expiresAt: string | Date | null
  isActive: boolean
  business: DealPublicBusiness
}

interface Props {
  deal: DealPublic
}

function formatExpiresAt(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function DealCardPublic({ deal }: Props) {
  const expiresLabel = formatExpiresAt(deal.expiresAt)
  const startsLabel = formatExpiresAt(deal.startsAt)

  return (
    <Link
      href={`/business/${deal.business.slug}#deal-${deal.id}`}
      className="block card group"
      id={`deal-${deal.id}`}
    >
      {/* Image: deal image takes priority, fall back to business cover,
          then to a logo placeholder. Same priority rule as BusinessCard. */}
      <div className="relative w-full h-44 rounded-t-xl overflow-hidden bg-slate-100">
        {deal.imageUrl || deal.business.coverImage || deal.business.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.imageUrl || deal.business.coverImage || deal.business.logo || ''}
            alt={`${deal.headline} — ${deal.business.name}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
            <span className="text-4xl font-bold text-primary/30">{deal.business.name[0]}</span>
          </div>
        )}
        {/* Deal pill — top-right, mirrors the pattern from BusinessCard */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">
          <Tag className="w-3 h-3" />
          Deal
        </div>
      </div>

      <div className="p-5">
        {/* Business line — category + name. Keeps the click-through
            context obvious without crowding the headline. */}
        <p className="text-xs text-primary font-medium mb-1">
          {deal.business.category.name}
        </p>

        <h3 className="font-bold text-text text-lg leading-tight mb-2 group-hover:text-primary transition-colors">
          {deal.headline}
        </h3>

        {/* Business name as the secondary line — links back to the
            business's listing. Kept under the headline because that's
            the user's primary scan point. */}
        <p className="text-sm text-text-secondary mb-3">
          from <span className="font-medium text-text">{deal.business.name}</span>
        </p>

        {deal.description && (
          <p className="text-sm text-text-secondary line-clamp-2 mb-3">
            {deal.description}
          </p>
        )}

        {/* Code + expiry — the action surface. Code renders as a
            monospaced pill so it copies cleanly. ExpiresAt only
            rendered when set (evergreen deals stay quiet). */}
        <div className="flex flex-wrap items-center gap-2">
          {deal.code && (
            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-text font-mono font-bold text-sm px-3 py-1.5 rounded-lg border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              {deal.code}
            </span>
          )}
          {expiresLabel && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="w-3.5 h-3.5" />
              {startsLabel ? `${startsLabel} – ${expiresLabel}` : `Ends ${expiresLabel}`}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
