'use client'

import { Users, ChevronDown } from 'lucide-react'

export function InsightsHero() {
  return (
    <section className="relative min-h-[70vh] sm:min-h-[75vh] flex items-center overflow-hidden bg-secondary">
      {/* Background collage image */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/insights-hero-collage.png)' }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/80 to-primary/40"
          aria-hidden="true"
        />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 w-full">
        <div className="container-max py-20 sm:py-28 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <Users className="w-4 h-4 text-white/90" />
              <span className="text-sm font-semibold tracking-widest uppercase text-white/90">
                Community Voices
              </span>
            </div>

            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] tracking-tight mb-6"
              style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
            >
              Insights
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-2xl leading-relaxed mb-8 font-sans">
              Curated perspectives from local professionals, business owners, and community leaders who know Moreno Valley best.
            </p>

            <a
              href="#insights-articles"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90 hover:text-white transition-colors group"
              aria-label="Scroll to the articles"
            >
              <span className="uppercase tracking-widest text-xs">Read the voices</span>
              <ChevronDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
