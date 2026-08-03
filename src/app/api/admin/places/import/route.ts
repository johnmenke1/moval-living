import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { nanoid } from 'nanoid'

// POST /api/admin/places/import
// Creates an APPROVED business listing from a Google Place result.
// Expects the search route to have already separated addressComponents into
// { street, city, state, zip } — no string-parsing on the import side.
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { placeId, name, address, city, state, zip, phone, website, type, hours, photos, location, categoryId } = body

  if (!name?.trim() || !address?.trim()) {
    return NextResponse.json({ error: 'name and address are required' }, { status: 400 })
  }

  // Fall back to old parseAddress only if the search response didn't include
  // structured city/state/zip (older callers / direct POSTs).
  let resolvedCity = city
  let resolvedState = state
  let resolvedZip = zip
  if (!resolvedCity || !resolvedState || !resolvedZip) {
    const parsed = parseAddress(address)
    resolvedCity = resolvedCity || parsed.city
    resolvedState = resolvedState || parsed.state
    resolvedZip = resolvedZip || parsed.zip
  }

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
      address: address.trim(),
      city: resolvedCity || 'Moreno Valley',
      state: resolvedState || 'CA',
      zip: resolvedZip || '',
      phone: phone || null,
      email: null,
      website: website || null,
      description: `Business information for ${name.trim()} in ${resolvedCity || 'Moreno Valley'}, ${resolvedState || 'CA'}.`,
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

// Legacy fallback: only used when the caller doesn't supply structured city/state/zip.
// Splits a US-style formattedAddress like "123 Main St, Moreno Valley, CA 92553, USA".
// Note: this is brittle for non-US addresses and for addresses with unusual punctuation.
// The search route should now pass structured addressComponents directly.
function parseAddress(address: string) {
  const parts = address.split(',').map((p: string) => p.trim())
  let city = ''
  let state = ''
  let zip = ''

  if (parts.length >= 2) {
    // Walk from the end: last segment is country (drop it), second-to-last is
    // usually "STATE ZIP" or just "STATE" (handle both).
    const country = parts[parts.length - 1]
    const stateAndZip = parts[parts.length - 2] || ''

    // Strip country from consideration (USA, US, United States, etc.)
    if (/^(usa?|united states)$/i.test(country)) {
      const stateZipMatch = stateAndZip.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/)
      if (stateZipMatch) {
        state = stateZipMatch[1]
        zip = stateZipMatch[2] || ''
        // City is the segment before state+zip
        if (parts.length >= 3) city = parts[parts.length - 3]
      } else {
        // Last segment isn't a clean STATE ZIP — try to extract whatever we can
        const stateOnly = stateAndZip.match(/^([A-Z]{2})/)
        if (stateOnly) state = stateOnly[1]
        const zipOnly = stateAndZip.match(/(\d{5}(?:-\d{4})?)/)
        if (zipOnly) zip = zipOnly[1]
        if (parts.length >= 3) city = parts[parts.length - 3]
      }
    } else {
      // Non-US or unusual — best effort: last segment is country, second-to-last is region
      // Leave state/zip empty so caller can edit manually.
      if (parts.length >= 3) city = parts[parts.length - 3]
    }
  }

  return { city, state, zip }
}
