'use client'

import { TrendingUp, TrendingDown, Home, DollarSign, Clock, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Stat {
  generatedAt: string
  active: {
    count: number
    medianListPrice: number
    avgListPrice: number
  }
  sold: {
    count: number
    totalVolume: number
    medianClosePrice: number
    avgClosePrice: number
  }
  daysOnMarket: {
    avgActive: number
    avgClosed: number
  }
  pricePerSqFt: number
  inventoryMonths: number
}

interface MarketStatsProps {
  stats: Stat | null
  loading?: boolean
  error?: string | null
}

function formatCurrency(val: number): string {
  if (!val) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}

function formatNumber(val: number): string {
  if (!val) return '—'
  return new Intl.NumberFormat('en-US').format(Math.round(val))
}

function formatUpdatedDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            trend === 'up' ? 'bg-success/10 text-success' :
            trend === 'down' ? 'bg-error/10 text-error' :
            'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-text">{value}</div>
        {sub && <div className="mt-1 text-xs text-text-secondary">{sub}</div>}
      </div>
      {trend && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            trend === 'up' ? 'text-success' :
            trend === 'down' ? 'text-error' :
            'text-text-secondary',
          )}
        >
          {trend === 'up' ? <TrendingUp className="h-3 w-3" /> :
           trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
          <span>Market indicator</span>
        </div>
      )}
    </div>
  )
}

export function MarketStats({ stats, loading, error }: MarketStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card animate-pulse p-5">
            <div className="mb-3 h-4 w-20 rounded bg-slate-200" />
            <div className="mb-2 h-8 w-28 rounded bg-slate-200" />
            <div className="h-3 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        {error ? (
          <>
            <p className="font-medium text-error">Unable to load market data.</p>
            <p className="text-xs mt-1 opacity-70">{error}</p>
          </>
        ) : (
          <p>Market data currently unavailable. Please check back shortly.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-text">Moreno Valley Market Stats</h3>
          <p className="mt-0.5 text-sm text-text-secondary">
            Based on CRMLS data • Updated {formatUpdatedDate(stats.generatedAt)}
          </p>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Active Listings
        </h4>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Home} label="Active Homes" value={formatNumber(stats.active.count)} sub="Currently for sale" />
          <StatCard icon={DollarSign} label="Median List Price" value={formatCurrency(stats.active.medianListPrice)} sub="Active listings" />
          <StatCard icon={TrendingUp} label="Avg List Price" value={formatCurrency(stats.active.avgListPrice)} />
          <StatCard icon={Clock} label="Avg Days on Market" value={`${Math.round(stats.daysOnMarket.avgActive)} days`} sub="Active homes" />
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Recent Sales <span className="text-xs font-normal normal-case">(last 12 months)</span>
        </h4>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={BarChart3} label="Homes Sold" value={formatNumber(stats.sold.count)} sub="Last 12 months" />
          <StatCard icon={DollarSign} label="Median Sale Price" value={formatCurrency(stats.sold.medianClosePrice)} sub="Closed sales" />
          <StatCard icon={TrendingUp} label="Avg Sale Price" value={formatCurrency(stats.sold.avgClosePrice)} />
          <StatCard icon={BarChart3} label="Avg $/Sq Ft" value={`$${formatNumber(stats.pricePerSqFt)}`} sub="Per square foot" />
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 rounded-xl p-5',
          stats.inventoryMonths < 3
            ? 'bg-success/5 border border-success/20'
            : stats.inventoryMonths < 6
            ? 'bg-primary/5 border border-primary/20'
            : 'bg-accent/5 border border-accent/20',
        )}
      >
        <div>
          <div className="mb-1 text-sm font-semibold text-text">Market Conditions</div>
          <div className="text-2xl font-bold text-text">
            {stats.inventoryMonths < 2 ? "Seller's Market" :
             stats.inventoryMonths < 4 ? 'Balanced Market' :
             "Buyer's Market"}
          </div>
          <div className="mt-1 text-sm text-text-secondary">
            {stats.inventoryMonths.toFixed(1)} months of inventory supply
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-text-secondary">Total sales volume</div>
          <div className="text-xl font-bold text-text">{formatCurrency(stats.sold.totalVolume)}</div>
          <div className="text-sm text-text-secondary">last 12 months</div>
        </div>
      </div>

      <p className="text-xs italic text-text-secondary">
        Based on information from CRMLS. All data should be independently verified. Some data may be suppressed due to privacy restrictions.
      </p>
    </div>
  )
}
