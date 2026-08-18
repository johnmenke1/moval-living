import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// GET /api/places/photos?ref=<photo_ref>&maxWidth=<px>
//
// Proxies Google Places photo bytes server-side so the API key never
// touches the browser. Supports BOTH formats:
//
//   1. Legacy v1:   ref=<photo_reference string>
//                   → https://maps.googleapis.com/maps/api/place/photo
//
//   2. Places API (New) v1:  ref=places/<place_id>/photos/<photo_id>
//                   → https://places.googleapis.com/v1/<name>/media
//
// Detection: if the ref starts with "places/" we use the new endpoint.
// Otherwise we treat it as a legacy photo_reference.
//
// The proxy returns the raw image bytes with a Cache-Control header
// so the browser + CDN can cache the result (24h). Set
// `cache=0` to disable caching (used by the enrichment script during
// backfills).
export async function GET(req: NextRequest) {
  if (!GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const ref = searchParams.get('ref')
  const maxWidth = searchParams.get('maxWidth') || '800'
  const cacheBust = searchParams.get('cache') === '0'

  if (!ref) {
    return NextResponse.json({ error: 'ref (photo_reference or photo name) is required' }, { status: 400 })
  }

  // Defense-in-depth: don't let an attacker drive us to arbitrary URLs.
  // Both Google endpoints require the ref to be Google-controlled.
  const isNewFormat = ref.startsWith('places/')

  try {
    let url: string
    if (isNewFormat) {
      // Places API (New) — note: the path is the photo name itself,
      // and we pass the key as ?key= (NOT a header). maxWidthPx is the
      // integer dimension.
      url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${encodeURIComponent(maxWidth)}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}`
    } else {
      // Legacy — keep working for existing call sites.
      url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${encodeURIComponent(maxWidth)}&photo_reference=${encodeURIComponent(ref)}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}`
    }

    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${res.status}`, detail: await res.text().catch(() => null) },
        { status: 502 },
      )
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        // 1 day for normal traffic; 5 minutes for backfill (cache-bust runs).
        'Cache-Control': cacheBust
          ? 'public, max-age=300'
          : 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('Places photo proxy error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}