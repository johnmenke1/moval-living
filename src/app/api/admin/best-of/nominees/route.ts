import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

  const nominees = await prisma.bestOfNominee.findMany({
    where: { categoryId },
    include: {
      business: {
        select: {
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
    orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
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
  const existing = await prisma.bestOfNominee.findUnique({
    where: { categoryId_businessId: { categoryId, businessId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Business already nominated in this category' }, { status: 409 })
  }

  // If this nominee is being marked winner, clear winner flag from others in same category
  if (winner) {
    await prisma.bestOfNominee.updateMany({
      where: { categoryId, winner: true },
      data: { winner: false },
    })
    // Also update Business.isBestOfWinner
    await prisma.business.update({ where: { id: businessId }, data: { isBestOfWinner: true } })
  }

  const nominee = await prisma.bestOfNominee.create({
    data: { categoryId, businessId, winner: winner ?? false, notes, displayOrder: displayOrder ?? 0 },
    include: { business: { select: { name: true } } },
  })
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidateBestOfData()

  return NextResponse.json(nominee, { status: 201 })
}
