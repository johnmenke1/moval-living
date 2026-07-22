import { prisma } from '@/lib/prisma'
import { HomePageClient } from '@/components/home/HomePageClient'

async function getFeaturedBusinesses() {
  return prisma.business.findMany({
    where: {
      status: 'APPROVED',
      tier: 'FEATURED',
    },
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
}

async function getAllBusinesses() {
  return prisma.business.findMany({
    where: { status: 'APPROVED' },
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
}

export default async function HomePage() {
  // Try featured first, fall back to any approved businesses
  let featuredBusinesses = await getFeaturedBusinesses()
  if (featuredBusinesses.length === 0) {
    featuredBusinesses = await getAllBusinesses()
  }

  return <HomePageClient featuredBusinesses={featuredBusinesses} />
}
