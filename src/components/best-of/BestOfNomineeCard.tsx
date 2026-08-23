import Link from 'next/link'
import { MapPin, Star, Award, Trophy, Sparkles, Languages } from 'lucide-react'
import { cn, averageRating } from '@/lib/utils'
import { publicDescription, publicAddress } from '@/lib/display'

interface NomineeCardProps {
  business: {
    id: string
    slug: string
    name: string
    tagline: string | null
    description: string
    address: string
    tier: string
    status: string
    logo: string | null
    coverImage: string | null
    photos: string[]
    category: { name: string; slug: string }
    reviews: Array<{ rating: number }>
    _count?: { reviews: number }
    hasCoupon?: boolean
    googleRating?: number | null
    googleReviewCount?: number | null
    isBestOfWinner?: boolean
    isExpertPartner?: boolean
    foundingPartnerSince?: string | Date | null
    seHablaEspanol?: boolean
    chamberMember?: boolean
    hispanicChamberMember?: boolean
  }
  variant?: 'winner' | 'nominee'
  rank?: number
  notes?: string | null
}

export function BestOfNomineeCard({ business, variant = 'nominee', rank, notes }: NomineeCardProps) {
  const rating = averageRating(business.reviews)
  const reviewCount = business._count?.reviews ?? business.reviews.length
  const isFeatured = business.tier === 'FEATURED' || business.tier === 'EXPERT_PARTNER'
  const isWinner = variant === 'winner'

  const chamberAffiliation = business.chamberMember && business.hispanicChamberMember
    ? 'Chamber & Hispanic Chamber member'
    : business.chamberMember
    ? 'Chamber member'
    : business.hispanicChamberMember
    ? 'Hispanic Chamber member'
    : null

  const hasRatings = rating > 0 || business.googleRating != null

  return (
    <Link
      href={`/business/${business.slug}`}
      className={cn(
        'group block overflow-hidden transition-all hover:-translate-y-0.5',
        isWinner
          ? 'bg-white rounded-3xl border-2 border-amber-300 shadow-xl hover:shadow-2xl'
          : isFeatured
          ? 'card-featured'
          : 'card'
      )}
    >
      <div className={cn('relative w-full overflow-hidden bg-slate-100', isWinner ? 'h-56 sm:h-72' : 'h-44 rounded-t-xl')}>
        {business.coverImage || business.logo || business.photos[0] ? (
          <img
            src={business.coverImage || business.logo || business.photos[0]}
            alt={business.name}
            className={cn(
              'w-full h-full transition-transform duration-300 group-hover:scale-105',
              !business.coverImage && business.logo ? 'object-contain p-6' : 'object-cover'
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
            <span className="text-4xl font-bold text-primary/30">{business.name[0]}</span>
          </div>
        )}

        {business.logo && business.coverImage && (
          <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl border-2 border-white shadow-md overflow-hidden bg-white">
            <img src={business.logo} alt={`${business.name} logo`} className="w-full h-full object-contain" />
          </div>
        )}

        {/* Winner badge */}
        {isWinner && (
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-gradient-to-br from-amber-400 to-amber-600 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg border border-amber-300">
            <Trophy className="w-4 h-4" />
            Best Of Winner
          </div>
        )}

        {/* Rank chip for nominees */}
        {!isWinner && typeof rank === 'number' && rank > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-slate-800/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            #{rank}
          </div>
        )}

        {/* Featured pill */}
        {!isWinner && isFeatured && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <Award className="w-3 h-3" />
            Featured
          </div>
        )}
      </div>

      <div className={cn('p-5', isWinner && 'sm:p-6')}>
        {(business.isBestOfWinner || business.isExpertPartner || business.seHablaEspanol) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {business.isBestOfWinner && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50/80 text-amber-800 border border-amber-200">
                <Trophy className="w-3 h-3" />
                Best of MoVal
              </span>
            )}
            {business.isExpertPartner && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/25">
                {business.foundingPartnerSince ? <Sparkles className="w-3 h-3" /> : <Award className="w-3 h-3" />}
                Expert Partner
              </span>
            )}
            {business.seHablaEspanol && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25">
                <Languages className="w-3 h-3" />
                Español
              </span>
            )}
          </div>
        )}

        <h3 className={cn('font-bold text-text leading-tight mb-2', isWinner ? 'text-2xl sm:text-3xl' : 'text-lg')}>
          {business.name}
        </h3>

        {business.tagline && (
          <p className="text-sm text-accent font-medium mb-2">{business.tagline}</p>
        )}

        <p className="text-xs text-primary font-medium mb-3">
          {business.category.name}
          {chamberAffiliation && (
            <span className="text-text-secondary font-normal"> · {chamberAffiliation}</span>
          )}
        </p>

        {hasRatings && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
            {rating > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={cn(
                        'w-4 h-4',
                        star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-text-secondary">
                  {rating.toFixed(1)} ({reviewCount})
                </span>
              </div>
            )}
            {business.googleRating != null && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 1 1 0-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0 0 12.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" fill="#4285F4"/>
                </svg>
                <span className="text-sm font-medium text-text">{business.googleRating.toFixed(1)}</span>
                {business.googleReviewCount != null && (
                  <span className="text-xs text-text-secondary">({business.googleReviewCount.toLocaleString()})</span>
                )}
              </div>
            )}
          </div>
        )}

        <p className={cn('text-text-secondary mb-4', isWinner ? 'text-base line-clamp-3' : 'text-sm line-clamp-2')}>
          {publicDescription(business)}
        </p>

        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{publicAddress(business.address)}, Moreno Valley</span>
        </div>

        {notes && (
          <p className="mt-4 text-sm text-text-secondary italic border-l-4 border-amber-300 pl-3">
            &ldquo;{notes}&rdquo;
          </p>
        )}
      </div>
    </Link>
  )
}
