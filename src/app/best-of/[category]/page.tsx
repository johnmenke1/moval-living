import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Star, MapPin, Globe, Phone, ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'

interface Props {
  params: Promise<{ category: string }>
}

async function getCategory(slug: string) {
  return prisma.bestOfCategory.findUnique({
    where: { slug, published: true },
    include: {
      nominees: {
        include: {
          business: {
            select: {
              id: true, name: true, slug: true, address: true, city: true, state: true,
              logo: true, website: true, phone: true,
              googleRating: true, googleReviewCount: true,
            },
          },
        },
        orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
      },
      // Parent categories (e.g. best-real-estate) group sub-categories
      // (best-overall-real-estate-agent, best-agent-rancho-belago, etc.)
      // whose individual winners make up the parent's picks.
      //
      // We pull the FULL nominee list (not just winners) so the parent
      // page can render each sub-category as a titled section with full
      // business cards inline — avoiding an extra click before the user
      // sees the actual listing.
      subCategories: {
        where: { published: true },
        orderBy: { name: 'asc' },
        include: {
          nominees: {
            include: {
              business: {
                select: {
                  id: true, name: true, slug: true, address: true, city: true, state: true,
                  logo: true, website: true, phone: true,
                  googleRating: true, googleReviewCount: true,
                },
              },
            },
            orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
          },
          _count: { select: { nominees: true } },
        },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params
  const cat = await getCategory(slug)
  if (!cat) return { title: 'Not Found' }
  const pageUrl = `https://www.moval.living/best-of/${slug}`
  const description = cat.description || `Our editor's pick for ${cat.name} in Moreno Valley.`
  return {
    title: cat.name,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'website',
      url: pageUrl,
      title: cat.name,
      description,
    },
    twitter: { card: 'summary', title: cat.name, description },
  }
}

function buildBestOfCategorySchema(cat: Awaited<ReturnType<typeof getCategory>>) {
  if (!cat) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cat.name,
    description: cat.description || `Our editor's pick for ${cat.name} in Moreno Valley.`,
    url: `https://www.moval.living/best-of/${cat.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'moval.living',
      url: 'https://www.moval.living',
    },
  }
}

function buildNomineesItemList(cat: Awaited<ReturnType<typeof getCategory>>) {
  if (!cat || cat.nominees.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cat.name} — moval.living Best Of`,
    numberOfItems: cat.nominees.length,
    itemListElement: cat.nominees.map((nominee, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: nominee.business.name,
      url: `https://www.moval.living/business/${nominee.business.slug}`,
    })),
  }
}

export default async function BestOfCategoryPage({ params }: Props) {
  const { category: slug } = await params
  const cat = await getCategory(slug)
  if (!cat) notFound()

  const nominees = cat.nominees
  const emoji = cat.icon ? getCategoryEmoji(cat.icon) : '⭐'
  const categorySchema = buildBestOfCategorySchema(cat)
  const itemListSchema = buildNomineesItemList(cat)

  return (
    <>
      {categorySchema && <JsonLd schema={categorySchema} />}
      {itemListSchema && <JsonLd schema={itemListSchema} />}
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
        {cat.subCategories.length > 0 ? (
          // Parent category — show each sub-category as a titled section
          // with the full nominee cards listed inline below.
          <SubCategorySections subCategories={cat.subCategories} />
        ) : nominees.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">{emoji}</p>
            <h2 className="text-xl font-bold text-text mb-2">Coming Soon</h2>
            <p className="text-text-secondary">Our editors are working on this pick. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {nominees.map((nominee, idx) => (
              <NomineeCard key={nominee.id} nominee={nominee} rank={idx + 1} emoji={emoji} />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

type Nominee = {
  id: string
  categoryId: string
  businessId: string
  winner: boolean
  notes: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
  business: {
    id: string
    slug: string
    name: string
    address: string
    city: string
    state: string
    logo: string | null
    website: string | null
    phone: string | null
    googleRating: number | null
    googleReviewCount: number | null
  }
}

function NomineeCard({
  nominee,
  rank,
  emoji,
}: {
  nominee: Nominee
  rank: number
  emoji: string
}) {
  const { business } = nominee
  const isWinner = nominee.winner

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${
      isWinner ? 'border-2 border-amber-300' : 'border-slate-100'
    }`}>
      <div className="flex items-start gap-0">
        {/* Rank badge */}
        <div className={`w-16 shrink-0 flex flex-col items-center justify-center py-6 ${
          isWinner
            ? 'bg-amber-100 text-amber-800'
            : 'bg-slate-50 text-slate-400'
        }`}>
          {isWinner ? (
            <span className="text-2xl">🏆</span>
          ) : (
            <span className="text-lg font-bold">#{rank}</span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              {business.logo ? (
                <img src={business.logo} alt={business.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                  {emoji}
                </div>
              )}
              <div>
                <h3 className="font-bold text-text text-lg leading-tight">{business.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  {business.googleRating != null && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium">{business.googleRating.toFixed(1)}</span>
                    </div>
                  )}
                  {business.googleReviewCount != null && (
                    <span className="text-sm text-text-secondary">
                      {business.googleReviewCount.toLocaleString()} reviews
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Address + contact */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-text-secondary">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{business.address}, {business.city} {business.state}</span>
            </div>
            {business.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>{business.phone}</span>
              </div>
            )}
            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                Website
              </a>
            )}
            <Link
              href={`/business/${business.slug}`}
              className="ml-auto text-sm font-medium text-primary hover:underline"
            >
              View Listing →
            </Link>
          </div>

          {/* Editorial notes */}
          {nominee.notes && (
            <p className="text-sm text-text-secondary italic border-t border-slate-100 pt-3 mt-3">
              {nominee.notes}
            </p>
          )}
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

// ── Parent category: titled sections with full nominee cards inline ──────────
//
// Each sub-category gets a section header (e.g. "Best Overall Real Estate
// Agent") and the full NomineeCard list right underneath. The user goes
// directly from /best-of/[parent] → /business/[slug] without an extra click
// in between.

type SubCategoryRow = {
  id: string
  slug: string
  name: string
  icon: string | null
  nominees: Nominee[]
  _count: { nominees: number }
}

function SubCategorySections({ subCategories }: { subCategories: SubCategoryRow[] }) {
  return (
    <div className="space-y-12">
      {subCategories.map(sub => (
        <section key={sub.id}>
          {/* Sub-category title */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{sub.icon ? getCategoryEmoji(sub.icon) : '🏆'}</span>
            <h2 className="text-xl sm:text-2xl font-bold text-text">{sub.name}</h2>
            {sub._count.nominees > 0 && (
              <span className="text-xs bg-slate-100 text-text-secondary px-2 py-0.5 rounded-full">
                {sub._count.nominees} {sub._count.nominees === 1 ? 'pick' : 'picks'}
              </span>
            )}
          </div>

          {/* Nominees inline */}
          {sub.nominees.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center text-text-secondary">
              No winner assigned yet.
            </div>
          ) : (
            <div className="space-y-4">
              {sub.nominees.map((nominee, idx) => (
                <NomineeCard
                  key={nominee.id}
                  nominee={nominee}
                  rank={idx + 1}
                  emoji={sub.icon ? getCategoryEmoji(sub.icon) : '🏆'}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
