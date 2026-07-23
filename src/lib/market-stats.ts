import { getAccessToken, getPropertyEndpoint } from '@/lib/trestle-auth'

const MORENO_VALLEY_FILTER =
  "contains(City, 'Moreno Valley') and StateOrProvince eq 'CA' and PropertyType eq 'Residential'"

const ACTIVE_STATS_SELECT = [
  'ListPrice', 'ClosePrice', 'LivingArea', 'BuildingAreaTotal', 'StandardStatus',
  'DaysOnMarket', 'CloseDate', 'BedroomsTotal', 'BathroomsTotalInteger',
].join(',')

const PAGE_SIZE = 500

type RawListing = Record<string, unknown>

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function fetchAllRows(token: string, status: 'Active' | 'Closed'): Promise<RawListing[]> {
  const rows: RawListing[] = []
  let skip = 0
  for (let page = 0; page < 10; page += 1) {
    const filter = `${MORENO_VALLEY_FILTER} and StandardStatus eq '${status}'`
    const params = new URLSearchParams({
      $filter: filter,
      $select: ACTIVE_STATS_SELECT,
      $top: String(PAGE_SIZE),
      $skip: String(skip),
      $count: 'true',
    })
    const response = await fetch(`${getPropertyEndpoint()}?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`Trestle ${status} fetch failed: ${response.status}`)
    }
    const data = (await response.json()) as { value?: RawListing[] }
    const chunk = data.value ?? []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }
  return rows
}

export async function computeMorenoValleyMarketStats() {
  const token = await getAccessToken()
  const [active, closed] = await Promise.all([
    fetchAllRows(token, 'Active'),
    fetchAllRows(token, 'Closed'),
  ])

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const recentClosed = closed.filter(row => {
    const date = row.CloseDate
    if (typeof date !== 'string') return false
    const parsed = new Date(date)
    return Number.isFinite(parsed.getTime()) && parsed >= twelveMonthsAgo
  })

  const activePrices = active.map(row => toNumber(row.ListPrice)).filter((n): n is number => n !== null && n > 0)
  const closePrices = recentClosed.map(row => toNumber(row.ClosePrice)).filter((n): n is number => n !== null && n > 0)
  const livingAreas = recentClosed.map(row => toNumber(row.BuildingAreaTotal) ?? toNumber(row.LivingArea))
    .filter((n): n is number => n !== null && n > 0)
  const activeDom = active.map(row => toNumber(row.DaysOnMarket)).filter((n): n is number => n !== null && n >= 0)
  const closedDom = recentClosed.map(row => toNumber(row.DaysOnMarket)).filter((n): n is number => n !== null && n >= 0)

  const monthsSupply = recentClosed.length > 0 ? active.length / (recentClosed.length / 12) : 0
  const pricePerSqft = livingAreas.length > 0
    ? livingAreas.reduce((sum, area, i) => sum + (closePrices[i] ?? 0) / area, 0) / livingAreas.length
    : 0

  return {
    generatedAt: new Date().toISOString(),
    active: {
      count: active.length,
      medianListPrice: median(activePrices),
      avgListPrice: average(activePrices),
    },
    sold: {
      count: recentClosed.length,
      totalVolume: closePrices.reduce((sum, value) => sum + value, 0),
      medianClosePrice: median(closePrices),
      avgClosePrice: average(closePrices),
    },
    daysOnMarket: {
      avgActive: average(activeDom),
      avgClosed: average(closedDom),
    },
    pricePerSqFt: Math.round(pricePerSqft),
    inventoryMonths: Math.round(monthsSupply * 10) / 10,
  }
}
