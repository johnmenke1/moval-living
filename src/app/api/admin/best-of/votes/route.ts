import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/best-of/votes
 *
 * Admin-only voter activity for the Best Of dashboard. Returns:
 *   - Top voters (most-active Owners, with vote counts)
 *   - Recent vote stream (newest first, joined with nominee + category)
 *   - Per-nominee vote totals (for the active category, if `categoryId`
 *     query param is set)
 *
 * Auth: this endpoint lives under /api/admin/* — the dashboard gate
 * checks ADMIN role on the session before allowing access. We re-check
 * role here as defense-in-depth so a leaked URL doesn't expose voter
 * identity data.
 *
 * Query params:
 *   limit     — max recent votes to return (default 50, max 200)
 *   categoryId — optional; when set, includes per-nominee totals for
 *                this category (used by the tab UI when a category is
 *                selected)
 */
export async function GET(req: NextRequest) {
  // Defense-in-depth role check. The dashboard shell already enforces
  // ADMIN, but we re-check here so this endpoint can't be called by
  // a non-admin even if the dashboard gate is misconfigured.
  const { auth } = await import('@/auth')
  const session = await auth()
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '50', 10)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), 200)
    : 50
  const categoryId = url.searchParams.get('categoryId')

  // Three queries in parallel:
  //   1. Recent vote stream — what just happened
  //   2. Top voters — who is most engaged
  //   3. Per-nominee totals (if categoryId provided)
  const [recentVotes, topVoters, perNomineeCounts] = await Promise.all([
    prisma.bestOfVote.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        voterId: true,
        voterNameSnapshot: true,
        voterImageSnapshot: true,
        createdAt: true,
        nominee: {
          select: {
            id: true,
            business: { select: { id: true, name: true, slug: true } },
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        voter: {
          select: {
            email: true,
            lastBestOfVoteAt: true,
          },
        },
      },
    }),
    // Group by voter to find most-active Owners.
    prisma.bestOfVote.groupBy({
      by: ['voterId'],
      _count: { _all: true },
      orderBy: { _count: { voterId: 'desc' } },
      take: 20,
    }),
    categoryId
      ? prisma.bestOfVote.groupBy({
          by: ['nomineeId'],
          where: { nominee: { categoryId } },
          _count: { _all: true },
          orderBy: { _count: { nomineeId: 'desc' } },
        })
      : Promise.resolve([] as { nomineeId: string; _count: { _all: number } }[]),
  ])

  // Hydrate the top-voters list with the Owner's name + avatar.
  // (BestOfVote doesn't store voterId in the snapshot — only the
  // display fields. We re-join the Owner table to get the live
  // name/avatar so an admin sees who the voter actually is.)
  const voterIds = topVoters.map((v) => v.voterId)
  const owners =
    voterIds.length > 0
      ? await prisma.owner.findMany({
          where: { id: { in: voterIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : []
  const ownerById = new Map(owners.map((o) => [o.id, o]))
  const topVotersHydrated = topVoters.map((v) => {
    const owner = ownerById.get(v.voterId)
    return {
      voterId: v.voterId,
      voterName: owner?.name ?? '—',
      voterEmail: owner?.email ?? null,
      voterImage: owner?.image ?? null,
      voteCount: v._count._all,
    }
  })

  // Hydrate the per-nominee counts with the nominee name so the UI
  // doesn't have to do a second roundtrip.
  const nomineeIds = perNomineeCounts.map((p) => p.nomineeId)
  const nominees =
    nomineeIds.length > 0
      ? await prisma.bestOfNominee.findMany({
          where: { id: { in: nomineeIds } },
          select: {
            id: true,
            business: { select: { name: true, slug: true } },
          },
        })
      : []
  const nomineeById = new Map(nominees.map((n) => [n.id, n]))
  const perNomineeHydrated = perNomineeCounts.map((p) => {
    const nominee = nomineeById.get(p.nomineeId)
    return {
      nomineeId: p.nomineeId,
      nomineeName: nominee?.business.name ?? '—',
      voteCount: p._count._all,
    }
  })

  return NextResponse.json({
    recentVotes: recentVotes.map((v) => ({
      id: v.id,
      voterName: v.voterNameSnapshot,
      voterImage: v.voterImageSnapshot,
      voterEmail: v.voter?.email ?? null,
      votedAt: v.createdAt.toISOString(),
      nominee: {
        id: v.nominee.id,
        name: v.nominee.business.name,
        slug: v.nominee.business.slug,
      },
      category: {
        id: v.nominee.category.id,
        name: v.nominee.category.name,
        slug: v.nominee.category.slug,
      },
    })),
    topVoters: topVotersHydrated,
    perNominee: categoryId ? perNomineeHydrated : null,
  })
}
