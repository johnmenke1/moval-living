import { NextResponse } from 'next/server'

/**
 * Trestle / CoreLogic OData proxy for Moreno Valley real estate listings.
 *
 * Auth: Bearer token (TRESTLE_API_KEY env var — set in Vercel, never exposed to client).
 * Base URL: https://api-prod.corelogic.com/trestle/odata/Property
 * Docs: https://trestle-documentation.corelogic.com
 *
 * CRMLS covers Riverside County including Moreno Valley.
 * RESO WebAPI OData 4.0 — filter, select, orderby, top, skip.
 */

const TRESTLE_BASE = 'https://api-prod.corelogic.com/trestle/odata'
const MV_CITY_FILTER = "City eq 'Moreno Valley'"
const MV_COUNTY_FILTER = "CountyOrParish eq 'Riverside'"

export const revalidate = 900 // 15-minute ISR cache

export async function GET(request: Request) {
  const apiKey = process.env.TRESTLE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Trestle API key not configured' }, { status: 500 })
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
  const filters: string[] = [
    MV_CITY_FILTER,
    `PropertyType eq '${propertyType}'`,
    `MlsStatus eq '${status}'`,
  ]

  if (minBeds) filters.push(`BedroomsTotal ge ${minBeds}`)
  if (maxBeds) filters.push(`BedroomsTotal le ${maxBeds}`)
  if (minPrice) filters.push(`ListPrice ge ${minPrice}`)
  if (maxPrice) filters.push(`ListPrice le ${maxPrice}`)

  const odataFilter = filters.join(' and ')

  // --- Select limited fields for performance + privacy ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const select: any = [
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
    'MlsStatus',
    'ListingContractDate',
    'CloseDate',
    'DaysOnMarket',
    'InternetAddressDisplayYN',
    'MlsNumber',
    'ListAgentFullName',
    'ListOfficeName',
    'Media',
  ].join(',')

  const odataUrl = `${TRESTLE_BASE}/Property`
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
    res = await fetch(`${odataUrl}?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
  // Pick the first primary photo (MediaGroup=1) or the first entry
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
    status: r.MlsStatus,
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
