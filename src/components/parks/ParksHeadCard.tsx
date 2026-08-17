'use client'

import { TreePine, MapPin, Sparkles } from 'lucide-react'

interface ParksHeadCardProps {
  parkCount: number
  golfCount: number
  recCount: number
}

/**
 * ParksHeadCard — the non-sticky head card for the /parks route.
 *
 * Following the search-page-brand-treatment rule (Aug 16):
 *   - Brand, stats, eyebrow chip → scroll with content
 *   - Frequent controls (search, filter chips, geolocation) → split out
 *     into the sticky compact bar so the head card doesn't eat the
 *     listings once the user is past it.
 *
 * Stats line shows "36 facilities · 33 parks · 1 golf · 1 rec center"
 * so users immediately see the size of the directory.
 */
export function ParksHeadCard({
  parkCount,
  golfCount,
  recCount,
}: ParksHeadCardProps) {
  const total = parkCount + golfCount + recCount
  return (
    <div className="rounded-3xl bg-gradient-to-br from-secondary via-secondary to-primary text-white px-6 py-10 sm:px-10 sm:py-14 mb-6 relative overflow-hidden">
      {/* Decorative watermark — same pattern as the homepage hero */}
      <div className="absolute -right-12 -top-12 opacity-10 pointer-events-none">
        <TreePine className="w-72 h-72" />
      </div>
      <div className="absolute right-6 bottom-6 opacity-5 pointer-events-none">
        <MapPin className="w-32 h-32" />
      </div>

      <div className="relative max-w-3xl">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/15 backdrop-blur-sm border border-white/20 mb-4">
          <Sparkles className="w-3 h-3" />
          Parks & Recreation
        </span>

        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-4"
          style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
        >
          Every{' '}
          <span className="italic font-semibold text-accent">park</span>
          <br />
          in MoVal.
        </h1>

        <p className="text-lg sm:text-xl text-white/85 leading-relaxed mb-6 max-w-2xl">
          {total} City-maintained facilities on one map — with filters for
          amenities, photos, and a &quot;near me&quot; distance so you can find the closest
          spot to take the kids, walk the dog, or hit the links.
        </p>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            {total} facilities
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            {parkCount} parks
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            {golfCount} golf center{golfCount === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            {recCount} recreation center{recCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
