import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'
import { AMENITY_SLUGS } from '@/lib/park-amenities'

export const dynamic = 'force-dynamic'

const amenityEnum = z.enum(AMENITY_SLUGS as unknown as [string, ...string[]])

// Editable fields. We intentionally don't let admins change `slug` or
// `type` from the editor — slug would 404 existing links, type would
// mis-categorize the facility. Both require a migration.
const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().nullable().optional(),
  city: z.string().min(1).max(80).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  amenities: z.array(amenityEnum).max(50).optional(),
  blurb: z.string().max(280).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  // Hero photo URL is a separate field on the model, but the editor
  // manages it via reorder-photos for clarity. Leave it out here.
})

/**
 * PATCH /api/admin/parks/[slug]
 *
 * Edit a park's curated fields. Slug and type are intentionally
 * immutable from this endpoint — they need a migration.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const existing = await prisma.park.findUnique({ where: { slug } })
  if (!existing) {
    return NextResponse.json({ error: 'Park not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) data[k] = v
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const updated = await prisma.park.update({ where: { slug }, data })
  return NextResponse.json({ park: updated })
}

/**
 * GET /api/admin/parks/[slug] — fetch a single park with full detail
 * (including hoursJson + photoUrls) for the editor.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params
  const park = await prisma.park.findUnique({ where: { slug } })
  if (!park) {
    return NextResponse.json({ error: 'Park not found' }, { status: 404 })
  }
  return NextResponse.json({ park })
}
