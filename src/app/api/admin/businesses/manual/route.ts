// POST /api/admin/businesses
//
// Manually create a Business listing from typed-in admin input.
// Mirrors /api/admin/places/import (admin-gated, returns { business: { id, slug, name } })
// but skips the Google Places data — admin enters everything by hand.
//
// Required: name, address, categoryId (CUID or slug).
// Optional: tagline, description, phone, email, website, city, state, zip, tier, status.
// Defaults: city='Moreno Valley', state='CA', zip='', status='PENDING', tier='FREE',
//           description = a non-leaky placeholder if admin leaves it blank.

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidateBusinessData } from '@/lib/revalidate'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    name,
    tagline,
    description,
    categoryId,
    address,
    city,
    state,
    zip,
    phone,
    email,
    website,
    tier,
    status,
  } = body || {}

  if (!name?.trim() || !address?.trim()) {
    return NextResponse.json(
      { error: 'name and address are required' },
      { status: 400 },
    )
  }

  // Resolve category: accept CUID or slug. Fall back to 'other' (creating it
  // if absent) — mirrors /api/admin/places/import so manual + import paths
  // behave the same.
  let resolvedCategoryId: string | undefined = categoryId
  if (resolvedCategoryId) {
    // Try CUID lookup first; fall through to slug lookup.
    const byId = await prisma.category.findUnique({
      where: { id: resolvedCategoryId },
      select: { id: true },
    })
    if (!byId) {
      const bySlug = await prisma.category.findUnique({
        where: { slug: resolvedCategoryId },
        select: { id: true },
      })
      resolvedCategoryId = bySlug?.id
    }
  }
  if (!resolvedCategoryId) {
    const fallback = await prisma.category.findFirst({
      where: { slug: 'other' },
      select: { id: true },
    })
    resolvedCategoryId = fallback?.id
  }
  if (!resolvedCategoryId) {
    const created = await prisma.category.create({
      data: { name: 'Other', slug: 'other', icon: 'Star', description: '' },
      select: { id: true },
    })
    resolvedCategoryId = created.id
  }

  // Slug: kebab-case the name, append 6-char nanoid for uniqueness (same shape
  // as /api/admin/places/import and /api/businesses POST).
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const slug = `${baseSlug || 'business'}-${nanoid(6)}`

  // Allowed status / tier values mirror the Prisma enums.
  const ALLOWED_STATUS = new Set(['PENDING', 'APPROVED', 'REJECTED'])
  const ALLOWED_TIER = new Set(['FREE', 'FEATURED', 'EXPERT_PARTNER'])
  const resolvedStatus = ALLOWED_STATUS.has(status) ? status : 'PENDING'
  const resolvedTier = ALLOWED_TIER.has(tier) ? tier : 'FREE'

  // Description: non-leaky placeholder if admin leaves it blank, matches
  // /api/admin/places/import so manually-added rows look identical to imported ones.
  const resolvedDescription = (description && description.trim().length >= 10)
    ? description.trim()
    : `Business information for ${name.trim()} in ${(city || 'Moreno Valley').trim()}, ${(state || 'CA').trim()}.`

  const business = await prisma.business.create({
    data: {
      slug,
      name: name.trim(),
      tagline: tagline?.trim() || null,
      categoryId: resolvedCategoryId,
      address: address.trim(),
      city: (city || 'Moreno Valley').trim(),
      state: (state || 'CA').trim().slice(0, 2).toUpperCase(),
      zip: (zip || '').trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      website: website?.trim() || null,
      description: resolvedDescription,
      status: resolvedStatus,
      tier: resolvedTier,
      photos: [],
    },
    select: { id: true, slug: true, name: true },
  })

  revalidateBusinessData()

  return NextResponse.json({ business }, { status: 201 })
}