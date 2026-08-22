import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
  // Languages & Chamber affiliation badges
  //   seHablaEspanol        — owner-toggleable in claim flow + dashboard edit;
  //                            admin can override here if a dispute arises
  //   chamberMember         — Moreno Valley Chamber of Commerce (admin-only)
  //   hispanicChamberMember — MV Hispanic Chamber of Commerce (admin-only)
  seHablaEspanol: z.boolean().optional(),
  chamberMember: z.boolean().optional(),
  hispanicChamberMember: z.boolean().optional(),
})

// PATCH /api/admin/businesses/[id] — approve/reject/status + admin metadata (google reviews, category)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  if (parsed.data.seHablaEspanol !== undefined) data.seHablaEspanol = parsed.data.seHablaEspanol
  if (parsed.data.chamberMember !== undefined) data.chamberMember = parsed.data.chamberMember
  if (parsed.data.hispanicChamberMember !== undefined) data.hispanicChamberMember = parsed.data.hispanicChamberMember

  // If the admin is bumping tier to a premium tier, stamp featuredAt on
  // first transition (idempotent — only set if currently null). This
  // mirrors the Stripe webhook logic so both paths produce the same UX.
  if (parsed.data.tier && (parsed.data.tier === 'FEATURED' || parsed.data.tier === 'EXPERT_PARTNER')) {
    const existing = await prisma.business.findUnique({
      where: { id },
      select: { featuredAt: true },
    })
    if (existing && !existing.featuredAt) {
      data.featuredAt = new Date()
    }
  }

  const business = await prisma.business.update({
    where: { id },
    data,
    include: {
      category: { select: { name: true, slug: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  })

  // Invalidate the ISR caches the homepage and sitemap read from.
  // Without this, an admin tier/status change takes up to 5 min
  // (homepage) / 1 hr (sitemap) to appear. The detail page is
  // force-dynamic and re-renders on every request, so no bust
  // needed there.
  revalidatePath('/')
  revalidatePath('/sitemap.xml')

  return NextResponse.json(business)
}

// DELETE /api/admin/businesses/[id] — permanently delete a business
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  await prisma.business.delete({ where: { id } })

  // Same ISR bust as PATCH — a deletion needs to disappear from the
  // sitemap and any homepage listings immediately, not after cache
  // expiry.
  revalidatePath('/')
  revalidatePath('/sitemap.xml')

  return NextResponse.json({ success: true })
}