import { NextResponse } from 'next/server'
import { getAccessToken, getPropertyEndpoint } from '@/lib/trestle-auth'

export const revalidate = 0

type RawProperty = Record<string, unknown>

// ── OpenHouse sub-object (RESO standard) ─────────────────────────────────────
type OpenHouseEntry = {
  startDate: string      // ISO datetime
  endDate: string       // ISO datetime
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

function pickPhoto(p: RawProperty): string | null {
  const media = p.Media as RawProperty[] | undefined
  if (!Array.isArray(media) || media.length === 0) return null
  const photo =
    media.find((m) => m.MediaCategory === 'Photo' || m.MediaCategory == null) ??
    media[0]
  return (photo?.MediaURL as string | undefined) ?? null
}

function parseOpenHouses(p: RawProperty): OpenHouseEntry[] {
  // RESO standard: OpenHouse is an array on the property record
  const raw = p.OpenHouse
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr
    .map((entry: RawProperty) => {
      const startDate = entry.StartDate ?? entry.startDate ?? null
      const endDate = entry.EndDate ?? entry.endDate ?? null
      if (!startDate || !endDate) return null

      // Only include future open houses
      const start = new Date(startDate as string)
      if (isNaN(start.getTime())) return null
      if (start <= new Date()) return null

      return {
        startDate: startDate as string,
        endDate: endDate as string,
        startTime: (entry.StartTime ?? entry.startTime ?? null) as string | null,
        endTime: (entry.EndTime ?? entry.endTime ?? null) as string | null,
        remarks: (entry.Remarks ?? entry.remarks ?? null) as string | null,
      }
    })
    .filter((e): e is OpenHouseEntry => e !== null)
}

function normalize(p: RawProperty): OpenHouseListing {
  return {
    listingKey: p.ListingKey as string,
    listingId: (p.ListingId ?? p.ListingKey) as string,
    address: buildAddress(p),
    listPrice: Number.isFinite(Number(p.ListPrice)) ? Number(p.ListPrice) : 0,
    status: p.StandardStatus as string,
    bedrooms: Number.isFinite(Number(p.BedroomsTotal)) ? Number(p.BedroomsTotal) : null,
    bathrooms: Number.isFinite(Number(p.BathroomsTotalInteger))
      ? Number(p.BathroomsTotalInteger)
      : null,
    livingArea: Number.isFinite(Number(p.LivingArea)) ? Number(p.LivingArea) : null,
    yearBuilt: Number.isFinite(Number(p.YearBuilt)) ? Number(p.YearBuilt) : null,
    city: p.City as string | null,
    state: p.StateOrProvince as string | null,
    zip: p.PostalCode as string | null,
    daysOnMarket: Number.isFinite(Number(p.DaysOnMarket)) ? Number(p.DaysOnMarket) : null,
    listAgent: p.ListAgentFullName as string | null,
    listOffice: p.ListOfficeName as string | null,
    showAddress: p.InternetAddressDisplayYN as boolean | null,
    photoUrl: pickPhoto(p),
    openHouses: parseOpenHouses(p),
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const token = await getAccessToken()

    // Find Active listings in Moreno Valley that have OpenHouse data.
    // Filter: active + has city + future start date on at least one OH entry.
    // We pull all OH listings (up to 200) so we can filter and sort in-process.
    const filter = [
      "contains(City, 'Moreno Valley')",
      "StateOrProvince eq 'CA'",
      "StandardStatus eq 'Active'",
    ].join(' and ')

    const params = new URLSearchParams({
      $filter: filter,
      $top: '200',
      $count: 'true',
      $orderby: 'ListingContractDate desc',
      $select: [
        'ListingKey', 'ListingId',
        'StreetNumber', 'StreetDirPrefix', 'StreetName', 'StreetSuffix',
        'City', 'StateOrProvince', 'PostalCode',
        'ListPrice', 'BedroomsTotal', 'BathroomsTotalInteger', 'LivingArea',
        'YearBuilt', 'DaysOnMarket',
        'InternetAddressDisplayYN', 'MlsNumber',
        'ListAgentFullName', 'ListOfficeName',
        'OpenHouse',
      ].join(','),
      // Media is needed for the listing card photo
      $expand:
        "Media($filter=MediaCategory eq 'Photo' or MediaCategory eq null;$orderby=Order)",
    })

    const url = `${getPropertyEndpoint()}?${params.toString()}`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[trestle/open-houses]', res.status, text)
      return NextResponse.json(
        { error: 'Failed to fetch open houses from Trestle', detail: text },
        { status: 502 }
      )
    }

    const data = (await res.json()) as {
      '@odata.count'?: number
      value?: RawProperty[]
    }

    const raw = data.value ?? []

    // Filter to only listings with at least one future open house,
    // then normalize.
    const listings = raw
      .map(normalize)
      .filter((p) => p.openHouses.length > 0)

    // Sort: soonest first-open-house first
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
