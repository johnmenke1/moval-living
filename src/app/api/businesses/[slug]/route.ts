import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        category: true,
        reviews: {
          where: { flagged: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json(business)
  } catch (error) {
    console.error('Business fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()

    const business = await prisma.business.update({
      where: { slug },
      data: body,
    })

    return NextResponse.json(business)
  } catch (error) {
    console.error('Business update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
