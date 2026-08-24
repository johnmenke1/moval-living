import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { normalizeReviewEmail } from '@/lib/review-owner-helpers'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { authorName, authorEmail, rating, content } = await request.json()

    if (!authorName?.trim() || !rating || !content?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({ where: { slug } })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // If the reviewer is signed in, link the review to their Owner
    // account. authorName/authorEmail are still snapshotted so the
    // review retains its display identity even if the user later
    // renames themselves in /dashboard/profile.
    const session = await auth()
    const ownerId = session?.user?.id ?? null

    const review = await prisma.review.create({
      data: {
        businessId: business.id,
        ownerId,
        authorName: authorName.trim(),
        authorEmail: normalizeReviewEmail(authorEmail) || null,
        rating,
        content: content.trim(),
      },
    })

    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    console.error('Review creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const reviews = await prisma.review.findMany({
      where: {
        business: { slug },
        flagged: false,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Reviews fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
