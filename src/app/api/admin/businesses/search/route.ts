import { NextRequest, NextResponse } from 'next/server'
import { and, asc, eq, ilike } from 'drizzle-orm'
import { db, business, escapeLike } from '@/db'
import { auth } from '@/auth'

// GET /api/admin/businesses/search?q= — search businesses for BestOf admin
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q.trim()) return NextResponse.json({ businesses: [] })

  const businesses = await db.query.business.findMany({
    where: and(ilike(business.name, `%${escapeLike(q)}%`), eq(business.status, 'APPROVED')),
    columns: {
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
    limit: 20,
    orderBy: asc(business.name),
  })

  return NextResponse.json({ businesses })
}
