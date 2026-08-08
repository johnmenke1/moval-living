import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/diagnostics/db
 *
 * Admin-only. Returns a DB connectivity check + record counts so you can
 * spot drift (e.g. if a recent deploy broke a model, counts will look
 * wrong or the query will throw).
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [businessCount, ownerCount, leadCount, expertCount, reviewCount] = await Promise.all([
      prisma.business.count(),
      prisma.owner.count(),
      prisma.expertPartnerLead.count(),
      prisma.business.count({ where: { isExpertPartner: true } }),
      prisma.review.count(),
    ])

    // Find the most recent lead timestamp so we can spot a stuck pipeline
    const lastLead = await prisma.expertPartnerLead.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, businessId: true },
    })

    return NextResponse.json({
      ok: true,
      message: 'Database connected',
      counts: {
        businesses: businessCount,
        owners: ownerCount,
        expertPartnerLeads: leadCount,
        expertPartners: expertCount,
        reviews: reviewCount,
      },
      lastLeadAt: lastLead?.createdAt ?? null,
      ranAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'DB query failed',
      },
      { status: 500 }
    )
  }
}