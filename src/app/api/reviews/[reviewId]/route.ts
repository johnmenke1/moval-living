import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ownerOwnsReview } from '@/app/dashboard/profile/review-delete-helpers'

/**
 * DELETE /api/reviews/[reviewId]
 *
 * Hard-deletes a Review row owned by the current Owner.
 *
 * Authorization model:
 *   - The review must be tied to the session owner via one of:
 *     1. Review.ownerId === session.user.id (modern reviews)
 *     2. Review.authorEmail matches session user email (legacy
 *        anonymous reviews that were written before the user
 *        had an account)
 *   - Otherwise: 403. We never let a logged-in user delete a
 *     review they didn't leave, even if they happen to know the
 *     reviewId.
 *
 * Why hard-delete (not soft-delete):
 *   - Reviews are personal content. If a user wants it gone,
 *     they want it GONE.
 *   - No business analytics depend on "deleted reviews" — the
 *     business's average rating is recomputed from the surviving
 *     rows in the page query.
 *   - Easier GDPR/right-to-erasure compliance: a user saying
 *     "delete my review" should result in no copy anywhere.
 *
 * Returns:
 *   - 200 { ok: true } on success
 *   - 401 { error: 'Sign in to delete your review' } when no session
 *   - 403 { error: 'You can only delete your own reviews' } when
 *     the review exists but isn't owned by the session user
 *   - 404 { error: 'Review not found' } when the reviewId doesn't exist
 *     (we use 404 to avoid leaking whether a review exists at all)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to delete your review' },
      { status: 401 },
    )
  }

  const { reviewId } = await params

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, ownerId: true, authorEmail: true },
  })

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  if (
    !ownerOwnsReview(review, session.user.id, session.user.email ?? null)
  ) {
    return NextResponse.json(
      { error: "You can only delete your own reviews" },
      { status: 403 },
    )
  }

  await prisma.review.delete({ where: { id: reviewId } })

  return NextResponse.json({ ok: true })
}
