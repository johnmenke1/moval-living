import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any = sort === 'rating'
      ? { reviews: { _count: 'desc' } }
      : sort === 'name'
      ? { name: 'asc' }
      : { createdAt: 'desc' }

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where: { status: 'APPROVED', hasCoupon: true },
        include: {
          category: true,
          reviews: true,
          _count: { select: { reviews: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.business.count({ where: { status: 'APPROVED', hasCoupon: true } }),
    ])

    return NextResponse.json({ businesses, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Deals listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
