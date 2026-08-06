import { prisma } from '@/lib/prisma'
import { HomePageClient } from '@/components/home/HomePageClient'
import { JsonLd } from '@/components/seo/JsonLd'

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
  // Homepage is curated, not algorithmic: only Best-Of winners and Featured listings.
  // Order: BestOf+Featured → Featured only → BestOf-only winners. No FREE listings.
  return prisma.business.findMany({
    where: {
      status: 'APPROVED',
      OR: [
        { tier: 'FEATURED' },
        { isBestOfWinner: true },
      ],
    },
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
  })
}

export default async function HomePage() {
  const [candidates, categoryCounts] = await Promise.all([
    getHomepageBusinesses(),
    getCategoryCounts(),
  ])

  // Priority: 0 = BestOf+Featured, 1 = Featured, 2 = BestOf-only
  const priority = (b: { tier: string; isBestOfWinner: boolean }) =>
    b.isBestOfWinner && b.tier === 'FEATURED' ? 0 : b.tier === 'FEATURED' ? 1 : 2

  const sorted = [...candidates].sort((a, b) => {
    const diff = priority(a) - priority(b)
    // Within a tier, keep most recent first
    return diff !== 0 ? diff : b.createdAt.getTime() - a.createdAt.getTime()
  })

  const featuredBusinesses = sorted.map(b => ({
    ...b,
    isBestOf: b.isBestOfWinner,
  }))

  return (
    <>
      <JsonLd schema={WEBSITE_SCHEMA} />
      <JsonLd schema={ORGANIZATION_SCHEMA} />
      <HomePageClient featuredBusinesses={featuredBusinesses} categoryCounts={categoryCounts} />
    </>
  )
}
