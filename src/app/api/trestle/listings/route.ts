import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, getPropertyEndpoint } from '@/lib/trestle-auth'

/**
 * Trestle / CoreLogic OData proxy for Moreno Valley listings.
 * Auth: OAuth2 client credentials (TRESTLE_CLIENT_ID / TRESTLE_CLIENT_SECRET env vars).
 * Token is fetched + cached server-side; never exposed to the client.
 * Based on the proven working pattern from menke-real-estate app/api/market-listings.
 */

export const revalidate = 0

export async function GET(request: NextRequest) {
  let token: string
  try {
    token = await getAccessToken()
  } catch (err) {
    console.error('[Trestle listings] Auth error:', err)
    return NextResponse.json(
      { listings: [], error: 'Trestle credentials not configured', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '12'), 1), 24)
  const skip = (page - 1) * limit

  // Match the working menke-real-estate pattern exactly:
  // - contains(City) not exact eq — handles variations in how city is stored
  // - StateOrProvince eq 'CA' — required to exclude other "Moreno Valley" cities
  const filter =
    "contains(City, 'Moreno Valley') and StateOrProvince eq 'CA' and StandardStatus eq 'Active'"

  const params = new URLSearchParams()
  params.set('$top', String(limit))
  params.set('$skip', String(skip))
  params.set('$count', 'true')
  params.set('$orderby', 'ListingContractDate desc, OnMarketDate desc, ModificationTimestamp desc')
  params.set(
    '$select',
    [
      'ListingKey',
      'ListingId',
      'StreetNumber',
      'StreetDirPrefix',
      'StreetName',
      'StreetSuffix',
      'City',
      'StateOrProvince',
      'PostalCode',
      'ListPrice',
      'BedroomsTotal',
      'BathroomsTotalInteger',
      'LivingArea',
      'LotSizeAcres',
      'GarageSpaces',
      'YearBuilt',
      'PoolYN',
      'DaysOnMarket',
      'InternetAddressDisplayYN',
      'MlsNumber',
      'ListAgentFullName',
      'ListOfficeName',
    ].join(',')
  )
  // Inline photo expansion — proven working in menke-real-estate
  params.set(
    '$expand',
    "Media($filter=MediaCategory eq 'Photo' or MediaCategory eq null;$orderby=Order)"
  )
  params.set('$filter', filter)

  const url = `${getPropertyEndpoint()}?${params.toString()}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[Trestle] Network error:', err)
    return NextResponse.json(
      { listings: [], error: 'Failed to reach Trestle API', message: String(err) },
      { status: 502 }
    )
  }

  if (!res.ok) {
    const body = await res.text()
    console.error(`[Trestle] API error ${res.status}:`, body)
    return NextResponse.json(
      { listings: [], error: 'Trestle API request failed', details: body.slice(0, 300) },
      { status: 502 }
    )
  }

  const data = await res.json()
  const rows: Record<string, unknown>[] = data.value ?? []
  const total: number = data['@odata.count'] ?? rows.length

  const listings = rows.map(normalizeListing)

  return NextResponse.json(
    { listings, total, page, limit, totalPages: Math.ceil(total / limit) },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}

function buildAddress(p: Record<string, unknown>): string {
  const parts = [p.StreetNumber, p.StreetDirPrefix, p.StreetName, p.StreetSuffix]
    .filter((x) => x != null && x !== '')
    .join(' ')
    .trim()
  if (parts) {
    return `${parts}, ${p.City ?? ''}, ${p.StateOrProvince ?? ''} ${p.PostalCode ?? ''}`
      .replace(/,\s*,/g, ',')
      .trim()
  }
  return [p.City, p.StateOrProvince, p.PostalCode].filter(Boolean).join(', ')
}

function pickPhoto(p: Record<string, unknown>): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const media = p.Media as any[]
  if (!Array.isArray(media) || media.length === 0) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photo = media.find((m: any) => m.MediaCategory === 'Photo' || m.MediaCategory == null) ?? media[0]
  return photo?.MediaURL ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeListing(p: any): any {
  return {
    listingKey: p.ListingKey,
    listingId: p.ListingId || p.ListingKey,
    address: buildAddress(p),
    listPrice: Number.isFinite(Number(p.ListPrice)) ? Number(p.ListPrice) : null,
    closePrice: Number.isFinite(Number(p.ClosePrice)) ? Number(p.ClosePrice) : null,
    status: p.StandardStatus,
    bedrooms: Number.isFinite(Number(p.BedroomsTotal)) ? Number(p.BedroomsTotal) : null,
    bathrooms: Number.isFinite(Number(p.BathroomsTotalInteger)) ? Number(p.BathroomsTotalInteger) : null,
    livingArea: Number.isFinite(Number(p.LivingArea)) ? Number(p.LivingArea) : null,
    lotSizeAcres: Number.isFinite(Number(p.LotSizeAcres)) && Number(p.LotSizeAcres) > 0 ? Number(p.LotSizeAcres) : null,
    garageSpaces: Number.isFinite(Number(p.GarageSpaces)) && Number(p.GarageSpaces) > 0 ? Number(p.GarageSpaces) : null,
    yearBuilt: Number.isFinite(Number(p.YearBuilt)) ? Number(p.YearBuilt) : null,
    pool: p.PoolYN === true || p.PoolYN === 'true' || p.PoolYN === 'Y',
    city: p.City,
    state: p.StateOrProvince,
    zip: p.PostalCode,
    daysOnMarket: Number.isFinite(Number(p.DaysOnMarket)) ? Number(p.DaysOnMarket) : null,
    listAgent: p.ListAgentFullName,
    listOffice: p.ListOfficeName,
    showAddress: p.InternetAddressDisplayYN,
    photoUrl: pickPhoto(p),
  }
}
