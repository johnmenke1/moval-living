import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateNomineeSchema = z.object({
  winner: z.boolean().optional(),
  notes: z.string().optional(),
  displayOrder: z.number().optional(),
})

// PATCH /api/admin/best-of/nominees/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateNomineeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { winner, notes, displayOrder } = parsed.data

  // If setting winner=true, clear winner flag from other nominees in the same category
  if (winner === true) {
    const current = await prisma.bestOfNominee.findUnique({ where: { id } })
    if (current) {
      await prisma.bestOfNominee.updateMany({
        where: { categoryId: current.categoryId, winner: true, id: { not: id } },
        data: { winner: false },
      })
      await prisma.business.update({
        where: { id: current.businessId },
        data: { isBestOfWinner: true },
      })
    }
  }

  const nominee = await prisma.bestOfNominee.update({
    where: { id },
    data: { winner, notes, displayOrder },
    include: { business: { select: { name: true, slug: true } } },
  })

  return NextResponse.json(nominee)
}

// DELETE /api/admin/best-of/nominees/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const nominee = await prisma.bestOfNominee.findUnique({ where: { id } })
  if (!nominee) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.bestOfNominee.delete({ where: { id } })

  // Check if business is still a winner anywhere
  const stillWinner = await prisma.bestOfNominee.findFirst({
    where: { businessId: nominee.businessId, winner: true },
  })
  if (!stillWinner) {
    await prisma.business.update({
      where: { id: nominee.businessId },
      data: { isBestOfWinner: false },
    })
  }

  return NextResponse.json({ success: true })
}
