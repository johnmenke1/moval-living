import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canManageBusiness } from '@/lib/business-mutations'

// Sort options for the public /deals index. The Deal table was added in
// migration 20260914000000_add_deal_model as the first-class replacement
// for the legacy Business.coupon Json blob.
const dealSortValues = ['newest', 'expiring', 'business'] as const
type DealSort = typeof dealSortValues[number]

// Zod schema for POST /api/deals — used by both the owner
// /dashboard/deals page and the admin Deals tab inside
// /dashboard/edit?id=... . imageUrl is optional (a deal doesn't need a
// picture). expiresAt is optional too — some deals are evergreen.
const dealCreateSchema = z.object({
  businessId: z.string().trim().min(1).max(100),
  headline: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  code: z.string().trim().max(40).nullable().optional(),
  imageUrl: z.string().trim().url().max(500).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
}).strict()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sortParam = searchParams.get('sort') || 'newest'
    const sort: DealSort = dealSortValues.includes(sortParam as DealSort)
      ? (sortParam as DealSort)
      : 'newest'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    // Public filter: only active deals on APPROVED businesses whose
    // date window is currently open. Prisma 7 dropped the top-level
    // OR inside nullable date filters, so we hoist OR to the where
    // clause and combine the two date predicates at the top level.
    const now = new Date()
    const where = {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      AND: [
        {
          OR: [
            { startsAt: null },
            { startsAt: { lte: now } },
          ],
        },
        { business: { status: 'APPROVED' as const } },
      ],
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any = sort === 'expiring'
      ? [{ isActive: 'desc' }, { expiresAt: 'asc' }]
      : sort === 'business'
        ? [{ business: { name: 'asc' as const } }, { createdAt: 'desc' as const }]
        : [{ displayOrder: 'asc' as const }, { createdAt: 'desc' as const }]

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          business: {
            select: {
              id: true,
              slug: true,
              name: true,
              tagline: true,
              logo: true,
              coverImage: true,
              category: { select: { name: true, slug: true } },
              _count: { select: { reviews: true } },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ])

    return NextResponse.json({ deals, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Deals listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: create a new deal. Used by both business owners (via
// /dashboard/deals) and site admin (via the Deals tab inside
// /dashboard/edit?id=...). Auth model is canManageBusiness(actor,
// business.ownerId) — same pattern as the rest of the business
// mutations. Returns the new Deal row on success.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = dealCreateSchema.parse(await request.json())

    // Resolve the target business + verify the caller may manage it.
    // canManageBusiness returns true for the business owner OR for
    // any ADMIN — that's exactly what we want here.
    const business = await prisma.business.findUnique({
      where: { id: parsed.businessId },
      select: { id: true, ownerId: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }
    const actor = { userId: session.user.id, role: session.user.role }
    if (!canManageBusiness(actor, business.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deal = await prisma.deal.create({
      data: {
        businessId: business.id,
        headline: parsed.headline,
        description: parsed.description ?? null,
        code: parsed.code ?? null,
        imageUrl: parsed.imageUrl ?? null,
        startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        displayOrder: parsed.displayOrder ?? 0,
        isActive: parsed.isActive ?? true,
      },
    })

    return NextResponse.json(deal, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      const zerr = error as { issues?: Array<{ path: (string | number)[]; message: string }> }
      const fields = (zerr.issues || []).reduce<Record<string, string>>((acc, e) => {
        acc[e.path.join('.')] = e.message
        return acc
      }, {})
      return NextResponse.json(
        { error: 'Validation failed', fields },
        { status: 400 }
      )
    }
    console.error('Deal create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
