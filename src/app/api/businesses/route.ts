import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { nanoid } from 'nanoid'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, tagline, categoryId, address, city, state, zip, phone, email, website, description, facebook, instagram, yelp } = body

    if (!name?.trim() || !categoryId || !address?.trim() || !zip?.trim() || !description?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (description.trim().length < 50) {
      return NextResponse.json({ error: 'Description must be at least 50 characters' }, { status: 400 })
    }

    // Check for duplicate
    const existing = await prisma.business.findFirst({
      where: { name: { equals: name.trim() }, address: { equals: address.trim() } },
    })

    if (existing) {
      return NextResponse.json({
        error: 'A business with this name and address already exists.',
        existingSlug: existing.slug,
      }, { status: 409 })
    }

    // Generate unique slug
    const baseSlug = slugify(name)
    const uniqueSuffix = nanoid(6)
    const slug = `${baseSlug}-${uniqueSuffix}`

    const business = await prisma.business.create({
      data: {
        slug,
        name: name.trim(),
        tagline: tagline?.trim() || null,
        description: description.trim(),
        categoryId,
        address: address.trim(),
        city: city?.trim() || 'Moreno Valley',
        state: state?.trim() || 'CA',
        zip: zip.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        website: website?.trim() || null,
        facebook: facebook?.trim() || null,
        instagram: instagram?.trim() || null,
        yelp: yelp?.trim() || null,
        status: 'APPROVED', // Auto-approve for now; change to PENDING for moderation
        tier: 'FREE',
      },
    })

    return NextResponse.json({ slug: business.slug, id: business.id }, { status: 201 })
  } catch (error) {
    console.error('Business creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const category = searchParams.get('category')
    const tier = searchParams.get('tier')
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { status: 'APPROVED' }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { tagline: { contains: q, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.category = { slug: category }
    }

    if (tier) {
      where.tier = tier.toUpperCase()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any = sort === 'rating'
      ? { reviews: { _count: 'desc' } }
      : sort === 'name'
      ? { name: 'asc' }
      : { createdAt: 'desc' }

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: { category: true, reviews: true, _count: { select: { reviews: true } } },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.business.count({ where }),
    ])

    return NextResponse.json({ businesses, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Business listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
