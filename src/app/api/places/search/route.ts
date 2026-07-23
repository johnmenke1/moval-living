import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// GET /api/places/search?q=...&location=... — search Google Places
// Used to find a business by name or GMB URL before creating a listing
export async function GET(req: NextRequest) {
  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) {
    return NextResponse.json({ error: 'q (query) is required' }, { status: 400 })
  }

  // Try to scope results to Moreno Valley, CA
  const locationBias = 'circle:20000@33.9425,-117.2280' // Moreno Valley center + 20km radius

  try {
    const url = new URL('https://places.googleapis.com/v1/places:searchText')
    url.searchParams.set('textQuery', q)
    url.searchParams.set('locationBias', locationBias)
    url.searchParams.set('includedType', 'local_business')
    url.searchParams.set('pageSize', '5')
    url.searchParams.set('fields', 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.nationalPhoneNumber,places.website,places.regularOpeningHours,places.photos,places.location')

    const res = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.primaryType,places.nationalPhoneNumber,places.website,places.regularOpeningHours,places.photos,places.location',
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Google Places search error:', err)
      return NextResponse.json({ error: 'Google Places search failed' }, { status: 502 })
    }

    const data = await res.json()
    const places = (data.places || []).map((p: {
      id: string
      displayName?: { text: string }
      formattedAddress?: string
      primaryType?: string
      nationalPhoneNumber?: string
      website?: string
      regularOpeningHours?: { periods?: { openDay?: string; openTime?: string; closeDay?: string; closeTime?: string }[] }
      photos?: { name: string }[]
      location?: { latitude: number; longitude: number }
    }) => ({
      placeId: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      phone: p.nationalPhoneNumber || '',
      website: p.website || '',
      type: p.primaryType || '',
      // Opening hours as our JSON format: { mon: { open: "9:00 AM", close: "5:00 PM", closed: false }, ... }
      hours: parseOpeningHours(p.regularOpeningHours),
      photos: p.photos || [],
      location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    }))

    return NextResponse.json({ places })
  } catch (err) {
    console.error('Places search error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function parseOpeningHours(roh?: {
  periods?: { openDay?: string; openTime?: string; closeDay?: string; closeTime?: string }[]
}): Record<string, { open: string; close: string; closed: boolean }> | null {
  if (!roh?.periods?.length) return null

  const dayMap: Record<string, string> = {
    MONDAY: 'mon', TUESDAY: 'tue', WEDNESDAY: 'wed', THURSDAY: 'thu',
    FRIDAY: 'fri', SATURDAY: 'sat', SUNDAY: 'sun',
  }

  const result: Record<string, { open: string; close: string; closed: boolean }> = {}
  for (const p of roh.periods) {
    const day = p.openDay ? dayMap[p.openDay] : null
    if (!day) continue
    result[day] = {
      open: p.openTime ? formatTime(p.openTime) : '9:00 AM',
      close: p.closeTime ? formatTime(p.closeTime) : '5:00 PM',
      closed: false,
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

function formatTime(time: string): string {
  // time is "HH:mm" e.g. "09:00"
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}
