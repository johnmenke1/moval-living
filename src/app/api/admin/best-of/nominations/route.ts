import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { asc, desc } from 'drizzle-orm'
import { db, bestOfNomination } from '@/db'

// GET /api/admin/best-of/nominations
// Returns the last 100 nominations with the related business (if matched)
// and any linked category. Admin-only.
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nominations = await db.query.bestOfNomination.findMany({
    orderBy: [asc(bestOfNomination.status), desc(bestOfNomination.createdAt)],
    limit: 100,
    with: {
      business: {
        columns: { id: true, name: true, slug: true, status: true, logo: true },
      },
    },
  })

  return NextResponse.json(nominations)
}