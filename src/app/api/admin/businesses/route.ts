import { NextResponse } from 'next/server'
import { desc, sql } from 'drizzle-orm'
import { db, business } from '@/db'
import { auth } from '@/auth'
import { revalidateBusinessData } from '@/lib/revalidate'

// GET /api/admin/businesses — list all businesses (admin only)
export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await db.query.business.findMany({
    with: {
      category: { columns: { name: true, slug: true } },
      owner: { columns: { id: true, name: true, email: true } },
    },
    // Alias-qualified outer column ("business" is the relational alias).
    extras: {
      reviewCount: sql<number>`(select count(*)::int from "Review" r where r."businessId" = "business"."id")`.as(
        'review_count'
      ),
    },
    orderBy: desc(business.createdAt),
  })
  // Keep the old Prisma `_count: { reviews }` shape for the admin UI.
  const businesses = rows.map(({ reviewCount, ...b }) => ({ ...b, _count: { reviews: reviewCount } }))
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidateBusinessData()

  return NextResponse.json(businesses)
}
