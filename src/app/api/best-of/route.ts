import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/best-of — list all published BestOf categories with nominee count
export async function GET() {
  const categories = await prisma.bestOfCategory.findMany({
    where: { published: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      tagHints: true,
      _count: { select: { nominees: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    categories.map(c => ({ ...c, nomineeCount: c._count.nominees })),
  )
}
