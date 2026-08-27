import { Suspense } from 'react'
import Link from 'next/link'
import { Building2, MapPin, ExternalLink } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { categories } from '@/data/categories'
import { BusinessCard } from '@/components/business/BusinessCard'
import { SearchFilters } from '@/components/search/SearchFilters'
import { CompactSearchBar } from '@/components/search/CompactSearchBar'
import { SearchHeroClient } from '@/components/search/SearchHeroClient'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchMapWrapper } from '@/components/map/SearchMapWrapper'
import { compareBusinessesForSearch } from '@/lib/business-priority'
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

type SearchBusiness = {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string
  address: string
  tier: string
  status: string
  logo: string | null
  coverImage: string | null
  photos: string[]
  isBestOfWinner: boolean
  isExpertPartner: boolean
  foundingPartnerSince: Date | string | null
  seHablaEspanol: boolean
  chamberMember: boolean
  hispanicChamberMember: boolean
  googleRating: number | null
  googleReviewCount: number | null
  category: { name: string; slug: string }
  reviews: { rating: number }[]
  _count: { reviews: number }
  coupon?: unknown
  latitude?: number | null
  longitude?: number | null
}

type CategoryGroup = {
  slug: string
  name: string
  categoryId: string | null
  businesses: SearchBusiness[]
}

type SearchResults = {
  total: number
  groups: CategoryGroup[]
  categoryNav: Array<{ slug: string; name: string }>
  mapItems: Array<{
    id: string
    slug: string
    name: string
    address: string
    city: string
    state: string
    zip: string
    latitude: number
    longitude: number
    category: { name: string; slug: string }
    tier: string
    isExpertPartner: boolean
    isBestOfWinner: boolean
    foundingPartnerSince: Date | string | null
    googleRating: number | null
    googleReviewCount: number | null
    hasCoupon: boolean
  }>
}

