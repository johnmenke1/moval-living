import { prisma } from '@/lib/prisma'
import { Trophy } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Best Of Moreno Valley',
  description: 'Moreno Valley\'s definitive Best Of awards — curated top picks by our editors for food, coffee, services, and more.',
}

type CategoryRow = Awaited<ReturnType<typeof getCategories>>[number]

async function getCategories() {
  return prisma.bestOfCategory.findMany({
    where: { published: true },
    orderBy: { name: 'asc' },
    include: {
      nominees: {
        where: { winner: true },
        include: {
          business: { select: { id: true, slug: true, name: true, logo: true } },
        },
      },
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

// Unsplash photo URLs keyed by category slug — realistic local/business photos
const UNSPLASH_PHOTOS: Record<string, string> = {
  'best-coffee':       'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
  'best-tacos':        'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',
  'best-burgers':      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  'best-pizza':        'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
  'best-breakfast':    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
  'best-bbq':          'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&q=80',
  'best-salon':        'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'best-auto-repair':  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80',
  'best-plumbing':     'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80',
  'best-landscaping':  'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&q=80',
  'best-real-estate': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  'best-veterinary':   'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=800&q=80',
  'best-nightlife':   'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80',
  'best-date-night':  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  'best-local-shop':  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
  'food-hospitality': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  'professional-services': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
  'home-services':     'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80',
  'health-wellness':   'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
  'real-estate':       'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  'default':           'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
}

function getCategoryImage(cat: CategoryRow): string {
  if (cat.imageUrl) return cat.imageUrl
  return UNSPLASH_PHOTOS[cat.slug] ?? UNSPLASH_PHOTOS['default']
}

function getCategoryEmoji(icon: string | null): string {
  const map: Record<string, string> = {
    Taco: '🌮', Coffee: '☕', Beef: '🍔', Pizza: '🍕',
    Sunrise: '🌅', Flame: '🔥', ShoppingBag: '🛍️', Heart: '💑',
    Trophy: '🏆', UtensilsCrossed: '🍽️', Wrench: '🔧', Scissors: '✂️',
    Droplets: '💧', Trees: '🌳', Building: '🏢', PawPrint: '🐾',
    Activity: '🏃', Home: '🏠', Car: '🚗', Briefcase: '💼',
  }
  return map[icon ?? ''] ?? '⭐'
}

export default async function BestOfPage() {
  const [categories, overallWinners] = await Promise.all([getCategories(), getOverallWinners()])

  // Separate sections from regular categories
  const sections = categories.filter(c => c.isSection && !c.parentCategoryId)
  const regularTopLevel = categories.filter(c => !c.isSection && !c.parentCategoryId)
  const hasSubCategoryGroups = regularTopLevel.some(c => c.subCategories.length > 0)

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

      <div className="container-max py-10 space-y-16">

        {categories.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-text mb-2">Coming Soon</h2>
            <p className="text-text-secondary">Our editors are working on the first Best Of picks. Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Section groups (e.g. Food & Hospitality, Professional Services) */}
            {sections.map(section => (
              <CategorySection key={section.id} section={section} categories={categories} />
            ))}

            {/* Regular top-level categories with sub-categories */}
            {regularTopLevel.filter(c => c.subCategories.length > 0).map(parent => (
              <ParentCategoryBlock key={parent.id} parent={parent} />
            ))}

            {/* Standalone category grid (no section, no sub-categories) */}
            {regularTopLevel.filter(c => c.subCategories.length === 0).length > 0 && (
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {regularTopLevel
                    .filter(c => c.subCategories.length === 0)
                    .map(cat => (
                      <CategoryBlock key={cat.id} cat={cat} />
                    ))}
                </div>
              </section>
            )}

            {/* Overall winners */}
            {overallWinners.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-text mb-6 flex items-center gap-2">
                  🏆 Our Top Picks
                </h2>
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

// ── Section group (e.g. Food & Hospitality) ─────────────────────────────────

function CategorySection({
  section,
  categories,
}: {
  section: CategoryRow
  categories: CategoryRow[]
}) {
  // Children of this section
  const children = categories.filter(c => c.parentCategoryId === section.id && c.published)

  return (
    <section>
      {/* Section header */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        <img
          src={getCategoryImage(section)}
          alt={section.name}
          className="w-full h-40 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
          <div className="px-6 py-4">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Category</p>
            <h2 className="text-2xl font-bold text-white">{section.name}</h2>
            {section.description && (
              <p className="text-white/70 text-sm mt-1">{section.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sub-category blocks in a grid */}
      {children.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {children.map(cat => (
            <CategoryBlock key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Parent category with sub-category pills ───────────────────────────────────

function ParentCategoryBlock({ parent }: { parent: CategoryRow }) {
  const hasWinner = parent.nominees.length > 0

  return (
    <section>
      {/* Category header */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        <img
          src={getCategoryImage(parent)}
          alt={parent.name}
          className="w-full h-40 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
          <div className="px-6 py-4">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Category</p>
            <h2 className="text-2xl font-bold text-white">{parent.name}</h2>
            {parent.description && (
              <p className="text-white/70 text-sm mt-1">{parent.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sub-category pills grid */}
      {parent.subCategories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {parent.subCategories.map(sub => (
            <SubCategoryPill key={sub.id} sub={sub} parentSlug={parent.slug} />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Single category block ──────────────────────────────────────────────────────

function CategoryBlock({ cat }: { cat: CategoryRow }) {
  const totalNominees = cat.nominees.length
  const winner = cat.nominees[0]?.business

  return (
    <Link
      href={`/best-of/${cat.slug}`}
      className="group relative rounded-2xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5"
      style={{ display: 'block' }}
    >
      {/* Cover image */}
      <div className="relative h-36 overflow-hidden bg-slate-200">
        <img
          src={getCategoryImage(cat)}
          alt={cat.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Winner badge */}
        {totalNominees > 0 && (
          <div className="absolute top-2 right-2">
            <img src="/best-of-badge.svg" alt="Best Of" className="w-7 h-7" />
          </div>
        )}

        {/* Category name */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="font-semibold text-white text-sm leading-tight drop-shadow">{cat.name}</p>
        </div>
      </div>

      {/* Sub-category pills */}
      {cat.subCategories.length > 0 && (
        <div className="bg-white p-3 flex flex-wrap gap-1">
          {cat.subCategories.slice(0, 4).map(sub => (
            <span key={sub.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {sub.name}
            </span>
          ))}
          {cat.subCategories.length > 4 && (
            <span className="text-xs text-slate-400">+{cat.subCategories.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  )
}

// ── Sub-category pill (links to parent category page) ─────────────────────────

function SubCategoryPill({
  sub,
  parentSlug,
}: {
  sub: { id: string; name: string; slug: string; _count: { nominees: number } }
  parentSlug: string
}) {
  return (
    <Link
      href={`/best-of/${parentSlug}`}
      className="group flex items-center gap-3 bg-white rounded-xl border border-slate-100 p-4 hover:border-primary hover:shadow-md transition-all"
    >
      <span className="text-xl">{getCategoryEmoji(null)}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text text-sm group-hover:text-primary transition-colors leading-tight">{sub.name}</p>
        <p className="text-xs text-text-secondary mt-0.5">
          {sub._count.nominees} {sub._count.nominees === 1 ? 'pick' : 'picks'}
        </p>
      </div>
    </Link>
  )
}
