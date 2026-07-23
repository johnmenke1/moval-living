import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { auth } from '@/auth'

// GET /api/businesses — list approved businesses (for social post form's "link to business" dropdown)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''

  const businesses = await prisma.business.findMany({
    where: {
      status: 'APPROVED',
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    select: { id: true, name: true, slug: true, logo: true },
    take: 20,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(businesses)
}

// POST /api/businesses — create a new business submission
// Accepts `categoryId` that may be either a CUID (from /api/categories) or a slug
// (e.g. "real-estate"). Resolves to a real Category record before insert.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    name, tagline, categoryId, address, city, state, zip,
    phone, email, website, description, facebook, instagram, yelp,
    hasCoupon, couponHeadline, couponDescription, couponCode, couponExpiresAt,
    hours, latitude, longitude,
  } = body

  if (!name || !categoryId || !address || !zip || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (description.trim().length < 50) {
    return NextResponse.json({ error: 'Description must be at least 50 characters' }, { status: 400 })
  }

  // Resolve the category: try by CUID first, then by slug. Either form is accepted.
  // If no match is found, auto-create the category from the slug (handles cases where
  // categories.ts has categories that don't exist in the DB yet — e.g. after a schema
  // change or new category added to the frontend before a seed was run).
  let category = await prisma.category.findFirst({
    where: { OR: [{ id: categoryId }, { slug: categoryId }] },
    select: { id: true, slug: true },
  })

  if (!category) {
    // Auto-create from slug — use the slug as name with title-case formatting
    const name = categoryId
      .split('-')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    category = await prisma.category.create({
      data: { id: categoryId, name, slug: categoryId, icon: 'Star', description: '' },
      select: { id: true, slug: true },
    })
  }

  // Auto-link to logged-in owner if authenticated
  const session = await auth()
  const ownerId = session?.user?.id || null

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${nanoid(6)}`

  const business = await prisma.business.create({
    data: {
      slug,
      name,
      tagline: tagline || null,
      categoryId: category.id,  // resolved CUID
      ownerId,
      address,
      city: city || 'Moreno Valley',
      state: state || 'CA',
      zip,
      phone: phone || null,
      email: email || null,
      website: website || null,
      description,
      facebook: facebook || null,
      instagram: instagram || null,
      yelp: yelp || null,
      latitude: latitude || null,
      longitude: longitude || null,
      hours: hours || undefined,
      hasCoupon: hasCoupon || false,
      coupon: (hasCoupon && couponHeadline) ? {
        headline: couponHeadline,
        description: couponDescription || '',
        code: couponCode || null,
        expiresAt: couponExpiresAt || null,
      } : undefined,
      status: 'PENDING',
    },
  })

  return NextResponse.json(business, { status: 201 })
}
