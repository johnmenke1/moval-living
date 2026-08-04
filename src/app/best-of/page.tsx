import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { Trophy } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Best Of Moreno Valley',
  description: 'Moreno Valley\'s definitive Best Of awards — curated top picks by our editors for food, coffee, services, and more.',
}

async function getCategories() {
  return prisma.bestOfCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { nominees: true } },
    },
  })
}

async function getOverallWinners() {
  // Businesses that are winners in at least one category
  return prisma.bestOfNominee.findMany({
    where: { winner: true },
    include: {
      business: {
        select: {
          id: true,
          slug: true,
          name: true,
          logo: true,
          googleRating: true,
          address: true,
        },
      },
      category: { select: { name: true, slug: true, icon: true } },
    },
    take: 10,
  })
}

export default async function BestOfPage() {
  const [categories, overallWinners] = await Promise.all([getCategories(), getOverallWinners()])

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary to-secondary">
        <div className="container-max py-14">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-8 h-8 text-white/80" />
            <h1 className="text-4xl font-bold text-white">Best of Moreno Valley</h1>
          </div>
          <p className="text-white/80 text-lg max-w-2xl">
            Curated by our editors — the local spots that make Moreno Valley great.
          </p>
        </div>
      </div>

      <div className="container-max py-10 space-y-12">
        {categories.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Coming Soon</h2>
            <p className="text-text-secondary">Our editors are working on the first Best Of picks. Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Category grid */}
            <section>
              <h2 className="text-2xl font-bold text-text mb-6">All Categories</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/best-of/${cat.slug}`}
                    className="group bg-white rounded-2xl border border-slate-100 p-6 hover:border-primary hover:shadow-md transition-all text-center"
                  >
                    <p className="text-3xl mb-2">{cat.icon ? getCategoryEmoji(cat.icon) : '⭐'}</p>
                    <p className="font-semibold text-text text-sm group-hover:text-primary transition-colors">
                      {cat.name}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {cat._count.nominees} {cat._count.nominees === 1 ? 'pick' : 'picks'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            {/* Overall winners */}
            {overallWinners.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-text mb-6">🏆 Our Top Picks</h2>
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  {overallWinners.map((nominee, idx) => (
                    <Link
                      key={nominee.id}
                      href={`/best-of/${nominee.category.slug}`}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      {idx === 0 ? (
                        <img src="/best-of-badge.svg" alt="#1 Best Of" className="w-9 h-9 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {idx + 1}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text text-sm">{nominee.business.name}</p>
                        <p className="text-xs text-text-secondary">{nominee.category.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {nominee.business.googleRating != null && (
                          <div className="flex items-center gap-1 text-xs">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
                              <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>
                            </svg>
                            <span className="font-medium text-xs">{nominee.business.googleRating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
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
