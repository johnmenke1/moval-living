import Link from 'next/link'
import { MapPin, Star, Award, Tag, Trophy } from 'lucide-react'
import { cn, averageRating } from '@/lib/utils'

interface BusinessCardProps {
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
    coupon?: {
      headline: string
      description?: string | null
      code?: string | null
      expiresAt?: string | null
    } | null
    isBestOf?: boolean
  }
}

export function BusinessCard({ business }: BusinessCardProps) {
  const rating = averageRating(business.reviews)
  const reviewCount = business._count?.reviews ?? business.reviews.length
  const isFeatured = business.tier === 'FEATURED'

  return (
    <Link href={`/business/${business.slug}`} className={cn('block', isFeatured ? 'card-featured' : 'card')}>
      {/* Image */}
      <div className="relative w-full h-44 rounded-t-xl overflow-hidden bg-slate-100">
        {business.coverImage || business.logo || business.photos[0] ? (
          <img
            src={business.coverImage || business.logo || business.photos[0]}
            alt={business.name}
            className={cn(
              'w-full h-full',
              !business.coverImage && business.logo ? 'object-contain p-6' : 'object-cover'
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
            <span className="text-4xl font-bold text-primary/30">{business.name[0]}</span>
          </div>
        )}
        {/* Logo badge — shows on top of cover image */}
        {business.logo && business.coverImage && (
          <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl border-2 border-white shadow-md overflow-hidden bg-white">
            <img src={business.logo} alt={`${business.name} logo`} className="w-full h-full object-contain" />
          </div>
        )}
        {isFeatured && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <Award className="w-3 h-3" />
            Featured
          </div>
        )}
        {business.isBestOf && (
          <div className="absolute top-3 right-3 w-10 h-10">
            <img
              src="/best-of-badge.svg"
              alt="#1 Best Of"
              className="w-full h-full drop-shadow-md"
            />
          </div>
        )}
        {business.hasCoupon && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <Tag className="w-3 h-3" />
            Deal
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-text text-lg leading-tight">{business.name}</h3>
        </div>

        {business.tagline && (
          <p className="text-sm text-accent font-medium mb-2">{business.tagline}</p>
        )}

        <p className="text-xs text-primary font-medium mb-2">{business.category.name}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
          {rating > 0 ? (
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
          ) : (
            <span className="text-sm text-text-secondary">No site reviews</span>
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

        <p className="text-sm text-text-secondary line-clamp-2 mb-3">
          {business.description}
        </p>

        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{business.address}, Moreno Valley</span>
        </div>
      </div>
    </Link>
  )
}
