import { Trophy, Sparkles, Users } from 'lucide-react'
import { BestOfTrophy } from './BestOfTrophy'

interface SubmitBestOfHeroProps {
  winnerCount?: number
}

export function SubmitBestOfHero({ winnerCount }: SubmitBestOfHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-[#01566d] to-primary">
      {/* Warm gold glow behind the trophy */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-amber-300/10 rounded-full blur-3xl" />

      <div className="container-max relative py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm px-4 py-1.5 rounded-full mb-6">
            <Users className="w-4 h-4 text-amber-300" />
            Community nomination
          </div>

          {/* Golden trophy */}
          <div className="relative w-20 h-20 md:w-28 md:h-28 mx-auto mb-6">
            <BestOfTrophy className="w-full h-full drop-shadow-2xl" />
            <Sparkles className="absolute -top-1 -right-1 w-6 h-6 md:w-7 md:h-7 text-amber-200 animate-pulse" />
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            Who deserves <span className="text-[#8fd4d7]">Best Of Moreno Valley</span>?
          </h1>

          <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Tell us about a local business you love. We read every nomination personally,
            and standout picks move on to public voting and editor review.
          </p>

          {typeof winnerCount === 'number' && winnerCount > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>
                <span className="font-bold text-amber-300">{winnerCount}</span>{' '}
                {winnerCount === 1 ? 'winner has' : 'winners have'} been crowned so far
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
