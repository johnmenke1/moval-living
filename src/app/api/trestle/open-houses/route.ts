import { NextResponse } from 'next/server'
import { getAccessToken, getOpenHouseEndpoint } from '@/lib/trestle-auth'

export const revalidate = 0

// ── Types ─────────────────────────────────────────────────────────────────────

type RawOpenHouse = Record<string, unknown>
type RawProperty  = Record<string, unknown>

export type OpenHouseEntry = {
  openHouseId: string
  openHouseDate: string    // date string YYYY-MM-DD
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

function buildAddress(p: RawProperty): string {
  const street = [p.StreetNumber, p.StreetDirPrefix, p.StreetName, p.StreetSuffix]
    .filter((v) => v != null && v !== '').join(' ')
  if (p.InternetAddressDisplayYN === false) {
    return [p.City, p.StateOrProvince, p.PostalCode].filter(Boolean).join(', ')
  }
  return `${street}, ${p.City ?? ''}, ${p.StateOrProvince ?? ''} ${p.PostalCode ?? ''}`.replace(/^,\s*/, '')
}

function numberOrNull(v: unknown): number | null {
  return Number.isFinite(Number(v)) ? Number(v) : null
}

function parseOHEntry(o: RawOpenHouse): OpenHouseEntry {
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

function normalizeProperty(p: RawProperty, photoUrl: string | null): Omit<OpenHouseListing, 'openHouses'> {
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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const token = await getAccessToken()

    // Query the OpenHouse entity set directly — not a navigation property on Property.
    // Filter: future OpenHouseDate in Moreno Valley, status = Active (not Cancelled/Ended).
    // The OpenHouse entity links to Property via ListingKey/ListingId.
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    const filter = [
      `OpenHouseDate ge ${today}`,
      "OpenHouseStatus eq 'Active'",
      "Property/StateOrProvince eq 'CA'",
      "Property/City eq 'Moreno Valley'",
    ].join(' and ')

    // Note: semicolons in $expand options are OData standard; URLSearchParams will
    // encode them, so we append them manually after building the base query string.
    const selectFields = [
      'OpenHouseId', 'OpenHouseKey',
      'OpenHouseDate', 'OpenHouseStartTime', 'OpenHouseEndTime',
      'OpenHouseStatus', 'OpenHouseType', 'OpenHouseRemarks',
      'ListingKey', 'ListingId',
    ].join(',')

    const base = getOpenHouseEndpoint()
    const params = new URLSearchParams({ $filter: filter, $select: selectFields, $top: '200', $count: 'true' })
    const url = `${base}?${params.toString()}&%24expand=Property%28%24select%3DListingKey%2CListingId%2CStreetNumber%2CStreetDirPrefix%2CStreetName%2CStreetSuffix%2CCity%2CStateOrProvince%2CPostalCode%2CListPrice%2CBedroomsTotal%2CBathroomsTotalInteger%2CBuildingAreaTotal%2CLivingArea%2CYearBuilt%2CDaysOnMarket%2CInternetAddressDisplayYN%2CListAgentFullName%2CListOfficeName%2CPhotosCount%29`

    console.log('[trestle/open-houses] URL:', url)
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[trestle/open-houses] API error', res.status, body)
      return NextResponse.json(
        { listings: [], error: `Trestle API error ${res.status}`, details: body.slice(0, 500) },
        { status: 502 }
      )
    }

    const data = (await res.json()) as {
      '@odata.count'?: number
      value?: RawOpenHouse[]
    }

    console.log('[trestle/open-houses] raw response keys:', Object.keys(data))
    console.log('[trestle/open-houses] first row:', JSON.stringify(data.value?.[0])?.slice(0, 800))

    const rows = data.value ?? []

    if (rows.length === 0) {
      return NextResponse.json({ listings: [], total: data['@odata.count'] ?? 0 })
    }

    // Group open houses by listing — one listing may have multiple OH entries
    const listingMap = new Map<string, { base: Omit<OpenHouseListing, 'openHouses'>, ohs: OpenHouseEntry[] }>()

    for (const row of rows) {
      const prop = row.Property as RawProperty | undefined
      if (!prop) continue

      const base = normalizeProperty(prop, null)
      const key  = base.listingKey

      if (!listingMap.has(key)) {
        listingMap.set(key, { base, ohs: [] })
      }
      listingMap.get(key)!.ohs.push(parseOHEntry(row))
    }

    // Sort open houses within each listing by date
    for (const entry of listingMap.values()) {
      entry.ohs.sort((a, b) => a.openHouseDate.localeCompare(b.openHouseDate))
    }

    // Sort listings by soonest open house date
    const listings: OpenHouseListing[] = Array.from(listingMap.values())
      .map(({ base, ohs }) => ({ ...base, openHouses: ohs }))
      .sort((a, b) => a.openHouses[0].openHouseDate.localeCompare(b.openHouses[0].openHouseDate))

    const total = data['@odata.count'] ?? listings.length

    return NextResponse.json(
      { listings, total, _debug: { rowsReturned: rows.length } },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[trestle/open-houses]', message)
    return NextResponse.json(
      { listings: [], error: message, _debug: { caughtAt: 'catch block' } },
      { status: 500 }
    )
  }
}
