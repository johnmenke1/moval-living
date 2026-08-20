'use client'

import { useMemo } from 'react'
import { Compass, ChevronDown } from 'lucide-react'

interface Outing {
  slug: string
  title: string
  excerpt: string
  heroImageUrl: string | null
  publishedAt: Date | null
}

interface OutingsHeroProps {
  posts: Outing[]
}

function pickHeroImages(posts: Outing[]): string[] {
  const images = posts
    .map(p => p.heroImageUrl)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  if (images.length === 0) {
    return [] // hero falls back to a solid-color travel-magazine plate
  }

  // Prefer distinct posts; limit to 3 for the collage.
  return [...new Set(images)].slice(0, 3)
}

export function OutingsHero({ posts }: OutingsHeroProps) {
  const heroImages = useMemo(() => pickHeroImages(posts), [posts])

  return (
    <section className="relative min-h-[70vh] sm:min-h-[75vh] flex items-end overflow-hidden bg-secondary">
      {/* Background collage with soft layered treatment */}
      <div className="absolute inset-0 z-0">
        {heroImages.length >= 3 ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${heroImages[0]})` }}
              aria-hidden="true"
            />
            <div
              className="absolute top-0 right-0 h-full w-1/2 hidden lg:block bg-cover bg-center"
              style={{
                backgroundImage: `url(${heroImages[1]})`,
                clipPath: 'polygon(8% 0, 100% 0, 100% 100%, 0% 100%)',
              }}
              aria-hidden="true"
            />
            <div
              className="absolute bottom-0 right-[12%] h-[55%] w-[28%] hidden xl:block bg-cover bg-center shadow-2xl"
              style={{
                backgroundImage: `url(${heroImages[2] ?? heroImages[1]})`,
              }}
              aria-hidden="true"
            />
          </>
        ) : heroImages.length > 0 ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImages[0]})` }}
            aria-hidden="true"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary to-primary/30" aria-hidden="true" />
        )}

        {/* Warm editorial overlay: dark teal gradient for high-contrast type */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/70 to-primary/30"
          aria-hidden="true"
        />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 w-full">
        <div className="container-max pb-16 sm:pb-20 pt-32 sm:pt-40">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <Compass className="w-4 h-4 text-white/90" />
              <span className="text-sm font-semibold tracking-widest uppercase text-white/90">
                Weekend Day Trips from Moreno Valley
              </span>
            </div>

            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
            >
              Live
              <br />
              <span className="text-[#4dd0d8]">Curiously</span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-2xl leading-relaxed mb-8 font-sans">
              Photo essays from the roads, rails, and trails within a short drive of home. Discover the places that make you want to pack a bag on a Saturday morning.
            </p>

            <a
              href="#outings-grid"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white transition-colors group"
              aria-label="Scroll to the outings grid"
            >
              <span className="uppercase tracking-widest text-xs">Explore the trips</span>
              <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
