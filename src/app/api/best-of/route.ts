import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/best-of — public: list all categories
export async function GET() {
  const categories = await prisma.bestOfCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      entries: {
        include: {
          business: {
            select: {
              id: true, name: true, slug: true, address: true,
              logo: true, website: true, googleRating: true, googleReviewCount: true,
            },
          },
        },
        orderBy: { compositeScore: 'desc' },
        where: { compositeScore: { not: null } },
      },
    },
  })

  return NextResponse.json(categories)
}
