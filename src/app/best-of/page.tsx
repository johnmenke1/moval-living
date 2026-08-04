import { prisma } from '@/lib/prisma'
import { Trophy, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Best Of Moreno Valley',
  description: 'Moreno Valley\'s definitive Best Of awards — curated top picks by our editors for food, coffee, services, and more.',
}

type CategoryWithSubs = Awaited<ReturnType<typeof getCategories>>[number]

async function getCategories() {
  return prisma.bestOfCategory.findMany({
    where: { published: true },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { nominees: true, subCategories: true } },
      subCategories: {
        where: { published: true },
        orderBy: { name: 'asc' },
        include: { _count: { select: { nominees: true } } },
      },
    },
  })
}

async function getOverallWinners() {
  return prisma.bestOfNominee.findMany({
    where: { winner: true },
    include: {
      business: {
        select: {
          id: true, slug: true, name: true, logo: true,
          googleRating: true, address: true,
        },
      },
      category: { select: { name: true, slug: true, icon: true } },
    },
    take: 10,
  })
}

export default async function BestOfPage() {
  const [categories, overallWinners] = await Promise.all([getCategories(), getOverallWinners()])

  // Split into parent categories and standalone (no-parent) categories
  const parentCategories = categories.filter(c => !c.parentCategoryId)
  const standaloneCategories = categories.filter(c => c.parentCategoryId === null && c._count.subCategories === 0)

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
            {/* Parent categories with sub-categories */}
            {parentCategories.map(parent => (
              <ParentCategorySection key={parent.id} parent={parent} />
            ))}

            {/* Flat categories (no parent, no sub-categories) */}
            {standaloneCategories.length > 0 && (
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {standaloneCategories.map(cat => (
                    <CategoryCard key={cat.id} cat={cat} />
                  ))}
                </div>
              </section>
            )}

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
                      {nominee.business.googleRating != null && (
                        <div className="flex items-center gap-1 text-xs shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
                            <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>
                          </svg>
                          <span className="font-medium">{nominee.business.googleRating.toFixed(1)}</span>
                        </div>
                      )}
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

// ── Parent category with sub-categories ──────────────────────────────────────

function ParentCategorySection({ parent }: { parent: CategoryWithSubs }) {
  const hasWinner = parent.subCategories.some(sc => sc._count.nominees > 0) ||
    parent._count.nominees > 0

  return (
    <section>
      {/* Parent header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{getCategoryEmoji(parent.icon ?? 'Trophy')}</span>
        <div>
          <h2 className="text-2xl font-bold text-text">{parent.name}</h2>
          {parent.description && (
            <p className="text-sm text-text-secondary">{parent.description}</p>
          )}
        </div>
      </div>

      {/* Sub-category cards */}
      {parent.subCategories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {parent.subCategories.map(sub => (
            <CategoryCard key={sub.id} cat={sub} parentIcon={parent.icon} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <CategoryCard cat={parent} />
        </div>
      )}
    </section>
  )
}

// ── Single category card ──────────────────────────────────────────────────────

function CategoryCard({
  cat,
  parentIcon,
}: {
  cat: CategoryWithSubs['subCategories'][number] | CategoryWithSubs
  parentIcon?: string | null
}) {
  const icon = parentIcon ?? cat.icon
  const totalNominees = cat._count.nominees
  const hasSubCats = '_count' in cat && 'subCategories' in cat && cat.subCategories !== undefined

  return (
    <Link
      href={`/best-of/${cat.slug}`}
      className="group bg-white rounded-2xl border border-slate-100 p-5 hover:border-primary hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon ? getCategoryEmoji(icon) : '⭐'}</span>
        {totalNominees > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
            {totalNominees} {totalNominees === 1 ? 'pick' : 'picks'}
          </span>
        )}
      </div>
      <p className="font-semibold text-text text-sm group-hover:text-primary transition-colors leading-tight">
        {cat.name}
      </p>
      {cat.description && (
        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{cat.description}</p>
      )}
    </Link>
  )
}

function getCategoryEmoji(icon: string): string {
  const map: Record<string, string> = {
    Taco: '🌮', Coffee: '☕', Beef: '🍔', Pizza: '🍕',
    Sunrise: '🌅', Flame: '🔥', ShoppingBag: '🛍️', Heart: '💑',
    Trophy: '🏆', UtensilsCrossed: '🍽️', Wrench: '🔧', Scissors: '✂️',
    Droplets: '💧', Trees: '🌳', Building: '🏢', PawPrint: '🐾',
    Activity: '🏃', Home: '🏠', Car: '🚗', Briefcase: '💼',
  }
  return map[icon] ?? '⭐'
}
