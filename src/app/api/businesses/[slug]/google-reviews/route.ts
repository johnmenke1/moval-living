import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// GET /api/businesses/[slug]/google-reviews
// Returns cached googleRating + googleReviewCount for a business.
// Triggers a fresh fetch from Google Places if ?refresh=true (owner/admin only).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const refresh = req.nextUrl.searchParams.get('refresh') === 'true'

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, googleBusiness: true, googleRating: true, googleReviewCount: true },
  })

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  if (!refresh) {
    return NextResponse.json({
      googleRating: business.googleRating,
      googleReviewCount: business.googleReviewCount,
      source: 'cache',
    })
  }

  // Refresh requested — caller must be authenticated as owner or admin
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
  }

  if (!business.googleBusiness) {
    return NextResponse.json({ error: 'No Google Business ID for this listing' }, { status: 400 })
  }

  try {
    // Google Places API v1: fetch a specific place by ID
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${business.googleBusiness}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount',
        },
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Google Places fetch error:', err)
      return NextResponse.json({ error: 'Failed to fetch from Google' }, { status: 502 })
    }

    const data = await res.json()
    const rating = data.rating ?? null
    const reviewCount = data.userRatingCount ?? null

    // Update cache in DB
    await prisma.business.update({
      where: { id: business.id },
      data: { googleRating: rating, googleReviewCount: reviewCount },
    })

    return NextResponse.json({ googleRating: rating, googleReviewCount: reviewCount, source: 'live' })
  } catch (err) {
    console.error('Google reviews refresh error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
