import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/partners/leads/:id
 *
 * Owner-only. Two optional fields:
 *   - contacted: boolean — toggle the "contacted" flag
 *   - notes:     string  — save private notes (≤ 2000 chars)
 *
 * Verifies the lead belongs to a business the current user owns.
 * Returns 403 if not the owner, 404 if the lead doesn't exist.
 */

const patchSchema = z
  .object({
    contacted: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((d) => d.contacted !== undefined || d.notes !== undefined, {
    message: 'At least one field required',
  })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body
  try {
    body = patchSchema.parse(await req.json())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Verify ownership by joining through Business.ownerId
  const lead = await prisma.expertPartnerLead.findUnique({
    where: { id },
    include: {
      business: { select: { ownerId: true } },
    },
  })

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  if (lead.business.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.expertPartnerLead.update({
    where: { id },
    data: {
      ...(body.contacted !== undefined
        ? {
            contacted: body.contacted,
            contactedAt: body.contacted ? new Date() : null,
          }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    select: {
      id: true,
      contacted: true,
      contactedAt: true,
      notes: true,
    },
  })

  return NextResponse.json({ success: true, lead: updated })
}