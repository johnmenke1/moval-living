import { NextResponse } from 'next/server'
import { getAccessToken, getPropertyEndpoint } from '@/lib/trestle-auth'

/**
 * Market statistics for Moreno Valley — derived from Trestle / CRMLS data.
 * Mirrors the proven working pattern from menke-real-estate.
 */

export const revalidate = 0

export async function GET() {
  let token: string
  try {
    token = await getAccessToken()
  } catch (err) {
    console.error('[Trestle stats] Auth error:', err)
    return NextResponse.json(
      { error: 'Trestle credentials not configured', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  const select = [
    'ListPrice',
    'ClosePrice',
    'LivingArea',
    'StandardStatus',
    'DaysOnMarket',
    'CloseDate',
    'PropertyType',
    'BedroomsTotal',
    'BathroomsTotalInteger',
  ].join(',')

  const propertyUrl = getPropertyEndpoint()

  async function fetchListings(status: string) {
    const filter = `contains(City, 'Moreno Valley') and StateOrProvince eq 'CA' and StandardStatus eq '${status}' and PropertyType eq 'Residential'`
    const url = `${propertyUrl}?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=500&$count=true`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const d = await res.json()
    return d.value ?? []
  }

  const [active, closed] = await Promise.all([
    fetchListings('Active'),
    fetchListings('Closed'),
  ])

  if (!active || !closed) {
    return NextResponse.json({ error: 'Failed to fetch from Trestle' }, { status: 502 })
  }

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentClosed = (closed as any[]).filter((r: any) => {
    if (!r.CloseDate) return false
    return new Date(r.CloseDate) >= twelveMonthsAgo
  })

  const median = (arr: number[]): number => {
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  const activePrices = active.map((r: any) => r.ListPrice).filter(Number.isFinite)
  const closedPrices = recentClosed.map((r: any) => r.ClosePrice).filter(Number.isFinite)
  const activeDOM = active.map((r: any) => r.DaysOnMarket).filter(Number.isFinite)
  const closedDOM = recentClosed.map((r: any) => r.DaysOnMarket).filter(Number.isFinite)
  const livingArea = recentClosed.map((r: any) => r.LivingArea).filter(Number.isFinite)

  const avgPricePerSqft =
    livingArea.length > 0 && closedPrices.length > 0
      ? closedPrices.reduce((s: number, p: number, i: number) => s + p / (livingArea[i] || 1), 0) / closedPrices.length
      : 0

  const monthsSupply = recentClosed.length > 0 ? (active.length / (recentClosed.length / 12)) : 0

  const stats = {
    generatedAt: new Date().toISOString(),
    active: {
      count: active.length,
      medianListPrice: median(activePrices),
      avgListPrice: activePrices.length ? activePrices.reduce((s: number, v: number) => s + v, 0) / activePrices.length : 0,
    },
    sold: {
      count: recentClosed.length,
      totalVolume: closedPrices.reduce((s: number, v: number) => s + v, 0),
      medianClosePrice: median(closedPrices),
      avgClosePrice: closedPrices.length ? closedPrices.reduce((s: number, v: number) => s + v, 0) / closedPrices.length : 0,
    },
    daysOnMarket: {
      avgActive: activeDOM.length ? activeDOM.reduce((s: number, v: number) => s + v, 0) / activeDOM.length : 0,
      avgClosed: closedDOM.length ? closedDOM.reduce((s: number, v: number) => s + v, 0) / closedDOM.length : 0,
    },
    pricePerSqFt: Math.round(avgPricePerSqft),
    inventoryMonths: Math.round(monthsSupply * 10) / 10,
  }

  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
