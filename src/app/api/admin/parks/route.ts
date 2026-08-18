import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/parks
 *
 * Returns every Park row (active + inactive) for the admin editor list.
 * Not paginated — ~50 rows, all visible in one shot.
 */
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parks = await prisma.park.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      address: true,
      amenities: true,
      latitude: true,
      longitude: true,
      googlePlaceId: true,
      googleRating: true,
      googleReviewCount: true,
      heroPhotoUrl: true,
      photoUrls: true,
      blurb: true,
      description: true,
      faqsJson: true,
      featured: true,
      isActive: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ parks })
}
