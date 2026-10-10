import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { desc, eq } from 'drizzle-orm'
import { db, business, owner, expertPartnerLead, review } from '@/db'

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
      db.$count(business),
      db.$count(owner),
      db.$count(expertPartnerLead),
      db.$count(business, eq(business.isExpertPartner, true)),
      db.$count(review),
    ])

    // Find the most recent lead timestamp so we can spot a stuck pipeline
    const lastLead = await db.query.expertPartnerLead.findFirst({
      orderBy: desc(expertPartnerLead.createdAt),
      columns: { createdAt: true, businessId: true },
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