async function getBusinesses(params: {
  q?: string
  category?: string
  tier?: string
  espanol?: string
}): Promise<SearchResults> {
  const where: Record<string, unknown> = {
    status: 'APPROVED',
  }

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { description: { contains: params.q, mode: 'insensitive' } },
      { tagline: { contains: params.q, mode: 'insensitive' } },
    ]
  }

  // The category dropdown now filters /search in-place. When a category is
  // selected, we scope the query to that category so both the map and the
  // card grid narrow together. The /category/[slug] pages remain canonical
  // for SEO; /search?category=X is the browsable filtered view.
  if (params.category) {
    where.category = { slug: params.category }
  }

  if (params.espanol) {
    where.seHablaEspanol = true
  }

  const businesses = await prisma.business.findMany({
    where,
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
  })

  const mapItems = businesses
    .filter((b) => b.latitude != null && b.longitude != null)
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      address: b.address,
      city: b.city,
      state: b.state,
      zip: b.zip,
      latitude: b.latitude as number,
      longitude: b.longitude as number,
      category: { name: b.category.name, slug: b.category.slug },
      tier: b.tier,
      isExpertPartner: b.isExpertPartner,
      isBestOfWinner: b.isBestOfWinner,
      foundingPartnerSince: b.foundingPartnerSince,
      googleRating: b.googleRating,
      googleReviewCount: b.googleReviewCount,
      hasCoupon: b.hasCoupon,
    })) as SearchResults['mapItems']

  const byCategory = new Map<string, CategoryGroup>()
  for (const b of businesses) {
    const slug = b.category?.slug ?? '__uncategorized'
    const name = b.category?.name ?? 'Uncategorized'
    const categoryId = b.category?.id ?? null
    if (!byCategory.has(slug)) {
      byCategory.set(slug, { slug, name, categoryId, businesses: [] })
    }
    byCategory.get(slug)!.businesses.push(b as unknown as SearchBusiness)
  }

  for (const group of byCategory.values()) {
    group.businesses.sort(compareBusinessesForSearch)
  }

  const groups = Array.from(byCategory.values()).sort((a, b) => {
    if (a.slug === '__uncategorized') return 1
    if (b.slug === '__uncategorized') return -1
    return a.name.localeCompare(b.name)
  })

  const categoryNav = groups.map(g => ({ slug: g.slug, name: g.name }))

  return {
    total: businesses.length,
    groups,
    categoryNav,
    mapItems,
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const { total, groups, categoryNav, mapItems } = await getBusinesses(params)
  const selectedCategory = categories.find(c => c.slug === params.category)

  // Headline is split into three segments so SearchHeroClient can wrap the
  // accent phrase in <ShimmerText> while the server stays the source of
  // truth for the literal text (good for SEO + answer-capsule content).
  // Each branch: (eyebrow, before, accent, after).
  const headline = params.q
    ? { eyebrow: 'Search results', before: 'Results for ', accent: `"${params.q}"`, after: '' }
    : selectedCategory
      ? { eyebrow: 'Category', before: '', accent: selectedCategory.name, after: '' }
      : { eyebrow: 'Local Business Directory', before: 'Discover ', accent: 'MoVal', after: '' }

  const hasActiveFilters = Boolean(params.q || params.category || params.espanol)
  const canonicalCategoryUrl = params.category ? `/category/${params.category}` : null

  // Answer-capsule subtitle — server-rendered, lives in the first ~150 words
  // of HTML so AI engines and Google can lift a complete factual answer.
  // Mirrors the /events hero pattern: count + named scope.
  const subtitle = (
    <>
      {total === 0
        ? 'No businesses match these filters yet — try a different category or be the first to list one.'
        : `${total.toLocaleString()} local business${total === 1 ? '' : 'es'} in Moreno Valley${params.q ? ` matching “${params.q}”` : ''}${params.espanol ? ', including Spanish-speaking providers' : ''}.`}
    </>
  )

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero — photo backdrop with ShimmerText on the headline's accent
          phrase + staggered fade-up entry. Houses the consolidated search
          input (was CompactSearchBar) and category filters (was SearchFilters).
          Replaces the old header card + sticky bar; the hero is now the
          single source of truth for filtering /search. */}
      <SearchHeroClient
        eyebrow={headline.eyebrow}
        titleBefore={headline.before}
        titleAccent={headline.accent}
        titleAfter={headline.after}
        subtitle={subtitle}
        compactSearchBar={
          <CompactSearchBar
            currentParams={params}
            hasActiveFilters={hasActiveFilters}
          />
        }
        searchFilters={
          <SearchFilters
            categories={categories}
            currentParams={params}
            categoryNav={categoryNav}
          />
        }
      />

      {/* Results body */}
      <div className="container-max py-8">
        {mapItems.length > 0 && (
          <section className="mb-10" aria-label="Businesses on a map">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text">Explore on the map</h2>
                  <p className="text-sm text-text-secondary">
                    {mapItems.length} business{mapItems.length !== 1 ? 'es' : ''} with locations
                    {total - mapItems.length > 0 && (
                      <span className="text-text-secondary/70"> · {total - mapItems.length} without map locations</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <Suspense fallback={<div className="w-full h-[420px] bg-slate-100 animate-pulse rounded-2xl" />}>
              <SearchMapWrapper businesses={mapItems} />
            </Suspense>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-secondary px-1">
              <span className="font-semibold text-text">Pin guide:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#D97706' }} />
                Expert Partner
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F97316' }} />
                Featured
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#007A7F' }} />
                Best of MoVal
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00405C' }} />
                Standard
              </span>
            </div>
          </section>
        )}

        {/* Result count strip */}
        <div className="flex items-center justify-between mb-6 px-4 py-3 rounded-2xl bg-secondary/5 border border-secondary/15">
          <p className="text-sm text-text-secondary">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-text text-xs font-bold mr-1.5">{total}</span>
            business{total !== 1 ? 'es' : ''} found in Moreno Valley
            {groups.length > 1 && (
              <>
                <span className="mx-2 text-slate-300">·</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-text text-xs font-bold mr-1.5">{groups.length}</span>
                categor{groups.length === 1 ? 'y' : 'ies'}
              </>
            )}
          </p>
          {canonicalCategoryUrl && (
            <Link
              href={canonicalCategoryUrl}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-secondary transition-colors"
            >
              View canonical category page
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>

        {total === 0 ? (
          <EmptyState
            title="No businesses found"
            description={
              params.q
                ? `We couldn't find anything matching "${params.q}". Try a different search or browse by category.`
                : 'No businesses match these filters yet. Be the first to list!'
            }
            ctaLabel="Submit a Business"
            ctaHref="/submit"
          />
        ) : (
          <div className="space-y-10">
            {groups.map(group => (
              <section
                key={group.slug}
                id={`cat-${group.slug}`}
                className="scroll-mt-32"
              >
                <div className="mb-4 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h2 className="text-xl font-bold text-text">{group.name}</h2>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-text-secondary text-xs font-semibold">
                      {group.businesses.length} business{group.businesses.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <div className="h-px bg-gradient-to-r from-primary/40 via-secondary/25 to-transparent" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.businesses.map(business => (
                    <BusinessCard
                      key={business.id}
                      business={business as React.ComponentProps<typeof BusinessCard>['business']}
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
