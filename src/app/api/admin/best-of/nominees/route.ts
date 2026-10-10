import { NextRequest, NextResponse } from 'next/server'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db, bestOfNominee, business } from '@/db'
import { z } from 'zod'
import { revalidateBestOfData } from '@/lib/revalidate'

const CreateNomineeSchema = z.object({
  categoryId: z.string().min(1),
  businessId: z.string().min(1),
  winner: z.boolean().optional(),
  notes: z.string().optional(),
  displayOrder: z.number().optional(),
})

// GET /api/admin/best-of/nominees?categoryId=xxx — list nominees for a category
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')

  if (!categoryId) {
    return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
  }

  const nominees = await db.query.bestOfNominee.findMany({
    where: eq(bestOfNominee.categoryId, categoryId),
    with: {
      business: {
        columns: {
          id: true,
          slug: true,
          name: true,
          logo: true,
          googleRating: true,
          googleReviewCount: true,
          address: true,
          bestOfTags: true,
        },
      },
    },
    orderBy: [desc(bestOfNominee.winner), asc(bestOfNominee.displayOrder)],
  })

  return NextResponse.json(nominees)
}

// POST /api/admin/best-of/nominees — add a nominee
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateNomineeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { categoryId, businessId, winner, notes, displayOrder } = parsed.data

  // Check for duplicate
  const existing = await db.query.bestOfNominee.findFirst({
    where: and(eq(bestOfNominee.categoryId, categoryId), eq(bestOfNominee.businessId, businessId)),
  })
  if (existing) {
    return NextResponse.json({ error: 'Business already nominated in this category' }, { status: 409 })
  }

  // If this nominee is being marked winner, clear winner flag from others in same category
  if (winner) {
    await db
      .update(bestOfNominee)
      .set({ winner: false })
      .where(and(eq(bestOfNominee.categoryId, categoryId), eq(bestOfNominee.winner, true)))
    // Also update Business.isBestOfWinner
    await db.update(business).set({ isBestOfWinner: true }).where(eq(business.id, businessId))
  }

  const [inserted] = await db
    .insert(bestOfNominee)
    .values({ categoryId, businessId, winner: winner ?? false, notes, displayOrder: displayOrder ?? 0 })
    .returning()
  const biz = await db.query.business.findFirst({
    where: eq(business.id, businessId),
    columns: { name: true },
  })
  const nominee = { ...inserted, business: biz ?? null }
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidateBestOfData()

  return NextResponse.json(nominee, { status: 201 })
}
