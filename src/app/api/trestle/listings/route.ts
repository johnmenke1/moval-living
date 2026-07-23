import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, getMediaEndpoint, getPropertyEndpoint } from '@/lib/trestle-auth'

export const revalidate = 0

type RawListing = Record<string, unknown>
type MediaRow = { ResourceRecordKey?: string; MediaURL?: string }

const ALLOWED_SORTS: Record<string, string> = {
  'ListingContractDate desc': 'ListingContractDate desc',
  'ListPrice asc': 'ListPrice asc',
  'ListPrice desc': 'ListPrice desc',
  'DaysOnMarket desc': 'DaysOnMarket desc',
}

async function fetchPhotos(token: string, keys: string[]): Promise<Map<string, string>> {
  const photos = new Map<string, string>()
  if (!keys.length) return photos
  const filter = keys.map(key => `ResourceRecordKey eq '${key.replace(/'/g, "''")}'`).join(' or ')
  const params = new URLSearchParams({
    $filter: filter,
    $select: 'MediaURL,ResourceRecordKey',
    $top: String(Math.min(keys.length * 12, 500)),
  })
  const res = await fetch(`${getMediaEndpoint()}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error(`[Trestle Media] ${res.status}:`, await res.text())
    return photos
  }
  const data = (await res.json()) as { value?: MediaRow[] }
  for (const row of data.value ?? []) {
    if (row.ResourceRecordKey && row.MediaURL && !photos.has(row.ResourceRecordKey)) {
      photos.set(row.ResourceRecordKey, row.MediaURL)
    }
  }
  return photos
}

export async function GET(request: NextRequest) {
  try {
    const token = await getAccessToken()
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(Number(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 12, 1), 24)
    const skip = (page - 1) * limit
    const sort = ALLOWED_SORTS[searchParams.get('sort') ?? ''] ?? 'ListingContractDate desc'
    const q = (searchParams.get('q') ?? '').trim().replace(/'/g, "''")

    const filters = [
      "contains(City, 'Moreno Valley')",
      "StateOrProvince eq 'CA'",
      "PropertyType eq 'Residential'",
      "StandardStatus eq 'Active'",
    ]
    for (const [name, field, op] of [
      ['minBeds', 'BedroomsTotal', 'ge'], ['maxBeds', 'BedroomsTotal', 'le'],
      ['minPrice', 'ListPrice', 'ge'], ['maxPrice', 'ListPrice', 'le'],
    ] as const) {
      const value = Number(searchParams.get(name))
      if (Number.isFinite(value) && value > 0) filters.push(`${field} ${op} ${value}`)
    }
    if (q) filters.push(`(contains(StreetName, '${q}') or ListingId eq '${q}')`)

    const params = new URLSearchParams({
      $filter: filters.join(' and '),
      $select: [
        'ListingKey','ListingId','StreetNumber','StreetDirPrefix','StreetName','StreetSuffix',
        'UnitNumber','City','StateOrProvince','PostalCode','ListPrice','ClosePrice',
        'BedroomsTotal','BathroomsTotalInteger','BuildingAreaTotal','LivingArea','LotSizeAcres',
        'GarageSpaces','YearBuilt','PoolPrivateYN','DaysOnMarket','InternetAddressDisplayYN',
        'StandardStatus','PropertyType','PropertySubType','ListingContractDate',
        'ListAgentFullName','ListOfficeName','PhotosCount',
      ].join(','),
      $top: String(limit),
      $skip: String(skip),
      $count: 'true',
      $orderby: sort,
    })

    const res = await fetch(`${getPropertyEndpoint()}?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[Trestle Property] ${res.status}:`, body)
      return NextResponse.json({ listings: [], error: 'Trestle API request failed', details: body.slice(0, 500) }, { status: 502 })
    }

    const data = (await res.json()) as { value?: RawListing[]; '@odata.count'?: number }
    const rows = data.value ?? []
    const keys = rows.map(row => String(row.ListingKey ?? '')).filter(Boolean)
    const photos = await fetchPhotos(token, keys)
    const listings = rows.map(row => normalizeListing(row, photos.get(String(row.ListingKey)) ?? null))
    const total = data['@odata.count'] ?? listings.length
    return NextResponse.json(
      { listings, total, page, limit, totalPages: Math.ceil(total / limit) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    console.error('[Trestle listings] Error:', error)
    return NextResponse.json({ listings: [], error: 'Unable to load listings' }, { status: 500 })
  }
}

function normalizeListing(p: RawListing, photoUrl: string | null) {
  const street = [p.StreetNumber, p.StreetDirPrefix, p.StreetName, p.StreetSuffix, p.UnitNumber]
    .filter(value => value != null && value !== '').join(' ')
  const address = p.InternetAddressDisplayYN === false
    ? [p.City, p.StateOrProvince, p.PostalCode].filter(Boolean).join(', ')
    : `${street}, ${p.City ?? ''}, ${p.StateOrProvince ?? ''} ${p.PostalCode ?? ''}`.replace(/^,\s*/, '')
  const numberOrNull = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null
  return {
    listingKey: String(p.ListingKey ?? ''),
    listingId: String(p.ListingId ?? p.ListingKey ?? ''),
    address,
    listPrice: numberOrNull(p.ListPrice) ?? 0,
    closePrice: numberOrNull(p.ClosePrice),
    status: String(p.StandardStatus ?? ''),
    bedrooms: numberOrNull(p.BedroomsTotal),
    bathrooms: numberOrNull(p.BathroomsTotalInteger),
    livingArea: numberOrNull(p.BuildingAreaTotal) ?? numberOrNull(p.LivingArea),
    lotSizeAcres: numberOrNull(p.LotSizeAcres),
    garageSpaces: numberOrNull(p.GarageSpaces),
    yearBuilt: numberOrNull(p.YearBuilt),
    pool: p.PoolPrivateYN === true,
    city: p.City,
    state: p.StateOrProvince,
    zip: p.PostalCode,
    daysOnMarket: numberOrNull(p.DaysOnMarket),
    listAgent: p.ListAgentFullName,
    listOffice: p.ListOfficeName,
    showAddress: p.InternetAddressDisplayYN,
    photoUrl,
  }
}
