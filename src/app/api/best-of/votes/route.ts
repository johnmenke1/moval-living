import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import {
  castVoteSchema,
  buildVoteSnapshot,
  CastVoteError,
} from '@/lib/best-of-votes'
import { revalidateBestOfVoteData } from '@/lib/revalidate'

/**
 * POST /api/best-of/votes
 *
 * Cast a vote for a BestOfNominee. Requires the caller to be signed in
 * (NextAuth session) AND have a verified email. One vote per (voter,
 * nominee) — the unique constraint catches double-clicks and tab races
 * with a clean 409.
 *
 * Race safety: the INSERT relies on @@unique([voterId, nomineeId]). Two
 * concurrent requests from the same user can both reach the INSERT, but
 * only one will succeed; the other gets a P2002 unique-constraint error
 * which we translate to 409 "you already voted for this".
 *
 * Response codes:
 *   201 { voteId, voterNameSnapshot, voterImageSnapshot } — vote recorded
 *   400 { error: 'Invalid payload' }                       — zod failed
 *   401 { error: 'Sign in to vote' }                       — no session
 *   403 { error: 'Verify your email first', code }         — unverified
 *   404 { error: 'Nominee not found', code }               — bad nomineeId
 *   409 { error: 'You already voted for this', code }      — dup vote
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to vote' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = castVoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { nomineeId } = parsed.data

  // Build the snapshot first — this is also where we enforce email
  // verification. Owner.emailVerified must be set; we re-read from DB
  // instead of trusting the session because the session JWT may be
  // older than the email verification event.
  const voter = await prisma.owner.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, image: true, emailVerified: true },
  })
  if (!voter) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 })
  }
  let snapshot
  try {
    snapshot = buildVoteSnapshot(voter)
  } catch (err) {
    if (err instanceof CastVoteError && err.code === 'NOT_VERIFIED') {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 403 },
      )
    }
    throw err
  }

  // Verify the nominee exists and its category is published. Without this,
  // an attacker with a valid session could INSERT against nomineeIds from
  // deleted/archived categories, leaving dangling votes in the DB.
  const nominee = await prisma.bestOfNominee.findUnique({
    where: { id: nomineeId },
    select: {
      id: true,
      category: { select: { published: true } },
    },
  })
  if (!nominee) {
    return NextResponse.json(
      { error: 'Nominee not found', code: 'NOMINEE_NOT_FOUND' },
      { status: 404 },
    )
  }
  if (!nominee.category.published) {
    return NextResponse.json(
      { error: 'Category not published', code: 'CATEGORY_NOT_PUBLISHED' },
      { status: 404 },
    )
  }

  // Race-safe INSERT. The unique constraint catches double-taps and tab
  // races; we don't need to pre-check with a SELECT first (which would
  // race too).
  try {
    const vote = await prisma.bestOfVote.create({
      data: {
        voterId: voter.id,
        nomineeId,
        voterNameSnapshot: snapshot.voterNameSnapshot,
        voterImageSnapshot: snapshot.voterImageSnapshot,
      },
      select: { id: true, createdAt: true },
    })

    // Track voter activity (used by v1.5 digests). Fire-and-forget so a
    // transient update failure doesn't roll back the vote.
    void prisma.owner
      .update({
        where: { id: voter.id },
        data: { lastBestOfVoteAt: vote.createdAt },
      })
      .catch((e) =>
        console.error('[best-of/votes] lastBestOfVoteAt update failed:', e),
      )

    // Bust the cache so /best-of/[category] reflects the new vote count
    // + the new entry in the voters feed on next request.
    revalidateBestOfVoteData()

    return NextResponse.json(
      {
        ok: true,
        voteId: vote.id,
        voterNameSnapshot: snapshot.voterNameSnapshot,
        voterImageSnapshot: snapshot.voterImageSnapshot,
        votedAt: vote.createdAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      // Unique constraint hit — concurrent vote or user re-clicked.
      return NextResponse.json(
        { error: 'You already voted for this', code: 'ALREADY_VOTED' },
        { status: 409 },
      )
    }
    throw err
  }
}
