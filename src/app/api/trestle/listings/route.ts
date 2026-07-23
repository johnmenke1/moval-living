import { NextResponse } from 'next/server'
import { getAccessToken, getPropertyEndpoint } from '@/lib/trestle-auth'

/**
 * Trestle / CoreLogic OData proxy for Moreno Valley real estate listings.
 *
 * Auth: OAuth2 client credentials (TRESTLE_CLIENT_ID / TRESTLE_CLIENT_SECRET env vars).
 * Token is fetched + cached server-side; never exposed to the client.
 * Base URL: TRESTLE_BASE_URL (falls back to https://api-prod.corelogic.com/trestle/odata)
 *
 * CRMLS covers Riverside County including Moreno Valley.
 * RESO WebAPI OData 4.0 — filter, select, orderby, top, skip.
 */

export const revalidate = 900 // 15-minute ISR cache

export async function GET(request: Request) {
  let token: string
  try {
    token = await getAccessToken()
  } catch (err) {
    console.error('[Trestle listings] Auth error:', err)
    return NextResponse.json({ error: 'Trestle credentials not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)

  // --- Parse filters ---
  const propertyType = searchParams.get('propertyType') ?? 'Residential'
  const status = searchParams.get('status') ?? 'Active'
  const minBeds = searchParams.get('minBeds')
  const maxBeds = searchParams.get('maxBeds')
  const minPrice = searchParams.get('minPrice')
  const maxPrice = searchParams.get('maxPrice')
  const sort = searchParams.get('sort') ?? 'CloseDate desc'
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const skip = (page - 1) * limit

  // --- Build OData $filter ---
  // StandardStatus is the correct field name per RESO standards
  const filters: string[] = [
    "City eq 'Moreno Valley'",
    `PropertyType eq '${propertyType}'`,
    `StandardStatus eq '${status}'`,
  ]

  if (minBeds) filters.push(`BedroomsTotal ge ${minBeds}`)
  if (maxBeds) filters.push(`BedroomsTotal le ${maxBeds}`)
  if (minPrice) filters.push(`ListPrice ge ${minPrice}`)
  if (maxPrice) filters.push(`ListPrice le ${maxPrice}`)

  const odataFilter = filters.join(' and ')

  // --- Select limited fields for performance + privacy ---
  const select = [
    'ListingKey',
    'ListPrice',
    'ClosePrice',
    'BedroomsTotal',
    'BathroomsFull',
    'BathroomsHalf',
    'LivingArea',
    'LotSizeAcres',
    'GarageSpaces',
    'YearBuilt',
    'PoolYN',
    'StreetName',
    'StreetNumber',
    'UnitNumber',
    'City',
    'StateOrProvince',
    'PostalCode',
    'PropertyType',
    'StandardStatus',
    'ListingContractDate',
    'CloseDate',
    'DaysOnMarket',
    'InternetAddressDisplayYN',
    'MlsNumber',
    'ListAgentFullName',
    'ListOfficeName',
    'Media',
  ].join(',')

  const propertyUrl = getPropertyEndpoint()
  const params = new URLSearchParams({
    $filter: odataFilter,
    $select: select,
    $top: String(limit),
    $skip: String(skip),
    $count: 'true',
    $orderby: sort,
  })

  let res: Response
  try {
    res = await fetch(`${propertyUrl}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      next: { revalidate: 900 },
    })
  } catch (err) {
    console.error('[Trestle] Network error:', err)
    return NextResponse.json({ error: 'Failed to reach Trestle API' }, { status: 502 })
  }

  if (!res.ok) {
    const body = await res.text()
    console.error(`[Trestle] API error ${res.status}:`, body)
    return NextResponse.json({ error: 'Trestle API request failed', detail: res.statusText }, { status: 502 })
  }

  const data = await res.json()

  // Normalize OData envelope
  const total: number = data['@odata.count'] ?? data.value?.length ?? 0
  const listings: Record<string, unknown>[] = data.value ?? []

  return NextResponse.json({
    listings: listings.map(normalizeListing),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPhotoUrl(r: any): string | null {
  if (!r.Media) return null
  const mediaArr = Array.isArray(r.Media) ? r.Media : [r.Media]
  const photo = mediaArr.find((m: { MediaGroup?: number }) => m.MediaGroup === 1) ?? mediaArr[0]
  return photo?.MediaURL ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeListing(r: any): any {
  return {
    listingKey: r.ListingKey,
    mlsNumber: r.MlsNumber,
    listPrice: r.ListPrice,
    closePrice: r.ClosePrice,
    status: r.StandardStatus,
    propertyType: r.PropertyType,
    bedrooms: r.BedroomsTotal,
    bathroomsFull: r.BathroomsFull,
    bathroomsHalf: r.BathroomsHalf,
    livingArea: r.LivingArea,
    lotSizeAcres: r.LotSizeAcres,
    garageSpaces: r.GarageSpaces,
    yearBuilt: r.YearBuilt,
    pool: r.PoolYN,
    streetNumber: r.StreetNumber,
    streetName: r.StreetName,
    unit: r.UnitNumber,
    city: r.City,
    state: r.StateOrProvince,
    zip: r.PostalCode,
    listDate: r.ListingContractDate,
    closeDate: r.CloseDate,
    daysOnMarket: r.DaysOnMarket,
    listAgent: r.ListAgentFullName,
    listOffice: r.ListOfficeName,
    showAddress: r.InternetAddressDisplayYN,
    photoUrl: extractPhotoUrl(r),
  }
}
