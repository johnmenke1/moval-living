import { NextResponse } from 'next/server'
import { getAccessToken, getPropertyEndpoint } from '@/lib/trestle-auth'

/**
 * Market statistics for Moreno Valley — derived from Trestle / CRMLS data.
 *
 * Pulls active listings + recently closed sales (last 12 months) and computes:
 * - Active listings count, median list price, avg list price
 * - Sold count, median close price, avg close price
 * - Average days on market, average price per sqft
 * - Inventory months supply
 *
 * Auth: OAuth2 client credentials (TRESTLE_CLIENT_ID / TRESTLE_CLIENT_SECRET env vars).
 * Cached: ISR 1 hour (revalidate: 3600).
 */

export const revalidate = 3600

export async function GET() {
  let token: string
  try {
    token = await getAccessToken()
  } catch (err) {
    console.error('[Trestle stats] Auth error:', err)
    return NextResponse.json({ error: 'Trestle credentials not configured' }, { status: 500 })
  }

  const select = [
    'ListPrice',
    'ClosePrice',
    'LivingArea',
    'StandardStatus',
    'DaysOnMarket',
    'CloseDate',
    'ListingContractDate',
    'PropertyType',
    'BedroomsTotal',
    'BathroomsFull',
  ].join(',')

  async function fetchStatus(status: string) {
    const filter = `City eq 'Moreno Valley' and StandardStatus eq '${status}' and PropertyType eq 'Residential'`
    const propertyUrl = getPropertyEndpoint()
    const url = `${propertyUrl}?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=500&$count=true`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const d = await res.json()
    return d.value ?? []
  }

  const [active, closed] = await Promise.all([
    fetchStatus('Active'),
    fetchStatus('Closed'),
  ])

  if (!active || !closed) {
    return NextResponse.json({ error: 'Failed to fetch from Trestle' }, { status: 502 })
  }

  // Filter to closed in last 12 months
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const recentClosed = (closed as Record<string, unknown>[]).filter(r => {
    if (!r.CloseDate) return false
    return new Date(r.CloseDate as string) >= twelveMonthsAgo
  })

  const median = (arr: number[]): number => {
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
  }

  const activePrices = (active as Record<string, unknown>[]).map(r => r.ListPrice as number).filter(Boolean)
  const closedPrices = (recentClosed as Record<string, unknown>[]).map(r => r.ClosePrice as number).filter(Boolean)
  const activeDOM = (active as Record<string, unknown>[]).map(r => r.DaysOnMarket as number).filter(Boolean)
  const closedDOM = (recentClosed as Record<string, unknown>[]).map(r => r.DaysOnMarket as number).filter(Boolean)
  const livingArea = (recentClosed as Record<string, unknown>[]).map(r => r.LivingArea as number).filter(Boolean)

  const avgPricePerSqft =
    livingArea.length > 0
      ? closedPrices.reduce((s, p, i) => s + p / (livingArea[i] || 1), 0) / closedPrices.length
      : 0

  const monthsSupply =
    recentClosed.length > 0 ? (active.length / (recentClosed.length / 12)) : 0

  const stats = {
    generatedAt: new Date().toISOString(),
    active: {
      count: active.length,
      medianListPrice: median(activePrices),
      avgListPrice: activePrices.length ? activePrices.reduce((s, v) => s + v, 0) / activePrices.length : 0,
    },
    sold: {
      count: recentClosed.length,
      totalVolume: closedPrices.reduce((s, v) => s + v, 0),
      medianClosePrice: median(closedPrices),
      avgClosePrice: closedPrices.length ? closedPrices.reduce((s, v) => s + v, 0) / closedPrices.length : 0,
    },
    daysOnMarket: {
      avgActive: activeDOM.length ? activeDOM.reduce((s, v) => s + v, 0) / activeDOM.length : 0,
      avgClosed: closedDOM.length ? closedDOM.reduce((s, v) => s + v, 0) / closedDOM.length : 0,
    },
    pricePerSqFt: Math.round(avgPricePerSqft),
    inventoryMonths: Math.round(monthsSupply * 10) / 10,
  }

  return NextResponse.json(stats)
}
