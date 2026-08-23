'use client'

import { Search, MapPin, Sparkles, TreePine } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParksHeadCardProps {
  parkCount: number
  golfCount: number
  recCount: number
  query: string
  onQueryChange: (next: string) => void
  onSearchFocus?: () => void
}

/**
 * ParksHeadCard — immersive photo hero for /parks.
 *
 * The new collage hero image is the focal point. A layered gradient keeps
 * the white headline readable while letting the warmth of the park photos
 * show through. The search input is embedded in the hero so the primary
 * action is immediately reachable, mirroring the homepage search pattern.
 */
export function ParksHeadCard({
  parkCount,
  golfCount,
  recCount,
  query,
  onQueryChange,
  onSearchFocus,
}: ParksHeadCardProps) {
  const total = parkCount + golfCount + recCount

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onQueryChange(e.currentTarget.value.trim())
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      onQueryChange('')
      e.currentTarget.blur()
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl">
      {/* Hero collage image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/parks-hero-collage.png"
        alt="Collage of Moreno Valley parks and recreation — playground, trails, lake, picnic, and family activities"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        decoding="async"
      />

      {/* Warm vignette + readability gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/60 to-primary/30" />
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-transparent to-accent/20" />

      {/* Decorative watermark — subtle tree silhouette */}
      <div className="absolute -right-8 -bottom-12 opacity-5 pointer-events-none">
        <TreePine className="w-80 h-80" />
      </div>

      <div className="relative container-max py-14 sm:py-20 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/15 backdrop-blur-sm border border-white/20 text-white mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Parks & Recreation
          </span>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.05] mb-5"
            style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
          >
            Explore Moreno Valley&apos;s{' '}
            <span className="italic font-semibold text-[#8fd4d7]">parks</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/85 leading-relaxed mb-8 max-w-2xl mx-auto">
            {total} City-maintained facilities on one map — with filters for
            amenities, photos, and a &quot;near me&quot; distance so you can find the
            closest spot to take the kids, walk the dog, or hit the links.
          </p>

          {/* Stats chips */}
          <div className="flex flex-wrap justify-center gap-3 text-sm font-medium mb-8">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
              <MapPin className="w-3.5 h-3.5" />
              {total} facilities
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
              {parkCount} parks
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
              {golfCount} golf center{golfCount === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
              {recCount} recreation center{recCount === 1 ? '' : 's'}
            </span>
          </div>

          {/* Search input embedded in hero */}
          <div className="max-w-xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={onSearchFocus}
                placeholder="Search parks, addresses, amenities…"
                aria-label="Search parks"
                className={cn(
                  'w-full pl-12 pr-4 py-4 rounded-2xl text-text placeholder:text-slate-400',
                  'bg-white shadow-2xl shadow-secondary/20',
                  'focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/40',
                  'transition-all duration-200',
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
