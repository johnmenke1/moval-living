import { prisma } from '@/lib/prisma'
import { HomePageClient } from '@/components/home/HomePageClient'
import { JsonLd } from '@/components/seo/JsonLd'
import { compareBusinesses } from '@/lib/business-priority'

// Force dynamic rendering so featured businesses list is always fresh
export const dynamic = 'force-dynamic'

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'moval.living',
  url: 'https://www.moval.living',
  description: 'Discover trusted local businesses in Moreno Valley, CA.',
  publisher: {
    '@type': 'Organization',
    name: 'moval.living',
    url: 'https://www.moval.living',
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.moval.living/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'moval.living',
  url: 'https://www.moval.living',
  description: 'Your trusted guide to local businesses in Moreno Valley, California.',
  areaServed: {
    '@type': 'City',
    name: 'Moreno Valley',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
}

async function getCategoryCounts() {
  // Single grouped query — count APPROVED businesses per category slug.
  const rows = await prisma.business.findMany({
    where: { status: 'APPROVED' },
    select: { category: { select: { slug: true } } },
  })
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const slug = r.category?.slug
    if (!slug) continue
    counts[slug] = (counts[slug] ?? 0) + 1
  }
  return counts
}

async function getHomepageBusinesses() {
  // Homepage is curated, not algorithmic: only Best-Of winners and Featured/Expert
  // Partner listings. Expert Partner is "Featured + more" — same elevated tier for
  // homepage placement. Order: BestOf+Featured/EP → Featured/EP only → BestOf-only.
  // No FREE listings.
  return prisma.business.findMany({
    where: {
      status: 'APPROVED',
      OR: [
        { tier: 'FEATURED' },
        { tier: 'EXPERT_PARTNER' },
        { isBestOfWinner: true },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      address: true,
      tier: true,
      status: true,
      logo: true,
      coverImage: true,
      photos: true,
      createdAt: true,
      isBestOfWinner: true,
      isExpertPartner: true,
      foundingPartnerSince: true,
      // Languages & Chamber affiliation badges
      seHablaEspanol: true,
      chamberMember: true,
      hispanicChamberMember: true,
      category: { select: { name: true, slug: true } },
      reviews: { select: { rating: true } },
      _count: { select: { reviews: true } },
    },
  })
}

// Recent "Life in MoVal" editorial posts for the homepage callout. We pull the
// most recent published LIFE posts (capped at 3) and only the fields the
// homepage card actually renders — slug, title, excerpt, hero, publish date.
// If there are no published LIFE posts yet, the homepage falls back to hiding
// the section entirely (handled in HomePageClient).
async function getLatestLifePosts() {
  return prisma.guestPost.findMany({
    where: { status: 'published', postType: 'LIFE' },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImageUrl: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  })
}

export default async function HomePage() {
  const [candidates, categoryCounts, latestLifePosts] = await Promise.all([
    getHomepageBusinesses(),
    getCategoryCounts(),
    getLatestLifePosts(),
  ])

  // Sort priority — shared with /search and category pages so listings
  // appear in a consistent, curated order everywhere:
  //   0 = Expert Partner (any combination — EP wins outright)
  //   1 = Best Of + (FEATURED or EXPERT_PARTNER tier)
  //   2 = (FEATURED or EXPERT_PARTNER tier) only
  //   3 = Best Of only
  //   4 = FREE (filtered out below, never reaches the homepage grid)
  const sorted = [...candidates].sort(compareBusinesses)

  const featuredBusinesses = sorted.map(b => ({
    ...b,
    isBestOf: b.isBestOfWinner,
    seHablaEspanol: b.seHablaEspanol,
    chamberMember: b.chamberMember,
    hispanicChamberMember: b.hispanicChamberMember,
  }))

  return (
      <>
        <JsonLd schema={WEBSITE_SCHEMA} />
        <JsonLd schema={ORGANIZATION_SCHEMA} />
        <HomePageClient
          featuredBusinesses={featuredBusinesses}
          categoryCounts={categoryCounts}
          latestLifePosts={latestLifePosts.map(p => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            heroImageUrl: p.heroImageUrl,
            publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
          }))}
        />
      </>
    )
  }
