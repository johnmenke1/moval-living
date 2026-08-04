import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, getPropertyEndpoint, getMediaEndpoint } from '@/lib/trestle-auth'

export const revalidate = 0

type RawListing = Record<string, unknown>
type MediaRow = { ResourceRecordKey?: string; MediaURL?: string }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const token = await getAccessToken()

    // ── Step 1: Fetch full Property record ────────────────────────────────────
    const propSelect = [
      'ListingKey', 'ListingId',
      'StreetNumber', 'StreetDirPrefix', 'StreetName', 'StreetSuffix', 'UnitNumber',
      'City', 'StateOrProvince', 'PostalCode',
      'ListPrice', 'ClosePrice', 'StandardStatus', 'PropertyType', 'PropertySubType',
      'BedroomsTotal', 'BathroomsTotalInteger',
      'BuildingAreaTotal', 'LivingArea', 'LotSizeAcres',
      'GarageSpaces', 'YearBuilt', 'PoolPrivateYN',
      'DaysOnMarket', 'InternetAddressDisplayYN',
      'ListingContractDate',
      'ListAgentFullName', 'ListOfficeName',
      'ListAgentStateLicense', 'CoListAgentFullName', 'CoListOfficeName',
      'ShowingInstructions', 'PublicRemarks',
      'Latitude', 'Longitude',
      'TaxLot', 'TaxMap', 'Zoning',
      'Ownership', 'SyndicateTo', 'PhotosCount',
    ].join(',')

    const params_ = new URLSearchParams({
      $filter: `ListingKey eq '${key.replace(/'/g, "''")}'`,
      $select: propSelect,
    })

    const propRes = await fetch(`${getPropertyEndpoint()}?${params_}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })

    console.log(`[trestle/listing] key=${key} status=${propRes.status} content-type=${propRes.headers.get('content-type')}`)
    const bodyText = await propRes.text()
    console.log(`[trestle/listing] body preview: ${bodyText.slice(0, 300)}`)

    if (!propRes.ok) {
      return NextResponse.json({ error: 'Listing not found', detail: bodyText.slice(0, 200) }, { status: 404 })
    }

    const propData = JSON.parse(bodyText) as { value?: RawListing[] }
    const row = propData.value?.[0]

    if (!row) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // ── Step 2: Fetch all photos ───────────────────────────────────────────────
    const photoParams = new URLSearchParams({
      $filter: `ResourceRecordKey eq '${key.replace(/'/g, "''")}'`,
      $select: 'MediaURL,ResourceRecordKey',
      $orderby: 'Order',
      $top: '50',
    })

    const photoRes = await fetch(`${getMediaEndpoint()}?${photoParams}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })

    const photoUrls: string[] = []
    if (photoRes.ok) {
      const photoData = (await photoRes.json()) as { value?: MediaRow[] }
      for (const m of photoData.value ?? []) {
        if (m.MediaURL) photoUrls.push(m.MediaURL)
      }
    }

    // ── Step 3: Build normalized response ─────────────────────────────────────
    const numberOrNull = (v: unknown): number | null =>
      Number.isFinite(Number(v)) ? Number(v) : null

    const street = [row.StreetNumber, row.StreetDirPrefix, row.StreetName, row.StreetSuffix, row.UnitNumber]
      .filter((v) => v != null && v !== '').join(' ')
    const address =
      row.InternetAddressDisplayYN === false
        ? [row.City, row.StateOrProvince, row.PostalCode].filter(Boolean).join(', ')
        : `${street}, ${row.City ?? ''}, ${row.StateOrProvince ?? ''} ${row.PostalCode ?? ''}`.replace(/^,\s*/, '')

    const listing = {
      listingKey: String(row.ListingKey ?? ''),
      listingId: String(row.ListingId ?? row.ListingKey ?? ''),
      address,
      listPrice: numberOrNull(row.ListPrice) ?? 0,
      closePrice: numberOrNull(row.ClosePrice),
      status: String(row.StandardStatus ?? ''),
      propertyType: String(row.PropertyType ?? ''),
      propertySubType: String(row.PropertySubType ?? ''),
      bedrooms: numberOrNull(row.BedroomsTotal),
      bathrooms: numberOrNull(row.BathroomsTotalInteger),
      livingArea: numberOrNull(row.BuildingAreaTotal) ?? numberOrNull(row.LivingArea),
      lotSizeAcres: numberOrNull(row.LotSizeAcres),
      garageSpaces: numberOrNull(row.GarageSpaces),
      yearBuilt: numberOrNull(row.YearBuilt),
      pool: row.PoolPrivateYN === true,
      city: row.City as string | null,
      state: row.StateOrProvince as string | null,
      zip: row.PostalCode as string | null,
      daysOnMarket: numberOrNull(row.DaysOnMarket),
      listingContractDate: row.ListingContractDate as string | null,
      listAgent: row.ListAgentFullName as string | null,
      listOffice: row.ListOfficeName as string | null,
      listAgentLicense: row.ListAgentStateLicense as string | null,
      coListAgent: row.CoListAgentFullName as string | null,
      coListOffice: row.CoListOfficeName as string | null,
      showingInstructions: row.ShowingInstructions as string | null,
      publicRemarks: row.PublicRemarks as string | null,
      latitude: numberOrNull(row.Latitude),
      longitude: numberOrNull(row.Longitude),
      taxLot: row.TaxLot as string | null,
      taxMap: row.TaxMap as string | null,
      zoning: row.Zoning as string | null,
      ownership: row.Ownership as string | null,
      internetDisplay: row.InternetAddressDisplayYN as boolean | null,
      photoCount: numberOrNull(row.PhotosCount),
      photoUrls,
    }

    return NextResponse.json(
      { listing },
      { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[trestle/listing/key]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
