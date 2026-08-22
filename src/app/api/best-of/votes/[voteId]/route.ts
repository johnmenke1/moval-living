import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidateBestOfVoteData } from '@/lib/revalidate'

/**
 * DELETE /api/best-of/votes/[voteId]
 *
 * Retract a vote (Google Reviews pattern — "I changed my mind"). Requires
 * the caller to be signed in AND be the original voter. No admin override
 * (admins moderate via the BestOfAdmin dashboard's vote activity tab,
 * not via this endpoint).
 *
 * Response codes:
 *   204 — vote deleted (no body)
 *   401 — not signed in
 *   403 — signed in but not the original voter
 *   404 — vote doesn't exist (or already deleted)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ voteId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to retract votes' }, { status: 401 })
  }

  const { voteId } = await params

  // Verify ownership BEFORE the delete. If we just `deleteMany` with the
  // voterId filter, we'd get a count and could 404 on count=0 — but
  // returning 403 vs 404 leaks existence information (an attacker could
  // enumerate voteIds and learn which exist). Pulling first + checking
  // ownership keeps the response surface honest: 404 means "doesn't
  // exist OR you don't own it", same as GitHub's /repos/{owner}/{repo}
  // patterns.
  const vote = await prisma.bestOfVote.findUnique({
    where: { id: voteId },
    select: { id: true, voterId: true },
  })
  if (!vote || vote.voterId !== session.user.id) {
    return NextResponse.json({ error: 'Vote not found' }, { status: 404 })
  }

  await prisma.bestOfVote.delete({ where: { id: voteId } })

  revalidateBestOfVoteData()
  return new NextResponse(null, { status: 204 })
}
