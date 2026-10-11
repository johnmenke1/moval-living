import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db, halloweenEntry } from '@/db'
import { publicLocationFor } from '@/lib/halloween'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  rejectionReason: z.string().trim().max(500).nullable().optional(),
  displayName: z.string().trim().min(3).max(80).optional(),
  tagline: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(800).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  showExactAddress: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  photoUrls: z.array(z.string().url()).max(6).optional(),
})

async function requireAdmin() {
  const session = await auth()
  return session?.user?.id && session.user.role === 'ADMIN' ? session : null
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  const d = parsed.data

  const current = await db.query.halloweenEntry.findFirst({ where: eq(halloweenEntry.id, id) })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const lat = d.latitude ?? current.latitude
  const lng = d.longitude ?? current.longitude
  const showExact = d.showExactAddress ?? current.showExactAddress

  if (d.status === 'APPROVED' && (lat == null || lng == null)) {
    return NextResponse.json({ error: 'Set a latitude/longitude before approving.' }, { status: 400 })
  }

  const update: Partial<typeof halloweenEntry.$inferInsert> = {}
  if (d.displayName !== undefined) update.displayName = d.displayName
  if (d.tagline !== undefined) update.tagline = d.tagline
  if (d.description !== undefined) update.description = d.description
  if (d.category !== undefined) update.category = d.category
  if (d.photoUrls !== undefined) update.photoUrls = d.photoUrls
  if (d.rejectionReason !== undefined) update.rejectionReason = d.rejectionReason
  if (d.status !== undefined) {
    update.status = d.status
    update.approvedAt = d.status === 'APPROVED' ? new Date() : null
  }
  if (d.latitude !== undefined) update.latitude = d.latitude
  if (d.longitude !== undefined) update.longitude = d.longitude
  if (d.showExactAddress !== undefined) update.showExactAddress = d.showExactAddress

  // Any change to the pin or the privacy choice recomputes what the public sees.
  if (lat != null && lng != null && (d.latitude !== undefined || d.longitude !== undefined || d.showExactAddress !== undefined || d.status === 'APPROVED')) {
    const pub = publicLocationFor(lat, lng, current.streetAddress, showExact)
    update.publicLatitude = pub.publicLatitude
    update.publicLongitude = pub.publicLongitude
    update.locationLabel = pub.locationLabel
  }

  await db.update(halloweenEntry).set(update).where(eq(halloweenEntry.id, id))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  await db.delete(halloweenEntry).where(eq(halloweenEntry.id, id))
  return NextResponse.json({ ok: true })
}
