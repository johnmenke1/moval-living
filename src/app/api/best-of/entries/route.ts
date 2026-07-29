import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// POST /api/best-of/entries — add a business entry to a BestOf category (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      categoryId,
      businessId,
      localOwnership,
      uniqueness,
      communityInvolvement,
      personalVisitReview,
    } = body

    if (!categoryId || !businessId) {
      return NextResponse.json({ error: 'categoryId and businessId are required' }, { status: 400 })
    }

    // Verify category exists
    const category = await prisma.bestOfCategory.findUnique({ where: { id: categoryId } })
    if (!category) {
      return NextResponse.json({ error: 'BestOfCategory not found' }, { status: 404 })
    }

    // Verify business exists
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Check for duplicate entry in this category (schema unique is on businessId alone,
    // meaning a business can only be in one BestOf category total; additionally guard
    // per-category so the intent is clear if/when the schema is corrected)
    const existing = await prisma.bestOfEntry.findFirst({
      where: { businessId, categoryId },
    })
    if (existing) {
      return NextResponse.json({ error: 'This business already has an entry in this category' }, { status: 409 })
    }

    // Compute yearsActive from business creation date
    const yearsActive = (Date.now() - business.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)

    const entry = await prisma.bestOfEntry.create({
      data: {
        categoryId,
        businessId,
        localOwnership: localOwnership ?? 0,
        uniqueness: uniqueness ?? 0,
        communityInvolvement: communityInvolvement ?? 0,
        personalVisitReview: personalVisitReview ?? 0,
        googleRating: business.googleRating,
        googleReviewCount: business.googleReviewCount,
        yearsActive,
      },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('BestOf entry creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
