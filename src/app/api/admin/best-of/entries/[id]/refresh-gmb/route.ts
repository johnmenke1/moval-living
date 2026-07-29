import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/best-of/entries/[id]/refresh-gmb
// Fetches fresh googleRating + googleReviewCount from Places API for an entry's business
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const entry = await prisma.bestOfEntry.findUnique({
    where: { id },
    include: { business: { select: { googleBusiness: true } } },
  })

  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  if (!entry.business.googleBusiness) {
    return NextResponse.json({ error: 'Business has no Google Place ID' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
  }

  let rating: number | null = null
  let reviewCount: number | null = null

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${entry.business.googleBusiness}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'rating,userRatingCount',
        },
      }
    )
    if (res.ok) {
      const data = await res.json()
      rating = data.rating ?? null
      reviewCount = data.userRatingCount ?? null
    }
  } catch {
    // Non-fatal — keep existing values
  }

  const updated = await prisma.bestOfEntry.update({
    where: { id },
    data: {
      googleRating: rating,
      googleReviewCount: reviewCount,
    },
    include: {
      business: {
        select: { id: true, name: true, slug: true, address: true, website: true, logo: true },
      },
    },
  })

  return NextResponse.json(updated)
}
