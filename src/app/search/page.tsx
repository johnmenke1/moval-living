import { Suspense } from 'react'
import { Building2, Sparkles, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { categories } from '@/data/categories'
import { BusinessCard } from '@/components/business/BusinessCard'
import { SearchFilters } from '@/components/search/SearchFilters'
import { EmptyState } from '@/components/ui/EmptyState'
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

  if (params.tier === 'CHAMBER') {
    // Show businesses affiliated with either chamber — covers the Chamber
    // Members filter chip in the search dropdown. We AND this with any
    // existing search query rather than overwriting it.
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
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const { total, groups, categoryNav } = await getBusinesses(params)
  const selectedCategory = categories.find(c => c.slug === params.category)

  // Headline adapts to what's in the URL: a query gets the most prominent
  // treatment, a deep-linked category gets the category name, and the
  // default landing is a brand-style "Discover MoVal" heading.
  const headline = params.q
    ? { eyebrow: 'Search results', title: <>Results for &ldquo;{params.q}&rdquo;</>, color: 'primary' as const }
    : selectedCategory
      ? { eyebrow: 'Category', title: selectedCategory.name, color: 'primary' as const }
      : { eyebrow: 'Local Business Directory', title: <>Discover <span className="text-primary">MoVal</span></>, color: 'primary' as const }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header — single cohesive card with brand wash + decorative watermark.
          Matches the /events treatment so the two search/listing pages
          feel like a related family. Sticky so filters follow scroll. */}
      <div className="sticky top-16 z-30">
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

              {/* Filter row — search input primary, dropdowns subordinated */}
              <SearchFilters
                categories={categories}
                currentParams={params}
                resultCount={total}
                categoryNav={categoryNav}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results body */}
      <div className="container-max py-8">
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
                // `scroll-mt-*` clears the sticky header when jumping to an anchor.
                className="scroll-mt-48"
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