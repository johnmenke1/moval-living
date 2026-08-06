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

async function getFeaturedBusinesses() {
  return prisma.business.findMany({
    where: {
      status: 'APPROVED',
    },
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export default async function HomePage() {
  const allApproved = await getFeaturedBusinesses()

  // Sort: BestOf winners first, then FEATURED, then FREE — within each tier
  // preserve the createdAt-desc order. isBestOfWinner is a manual admin flag on Business.
  const sorted = [...allApproved].sort((a, b) => {
    const aBest = a.isBestOfWinner ? 0 : a.tier === 'FEATURED' ? 1 : 2
    const bBest = b.isBestOfWinner ? 0 : b.tier === 'FEATURED' ? 1 : 2
    return aBest - bBest
  })

  const featuredBusinesses = sorted.map(b => ({
    ...b,
    isBestOf: b.isBestOfWinner,
  }))

  return (
    <>
      <JsonLd schema={WEBSITE_SCHEMA} />
      <JsonLd schema={ORGANIZATION_SCHEMA} />
      <HomePageClient featuredBusinesses={featuredBusinesses} />
    </>
  )
}
