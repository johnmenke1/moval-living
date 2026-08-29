import { Sparkles, PlayCircle, Building2, Video } from 'lucide-react'

interface SpotlightsHeroProps {
  /** Total published spotlight count — surfaced in the stats chip. */
  spotlightCount: number
  /** Number of distinct businesses featured — derived from titles in seed. */
  businessCount: number
}

/**
 * SpotlightsHero — full-bleed photo hero for /spotlights.
 *
 * Visual structure mirrors the rest of the site's hero language
 * (`/parks` is the closest cousin — full-bleed collage, dual gradient,
 * eyebrow chip, Fraunces italic accent, answer-capsule subtitle, stats
 * chips). The signature element unique to this page is the 3×3 mosaic of
 * actual spotlight video thumbnails arranged behind the navy-to-teal
 * gradient — the businesses that the page is about, made literally
 * visible in the hero.
 *
 * No search input here — the spotlights grid below IS the wayfinding,
 * so an embedded search bar would compete with it.
 *
 * Renders full-bleed (no max-width, no horizontal padding, no top-edge
 * rounding) so it spans the entire viewport width. The grid below sits
 * in its own container-max wrapper.
 */
export function SpotlightsHero({
  spotlightCount,
  businessCount,
}: SpotlightsHeroProps) {
  // Friendly ranges for the attribution copy.
  const programLine =
    spotlightCount > 0
      ? `Featuring the City of Moreno Valley's "Spotlight on Moreno Valley Business" program — a monthly series that's been documenting local businesses since 2015.`
      : 'Coming soon: short-form video profiles of the people and businesses that make Moreno Valley worth talking about.'

  return (
    <section className="relative overflow-hidden">
      {/* Mosaic of spotlight thumbnails — the page's signature element.
          WebP preferred, PNG fallback for Safari < 16. The image is
          eager-loaded and is the LCP element. */}
      <picture>
        <source
          srcSet="/spotlights-hero-collage.webp"
          type="image/webp"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/spotlights-hero-collage.png"
          alt="A mosaic of nine local Moreno Valley businesses featured in the City of MoVal Business Spotlight program"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      {/* Layered gradients — keep the white headline readable while
          letting the warmth of the mosaic show through. Matches the
          /parks hero's two-layer gradient recipe. */}
      <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/70 to-primary/40" />
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/60 via-transparent to-accent/20" />

      {/* Brand accent blob — kept on-brand with the homepage hero, but
          positioned bottom-right so it doesn't compete with the eyebrow
          chip on the upper-left of the centered stack. */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/15 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="relative container-max py-14 sm:py-20 md:py-24">
        <div className="max-w-3xl mx-auto text-center min-w-0 px-4 sm:px-0">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/15 backdrop-blur-sm border border-white/20 text-white mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Local Spotlights
          </span>

          <h1
            className="text-[2.25rem] sm:text-5xl md:text-6xl font-bold text-white tracking-tight leading-[1.05] mb-5 break-words"
            style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
          >
            The faces behind{' '}
            <span className="italic font-semibold text-[#8fd4d7]">MoVal</span>
          </h1>

          {/* Answer-capsule subtitle — server-rendered, phrased as a
              complete factual answer that AI engines can lift. The City
              attribution lives here rather than in a banner above the
              hero (mirrors the /parks Aug 27 migration). */}
          <p className="text-base sm:text-xl text-white/85 leading-relaxed mb-3 max-w-2xl mx-auto">
            {spotlightCount > 0
              ? `${spotlightCount} short-form video spotlights of Moreno Valley businesses — from the City's "Spotlight on Moreno Valley Business" program. ${businessCount} distinct businesses featured so far.`
              : programLine}
          </p>
          <p className="text-sm sm:text-lg text-white/75 leading-relaxed mb-6 max-w-2xl mx-auto">
            {programLine}
          </p>

          {/* Stats chips — `min-w-0` on the parent so the flex children
              are allowed to wrap inside the constrained content width;
              `flex-wrap` already handles the rest. */}
          <div className="flex flex-wrap justify-center gap-3 text-sm font-medium mb-8 w-full">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
              <Video className="w-3.5 h-3.5" />
              {spotlightCount} video{spotlightCount === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
              <Building2 className="w-3.5 h-3.5" />
              {businessCount} business{businessCount === 1 ? '' : 'es'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white">
              <Sparkles className="w-3.5 h-3.5" />
              Since 2015
            </span>
          </div>

          {/* CTA — link to the YouTube playlist so visitors can browse
              the source. Scroll-down affordance sits below it. */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <a
              href="https://www.youtube.com/playlist?list=PLmdmVBb42qYhA-xJugxmokFo-xZNVF_1Q"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
            >
              <PlayCircle className="w-5 h-5" />
              Watch on YouTube
            </a>
            <a
              href="#spotlights-grid"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white transition-colors group"
              aria-label="Jump to the spotlight grid"
            >
              <span className="uppercase tracking-widest text-xs">Browse the videos</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 group-hover:translate-y-1 transition-transform"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
