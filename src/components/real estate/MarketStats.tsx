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
}

function formatCurrency(val: number): string {
  if (!val) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

function formatNumber(val: number): string {
  if (!val) return '—'
  return new Intl.NumberFormat('en-US').format(Math.round(val))
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
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary font-medium">{label}</span>
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          trend === 'up' ? 'bg-success/10 text-success' :
          trend === 'down' ? 'bg-error/10 text-error' :
          'bg-primary/10 text-primary'
        )}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-text">{value}</div>
        {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
      </div>
      {trend && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          trend === 'up' ? 'text-success' : trend === 'down' ? 'text-error' : 'text-text-secondary'
        )}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> :
           trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
          <span>Market indicator</span>
        </div>
      )}
    </div>
  )
}

export function MarketStats({ stats, loading }: MarketStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-20 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-28 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Market data currently unavailable. Please check back shortly.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-text">Moreno Valley Market Stats</h3>
          <p className="text-sm text-text-secondary mt-0.5">
            Based on CRMLS data • Updated {new Date(stats.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Active Listings */}
      <div>
        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Active Listings</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Home}
            label="Active Homes"
            value={formatNumber(stats.active.count)}
            sub="Currently for sale"
            trend={stats.active.count > 20 ? 'up' : 'down'}
          />
          <StatCard
            icon={DollarSign}
            label="Median List Price"
            value={formatCurrency(stats.active.medianListPrice)}
            sub="Active listings"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg List Price"
            value={formatCurrency(stats.active.avgListPrice)}
          />
          <StatCard
            icon={Clock}
            label="Avg Days on Market"
            value={`${Math.round(stats.daysOnMarket.avgActive)} days`}
            sub="Active homes"
            trend="neutral"
          />
        </div>
      </div>

      {/* Sold / Closed */}
      <div>
        <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
          Recent Sales <span className="normal-case font-normal">(last 12 months)</span>
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={BarChart3}
            label="Homes Sold"
            value={formatNumber(stats.sold.count)}
            sub="Last 12 months"
          />
          <StatCard
            icon={DollarSign}
            label="Median Sale Price"
            value={formatCurrency(stats.sold.medianClosePrice)}
            sub="Closed sales"
            trend="up"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Sale Price"
            value={formatCurrency(stats.sold.avgClosePrice)}
          />
          <StatCard
            icon={BarChart3}
            label="Avg $/Sq Ft"
            value={`$${formatNumber(stats.pricePerSqFt)}`}
            sub="Per square foot"
          />
        </div>
      </div>

      {/* Market conditions banner */}
      <div className={cn(
        'rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap',
        stats.inventoryMonths < 3
          ? 'bg-success/5 border border-success/20'
          : stats.inventoryMonths < 6
          ? 'bg-primary/5 border border-primary/20'
          : 'bg-accent/5 border border-accent/20'
      )}>
        <div>
          <div className="text-sm font-semibold text-text mb-1">Market Conditions</div>
          <div className="text-2xl font-bold text-text">
            {stats.inventoryMonths < 2 ? "� Seller's Market" :
             stats.inventoryMonths < 4 ? "⚖️ Balanced Market" :
             stats.inventoryMonths < 7 ? "📉 Buyer's Market" : "📉 Buyer's Market"}
          </div>
          <div className="text-sm text-text-secondary mt-1">
            {stats.inventoryMonths.toFixed(1)} months of inventory supply
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-text-secondary">Total sales volume</div>
          <div className="text-xl font-bold text-text">{formatCurrency(stats.sold.totalVolume)}</div>
          <div className="text-sm text-text-secondary">last 12 months</div>
        </div>
      </div>

      <p className="text-xs text-text-secondary italic">
        Based on information from CRMLS. All data should be independently verified. Some data may be suppressed due to privacy restrictions.
      </p>
    </div>
  )
}
