import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// Event metadata that admins can edit. Slug, source fields, and id are immutable.
// Keep enum values in sync with prisma/schema.prisma.
const eventCategoryEnum = z.enum([
  'SPORTS',
  'MUSIC',
  'ARTS',
  'EDUCATIONAL',
  'FUNDRAISERS',
  'COMMUNITY',
  'FAMILY',
  'FOOD_DRINK',
  'HOLIDAY_CELEBRATIONS',
])

const venueTagEnum = z.enum([
  'FOX_RIVERSIDE',
  'RIVERSIDE_MUNICIPAL_AUDITORIUM',
  'RIVERSIDE_CONVENTION_CENTER',
  'UCR',
  'CBU',
  'RIVERSIDE_ART_MUSEUM',
  'RIVERSIDE_METROPOLITAN_MUSEUM',
  'REDLANDS_BOWL',
  'REDLANDS_THEATER_FESTIVAL',
  'MOVAL_HIGH_SCHOOL',
  'OTHER',
])

const eventTierEnum = z.enum(['STANDARD', 'HONORABLE_MENTION', 'HERO'])

const schema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(20000).nullable(),
    startsAt: z.string().datetime({ message: 'Invalid start date' }),
    endsAt: z.string().datetime({ message: 'Invalid end date' }).nullable(),
    isFree: z.boolean(),
    ticketUrl: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .refine(
        (v) => !v || /^https?:\/\/.+/.test(v),
        'Must be a valid http(s) URL'
      ),
    tier: eventTierEnum,
    venueName: z.string().trim().max(200).nullable(),
    venueTag: venueTagEnum,
    category: eventCategoryEnum.nullable(),
    address: z.string().trim().max(300).nullable(),
    city: z.string().trim().max(100).nullable(),
    state: z
      .string()
      .trim()
      .max(2)
      .nullable()
      .refine(
        (v) => !v || /^[A-Za-z]{2}$/.test(v),
        'State must be 2 letters (e.g. CA)'
      ),
    zip: z
      .string()
      .trim()
      .max(10)
      .nullable()
      .refine(
        (v) => !v || /^\d{5}(-\d{4})?$/.test(v),
        'ZIP must be 5 or 9 digits'
      ),
    heroImageUrl: z.string().trim().max(2000).nullable(),
  })
  .refine(
    (d) => !d.endsAt || new Date(d.endsAt) > new Date(d.startsAt),
    { message: 'End must be after start', path: ['endsAt'] }
  )

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      const flat = parsed.error.flatten()
      return NextResponse.json(
        { error: 'Validation failed', fields: flat.fieldErrors },
        { status: 400 }
      )
    }

    const existing = await prisma.event.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const data = parsed.data
    const updated = await prisma.event.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        isFree: data.isFree,
        ticketUrl: data.ticketUrl,
        tier: data.tier,
        venueName: data.venueName,
        venueTag: data.venueTag,
        category: data.category,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        heroImageUrl: data.heroImageUrl,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ ok: true, event: updated })
  } catch (err) {
    console.error('[admin/events/[id] PATCH] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Save failed' },
      { status: 500 }
    )
  }
}
