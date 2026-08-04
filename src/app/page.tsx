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

  return <HomePageClient featuredBusinesses={featuredBusinesses} />
}
