import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { computeScores, FACTOR_ORDER } from '@/lib/best-of-score'

// POST /api/best-of/entries/[id]/score — recompute composite score + per-factor breakdown (admin only)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const entry = await prisma.bestOfEntry.findUnique({
      where: { id },
      include: { category: { include: { entries: { select: { googleReviewCount: true, yearsActive: true } } } } },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    // Derive category-level maxima for relative factors
    const maxReviews = Math.max(
      ...entry.category.entries.map((e) => e.googleReviewCount ?? 0),
      entry.googleReviewCount ?? 0
    )
    const maxYears = Math.max(
      ...entry.category.entries.map((e) => e.yearsActive ?? 0),
      entry.yearsActive ?? 0
    )

    const { factors, composite } = computeScores(
      {
        googleRating: entry.googleRating,
        googleReviewCount: entry.googleReviewCount,
        yearsActive: entry.yearsActive,
        localOwnership: entry.localOwnership,
        uniqueness: entry.uniqueness,
        communityInvolvement: entry.communityInvolvement,
        personalVisitReview: entry.personalVisitReview,
      },
      { maxReviews, maxYears }
    )

    // Persist factor scores
    await prisma.$transaction(
      factors.map((f) =>
        prisma.bestOfScore.upsert({
          where: { id: `${id}-${f.factor}` },
          create: {
            id: `${id}-${f.factor}`,
            entryId: id,
            factor: f.factor,
            rawValue: f.rawValue,
            weight: f.weight,
          },
          update: {
            rawValue: f.rawValue,
            weight: f.weight,
          },
        })
      )
    )

    // Persist composite score on entry
    await prisma.bestOfEntry.update({
      where: { id },
      data: { compositeScore: composite },
    })

    return NextResponse.json({
      id,
      composite,
      factors: factors.map((f) => ({
        factor: f.factor,
        rawValue: f.rawValue,
        normalizedScore: Math.round(f.normalizedScore * 100) / 100,
      })),
    })
  } catch (error) {
    console.error('BestOf score computation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
