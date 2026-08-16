import { prisma } from '@/lib/prisma'
import { categories } from '@/data/categories'
import { BusinessCard } from '@/components/business/BusinessCard'
import { SearchFilters } from '@/components/search/SearchFilters'
import { EmptyState } from '@/components/ui/EmptyState'
import { businessPriority } from '@/lib/business-priority'
import type { Metadata } from 'next'

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    tier?: string
    espanol?: string
  }>
}

export const metadata: Metadata = {
  title: 'Browse Businesses',
  description: 'Search and discover local businesses in Moreno Valley, CA.',
  alternates: { canonical: 'https://www.moval.living/search' },
  openGraph: {
    type: 'website',
    url: 'https://www.moval.living/search',
    title: 'Browse Businesses — moval.living',
    description: 'Search and discover local businesses in Moreno Valley, CA.',
  },
  twitter: { card: 'summary', title: 'Browse Businesses', description: 'Discover local businesses in Moreno Valley, CA.' },
}

// Anchor slug for category section IDs: alphanumeric + hyphens, lowercased.
function anchorFor(slug: string): string {
  return 'cat-' + slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
}

async function getBusinesses(params: {
  q?: string
  category?: string
  tier?: string
  espanol?: string
}) {
  const where: Record<string, unknown> = { status: 'APPROVED' }

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { description: { contains: params.q, mode: 'insensitive' } },
      { tagline: { contains: params.q, mode: 'insensitive' } },
    ]
  }

  // "Se habla español" filter — first-class search facet.
  if (params.espanol) {
    where.seHablaEspanol = true
  }

  if (params.tier === 'CHAMBER') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { chamberMember: true },
          { hispanicChamberMember: true },
        ],
      },
    ]
  } else if (params.tier) {
    where.tier = params.tier.toUpperCase()
  }

  // Pull every approved business matching the filters. We group + sort
  // client-side so the new "by category → tier → A–Z" ordering is the
  // single source of truth across the site.
  const businesses = await prisma.business.findMany({
    where,
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
  })

  // When a single category is filtered, the grouping collapses to one
  // section. Otherwise group by category, alphabetized.
  const singleCategory = params.category
    ? categories.find(c => c.slug === params.category)
    : undefined

  // Bucket businesses by category. Categories without matches are dropped.
  // Type the bucket's category as the Prisma row shape (not the static
  // `categories[]` fallback) so we don't fight extra nullable fields.
  type BucketCategory = NonNullable<(typeof businesses)[number]['category']>
  const buckets = new Map<string, { category: BucketCategory; items: typeof businesses }>()

  for (const b of businesses) {
    const cat = b.category
    if (!cat) continue
    const key = cat.id
    if (!buckets.has(key)) buckets.set(key, { category: cat, items: [] as typeof businesses })
    buckets.get(key)!.items.push(b)
  }

  // Sort each bucket by tier priority then name ascending.
  for (const { items } of buckets.values()) {
    items.sort((a, b) => {
      const diff = businessPriority(a) - businessPriority(b)
      if (diff !== 0) return diff
      return a.name.localeCompare(b.name)
    })
  }

  // Order the sections: filtered category first if applicable, otherwise
  // all categories with matches, sorted alphabetically by name.
  const sections = Array.from(buckets.values()).sort((a, b) =>
    a.category.name.localeCompare(b.category.name)
  )

  // When the user filters to one category, we still want to surface the
  // category name as the H1 — drop the "All Businesses" header.
  const isSingleCategoryView = Boolean(singleCategory) && sections.length > 0

  return {
    sections,
    total: businesses.length,
    isSingleCategoryView,
    singleCategory,
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const { sections, total, isSingleCategoryView, singleCategory } = await getBusinesses(params)

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Search Header */}
      <div className="bg-white border-b border-slate-100 sticky top-16 z-30">
        <div className="container-max py-6">
          <SearchFilters
            categories={categories}
            currentParams={params}
            resultCount={total}
          />
        </div>
      </div>

      <div className="container-max py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text">
              {params.q
                ? `Results for "${params.q}"`
                : isSingleCategoryView && singleCategory
                ? singleCategory.name
                : 'All Businesses'}
            </h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {total} business{total !== 1 ? 'es' : ''} found in Moreno Valley
              {sections.length > 1 && ` · ${sections.length} categories`}
            </p>
          </div>
        </div>

        {sections.length === 0 ? (
          <EmptyState
            title="No businesses found"
            description={
              params.q
                ? `We couldn't find anything matching "${params.q}". Try a different search or browse by category.`
                : 'No businesses in this category yet. Be the first to list!'
            }
            ctaLabel="Submit a Business"
            ctaHref="/submit"
          />
        ) : (
          <div className="space-y-12">
            {sections.map(({ category, items }) => (
              <section
                key={category.id}
                id={anchorFor(category.slug)}
                className="scroll-mt-32"
                aria-labelledby={`${anchorFor(category.slug)}-title`}
              >
                <header className="flex items-baseline justify-between gap-4 mb-5 border-b border-slate-200 pb-3">
                  <h2
                    id={`${anchorFor(category.slug)}-title`}
                    className="text-xl font-bold text-text"
                  >
                    {category.name}
                  </h2>
                  <span className="text-xs font-medium text-text-secondary whitespace-nowrap">
                    {items.length} business{items.length !== 1 ? 'es' : ''}
                  </span>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map(business => (
                    <BusinessCard
                      key={business.id}
                      business={{
                        ...business,
                        isBestOf: business.isBestOfWinner,
                        coupon: business.coupon as {
                          headline: string
                          description?: string | null
                          code?: string | null
                          expiresAt?: string | null
                        } | null,
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
