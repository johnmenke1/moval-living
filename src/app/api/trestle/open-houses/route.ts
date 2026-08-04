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

    // ── Step 1: Get all Property ListingKeys for the target city ──────────────
    // Try exact City match first; if that returns 0, try contains()
    const propSelect = ['ListingKey', 'ListingId', 'City', 'StandardStatus'].join(',')

    const fetchPropertyKeys = async (cityFilter: string): Promise<string[]> => {
      const keys: string[] = []
      let skip = 0
      const pageSize = 1000

      while (true) {
        const params = new URLSearchParams({
          $filter: cityFilter,
          $select: propSelect,
          $top: String(pageSize),
          $skip: String(skip),
          $count: 'true',
        })
        const res = await fetch(`${getPropertyEndpoint()}?${params}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        })
        const body = await res.text()
        if (!res.ok) {
          console.error('[trestle/open-houses] Property query failed:', res.status, body.slice(0, 300))
          return []
        }
        const data = (await JSON.parse(body)) as { '@odata.count'?: number; value?: PropertyRow[] }
        const rows = data.value ?? []
        for (const p of rows) {
          const key = String(p.ListingKey ?? '')
          if (key) keys.push(key)
        }
        console.log(`[trestle/open-houses] Property page skip=${skip} rows=${rows.length} total=${data['@odata.count']} firstCity=${rows[0]?.City}`)
        if (rows.length < pageSize) break
        skip += pageSize
        if (skip >= 50000) break
      }
      return keys
    }

    // Try exact match first
    let propKeys = await fetchPropertyKeys(`City eq '${city}' and StandardStatus eq 'Active'`)
    console.log(`[trestle/open-houses] exact City='${city}' → ${propKeys.length} keys`)

    // If 0 results, the city field value might be formatted differently — try contains()
    if (propKeys.length === 0) {
      console.log(`[trestle/open-houses] 0 keys for exact match, trying contains...`)
      propKeys = await fetchPropertyKeys(`contains(City,'${city}') and StandardStatus eq 'Active'`)
      console.log(`[trestle/open-houses] contains(City,'${city}') → ${propKeys.length} keys`)
    }

    if (propKeys.length === 0) {
      return NextResponse.json({ listings: [], total: 0 })
    }

    // ── Step 2: Fetch OpenHouse records for those ListingKeys ─────────────────
    const ohSelect = [
      'OpenHouseId', 'OpenHouseKey',
      'OpenHouseDate', 'OpenHouseStartTime', 'OpenHouseEndTime',
      'OpenHouseStatus', 'OpenHouseType', 'OpenHouseRemarks',
      'ListingKey', 'ListingId',
    ].join(',')

    const todayISO = `datetime'${today}'`
    const ohRows: OpenHouseRow[] = []
    const batchSize = 50

    for (let i = 0; i < propKeys.length; i += batchSize) {
      const batch = propKeys.slice(i, i + batchSize)
      const listingKeyFilter = batch
        .map((k) => `ListingKey eq '${k.replace(/'/g, "''")}'`)
        .join(' or ')

      const ohFilter = [
        `OpenHouseDate ge ${todayISO}`,
        "OpenHouseStatus eq 'Active'",
        `(${listingKeyFilter})`,
      ].join(' and ')

      const params = new URLSearchParams({
        $filter: ohFilter,
        $select: ohSelect,
        $top: String(batch.length * 3),
      })

      const res = await fetch(
        `${process.env.TRESTLE_BASE_URL ?? 'https://api.cotality.com/trestle/odata'}/OpenHouse?${params}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        }
      )

      if (res.ok) {
        const data = (await res.json()) as { value?: OpenHouseRow[] }
        ohRows.push(...(data.value ?? []))
      }
    }

    console.log(`[trestle/open-houses] ${ohRows.length} OH records for ${city}`)

    if (ohRows.length === 0) {
      return NextResponse.json({ listings: [], total: 0 })
    }

    // ── Step 3: Batch-fetch full Property records ──────────────────────────────
    const uniqueKeys = [...new Set(ohRows.map((r) => String(r.ListingKey ?? '')).filter(Boolean))]

    const fullPropSelect = [
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

    for (let i = 0; i < uniqueKeys.length; i += 50) {
      const batch = uniqueKeys.slice(i, i + 50)
      const propFilter = batch
        .map((k) => `ListingKey eq '${k.replace(/'/g, "''")}'`)
        .join(' or ')
      const params = new URLSearchParams({ $filter: propFilter, $select: fullPropSelect, $top: String(batch.length) })
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

    // ── Step 4: Fetch photos ─────────────────────────────────────────────────
    const photoMap = new Map<string, string>()
    for (let i = 0; i < uniqueKeys.length; i += 50) {
      const batch = uniqueKeys.slice(i, i + 50)
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

    // ── Step 5: Group OH rows → listings ─────────────────────────────────────
    const listingMap = new Map<string, { base: Omit<OpenHouseListing, 'openHouses'>; ohs: OpenHouseEntry[] }>()

    for (const row of ohRows) {
      const key = String(row.ListingKey ?? '')
      if (!key) continue
      const prop = propMap.get(key)
      if (!prop) continue

      if (!listingMap.has(key)) {
        listingMap.set(key, { base: normalizeProperty(prop, photoMap.get(key) ?? null), ohs: [] })
      }
      listingMap.get(key)!.ohs.push(parseOHEntry(row))
    }

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
