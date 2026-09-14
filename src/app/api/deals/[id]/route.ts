import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canManageBusiness } from '@/lib/business-mutations'

// PATCH + DELETE for a single Deal. Same auth model as POST
// /api/deals: canManageBusiness(actor, business.ownerId) returns true
// for the business owner OR any ADMIN. This is what lets site admin
// edit/delete a deal on behalf of any business from the Deals tab
// inside /dashboard/edit?id=... .

// Zod schema for PATCH. All fields are optional — the client sends
// only what changed. headline stays required when present (a deal must
// always have a headline). To clear a nullable field, send null (the
// schema distinguishes "absent" from "explicit null" via the
// .partial() + the explicit-null branch below).
const dealUpdateSchema = z.object({
  headline: z.string().trim().min(1).max(120).optional(),
  description: z.union([z.string().trim().max(1000), z.null()]).optional(),
  code: z.union([z.string().trim().max(40), z.null()]).optional(),
  imageUrl: z.union([z.string().trim().url().max(500), z.null()]).optional(),
  startsAt: z.union([z.string().datetime(), z.null()]).optional(),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
}).strict()

function parseDateField(value: string | null | undefined): Date | null | undefined {
  if (value === null) return null
  if (value === undefined) return undefined
  return new Date(value)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.deal.findUnique({
      where: { id },
      select: {
        id: true,
        businessId: true,
        business: { select: { ownerId: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const actor = { userId: session.user.id, role: session.user.role }
    if (!canManageBusiness(actor, existing.business.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsed = dealUpdateSchema.parse(await request.json())

    const data: Record<string, unknown> = {}
    if (parsed.headline !== undefined) data.headline = parsed.headline
    if (parsed.description !== undefined) data.description = parsed.description
    if (parsed.code !== undefined) data.code = parsed.code
    if (parsed.imageUrl !== undefined) data.imageUrl = parsed.imageUrl
    const startsAtParsed = parseDateField(parsed.startsAt as string | null | undefined)
    if (startsAtParsed !== undefined) data.startsAt = startsAtParsed
    const expiresAtParsed = parseDateField(parsed.expiresAt as string | null | undefined)
    if (expiresAtParsed !== undefined) data.expiresAt = expiresAtParsed
    if (parsed.displayOrder !== undefined) data.displayOrder = parsed.displayOrder
    if (parsed.isActive !== undefined) data.isActive = parsed.isActive

    const updated = await prisma.deal.update({
      where: { id: existing.id },
      data,
    })

    return NextResponse.json(updated)
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
    console.error('Deal update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.deal.findUnique({
      where: { id },
      select: {
        id: true,
        businessId: true,
        business: { select: { ownerId: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const actor = { userId: session.user.id, role: session.user.role }
    if (!canManageBusiness(actor, existing.business.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.deal.delete({ where: { id: existing.id } })

    // Note: the associated Vercel Blob image is NOT deleted here. The
    // /api/upload route stores the URL on the Deal row but doesn't
    // track the blob handle, so we don't have a reliable way to
    // reverse-lookup the file. Orphaned deal images are cheap to keep
    // around and hard to delete safely (matching by prefix would also
    // kill the user's other images). Documented in the plan.
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Deal delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
