import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { nanoid } from 'nanoid'

// POST /api/admin/places/import
// Creates an APPROVED business listing from a Google Place result
// Body: { placeId, name, address, phone, website, type, hours, photos, location, categoryId }
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { placeId, name, address, phone, website, type, hours, photos, location, categoryId } = body

  if (!name?.trim() || !address?.trim()) {
    return NextResponse.json({ error: 'name and address are required' }, { status: 400 })
  }

  // Parse address: "123 Main St, Moreno Valley, CA 92553, USA"
  // → { street: "123 Main St", city: "Moreno Valley", state: "CA", zip: "92553" }
  const parsed = parseAddress(address)

  // Resolve category: accept a CUID, slug, or use "other" fallback
  let resolvedCategoryId = categoryId
  if (!resolvedCategoryId) {
    const fallback = await prisma.category.findFirst({
      where: { slug: 'other' },
      select: { id: true },
    })
    resolvedCategoryId = fallback?.id
  }

  if (!resolvedCategoryId) {
    // Auto-create an "other" category
    const created = await prisma.category.create({
      data: { name: 'Other', slug: 'other', icon: 'Star', description: '' },
    })
    resolvedCategoryId = created.id
  }

  // Generate a unique slug
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const slug = `${baseSlug}-${nanoid(6)}`

  // Check for duplicate placeId to prevent re-importing the same listing
  const existing = await prisma.business.findFirst({
    where: { googleBusiness: placeId },
  })
  if (existing) {
    return NextResponse.json({ error: 'This business has already been imported', business: existing }, { status: 409 })
  }

  const business = await prisma.business.create({
    data: {
      slug,
      name: name.trim(),
      categoryId: resolvedCategoryId,
      address: parsed.street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      phone: phone || null,
      email: null,
      website: website || null,
      description: `Business information for ${name.trim()} in ${parsed.city}, ${parsed.state}.`,
      googleBusiness: placeId || null,
      latitude: location?.lat || null,
      longitude: location?.lng || null,
      hours: hours || null,
      photos: [],
      status: 'APPROVED',
      tier: 'FREE',
    },
  })

  return NextResponse.json({ business: { id: business.id, slug: business.slug, name: business.name } }, { status: 201 })
}

function parseAddress(address: string) {
  const parts = address.split(',').map((p: string) => p.trim())
  let city = 'Moreno Valley'
  let state = 'CA'
  let zip = ''
  let street = address

  if (parts.length >= 2) {
    const last = parts[parts.length - 1] // e.g. "CA 92553, USA"
    const zipMatch = last.match(/\d{5}/)
    const stateMatch = last.match(/[A-Z]{2}/)
    if (zipMatch) zip = zipMatch[0]
    if (stateMatch) state = stateMatch[0]
    if (parts.length >= 3) city = parts[parts.length - 2].replace(/, USA$/, '').trim()
    street = parts[0]
  }

  return { street, city, state, zip }
}
