import { Suspense } from 'react'
import { Building2, Sparkles, Search, MapPin } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { categories } from '@/data/categories'
import { BusinessCard } from '@/components/business/BusinessCard'
import { SearchFilters } from '@/components/search/SearchFilters'
import { CompactSearchBar } from '@/components/search/CompactSearchBar'
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
  // Always present in our grouped results — businesses with no category
  // land in the synthetic "Uncategorized" bucket at the end.
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
  // Category-slug → display-name for the jump-to anchor nav. Same order
  // as `groups` (alphabetical). Categories with 0 results are stripped.
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

  // The category dropdown is a "jump to" anchor, not a filter, so we no
  // longer scope the WHERE to a single category here. The user can still
  // arrive on /search?category=restaurants via a deep link — we honor that
  // by rendering the page normally and scrolling to that section on mount.
  void params.category

  // "Se habla español" filter — with ~35% of Moreno Valley Spanish-speaking,
  // language is a first-class search facet, not just a badge. Linkable
  // directly as /search?espanol=1.
  if (params.espanol) {
    where.seHablaEspanol = true
  }

  // Tier filter dropped (2026-08-16): the All / Featured / Free / Chamber
  // buttons weren't earning their space per Johnny. Existing deep links
  // with ?tier= still resolve (this param is just ignored). Within-group
  // presentation order (EP → Featured → BestOf → Free) still uses
  // compareBusinessesForSearch below.

  // No pagination — the grouped layout is the navigation. ~687 approved
  // businesses spread across ~20 categories is scannable; we'll revisit
  // with virtualization if the page ever feels slow.
  const businesses = await prisma.business.findMany({
    where,
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
  })

  // Project to the map dataset and the grouped display dataset. Drop
  // businesses missing coordinates from the map view (common for older
  // imports) while still including them in the category list.
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

  // Shape into a list of category groups. Businesses with no category land
  // in an "Uncategorized" bucket at the end (shouldn't happen given the
  // schema, but defensive).
  const byCategory = new Map<string, CategoryGroup>()
  for (const b of businesses) {
    const slug = b.category?.slug ?? '__uncategorized'
    const name = b.category?.name ?? 'Uncategorized'
    const categoryId = b.category?.id ?? null
    if (!byCategory.has(slug)) {
      byCategory.set(slug, { slug, name, categoryId, businesses: [] })
    }
    // Project to the minimum shape the comparator needs plus the fields
    // BusinessCard actually consumes. Pass the whole row through — the
    // BusinessCard prop type is loose.
    byCategory.get(slug)!.businesses.push(b as unknown as SearchBusiness)
  }

  // Within each category: Expert Partner → Featured → BestOf → Free, each
  // tier A→Z (compareBusinessesForSearch).
  for (const group of byCategory.values()) {
    group.businesses.sort(compareBusinessesForSearch)
  }

  // Sort categories alphabetically by display name. "Uncategorized" goes
  // last regardless of locale so it doesn't surprise the reader.
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

  // Headline adapts to what's in the URL: a query gets the most prominent
  // treatment, a deep-linked category gets the category name, and the
  // default landing is a brand-style "Discover MoVal" heading.
  const headline = params.q
    ? { eyebrow: 'Search results', title: <>Results for &ldquo;{params.q}&rdquo;</> }
    : selectedCategory
      ? { eyebrow: 'Category', title: selectedCategory.name }
      : { eyebrow: 'Local Business Directory', title: <>Discover <span className="text-primary">MoVal</span></> }

  // Active filter detection — drives the Clear button visibility on the
  // compact sticky bar. Anything non-default counts as active.
  const hasActiveFilters = Boolean(params.q || params.category || params.espanol)

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header — single cohesive card with brand wash + decorative watermark.
          Matches the /events treatment so the two search/listing pages
          feel like a related family. NOT sticky — only the search bar
          sticks. This block (title + category nav + category dropdown)
          scrolls away naturally, freeing up screen real estate once the
          user is reading business cards. */}
      <div className="container-max pt-6 pb-3">
        <div
          className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-secondary/8 via-white to-primary/5"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='1' cy='1' r='1' fill='%23015a6b' fill-opacity='0.10'/></svg>\"), linear-gradient(to bottom right, rgba(1,90,107,0.06), white, rgba(0,122,127,0.04))",
          }}
        >
          {/* Decorative watermark — soft, big, behind everything */}
          <Building2
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 w-64 h-64 text-primary/[0.06] rotate-12"
          />
          <Building2
            aria-hidden
            className="pointer-events-none absolute -left-12 bottom-0 w-48 h-48 text-secondary/[0.05] -rotate-6"
          />

          <div className="relative px-5 sm:px-8 pt-6 pb-5">
            {/* Title row */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary shrink-0">
                <Search className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                {/* Eyebrow chip — small primary chip that establishes the
                    page's identity ("Local Business Directory") before
                    the title. Matches the events-page treatment. */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <Sparkles className="w-3 h-3" />
                  {headline.eyebrow}
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold text-text leading-tight">
                  {headline.title}
                </h1>
              </div>
            </div>

            {/* Filter row — only the secondary filters live here (category
                select, language toggle). The search bar is rendered
                separately below in the sticky compact bar so it stays
                visible while scrolling without taking up massive real
                estate. */}
            <SearchFilters
              categories={categories}
              currentParams={params}
              categoryNav={categoryNav}
            />
          </div>
        </div>
      </div>

      {/* Compact sticky search bar — search input + lang toggle + clear.
          Sticks to the top once the header card scrolls past. Small
          footprint so it doesn't block listings. */}
      <div className="sticky top-16 z-30 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/70">
        <div className="container-max py-3">
          <CompactSearchBar
            currentParams={params}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>

      {/* Results body */}
      <div className="container-max py-8">
        {/* Interactive map — placed above the listing grid so spatial discovery
            happens before the user dives into category cards. Wrapped in a
            subtle white card so it sits apart from the slate-50 page background.
            No markers show when all results lack coordinates; the map still
            renders centered on Moreno Valley with a count chip. */}
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

            {/* Legend for marker tiers */}
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

        {/* Result count strip — sits below the sticky header so it's always
            visible when scrolling through long category lists. Wrapped in
            a tinted rounded-2xl so it reads as a small 'results bar'
            rather than bare text. */}
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
                // `scroll-mt-*` clears the sticky search bar when jumping
                // to an anchor (the search bar is much shorter now so 48
                // is plenty).
                className="scroll-mt-32"
              >
                {/* Category section header — small icon + name + count chip,
                    with a brand-tinted gradient underline so each category
                    reads as a distinct section (matches /events treatment).
                    `h-px` div handles the gradient since `border-` doesn't
                    accept gradient color stops. */}
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