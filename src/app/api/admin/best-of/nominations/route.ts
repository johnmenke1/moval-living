import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/best-of/nominations
// Returns the last 100 nominations with the related business (if matched)
// and any linked category. Admin-only.
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nominations = await prisma.bestOfNomination.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      business: {
        select: { id: true, name: true, slug: true, status: true, logo: true },
      },
    },
  })

  return NextResponse.json(nominations)
}