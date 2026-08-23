import { Trophy, Users, Vote, Sparkles, Gavel } from 'lucide-react'
import Link from 'next/link'

const HERO_TILES = [
  {
    src: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80',
    style: { top: '10%', left: '8%', width: '7.5rem', height: '10rem', transform: 'rotate(-8deg)' },
  },
  {
    src: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80',
    style: { top: '14%', right: '10%', width: '8.5rem', height: '6.5rem', transform: 'rotate(6deg)' },
  },
  {
    src: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
    style: { bottom: '18%', left: '12%', width: '7rem', height: '9rem', transform: 'rotate(5deg)' },
  },
  {
    src: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80',
    style: { bottom: '12%', right: '8%', width: '8rem', height: '8rem', transform: 'rotate(-6deg)' },
  },
  {
    src: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&q=80',
    style: { top: '40%', left: '5%', width: '6rem', height: '6rem', transform: 'rotate(10deg)' },
  },
  {
    src: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&q=80',
    style: { top: '36%', right: '6%', width: '7rem', height: '7rem', transform: 'rotate(-10deg)' },
  },
]

interface BestOfHeroProps {
  categoryCount: number
  nomineeCount: number
  winnerCount: number
}

export function BestOfHero({ categoryCount, nomineeCount, winnerCount }: BestOfHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-[#01566d] to-primary">
      {/* Warm gold glow behind the trophy */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-amber-300/10 rounded-full blur-3xl" />

      {/* Decorative floating photo tiles — desktop only so they frame, not clutter */}
      {HERO_TILES.map((tile, i) => (
        <div
          key={i}
          className="absolute hidden lg:block rounded-xl border-2 border-white/25 shadow-2xl overflow-hidden"
          style={tile.style}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tile.src}
            alt=""
            className="w-full h-full object-cover opacity-90"
            loading="lazy"
          />
        </div>
      ))}

      <div className="container-max relative py-16 md:py-24 lg:py-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm px-4 py-1.5 rounded-full mb-6">
            <Trophy className="w-4 h-4 text-amber-300" />
            Community-powered awards
          </div>

          {/* Golden star trophy — lightweight inline SVG, no heavy badge asset */}
          <div className="relative w-28 h-28 md:w-36 md:h-36 mx-auto mb-8">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full drop-shadow-2xl"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="best-of-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="40%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="best-of-gold-side" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
              </defs>
              {/* Star */}
              <path
                d="M50 6 L62 34 L92 34 L68 52 L77 82 L50 65 L23 82 L32 52 L8 34 L38 34 Z"
                fill="url(#best-of-gold)"
                stroke="#fff"
                strokeWidth="1.5"
              />
              {/* Pedestal */}
              <rect x="43" y="78" width="14" height="10" rx="2" fill="url(#best-of-gold-side)" />
              <rect x="36" y="88" width="28" height="7" rx="2" fill="#92400e" />
            </svg>
            <Sparkles className="absolute -top-1 -right-1 w-7 h-7 md:w-9 md:h-9 text-amber-200 animate-pulse" />
            <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 md:w-6 md:h-6 text-amber-200" />
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Best of <span className="text-[#8fd4d7]">Moreno Valley</span>
          </h1>

          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto leading-relaxed">
            The restaurants, shops, and services our neighbors love most — chosen from community nominations,
            shaped by public voting, and finalized by local editor review. No paid placements, no hidden picks,
            just real MoVal favorites.
          </p>

          {/* Live stats pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
              <span className="font-bold text-amber-300 text-base">{categoryCount}</span>
              {categoryCount === 1 ? 'category' : 'categories'}
            </div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
              <span className="font-bold text-amber-300 text-base">{nomineeCount.toLocaleString()}</span>
              {nomineeCount === 1 ? 'nomination' : 'nominations'}
            </div>
            {winnerCount > 0 && (
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
                <span className="font-bold text-amber-300 text-base">{winnerCount}</span>
                {winnerCount === 1 ? 'winner crowned' : 'winners crowned'}
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/submit/best-of"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
            >
              <Users className="w-4 h-4" />
              Nominate a Business
            </Link>
            <a
              href="#methodology"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-white/60 text-white font-semibold hover:bg-white/10 hover:border-white transition-colors"
            >
              <Gavel className="w-4 h-4" />
              How winners are chosen
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
