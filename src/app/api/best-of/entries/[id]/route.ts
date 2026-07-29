import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// PATCH /api/best-of/entries/[id] — update editorial scores for an entry (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { localOwnership, uniqueness, communityInvolvement, personalVisitReview } = body

    const entry = await prisma.bestOfEntry.findUnique({ where: { id } })
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const updated = await prisma.bestOfEntry.update({
      where: { id },
      data: {
        ...(localOwnership !== undefined && { localOwnership }),
        ...(uniqueness !== undefined && { uniqueness }),
        ...(communityInvolvement !== undefined && { communityInvolvement }),
        ...(personalVisitReview !== undefined && { personalVisitReview }),
      },
      include: {
        business: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('BestOf entry update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/best-of/entries/[id] — remove an entry (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const entry = await prisma.bestOfEntry.findUnique({ where: { id } })
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    await prisma.bestOfEntry.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('BestOf entry deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
