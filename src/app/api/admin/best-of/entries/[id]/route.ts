import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { computeScores } from '@/lib/best-of-score'

// PATCH /api/admin/best-of/entries/[id] — update editorial scores
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await _request.json()
  const { localOwnership, uniqueness, communityInvolvement, personalVisitReview } = body

  const editorialScores = {
    localOwnership:        Number(localOwnership ?? 0),
    uniqueness:            Number(uniqueness ?? 0),
    communityInvolvement:  Number(communityInvolvement ?? 0),
    personalVisitReview:  Number(personalVisitReview ?? 0),
  }

  // Fetch the entry + all entries in its category (to compute category maxes)
  const entry = await prisma.bestOfEntry.findUnique({
    where: { id },
    include: {
      business: { select: { createdAt: true } },
      category: {
        include: {
          entries: {
            include: { business: { select: { createdAt: true } } },
          },
        },
      },
    },
  })

  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  // Recompute yearsActive for every entry in the category from Business.createdAt
  const now = Date.now()
  const entriesWithYears = entry.category.entries.map(e => ({
    ...e,
    yearsActive: (now - e.business.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365),
  }))

  const reviewCounts = entriesWithYears.map(e => e.googleReviewCount ?? 0).filter(v => v > 0)
  const yearsActiveList = entriesWithYears.map(e => e.yearsActive).filter(v => v > 0)

  const maxReviews = Math.max(...reviewCounts, 1)
  const maxYears = Math.max(...yearsActiveList, 1)

  // Recompute this entry's yearsActive from Business.createdAt
  const currentYearsActive = (now - entry.business.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)

  const { composite } = computeScores(
    {
      ...entry,
      yearsActive: currentYearsActive,
      ...editorialScores,
    },
    { maxReviews, maxYears }
  )

  const updated = await prisma.bestOfEntry.update({
    where: { id },
    data: {
      ...editorialScores,
      compositeScore: composite,
      yearsActive: currentYearsActive,
    },
    include: {
      business: {
        select: { id: true, name: true, slug: true, address: true, website: true, logo: true },
      },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/admin/best-of/entries/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  await prisma.bestOfEntry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
