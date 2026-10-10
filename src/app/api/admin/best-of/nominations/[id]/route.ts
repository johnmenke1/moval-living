import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { and, eq } from 'drizzle-orm'
import { db, bestOfCategory, bestOfNominee, bestOfNomination, requireRow } from '@/db'

const ReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  // Required when action === 'approve'. The ID of the BestOfCategory to
  // add the nominee to. If the suggested category doesn't exist, the
  // admin creates it first via the existing Best-Of admin UI, then
  // approves with the new ID.
  categoryId: z.string().optional(),
  // Optional notes from the admin (visible on the row).
  adminNotes: z.string().max(2000).optional(),
  // Reason for rejection (only used when action === 'reject').
  rejectionReason: z.string().max(2000).optional(),
})

// PATCH /api/admin/best-of/nominations/[id]
// Approve or reject a PENDING nomination. On approve, also creates a
// BestOfNominee in the chosen category and links the nomination back to
// it via promotedNomineeId (so we have a full audit trail).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const adminId = session.user.id
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { action, categoryId, adminNotes, rejectionReason } = parsed.data

  // Look up the nomination first — verify it's PENDING.
  const nomination = await db.query.bestOfNomination.findFirst({ where: eq(bestOfNomination.id, id) })
  if (!nomination) {
    return NextResponse.json({ error: 'Nomination not found' }, { status: 404 })
  }
  if (nomination.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Nomination is already ${nomination.status.toLowerCase()}` },
      { status: 400 },
    )
  }

  // Approval requires a real category + a matched business. If the
  // admin hasn't matched a Business yet (businessId is null on the row),
  // they need to do that first via the existing Best-Of admin — for now,
  // we surface that as a clear error.
  if (action === 'approve') {
    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId required when approving' },
        { status: 400 },
      )
    }
    if (!nomination.businessId) {
      return NextResponse.json(
        {
          error:
            'This nomination is not linked to a Business yet. Match it in the Best Of admin first, then approve.',
        },
        { status: 400 },
      )
    }

    const category = await db.query.bestOfCategory.findFirst({ where: eq(bestOfCategory.id, categoryId) })
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Create the nominee (or skip if a unique conflict already exists for
    // that business in that category — the @unique([categoryId, businessId])
    // on BestOfNominee would otherwise throw).
    const existing = await db.query.bestOfNominee.findFirst({
      where: and(
        eq(bestOfNominee.categoryId, categoryId),
        eq(bestOfNominee.businessId, nomination.businessId)
      ),
      columns: { id: true },
    })

    let nomineeId: string
    if (existing) {
      nomineeId = existing.id
    } else {
      const [created] = await db
        .insert(bestOfNominee)
        .values({
          categoryId,
          businessId: nomination.businessId,
          // Promoted via community nomination — copy the nominator's reason
          // into the nominee's admin-facing notes (truncated to fit).
          notes: nomination.reason.slice(0, 1000),
          displayOrder: 0,
        })
        .returning({ id: bestOfNominee.id })
      nomineeId = created.id
    }

    const updated = requireRow(
      await db
        .update(bestOfNomination)
        .set({
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          promotedNomineeId: nomineeId,
          ...(adminNotes ? { adminNotes } : {}),
        })
        .where(eq(bestOfNomination.id, id))
        .returning(),
      'Nomination not found'
    )

    return NextResponse.json({ ok: true, nomination: updated, nomineeId })
  }

  // Rejection path
  const updated = requireRow(
    await db
      .update(bestOfNomination)
      .set({
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        ...(rejectionReason ? { rejectionReason } : {}),
        ...(adminNotes ? { adminNotes } : {}),
      })
      .where(eq(bestOfNomination.id, id))
      .returning(),
    'Nomination not found'
  )

  return NextResponse.json({ ok: true, nomination: updated })
}