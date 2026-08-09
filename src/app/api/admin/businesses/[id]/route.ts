import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  tier: z.enum(['FREE', 'FEATURED', 'EXPERT_PARTNER']).optional(),
  categoryId: z.string().optional(),
  googleBusiness: z.string().nullable().optional(),
  googleRating: z.number().min(0).max(5).nullable().optional(),
  googleReviewCount: z.number().int().min(0).nullable().optional(),
  // Admin-only escape hatch: lets Johnny toggle the Expert Partner flag
  // manually for grace periods / comp accounts without round-tripping Stripe.
  // Stripe webhooks still own this in the normal subscription flow.
  isExpertPartner: z.boolean().optional(),
  expertPartnerSlug: z.string().nullable().optional(),
})

// PATCH /api/admin/businesses/[id] — approve/reject/status + admin metadata (google reviews, category)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.status) data.status = parsed.data.status
  if (parsed.data.tier) data.tier = parsed.data.tier
  if (parsed.data.categoryId) data.category = { connect: { id: parsed.data.categoryId } }
  if (parsed.data.googleBusiness !== undefined) data.googleBusiness = parsed.data.googleBusiness ?? null
  if (parsed.data.googleRating !== undefined) data.googleRating = parsed.data.googleRating ?? null
  if (parsed.data.googleReviewCount !== undefined) data.googleReviewCount = parsed.data.googleReviewCount ?? null
  if (parsed.data.isExpertPartner !== undefined) data.isExpertPartner = parsed.data.isExpertPartner
  if (parsed.data.expertPartnerSlug !== undefined) data.expertPartnerSlug = parsed.data.expertPartnerSlug ?? null

  const business = await prisma.business.update({
    where: { id },
    data,
    include: {
      category: { select: { name: true, slug: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(business)
}

// DELETE /api/admin/businesses/[id] — permanently delete a business
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  await prisma.business.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
