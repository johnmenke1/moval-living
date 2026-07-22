import Link from 'next/link'
import { MapPin, Star, Award, Tag } from 'lucide-react'
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
    coupon?: {
      headline: string
      description?: string | null
      code?: string | null
      expiresAt?: string | null
    } | null
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
        {business.coverImage || business.photos[0] ? (
          <img
            src={business.coverImage || business.photos[0]}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
            <span className="text-4xl font-bold text-primary/30">{business.name[0]}</span>
          </div>
        )}
        {isFeatured && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <Award className="w-3 h-3" />
            Featured
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

        <div className="flex items-center gap-1.5 mb-3">
          {rating > 0 ? (
            <>
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
                {rating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
              </span>
            </>
          ) : (
            <span className="text-sm text-text-secondary">No reviews yet</span>
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
