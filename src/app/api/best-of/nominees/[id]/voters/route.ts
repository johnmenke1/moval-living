import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/best-of/nominees/[id]/voters
 *
 * Public (no auth required). Returns the most recent voters for a
 * nominee so the category page can render the "<voter 1> · <voter 2> ·
 * ... and 235 more" feed under each card.
 *
 * Query params:
 *   limit — number of voters to return (default 12, max 50)
 *
 * Privacy: only fields the voter has set on their profile are returned.
 * If Owner.name is null, we render "MoVal member" client-side. If
 * Owner.image is null, the client renders initials. Future v2: respect
 * per-user 'always anonymous' opt-out if we add one.
 *
 * Response:
 *   200 {
 *     voters: [{ name, image, votedAt }],
 *     total: number,        // total CONFIRMED-equivalent votes (same as
 *                          // voters.length since we soft-removed vote
 *                          // retraction in v1.1 — every vote counts)
 *     displayed: number     // how many we returned (≤ limit)
 *   }
 *   404 — nominee doesn't exist
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: nomineeId } = await params

  // Sanity-check the nominee exists — without this, an attacker could
  // probe votes for any nomineeId and learn count distribution.
  const nominee = await prisma.bestOfNominee.findUnique({
    where: { id: nomineeId },
    select: {
      id: true,
      category: { select: { published: true } },
    },
  })
  if (!nominee || !nominee.category.published) {
    return NextResponse.json({ error: 'Nominee not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '12', 10)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), 50)
    : 12

  // Two queries in parallel: the recent-voters slice + the total count.
  // Promise.all is fine here — both are simple WHERE clauses with the
  // (nomineeId, createdAt DESC) index, so they hit the same B-tree.
  const [recent, total] = await Promise.all([
    prisma.bestOfVote.findMany({
      where: { nomineeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        voterNameSnapshot: true,
        voterImageSnapshot: true,
        createdAt: true,
      },
    }),
    prisma.bestOfVote.count({ where: { nomineeId } }),
  ])

  return NextResponse.json({
    voters: recent.map((v) => ({
      name: v.voterNameSnapshot,
      image: v.voterImageSnapshot,
      votedAt: v.createdAt.toISOString(),
    })),
    total,
    displayed: recent.length,
  })
}
