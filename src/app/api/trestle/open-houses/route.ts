import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, getPropertyEndpoint, getMediaEndpoint } from '@/lib/trestle-auth'

export const revalidate = 0

// ── Types ─────────────────────────────────────────────────────────────────────

type OpenHouseRow = Record<string, unknown>
type PropertyRow  = Record<string, unknown>
type MediaRow     = { ResourceRecordKey?: string; MediaURL?: string }

export type OpenHouseEntry = {
  openHouseId: string
  openHouseDate: string
  openHouseStartTime: string | null
  openHouseEndTime: string | null
  openHouseStatus: string | null
  openHouseType: string | null
  remarks: string | null
}

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

const numberOrNull = (v: unknown): number | null =>
  Number.isFinite(Number(v)) ? Number(v) : null

function buildAddress(p: PropertyRow): string {
  const street = [p.StreetNumber, p.StreetDirPrefix, p.StreetName, p.StreetSuffix]
    .filter((v) => v != null && v !== '').join(' ')
  if (p.InternetAddressDisplayYN === false) {
    return [p.City, p.StateOrProvince, p.PostalCode].filter(Boolean).join(', ')
  }
  return `${street}, ${p.City ?? ''}, ${p.StateOrProvince ?? ''} ${p.PostalCode ?? ''}`.replace(/^,\s*/, '')
}

function normalizeProperty(p: PropertyRow, photoUrl: string | null): Omit<OpenHouseListing, 'openHouses'> {
  return {
    listingKey:    String(p.ListingKey ?? ''),
    listingId:    String(p.ListingId ?? p.ListingKey ?? ''),
    address:      buildAddress(p),
    listPrice:    numberOrNull(p.ListPrice) ?? 0,
    status:       String(p.StandardStatus ?? ''),
    bedrooms:     numberOrNull(p.BedroomsTotal),
    bathrooms:    numberOrNull(p.BathroomsTotalInteger),
    livingArea:   numberOrNull(p.BuildingAreaTotal) ?? numberOrNull(p.LivingArea),
    yearBuilt:    numberOrNull(p.YearBuilt),
    city:         p.City as string | null,
    state:        p.StateOrProvince as string | null,
    zip:          p.PostalCode as string | null,
    daysOnMarket: numberOrNull(p.DaysOnMarket),
    listAgent:    p.ListAgentFullName as string | null,
    listOffice:   p.ListOfficeName    as string | null,
    showAddress:  p.InternetAddressDisplayYN as boolean | null,
    photoUrl,
  }
}

