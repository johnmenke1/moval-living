import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { Trophy, Star } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Best Of Moreno Valley',
  description: 'Moreno Valley\'s definitive Best Of awards — top tacos, coffee, burgers, pizza, BBQ, and more, ranked by the community.',
}

async function getCategories() {
  const categories = await prisma.bestOfCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      entries: {
        where: { rank: { not: null } },
        include: {
          business: {
            select: { id: true, name: true, slug: true, logo: true, googleRating: true, bestOfRank: true },
          },
        },
        orderBy: { rank: 'asc' },
        take: 3,
      },
    },
  })
  return categories
}

async function getTopEntries() {
  // Top entries = rank=1 in each category (the #1 winners)
  const all = await prisma.bestOfEntry.findMany({
    where: { rank: 1 },
    include: {
      business: {
        select: { id: true, name: true, slug: true, logo: true, address: true, googleRating: true, bestOfRank: true },
      },
      category: { select: { name: true, slug: true, icon: true } },
    },
    orderBy: { compositeScore: 'desc' },
    take: 10,
  })
  return all
}

export default async function BestOfPage() {
  const [categories, topEntries] = await Promise.all([getCategories(), getTopEntries()])

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
            The definitive local awards — our community&apos;s top picks for food, drinks, services, and more,
            ranked by a composite of Google ratings, longevity, and editorial scores.
          </p>
        </div>
      </div>

      <div className="container-max py-10 space-y-12">
        {/* Category grid */}
        {categories.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Coming Soon</h2>
            <p className="text-text-secondary">We&apos;re working on the first Best Of awards. Check back soon!</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-2xl font-bold text-text mb-6">All Categories</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/best-of/${cat.slug}`}
                    className="group bg-white rounded-2xl border border-slate-100 p-6 hover:border-primary hover:shadow-md transition-all text-center"
                  >
                    <p className="text-3xl mb-2">{getCategoryEmoji(cat.icon)}</p>
                    <p className="font-semibold text-text text-sm group-hover:text-primary transition-colors">
                      {cat.name}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {cat.entries.length} {cat.entries.length === 1 ? 'entry' : 'entries'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            {/* Overall top 10 */}
            {topEntries.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-text mb-6">🏆 Overall Top 10</h2>
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  {topEntries.map((entry, idx) => (
                    <Link
                      key={entry.id}
                      href={`/best-of/${entry.category.slug}`}
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
                        <p className="font-semibold text-text text-sm">{entry.business.name}</p>
                        <p className="text-xs text-text-secondary">
                          {entry.category.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {entry.business.googleRating != null && (
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="font-medium">{entry.business.googleRating.toFixed(1)}</span>
                          </div>
                        )}
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          ★ {entry.compositeScore?.toFixed(1)}
                        </span>
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
