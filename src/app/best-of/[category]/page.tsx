import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Star, MapPin, Globe, Phone, ChevronLeft, Trophy } from 'lucide-react'
import type { Metadata } from 'next'

interface BestOfCategoryPageProps {
  params: Promise<{ category: string }>
}

async function getCategory(slug: string) {
  const cat = await prisma.bestOfCategory.findUnique({
    where: { slug },
    include: {
      entries: {
        where: { rank: { not: null } },
        include: {
          business: {
            select: {
              id: true, name: true, slug: true, address: true, city: true, state: true, zip: true,
              logo: true, website: true, phone: true,
              googleRating: true, googleReviewCount: true,
              bestOfRank: true,
            },
          },
          scores: { orderBy: { factor: 'asc' } },
        },
        orderBy: { rank: 'asc' },
      },
    },
  })
  return cat
}

export async function generateMetadata({ params }: BestOfCategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params
  const cat = await getCategory(slug)
  if (!cat) return { title: 'Category Not Found' }
  return {
    title: cat.name,
    description: cat.description || `See the top-ranked ${cat.name} in Moreno Valley.`,
  }
}

const FACTOR_LABELS: Record<string, string> = {
  googleRating:          'Google Rating',
  googleReviewCount:     'Review Count',
  yearsActive:           'Longevity',
  localOwnership:        'Local Ownership',
  uniqueness:            'Uniqueness',
  communityInvolvement:  'Community',
  personalVisitReview:   'Personal Visit',
}

const FACTOR_WEIGHTS: Record<string, string> = {
  googleRating:          '20%',
  googleReviewCount:     '15%',
  yearsActive:           '15%',
  localOwnership:        '10%',
  uniqueness:            '15%',
  communityInvolvement:  '10%',
  personalVisitReview:   '15%',
}

export default async function BestOfCategoryPage({ params }: BestOfCategoryPageProps) {
  const { category: slug } = await params
  const cat = await getCategory(slug)
  if (!cat) notFound()

  const emoji = getCategoryEmoji(cat.icon)

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Back nav */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-4">
          <Link href="/best-of" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" /> All Best Of Categories
          </Link>
        </div>
      </div>

      {/* Category header */}
      <div className="bg-gradient-to-br from-primary to-secondary">
        <div className="container-max py-12">
          <p className="text-5xl mb-3">{emoji}</p>
          <h1 className="text-4xl font-bold text-white mb-2">{cat.name}</h1>
          {cat.description && (
            <p className="text-white/80 text-lg max-w-2xl">{cat.description}</p>
          )}
        </div>
      </div>

      <div className="container-max py-10">
        {cat.entries.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">No entries yet</h2>
            <p className="text-text-secondary">We&apos;re still building this category. Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Scoring legend */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-8">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">How We Score</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {Object.entries(FACTOR_WEIGHTS).map(([factor, weight]) => (
                  <div key={factor} className="text-center">
                    <p className="text-xs font-medium text-text">{FACTOR_LABELS[factor]}</p>
                    <p className="text-xs text-primary font-semibold">{weight}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rankings */}
            <div className="space-y-4">
              {cat.entries.map((entry, idx) => (
                <RankedCard key={entry.id} entry={entry} rank={idx + 1} emoji={emoji} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RankedCard({ entry, rank, emoji }: { entry: NonNullable<Awaited<ReturnType<typeof getCategory>>>['entries'][number]; rank: number; emoji: string }) {
  const isTop3 = rank <= 3
  const medalColors = ['bg-amber-100 text-amber-800', 'bg-slate-100 text-slate-600', 'bg-orange-100 text-orange-800']

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${
      isTop3 ? 'border-2' : 'border-slate-100'
    } ${rank === 1 ? 'border-amber-300' : rank === 2 ? 'border-slate-300' : rank === 3 ? 'border-orange-300' : ''}`}>
      <div className="flex items-start gap-0">
        {/* Rank badge */}
        <div className={`w-16 shrink-0 flex flex-col items-center justify-center py-6 ${
          isTop3 ? medalColors[rank - 1] : 'bg-slate-50 text-slate-400'
        }`}>
          {isTop3 ? (
            <span className="text-2xl">{['🥇', '🥈', '🥉'][rank - 1]}</span>
          ) : (
            <span className="text-lg font-bold">#{rank}</span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              {entry.business.logo ? (
                <img
                  src={entry.business.logo}
                  alt={entry.business.name}
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                  {emoji}
                </div>
              )}
              <div>
                <h3 className="font-bold text-text text-lg leading-tight">{entry.business.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  {entry.business.googleRating != null && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium">{entry.business.googleRating.toFixed(1)}</span>
                    </div>
                  )}
                  {entry.business.googleReviewCount != null && (
                    <span className="text-sm text-text-secondary">
                      {entry.business.googleReviewCount.toLocaleString()} reviews
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Composite score */}
            <div className="text-right shrink-0">
              <div className="text-3xl font-black text-primary">{entry.compositeScore?.toFixed(1)}</div>
              <div className="text-xs text-text-secondary">/ 100 pts</div>
            </div>
          </div>

          {/* Address + contact */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-text-secondary">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{entry.business.address}, {entry.business.city} {entry.business.state}</span>
            </div>
            {entry.business.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>{entry.business.phone}</span>
              </div>
            )}
            {entry.business.website && (
              <a
                href={entry.business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                Website
              </a>
            )}
            <Link
              href={`/business/${entry.business.slug}`}
              className="ml-auto text-sm font-medium text-primary hover:underline"
            >
              View Listing →
            </Link>
          </div>

          {/* Factor breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {entry.scores.map(score => {
              let pct: number
              if (score.factor === 'googleRating') {
                pct = (score.rawValue / 5) * 100
              } else if (score.factor === 'yearsActive') {
                // rawValue here is the raw years decimal (e.g. 0.013), display as "N years"
                const years = score.rawValue
                const maxYears = Math.max(...entry.scores.filter(s => s.factor === 'yearsActive').map(s => s.rawValue), 0.001)
                pct = (years / maxYears) * 100
              } else {
                pct = (score.rawValue / 10) * 100
              }
              return (
                <div key={score.factor} className="bg-slate-50 rounded-xl p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{FACTOR_LABELS[score.factor] ?? score.factor}</span>
                    <span className="text-xs font-bold text-text">
                      {score.factor === 'yearsActive'
                        ? `${score.rawValue.toFixed(2)} yrs`
                        : score.factor === 'googleRating'
                        ? `${score.rawValue} / 5`
                        : score.factor === 'googleReviewCount'
                        ? score.rawValue.toLocaleString()
                        : `${score.rawValue} / 10`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function getCategoryEmoji(icon: string): string {
  const map: Record<string, string> = {
    Taco: '🌮', Coffee: '☕', Beef: '🍔', Pizza: '🍕',
    Sunrise: '🌅', Flame: '🔥', ShoppingBag: '🛍️', Heart: '💑',
    Trophy: '🏆', UtensilsCrossed: '🍽️', Wrench: '🔧', Scissors: '✂️',
    Droplets: '💧', Trees: '🌳', Building: '🏢', PawPrint: '🐾',
    Activity: '🏃',
  }
  return map[icon] ?? '⭐'
}
