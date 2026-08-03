import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { computeScores } from '@/lib/best-of-score'

// POST /api/admin/best-of/recalculate
// Recomputes composite scores + ranks for all BestOf entries in a category,
// then syncs bestOfRank on the Business model.
//
// Body: { categoryId?: string }
//   - With categoryId: recalculate only that category
//   - Without categoryId: recalculate ALL categories
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { categoryId } = body as { categoryId?: string }

  const where = categoryId ? { categoryId } : {}

  // Fetch all categories with their entries
  const categories = await prisma.bestOfCategory.findMany({
    where: Object.keys(where).length > 0 ? { id: where.categoryId } : {},
    include: {
      entries: {
        include: {
          business: {
            select: { id: true, googleReviewCount: true, createdAt: true },
          },
        },
      },
    },
  })

  const results: Array<{ category: string; updated: number; topBusiness: string | null }> = []

  for (const category of categories) {
    const entries = category.entries

    if (entries.length === 0) {
      // Clear any existing bestOfRank on businesses that were in this empty category
      await prisma.business.updateMany({
        where: { bestOfRank: { not: null } },
        data: { bestOfRank: null },
      })
      results.push({ category: category.name, updated: 0, topBusiness: null })
      continue
    }

    // Compute category maxes for scoring
    const reviewCounts = entries
      .map(e => e.googleReviewCount ?? 0)
      .filter(v => v > 0)
    const yearsActive = entries
      .map(e => e.yearsActive ?? 0)
      .filter(v => v > 0)
    const maxReviews = Math.max(...reviewCounts, 1)
    const maxYears = Math.max(...yearsActive, 1)

    // Compute composite scores + sort
    const scored = entries
      .map(entry => {
        const yearsActive = (Date.now() - entry.business.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
        return {
          id: entry.id,
          businessId: entry.businessId,
          composite: computeScores(
            {
              googleRating: entry.googleRating ?? 0,
              googleReviewCount: entry.googleReviewCount ?? 0,
              yearsActive,
              localOwnership: entry.localOwnership,
              uniqueness: entry.uniqueness,
              communityInvolvement: entry.communityInvolvement,
              personalVisitReview: entry.personalVisitReview,
            },
            { maxReviews, maxYears }
          ).composite,
          yearsActive,
        }
      })
      .sort((a, b) => b.composite - a.composite)

    // Assign ranks
    const ranked = scored.map((s, i) => ({ ...s, rank: i + 1 }))
    const topBusinessId = ranked[0]?.businessId ?? null

    // Clear bestOfRank on ALL businesses first (reset stale ranks)
    await prisma.business.updateMany({
      where: { bestOfRank: { not: null } },
      data: { bestOfRank: null },
    })

    // Transaction: update ranks + sync bestOfRank on businesses
    await prisma.$transaction(async tx => {
      // Update all entry ranks
      for (const r of ranked) {
        await tx.bestOfEntry.update({
          where: { id: r.id },
          data: { compositeScore: r.composite, rank: r.rank },
        })
      }

      // Sync bestOfRank on the top business in this category
      if (topBusinessId) {
        await tx.business.update({
          where: { id: topBusinessId },
          data: { bestOfRank: 1 },
        })
      }
    })

    results.push({
      category: category.name,
      updated: ranked.length,
      topBusiness: topBusinessId,
    })
  }

  return NextResponse.json({ success: true, results })
}
