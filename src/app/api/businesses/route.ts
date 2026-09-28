import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

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
  // Parse JSON defensively. An empty body, malformed JSON, or a
  // multipart/form-data request will throw inside req.json(); without
  // this try/catch the route returned an empty 500 and the client
  // surfaced "Failed to execute 'json' on 'Response': Unexpected end of
  // JSON input". Wrap every failure path so the client always gets a
  // JSON { error } body it can render.
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body (expected JSON)' }, { status: 400 })
  }

  const {
    name, tagline, categoryId, address, city, state, zip,
    phone, email, website, description, facebook, instagram, yelp,
    // Deal fields — written as a first-class Deal row alongside the
    // Business in a single transaction. Replaces the legacy Business.coupon
    // Json blob (dropped in migration 20260915000000_drop_business_coupon).
    // The toggle + headline pattern is preserved so /submit's UX stays
    // identical to what owners were used to.
    deal: dealInput, hours, latitude, longitude,
    emailOptIn = false,
    smsOptIn = false,
  } = body
  const hasEmailConsent = Boolean(emailOptIn)
  const hasSmsConsent = Boolean(smsOptIn)

  if (!name || !categoryId || !address || !zip || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (typeof description !== 'string' || description.trim().length < 50) {
    return NextResponse.json({ error: 'Description must be at least 50 characters' }, { status: 400 })
  }

  try {
    // Resolve the category: try by CUID first, then by slug. Either form is accepted.
    // If no match is found, auto-create the category from the slug (handles cases where
    // categories.ts has categories that don't exist in the DB yet — e.g. after a schema
    // change or new category added to the frontend before a seed was run).
    let category = await prisma.category.findFirst({
      where: { OR: [{ id: categoryId as string }, { slug: categoryId as string }] },
      select: { id: true, slug: true },
    })

    if (!category) {
      // Auto-create from slug — use the slug as name with title-case formatting
      const autoName = (categoryId as string)
        .split('-')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      category = await prisma.category.create({
        data: { id: categoryId as string, name: autoName, slug: categoryId as string, icon: 'Star', description: '' },
        select: { id: true, slug: true },
      })
    }

    // We intentionally do NOT auto-attach the submitter as `ownerId` here.
    //
    //   - Business.ownerId is @unique (1:1 with Owner). The original schema
    //     assumption was one-account-one-business, but real owners run
    //     multiple businesses (Johnny owns Rate Trac Mortgage + Menke Real
    //     Estate & Mortgage; restaurant groups run multiple locations). If
    //     we attach on submit, anyone with one already-owned business
    //     hits P2002 ("a business with that name already exists" — wrong,
    //     it's an owner-uniqueness collision).
    //   - /claim/<token> is the canonical ownership-transfer path: it
    //     looks up the token, verifies email match or password, and
    //     links the listing to the authenticated Owner (replacing any
    //     prior owner with the new one — so claim is also the fix if a
    //     business was accidentally auto-attached to the wrong person).
    //
    // Generate a one-time claim token so the submitter can claim ownership
    // through /claim. Token expires in 7 days.
    const claimToken = nanoid(32)

    const slug = `${(name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${nanoid(6)}`

    // Bundle Business + Deal creation in one transaction. Either both land
    // or neither does — no half-submitted businesses floating without their
    // deal payload (the bug the legacy coupon JSON had). Typed as
    // Prisma.DealUncheckedCreateInput so the optional code/imageUrl fields
    // stay narrowed to string|null instead of widening to unknown.
    const d = (dealInput && typeof dealInput === 'object'
      ? (dealInput as Record<string, unknown>)
      : null) as null | {
        headline?: unknown; description?: unknown; code?: unknown
        imageUrl?: unknown; startsAt?: unknown; expiresAt?: unknown
      }
    const deal: Omit<Prisma.DealUncheckedCreateInput, 'businessId'> | null = d && d.headline
      ? {
          headline: String(d.headline).trim(),
          description: String(d.description ?? ''),
          code: typeof d.code === 'string' && d.code ? d.code : null,
          imageUrl: typeof d.imageUrl === 'string' && d.imageUrl ? d.imageUrl : null,
          startsAt: d.startsAt ? new Date(String(d.startsAt)) : null,
          expiresAt: d.expiresAt ? new Date(String(d.expiresAt)) : null,
          isActive: true,
        }
      : null

    const business = await prisma.$transaction(async (tx) => {
      const b = await tx.business.create({
        data: {
          slug,
          name: name as string,
          tagline: (tagline as string) || null,
          categoryId: category!.id,
          // ownerId intentionally omitted — see comment above. /claim
          // is the only path that links a Business to an Owner.
          claimToken,
          claimExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          address: address as string,
          city: (city as string) || 'Moreno Valley',
          state: (state as string) || 'CA',
          zip: zip as string,
          phone: (phone as string) || null,
          email: (email as string) || null,
          website: (website as string) || null,
          description: description as string,
          facebook: (facebook as string) || null,
          instagram: (instagram as string) || null,
          yelp: (yelp as string) || null,
          latitude: typeof latitude === 'number' ? latitude : null,
          longitude: typeof longitude === 'number' ? longitude : null,
          hours: (hours as Prisma.InputJsonValue) || undefined,
          status: 'PENDING',
        },
      })
      if (deal) {
        await tx.deal.create({
          data: { ...deal, businessId: b.id },
        })
      }
      return b
    })

    // Persist consent at submit-time (audit trail for 10DLC).
    // Mirrored to the Owner when they claim the listing.
    if (hasEmailConsent || hasSmsConsent) {
      await prisma.business.update({
        where: { id: business.id },
        data: {
          submitterEmailOptIn: hasEmailConsent,
          submitterSmsOptIn: hasSmsConsent,
          submitterConsentAt: new Date(),
        },
      })
    }

    return NextResponse.json({ slug: business.slug, claimToken, name: business.name }, { status: 201 })
  } catch (err: unknown) {
    // Surface Prisma / transaction errors as JSON so the client can render
    // them instead of getting an empty body and a JSON-parse crash.
    // P2002 = unique constraint (now only slug collision can fire here,
    // since we don't write ownerId anymore — see comment above).
    const message = err instanceof Error ? err.message : 'Unknown error'
    const code = (err as { code?: string }).code
    if (code === 'P2002') {
      return NextResponse.json(
        { error: 'A business with that name (or URL slug) already exists. Try a slightly different name.' },
        { status: 409 }
      )
    }
    console.error('[/api/businesses POST]', code, message)
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 })
  }
}