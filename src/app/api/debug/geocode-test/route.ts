import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/halloween'

export const dynamic = 'force-dynamic'

/**
 * TEMPORARY: returns what geocodeAddress() does in the Worker runtime.
 * Tests which env var (GOOGLE_PLACES_API_KEY vs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
 * the running code is using, and what the Geocoding API returns for a known
 * address. DELETE after we confirm the Halloween form auto-fills lat/lng.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const street = url.searchParams.get('street') ?? '12118 Marylee Way'
  const zip = url.searchParams.get('zip') ?? '92555'

  const places = process.env.GOOGLE_PLACES_API_KEY
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const out: Record<string, unknown> = {
    env: {
      GOOGLE_PLACES_API_KEY: places
        ? `${places.slice(0, 6)}...${places.slice(-4)} (length ${places.length})`
        : null,
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: publicKey
        ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)} (length ${publicKey.length})`
        : null,
    },
    addresses_equal:
      places && publicKey && places === publicKey ? 'YES (same value)' : 'NO (different or one missing)',
  }

  // Test the actual geocode call (the function picks GOOGLE_PLACES first)
  const geo = await geocodeAddress(street, 'Moreno Valley', zip)
  out.geocode_result = geo
  if (!geo) {
    out.geocode_failed = true
  }

  return NextResponse.json(out, { status: 200 })
}