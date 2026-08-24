import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  buildReviewsPageResponse,
  buildEmptyReviewsResponse,
} from '@/app/dashboard/profile/your-reviews-helpers'

/**
 * GET /api/profile/reviews
 *
 * Returns the current Owner's reviews (the rows that have ownerId =
 * session.user.id). Used by /dashboard/profile to render the
 * "Your reviews" section.
 *
 * Why this exists:
 *   - Reviews left before the ownerId migration have ownerId = NULL
 *     and won't appear here. That's by design — we only show
 *     reviews we can prove are tied to this account.
 *   - Reviews left by a user before they had an account, then the
 *     user signed up with a matching email, were backfilled on prod
 *     migration (zero matches on this dataset; all 18 legacy reviews
 *     remain ownerId = NULL).
 *
 * Shape matches the page consumer's expectations:
 *   { reviews: ReviewPageItem[], total: number }
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to view your reviews' },
      { status: 401 },
    )
  }

  const rows = await prisma.review.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50, // soft cap; v1.1 can add pagination if needed
    select: {
      id: true,
      rating: true,
      content: true,
      authorName: true,
      authorEmail: true,
      response: true,
      flagged: true,
      createdAt: true,
      business: { select: { id: true, name: true, slug: true } },
    },
  })

  if (rows.length === 0) {
    return NextResponse.json(buildEmptyReviewsResponse())
  }

  return NextResponse.json({
    reviews: rows.map((r) =>
      buildReviewsPageResponse({
        ...r,
        createdAt: r.createdAt.toISOString(),
      }),
    ),
    total: rows.length,
  })
}