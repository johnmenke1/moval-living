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

// Fetch photos for a batch of listing keys
async function fetchPhotos(token: string, keys: string[]): Promise<Map<string, string>> {
  const photos = new Map<string, string>()
  if (!keys.length) return photos

  // Trestle limits $filter clauses; batch in groups of 50
  const batchSize = 50
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize)
    const filter = batch
      .map((k) => `ResourceRecordKey eq '${k.replace(/'/g, "''")}'`)
      .join(' or ')
    const params = new URLSearchParams({
      $filter: filter,
      $select: 'MediaURL,ResourceRecordKey',
      $top: String(batch.length * 5),
    })
    const res = await fetch(`${getMediaEndpoint()}?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) break
    const data = (await res.json()) as { value?: MediaRow[] }
    for (const row of data.value ?? []) {
      if (row.ResourceRecordKey && row.MediaURL && !photos.has(row.ResourceRecordKey)) {
        photos.set(row.ResourceRecordKey, row.MediaURL)
      }
    }
  }
  return photos
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const token = await getAccessToken()
    const searchParams = request.nextUrl.searchParams
    const city = searchParams.get('city') ?? 'Moreno Valley'
    const today = new Date().toISOString().split('T')[0]

    const ohFilterBase = [
      `OpenHouseDate ge ${today}`,
      "OpenHouseStatus eq 'Active'",
    ].join(' and ')

    const ohFilterWithCity = [
      `OpenHouseDate ge ${today}`,
      "OpenHouseStatus eq 'Active'",
      `PropertyCity eq 'Moreno Valley'`,
    ].join(' and ')

    async function fetchOH(filter: string) {
      const ohParams = new URLSearchParams({
        $filter: filter,
        $select: [
          'OpenHouseId', 'OpenHouseKey',
          'OpenHouseDate', 'OpenHouseStartTime', 'OpenHouseEndTime',
          'OpenHouseStatus', 'OpenHouseType', 'OpenHouseRemarks',
          'ListingKey', 'ListingId',
        ].join(','),
        $top: '500',
        $count: 'true',
      })
      const url = `${process.env.TRESTLE_BASE_URL ?? 'https://api.cotality.com/trestle/odata'}/OpenHouse?${ohParams}`
      console.log('[trestle/open-houses] OH query URL:', url)
      return fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
    }

    let ohRes = await fetchOH(ohFilterWithCity)
    let usedCityFilter = true

    if (!ohRes.ok) {
      console.warn(`[trestle/open-houses] city filter ${ohRes.status}, falling back`)
      ohRes = await fetchOH(ohFilterBase)
      usedCityFilter = false
    }

    const ohStatus = ohRes.status
    const ohBody = await ohRes.text()
    console.log(`[trestle/open-houses] OH response status=${ohStatus} body=${ohBody.slice(0, 300)}`)

    if (!ohRes.ok) {
      console.error('[trestle/open-houses] OpenHouse query failed:', ohStatus, ohBody)
      return NextResponse.json({ listings: [], error: `Trestle ${ohStatus}`, details: ohBody.slice(0, 500) }, { status: 502 })
    }

    const ohData = (await JSON.parse(ohBody)) as {
      '@odata.count'?: number
      value?: OpenHouseRow[]
    }
    const ohRows = ohData.value ?? []
    console.log(`[trestle/open-houses] ${ohRows.length} OH rows (total: ${ohData['@odata.count']})`)

    if (ohRows.length === 0) {
      return NextResponse.json({ listings: [], total: 0 })
    }

    // ── Step 2: Extract unique listing keys ───────────────────────────────────
    const listingKeys = [...new Set(ohRows.map((r) => String(r.ListingKey ?? '')).filter(Boolean))]
    console.log(`[trestle/open-houses] ${listingKeys.length} unique listings`)

    // ── Step 3: Batch-fetch Property records ──────────────────────────────────
    // Trestle Property endpoint; batch by 50 keys per request
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
      const propParams = new URLSearchParams({
        $filter: propFilter,
        $select: propSelect,
        $top: String(batch.length),
      })
      const propRes = await fetch(`${getPropertyEndpoint()}?${propParams}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (propRes.ok) {
        const propData = (await propRes.json()) as { value?: PropertyRow[] }
        for (const p of propData.value ?? []) {
          const key = String(p.ListingKey ?? '')
          if (key && !propMap.has(key)) propMap.set(key, p)
        }
      }
    }

    console.log(`[trestle/open-houses] fetched ${propMap.size} property records`)
    console.log(`[trestle/open-houses] sample keys from propMap:`, [...propMap.keys()].slice(0, 3))
    console.log(`[trestle/open-houses] sample keys from ohRows:`, ohRows.slice(0, 3).map(r => r.ListingKey))

    // ── Step 4: Fetch photos ─────────────────────────────────────────────────
    const photos = await fetchPhotos(token, listingKeys)

    // ── Step 5: Group OH rows by listingKey ───────────────────────────────────
    const listingMap = new Map<string, { base: Omit<OpenHouseListing, 'openHouses'>; ohs: OpenHouseEntry[] }>()

    for (const row of ohRows) {
      const key = String(row.ListingKey ?? '')
      if (!key) continue

      const prop = propMap.get(key)
      if (!prop) continue

      // City filter in JS
      const propCity = prop.City as string | null
      const propState = prop.StateOrProvince as string | null
      const cityLC = city.toLowerCase()
      const propCityLC = propCity?.toLowerCase() ?? ''
      // Match if propCity contains the target city, OR the target city contains propCity, OR propCity is empty/null (accept anything)
      const cityMatch = !propCity || propCityLC.includes(cityLC) || cityLC.includes(propCityLC)
      // Only accept CA or null/unknown
      const stateMatch = !propState || propState === 'CA'

      console.log(`[trestle] key=${key} propCity=${JSON.stringify(propCity)} propState=${JSON.stringify(propState)} cityMatch=${cityMatch} stateMatch=${stateMatch}`)

      if (!cityMatch || !stateMatch) continue

      if (!listingMap.has(key)) {
        listingMap.set(key, { base: normalizeProperty(prop, photos.get(key) ?? null), ohs: [] })
      }
      listingMap.get(key)!.ohs.push(parseOHEntry(row))

    console.log(`[trestle/open-houses] after city filter: listingMap size = ${listingMap.size}`)
    }

    // ── Step 6: Build final list ─────────────────────────────────────────────
    const listings: OpenHouseListing[] = Array.from(listingMap.values())
      .map(({ base, ohs }) => ({ ...base, openHouses: ohs }))
      .map((l) => ({
        ...l,
        openHouses: l.openHouses.sort((a, b) => a.openHouseDate.localeCompare(b.openHouseDate)),
      }))
      .sort((a, b) => a.openHouses[0].openHouseDate.localeCompare(b.openHouses[0].openHouseDate))

    console.log(`[trestle/open-houses] → ${listings.length} listings with OH data`)
    console.log(`[trestle/open-houses] first listing:`, JSON.stringify(listings[0])?.slice(0, 300))

    return NextResponse.json(
      { listings, total: listings.length, _debug: { ohRowsTotal: ohRows.length, listingKeysTotal: listingKeys.length, propMapSize: propMap.size } },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[trestle/open-houses]', message)
    return NextResponse.json({ listings: [], error: message }, { status: 500 })
  }
}
