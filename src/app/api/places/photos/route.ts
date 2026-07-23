import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// GET /api/places/photos?ref=photo_reference&maxWidth=800
// Proxies Google Places photo URLs server-side to avoid exposing API key to browser
export async function GET(req: NextRequest) {
  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const ref = searchParams.get('ref')
  const maxWidth = searchParams.get('maxWidth') || '800'

  if (!ref) {
    return NextResponse.json({ error: 'ref (photo_reference) is required' }, { status: 400 })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${ref}&key=${GOOGLE_PLACES_API_KEY}`
    const res = await fetch(url)

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 1 day cache
      },
    })
  } catch (err) {
    console.error('Places photo proxy error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
