import Link from 'next/link'
import { ChevronLeft, Trophy, Users, Vote, Sparkles } from 'lucide-react'
import { BestOfTrophy } from './BestOfTrophy'

const CATEGORY_IMAGES: Record<string, string> = {
  'best-coffee': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
  'best-tacos': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',
  'best-burgers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  'best-pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
  'best-breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
  'best-bbq': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&q=80',
  'best-salon': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'best-auto-repair': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80',
  'best-plumbing': 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80',
  'best-landscaping': 'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&q=80',
  'best-real-estate': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  'best-veterinary': 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=800&q=80',
  'best-nightlife': 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80',
  'best-date-night': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  'best-local-shop': 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
}

interface BestOfCategoryHeroProps {
  slug: string
  name: string
  description: string | null
  emoji: string
  nomineeCount: number
  winnerCount: number
  voteCount: number
  capsule: React.ReactNode
}

export function BestOfCategoryHero({
  slug,
  name,
  description,
  emoji,
  nomineeCount,
  winnerCount,
  voteCount,
  capsule,
}: BestOfCategoryHeroProps) {
  const imageUrl = CATEGORY_IMAGES[slug] ?? CATEGORY_IMAGES['best-coffee']

  return (
    <section className="relative overflow-hidden">
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
        decoding="async"
      />
      {/* Gradient overlays for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/70 to-primary/40" />
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/60 via-transparent to-accent/20" />

      {/* Content */}
      <div className="relative">
        {/* Back nav */}
        <div className="container-max py-4">
          <Link
            href="/best-of"
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> All Best Of Categories
          </Link>
        </div>

        <div className="container-max pb-14 md:pb-20 pt-4 md:pt-8">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm px-4 py-1.5 rounded-full mb-5">
              <Trophy className="w-4 h-4 text-amber-300" />
              Best Of Moreno Valley
            </div>

            {/* Category icon + title */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl md:text-6xl">{emoji}</span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                {name}
              </h1>
            </div>

            {/* Trophy + caption */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-10 h-10">
                <BestOfTrophy className="w-full h-full drop-shadow-lg" />
                <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-200" />
              </div>
              <p className="text-white/90 text-lg md:text-xl">{capsule}</p>
            </div>

            {description && (
              <p className="text-white/80 text-base md:text-lg max-w-2xl mb-8">{description}</p>
            )}

            {/* Stats pills */}
            <div className="flex flex-wrap gap-3 mb-8">
              {winnerCount > 0 && (
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span className="font-bold text-amber-300 text-base">{winnerCount}</span>
                  {winnerCount === 1 ? 'winner' : 'winners'}
                </div>
              )}
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
                <Users className="w-4 h-4 text-amber-300" />
                <span className="font-bold text-amber-300 text-base">{nomineeCount}</span>
                {nomineeCount === 1 ? 'nominee' : 'nominees'}
              </div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
                <Vote className="w-4 h-4 text-amber-300" />
                <span className="font-bold text-amber-300 text-base">{voteCount.toLocaleString()}</span>
                {voteCount === 1 ? 'vote' : 'votes'}
              </div>
            </div>

            {/* CTA */}
            <Link
              href="/submit/best-of"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
            >
              <span className="text-lg">+</span> Nominate a business
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
