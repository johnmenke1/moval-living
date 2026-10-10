import { NextRequest, NextResponse } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { db, bestOfNominee, business, requireRow } from '@/db'
import { z } from 'zod'
import { revalidateBestOfData, revalidateBusinessData } from '@/lib/revalidate'

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
    const current = await db.query.bestOfNominee.findFirst({ where: eq(bestOfNominee.id, id) })
    if (current) {
      await db
        .update(bestOfNominee)
        .set({ winner: false })
        .where(
          and(
            eq(bestOfNominee.categoryId, current.categoryId),
            eq(bestOfNominee.winner, true),
            ne(bestOfNominee.id, id)
          )
        )
      await db.update(business).set({ isBestOfWinner: true }).where(eq(business.id, current.businessId))
    }
  }

  const changes = { winner, notes, displayOrder }
  if (Object.values(changes).some((v) => v !== undefined)) {
    requireRow(
      await db.update(bestOfNominee).set(changes).where(eq(bestOfNominee.id, id)).returning({ id: bestOfNominee.id }),
      'Nominee not found'
    )
  }
  const nominee = await db.query.bestOfNominee.findFirst({
    where: eq(bestOfNominee.id, id),
    with: { business: { columns: { name: true, slug: true } } },
  })
  if (!nominee) throw new Error('Nominee not found')

  return NextResponse.json(nominee)
}

// DELETE /api/admin/best-of/nominees/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const nominee = await db.query.bestOfNominee.findFirst({ where: eq(bestOfNominee.id, id) })
  if (!nominee) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.delete(bestOfNominee).where(eq(bestOfNominee.id, id))

  // Check if business is still a winner anywhere
  const stillWinner = await db.query.bestOfNominee.findFirst({
    where: and(eq(bestOfNominee.businessId, nominee.businessId), eq(bestOfNominee.winner, true)),
  })
  if (!stillWinner) {
    await db.update(business).set({ isBestOfWinner: false }).where(eq(business.id, nominee.businessId))
  }
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidateBusinessData()

  revalidateBestOfData()

  return NextResponse.json({ success: true })
}
