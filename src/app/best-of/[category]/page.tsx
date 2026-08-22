import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { BusinessCard } from '@/components/business/BusinessCard'

interface Props {
  params: Promise<{ category: string }>
}

async function getCategory(slug: string) {
  return prisma.bestOfCategory.findUnique({
    where: { slug, published: true },
    include: {
      nominees: {
        orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
        include: {
          business: {
            // Shape mirrors BusinessCard's props so we can drop the
            // business straight into the home-style card component.
            select: {
              id: true, name: true, slug: true, tagline: true, description: true,
              address: true, city: true, state: true, zip: true,
              logo: true, coverImage: true, photos: true,
              tier: true, status: true, hasCoupon: true,
              isBestOfWinner: true, isExpertPartner: true, foundingPartnerSince: true,
              website: true, phone: true, email: true,
              googleRating: true, googleReviewCount: true,
              category: { select: { name: true, slug: true } },
              reviews: { select: { rating: true } },
              _count: { select: { reviews: true } },
            },
          },
        },
      },
      subCategories: {
        where: { published: true },
        orderBy: { name: 'asc' },
        include: {
          nominees: {
            orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
            include: {
              business: {
                select: {
                  id: true, name: true, slug: true, tagline: true, description: true,
                  address: true, city: true, state: true, zip: true,
                  logo: true, coverImage: true, photos: true,
                  tier: true, status: true, hasCoupon: true,
                  isBestOfWinner: true, isExpertPartner: true, foundingPartnerSince: true,
                  website: true, phone: true, email: true,
                  googleRating: true, googleReviewCount: true,
                  category: { select: { name: true, slug: true } },
                  reviews: { select: { rating: true } },
                  _count: { select: { reviews: true } },
                },
              },
            },
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
      name: 'MoVal Living',  // display name (canonical: Title Case)
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
          // with home-style business cards listed inline below.
          <SubCategorySections subCategories={cat.subCategories} />
        ) : nominees.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">{emoji}</p>
            <h2 className="text-xl font-bold text-text mb-2">Coming Soon</h2>
            <p className="text-text-secondary">Our editors are working on this pick. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nominees.map((nominee, idx) => (
              <BestOfCardWrapper
                key={nominee.id}
                nominee={nominee}
                rank={idx + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// Shape needed to feed BusinessCard. Mirrors BusinessCard's prop shape
// closely so we can drop a `nominee.business` straight into it.

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
    tagline: string | null
    description: string
    address: string
    city: string
    state: string
    zip: string
    logo: string | null
    coverImage: string | null
    photos: string[]
    tier: string
    status: string
    hasCoupon: boolean
    isBestOfWinner: boolean
    isExpertPartner: boolean
    foundingPartnerSince: string | Date | null
    website: string | null
    phone: string | null
    email: string | null
    googleRating: number | null
    googleReviewCount: number | null
    category: { name: string; slug: string }
    reviews: Array<{ rating: number }>
    _count: { reviews: number }
  }
}

// Wrapper that drops the home-style BusinessCard onto a nominee and
// overlays a small winner / rank ribbon so winners stay visually distinct
// from runner-ups.

function BestOfCardWrapper({ nominee, rank }: { nominee: Nominee; rank: number }) {
  const { business } = nominee
  return (
    <div className="relative">
      <BusinessCard business={business} />

      {/* Winner ribbon (top-right) */}
      {nominee.winner && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-gradient-to-br from-amber-400 to-amber-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg border border-amber-300">
          🏆 Winner
        </div>
      )}

      {/* Runner-up rank ribbon (top-left, only when there's a winner above) */}
      {!nominee.winner && rank > 1 && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-slate-800/85 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
          #{rank}
        </div>
      )}

      {/* Editorial notes — show below the card if present */}
      {nominee.notes && (
        <p className="mt-2 text-sm text-text-secondary italic px-1">
          &ldquo;{nominee.notes}&rdquo;
        </p>
      )}
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

// ── Parent category: titled sections with home-style business cards ─────────

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

          {/* Cards inline */}
          {sub.nominees.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center text-text-secondary">
              No winner assigned yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sub.nominees.map((nominee, idx) => (
                <BestOfCardWrapper
                  key={nominee.id}
                  nominee={nominee}
                  rank={idx + 1}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
