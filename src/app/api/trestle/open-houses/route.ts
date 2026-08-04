import { NextResponse } from 'next/server'
import { getAccessToken, getMediaEndpoint, getPropertyEndpoint } from '@/lib/trestle-auth'

export const revalidate = 0

type RawProperty = Record<string, unknown>

// ── OpenHouse sub-object ──────────────────────────────────────────────────────
type OpenHouseEntry = {
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  remarks: string | null
}

// ── Normalized shape returned to the client ──────────────────────────────────
export type OpenHouseListing = {
  listingKey: string
  listingId: string
  address: string
  listPrice: number
  status: string
  bedrooms: number | null
  bathrooms: number | null
  livingArea: number | null
  yearBuilt: number | null
  city: string | null
  state: string | null
  zip: string | null
  daysOnMarket: number | null
  listAgent: string | null
  listOffice: string | null
  showAddress: boolean | null
  photoUrl: string | null
  openHouses: OpenHouseEntry[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAddress(p: RawProperty): string {
  const street = [p.StreetNumber, p.StreetDirPrefix, p.StreetName, p.StreetSuffix]
    .filter((v) => v != null && v !== '').join(' ')
  if (p.InternetAddressDisplayYN === false) {
    return [p.City, p.StateOrProvince, p.PostalCode].filter(Boolean).join(', ')
  }
  return `${street}, ${p.City ?? ''}, ${p.StateOrProvince ?? ''} ${p.PostalCode ?? ''}`.replace(/^,\s*/, '')
}

function parseOpenHouses(p: RawProperty): OpenHouseEntry[] {
  const raw = p.OpenHouse
  if (!raw) return []
  const arr: RawProperty[] = Array.isArray(raw) ? raw : [raw]
  const now = new Date()
  return arr
    .map((entry) => {
      const startDate = (entry.StartDate ?? entry.startDate ?? null) as string | null
      const endDate = (entry.EndDate ?? entry.endDate ?? null) as string | null
      if (!startDate || !endDate) return null
      const start = new Date(startDate)
      if (isNaN(start.getTime())) return null
      if (start <= now) return null
      return {
        startDate,
        endDate,
        startTime: (entry.StartTime ?? entry.startTime ?? null) as string | null,
        endTime: (entry.EndTime ?? entry.endTime ?? null) as string | null,
        remarks: (entry.Remarks ?? entry.remarks ?? null) as string | null,
      }
    })
    .filter((e): e is OpenHouseEntry => e !== null)
}

function normalize(p: RawProperty, photoUrl: string | null): OpenHouseListing {
  const numberOrNull = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : null
  return {
    listingKey: String(p.ListingKey ?? ''),
    listingId: String(p.ListingId ?? p.ListingKey ?? ''),
    address: buildAddress(p),
    listPrice: numberOrNull(p.ListPrice) ?? 0,
    status: String(p.StandardStatus ?? ''),
    bedrooms: numberOrNull(p.BedroomsTotal),
    bathrooms: numberOrNull(p.BathroomsTotalInteger),
    livingArea: numberOrNull(p.BuildingAreaTotal) ?? numberOrNull(p.LivingArea),
    yearBuilt: numberOrNull(p.YearBuilt),
    city: p.City as string | null,
    state: p.StateOrProvince as string | null,
    zip: p.PostalCode as string | null,
    daysOnMarket: numberOrNull(p.DaysOnMarket),
    listAgent: p.ListAgentFullName as string | null,
    listOffice: p.ListOfficeName as string | null,
    showAddress: p.InternetAddressDisplayYN as boolean | null,
    photoUrl,
    openHouses: parseOpenHouses(p),
  }
}

// ── Photo fetch (mirrors listings route exactly) ──────────────────────────────

async function fetchPhotos(
  token: string,
  keys: string[],
): Promise<Map<string, string>> {
  const photos = new Map<string, string>()
  if (!keys.length) return photos
  const filter = keys
    .map((k) => `ResourceRecordKey eq '${k.replace(/'/g, "''")}'`)
    .join(' or ')
  const params = new URLSearchParams({
    $filter: filter,
    $select: 'MediaURL,ResourceRecordKey',
    $top: String(Math.min(keys.length * 12, 500)),
  })
  const res = await fetch(`${getMediaEndpoint()}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error(`[Trestle Media] ${res.status}:`, await res.text())
    return photos
  }
  const data = (await res.json()) as { value?: { ResourceRecordKey?: string; MediaURL?: string }[] }
  for (const row of data.value ?? []) {
    if (row.ResourceRecordKey && row.MediaURL && !photos.has(row.ResourceRecordKey)) {
      photos.set(row.ResourceRecordKey, row.MediaURL)
    }
  }
  return photos
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const token = await getAccessToken()

    // Active Moreno Valley listings — same field list as the listings route,
    // plus OpenHouse via $expand (not $select — it's a navigation property).
    // We pull 200 and filter in-process for listings that have OH data.
    const filter = [
      "contains(City, 'Moreno Valley')",
      "StateOrProvince eq 'CA'",
      "StandardStatus eq 'Active'",
    ].join(' and ')

    // NOTE: $expand syntax with semicolons is unescaped by URLSearchParams.
    // We build the param manually to preserve the raw OData query string.
    const rawParams = {
      $filter: filter,
      $top: '200',
      $count: 'true',
      $orderby: 'ListingContractDate desc',
      $select: [
        'ListingKey', 'ListingId',
        'StreetNumber', 'StreetDirPrefix', 'StreetName', 'StreetSuffix',
        'City', 'StateOrProvince', 'PostalCode',
        'ListPrice', 'BedroomsTotal', 'BathroomsTotalInteger',
        'BuildingAreaTotal', 'LivingArea',
        'YearBuilt', 'DaysOnMarket',
        'InternetAddressDisplayYN',
        'ListAgentFullName', 'ListOfficeName',
        'OpenHouse',
      ].join(','),
    }

    // Build URL manually so $expand with semicolons passes through untouched
    const base = getPropertyEndpoint()
    const qs = new URLSearchParams(rawParams).toString()
    // Use the same $expand syntax that works in the listings route for Media
    const url = `${base}?${qs}&%24expand=OpenHouse`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[trestle/open-houses]', res.status, body)
      return NextResponse.json(
        { listings: [], error: 'Trestle API request failed', details: body.slice(0, 500) },
        { status: 502 }
      )
    }

    const data = (await res.json()) as {
      '@odata.count'?: number
      value?: RawProperty[]
    }

    const rows = data.value ?? []

    // DEBUG: log the raw shape of the first row's OpenHouse field
    if (rows.length > 0) {
      const first = rows[0]
      console.log('[trestle/open-houses] DEBUG first row keys:', Object.keys(first))
      console.log('[trestle/open-houses] DEBUG OpenHouse:', JSON.stringify(first.OpenHouse)?.slice(0, 500))
    }
    const keys = rows.map((r) => String(r.ListingKey ?? '')).filter(Boolean)
    const photos = await fetchPhotos(token, keys)

    const listings = rows
      .map((r) => normalize(r, photos.get(String(r.ListingKey)) ?? null))
      .filter((p) => p.openHouses.length > 0)

    // Sort: soonest first open house first
    listings.sort((a, b) => {
      const aStart = new Date(a.openHouses[0].startDate).getTime()
      const bStart = new Date(b.openHouses[0].startDate).getTime()
      return aStart - bStart
    })

    const total = data['@odata.count'] ?? listings.length

    return NextResponse.json(
      { listings, total },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[trestle/open-houses]', message)
    return NextResponse.json({ listings: [], error: message }, { status: 500 })
  }
}
