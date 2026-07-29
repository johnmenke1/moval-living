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

  // Fetch the entry with its category's max review count and years
  const entry = await prisma.bestOfEntry.findUnique({
    where: { id },
    include: {
      category: {
        include: {
          entries: {
            select: { googleReviewCount: true, yearsActive: true },
          },
        },
      },
    },
  })

  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  const reviewCounts = entry.category.entries
    .map(e => e.googleReviewCount ?? 0)
    .filter(v => v > 0)
  const yearsActive = entry.category.entries
    .map(e => e.yearsActive ?? 0)
    .filter(v => v > 0)

  const maxReviews = Math.max(...reviewCounts, 1)
  const maxYears = Math.max(...yearsActive, 1)

  const { composite } = computeScores(
    {
      ...entry,
      ...editorialScores,
    },
    { maxReviews, maxYears }
  )

  const updated = await prisma.bestOfEntry.update({
    where: { id },
    data: {
      ...editorialScores,
      compositeScore: composite,
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
