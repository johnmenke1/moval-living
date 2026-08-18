import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/admin/businesses/search?q= — search businesses for BestOf admin
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q.trim()) return NextResponse.json({ businesses: [] })

  const businesses = await prisma.business.findMany({
    where: {
      name: { contains: q, mode: 'insensitive' },
      status: 'APPROVED',
    },
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      address: true,
      city: true,
      googleRating: true,
      googleReviewCount: true,
      bestOfTags: true,
    },
    take: 20,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ businesses })
}