function parseOHEntry(o: OpenHouseRow): OpenHouseEntry {
  return {
    openHouseId:       String(o.OpenHouseId ?? o.OpenHouseKey ?? ''),
    openHouseDate:     String(o.OpenHouseDate ?? ''),
    openHouseStartTime: o.OpenHouseStartTime as string | null,
    openHouseEndTime:  o.OpenHouseEndTime  as string | null,
    openHouseStatus:  o.OpenHouseStatus  as string | null,
    openHouseType:    o.OpenHouseType    as string | null,
    remarks:          o.OpenHouseRemarks as string | null,
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const token = await getAccessToken()
    const searchParams = request.nextUrl.searchParams
    const city = (searchParams.get('city') ?? 'Moreno Valley').trim()
    const today = new Date().toISOString().split('T')[0]

    // ── Step 1: Fetch ALL active OH rows (paginate through all pages) ──────────
    const ohSelect = [
      'OpenHouseId', 'OpenHouseKey',
      'OpenHouseDate', 'OpenHouseStartTime', 'OpenHouseEndTime',
      'OpenHouseStatus', 'OpenHouseType', 'OpenHouseRemarks',
      'ListingKey', 'ListingId',
    ].join(',')

    const baseOhUrl = `${process.env.TRESTLE_BASE_URL ?? 'https://api.cotality.com/trestle/odata'}/OpenHouse`
    const ohFilter = [
      `OpenHouseDate ge ${today}`,
      "OpenHouseStatus eq 'Active'",
    ].join(' and ')

    const ohRows: OpenHouseRow[] = []
    let ohSkip = 0
    const ohPageSize = 500
    let totalOH = 0

    while (true) {
      const params = new URLSearchParams({
        $filter: ohFilter,
        $select: ohSelect,
        $top: String(ohPageSize),
        $skip: String(ohSkip),
        $count: 'true',
      })
      const url = `${baseOhUrl}?${params}`
      console.log(`[trestle/open-houses] fetching OH page skip=${ohSkip}...`)
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = await res.text()
        console.error(`[trestle/open-houses] OH page failed skip=${ohSkip}:`, res.status, body.slice(0, 200))
        return NextResponse.json({ listings: [], error: `Trestle ${res.status}` }, { status: 502 })
      }
      const data = (await res.json()) as { '@odata.count'?: number; value?: OpenHouseRow[] }
      const rows = data.value ?? []
      ohRows.push(...rows)
      totalOH = data['@odata.count'] ?? 0
      if (rows.length < ohPageSize) break
      ohSkip += ohPageSize
      // Safety cap: don't fetch more than 10,000 OH records
      if (ohSkip >= 10000) break
    }

    console.log(`[trestle/open-houses] fetched ${ohRows.length}/${totalOH} OH rows`)

    if (ohRows.length === 0) {
      return NextResponse.json({ listings: [], total: 0 })
    }

    // ── Step 2: Extract unique listing keys ────────────────────────────────────
    const listingKeys = [...new Set(ohRows.map((r) => String(r.ListingKey ?? '')).filter(Boolean))]
    console.log(`[trestle/open-houses] ${listingKeys.length} unique listing keys`)

    // ── Step 3: Batch-fetch all Property records ───────────────────────────────
    const propSelect = [
      'ListingKey', 'ListingId',
      'StreetNumber', 'StreetDirPrefix', 'StreetName', 'StreetSuffix',
      'City', 'StateOrProvince', 'PostalCode',
      'ListPrice', 'StandardStatus',
      'BedroomsTotal', 'BathroomsTotalInteger',
      'BuildingAreaTotal', 'LivingArea', 'YearBuilt',
      'DaysOnMarket', 'InternetAddressDisplayYN',
      'ListAgentFullName', 'ListOfficeName', 'PhotosCount',
    ].join(',')

    const propMap = new Map<string, PropertyRow>()

    for (let i = 0; i < listingKeys.length; i += 50) {
      const batch = listingKeys.slice(i, i + 50)
      const propFilter = batch
        .map((k) => `ListingKey eq '${k.replace(/'/g, "''")}'`)
        .join(' or ')
      const params = new URLSearchParams({ $filter: propFilter, $select: propSelect, $top: String(batch.length) })
      const res = await fetch(`${getPropertyEndpoint()}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { value?: PropertyRow[] }
        for (const p of data.value ?? []) {
          const key = String(p.ListingKey ?? '')
          if (key && !propMap.has(key)) propMap.set(key, p)
        }
      }
    }

    console.log(`[trestle/open-houses] fetched ${propMap.size} properties`)

    // ── Step 4: Fetch photos ─────────────────────────────────────────────────
    const photoMap = new Map<string, string>()
    for (let i = 0; i < listingKeys.length; i += 50) {
      const batch = listingKeys.slice(i, i + 50)
      const photoFilter = batch
        .map((k) => `ResourceRecordKey eq '${k.replace(/'/g, "''")}'`)
        .join(' or ')
      const params = new URLSearchParams({ $filter: photoFilter, $select: 'MediaURL,ResourceRecordKey', $top: String(batch.length * 5) })
      const res = await fetch(`${getMediaEndpoint()}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) break
      const data = (await res.json()) as { value?: MediaRow[] }
      for (const row of data.value ?? []) {
        if (row.ResourceRecordKey && row.MediaURL && !photoMap.has(row.ResourceRecordKey)) {
          photoMap.set(row.ResourceRecordKey, row.MediaURL)
        }
      }
    }

    // ── Step 5: Group OH rows → listings, filter by city ─────────────────────
    const cityLC = city.toLowerCase()
    const listingMap = new Map<string, { base: Omit<OpenHouseListing, 'openHouses'>; ohs: OpenHouseEntry[] }>()

    for (const row of ohRows) {
      const key = String(row.ListingKey ?? '')
      if (!key) continue
      const prop = propMap.get(key)
      if (!prop) continue

      const propCity = (prop.City as string | null) ?? ''
      const propState = (prop.StateOrProvince as string | null) ?? ''

      // Strict CA + city match
      if (propState !== 'CA') continue
      if (!propCity.toLowerCase().includes(cityLC)) continue

      if (!listingMap.has(key)) {
        listingMap.set(key, { base: normalizeProperty(prop, photoMap.get(key) ?? null), ohs: [] })
      }
      listingMap.get(key)!.ohs.push(parseOHEntry(row))
    }

    console.log(`[trestle/open-houses] after city filter: ${listingMap.size} listings`)

    // ── Step 6: Build sorted final list ──────────────────────────────────────
    const listings: OpenHouseListing[] = Array.from(listingMap.values())
      .map(({ base, ohs }) => ({ ...base, openHouses: ohs }))
      .map((l) => ({
        ...l,
        openHouses: l.openHouses.sort((a, b) => a.openHouseDate.localeCompare(b.openHouseDate)),
      }))
      .sort((a, b) => a.openHouses[0].openHouseDate.localeCompare(b.openHouses[0].openHouseDate))

    return NextResponse.json(
      { listings, total: listings.length },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[trestle/open-houses]', message)
    return NextResponse.json({ listings: [], error: message }, { status: 500 })
  }
}
