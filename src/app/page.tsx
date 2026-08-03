import { prisma } from '@/lib/prisma'
import { HomePageClient } from '@/components/home/HomePageClient'

// Force dynamic rendering so featured businesses list is always fresh
export const dynamic = 'force-dynamic'

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

  // Sort: BestOf #1 first, then FEATURED, then FREE — within each tier
  // preserve the createdAt-desc order. The bestOfRank column on Business
  // is denormalized and indexed; it's maintained by the admin recalculate API.
  const sorted = [...allApproved].sort((a, b) => {
    const aBest = a.bestOfRank === 1 ? 0 : a.tier === 'FEATURED' ? 1 : 2
    const bBest = b.bestOfRank === 1 ? 0 : b.tier === 'FEATURED' ? 1 : 2
    return aBest - bBest
  })

  const featuredBusinesses = sorted.map(b => ({
    ...b,
    isBestOf: b.bestOfRank === 1,
  }))

  return <HomePageClient featuredBusinesses={featuredBusinesses} />
}
