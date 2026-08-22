import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidateBusinessData } from '@/lib/revalidate'

// GET /api/admin/businesses — list all businesses (admin only)
export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const businesses = await prisma.business.findMany({
    include: {
      category: { select: { name: true, slug: true } },
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { reviews: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidateBusinessData()

  return NextResponse.json(businesses)
}
