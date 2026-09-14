'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Star,
  Mail,
  Phone,
  ExternalLink,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'

interface Owner {
  id: string
  name: string | null
  email: string
  phone: string | null
  emailOptIn: boolean
}

interface ClaimedBusiness {
  id: string
  slug: string
  name: string
  tagline: string | null
  tier: 'FREE' | 'FEATURED' | 'EXPERT_PARTNER'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  city: string
  state: string
  address: string
  claimedAt: string
  featuredAt: string | null
  isExpertPartner: boolean
  category: { name: string; slug: string }
  owner: Owner
  _count: { reviews: number; deals: number }
}

interface Props {
  businesses: ClaimedBusiness[]
  counts: {
    total: number
    approved: number
    featuredOrPartner: number
    everClaimed: number
  }
}

type SortKey = 'claimedAt' | 'name' | 'city' | 'tier'

export default function ClaimedBusinessesClient({ businesses, counts }: Props) {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<'ALL' | 'FEATURED' | 'EXPERT_PARTNER' | 'FREE'>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('claimedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim()
    let rows = businesses

    if (tierFilter !== 'ALL') {
      rows = rows.filter(b => b.tier === tierFilter)
    }

    if (q) {
      rows = rows.filter(
        b =>
          b.name.toLowerCase().includes(q) ||
          b.owner.email.toLowerCase().includes(q) ||
          (b.owner.name || '').toLowerCase().includes(q) ||
          b.city.toLowerCase().includes(q) ||
          b.category.name.toLowerCase().includes(q) ||
          b.address.toLowerCase().includes(q),
      )
    }

    const sorted = [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'claimedAt') {
        cmp = new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime()
      } else if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortKey === 'city') {
        cmp = a.city.localeCompare(b.city)
      } else if (sortKey === 'tier') {
        // Heavier tier first on asc; flip direction handled below.
        const weight = { FREE: 0, FEATURED: 1, EXPERT_PARTNER: 2 } as const
        cmp = weight[a.tier] - weight[b.tier]
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [businesses, search, tierFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'claimedAt' ? 'desc' : 'asc')
    }
  }

  const tierBadge = (b: ClaimedBusiness) => {
    if (b.isExpertPartner || b.tier === 'EXPERT_PARTNER') {
      return { label: 'Expert Partner', cls: 'bg-[#fff4e0] text-[#b85d00] border-[#ffd99a]' }
    }
    if (b.tier === 'FEATURED') {
      return { label: 'Featured', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
    return { label: 'Free', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
  }

  const statusBadge = (status: ClaimedBusiness['status']) => {
    if (status === 'APPROVED') return { label: 'Live', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    if (status === 'PENDING') return { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    return { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' }
  }

  return (
    <div className="space-y-5">
      {/* Counts strip — claim activity at a glance, no scrolling needed. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="In this view" value={counts.total} accent="bg-[#e0f5f5] text-[#007a7f]" />
        <Stat label="Live & claimed" value={counts.approved} accent="bg-emerald-50 text-emerald-700" />
        <Stat
          label="Featured or Partner"
          value={counts.featuredOrPartner}
          accent="bg-amber-50 text-amber-700"
        />
        <Stat label="Ever claimed" value={counts.everClaimed} accent="bg-slate-100 text-slate-700" />
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search business, owner name, email, city, category…"
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#007a7f] focus:ring-1 focus:ring-[#007a7f]/30 outline-none transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['ALL', 'FEATURED', 'EXPERT_PARTNER', 'FREE'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border transition"
                style={{
                  background: tierFilter === t ? 'var(--primary, #007a7f)' : '#f1f5f9',
                  color: tierFilter === t ? '#fff' : 'var(--text-secondary, #5a6c72)',
                  borderColor: tierFilter === t ? 'var(--primary, #007a7f)' : '#e2e8f0',
                }}
              >
                {t === 'ALL' ? 'All tiers' : t.replace('_', ' ')}
                <span className="ml-1 opacity-70">
                  {t === 'ALL'
                    ? businesses.length
                    : businesses.filter(b => b.tier === t).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-text-secondary">
          Showing <span className="font-bold text-text">{visible.length}</span> of{' '}
          <span className="font-bold text-text">{businesses.length}</span> claimed
          {search || tierFilter !== 'ALL' ? ' (filtered)' : ''}.
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {visible.length === 0 ? (
          <div className="px-6 py-16 text-center text-text-secondary">
            {search ? (
              <>
                No claimed businesses match <span className="font-bold">&ldquo;{search}&rdquo;</span>.
              </>
            ) : (
              <>No businesses have been claimed yet.</>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-text-secondary">
                <tr>
                  <SortHeader label="Business" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                  <th className="text-left px-4 py-3 font-bold">Owner</th>
                  <SortHeader label="City" active={sortKey === 'city'} dir={sortDir} onClick={() => toggleSort('city')} />
                  <SortHeader label="Tier" active={sortKey === 'tier'} dir={sortDir} onClick={() => toggleSort('tier')} />
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <SortHeader label="Claimed" active={sortKey === 'claimedAt'} dir={sortDir} onClick={() => toggleSort('claimedAt')} />
                  <th className="text-right px-4 py-3 font-bold">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(b => {
                  const tier = tierBadge(b)
                  const status = statusBadge(b.status)
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 align-top">
                        <div className="font-bold text-text">{b.name}</div>
                        {b.tagline && (
                          <div className="text-xs text-text-secondary line-clamp-1 max-w-xs">{b.tagline}</div>
                        )}
                        <div className="text-xs text-text-secondary mt-0.5">{b.category.name}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-text">{b.owner.name || <span className="text-text-secondary italic">No name</span>}</div>
                        <a
                          href={`mailto:${b.owner.email}`}
                          className="inline-flex items-center gap-1 text-xs text-[#007a7f] hover:underline"
                        >
                          <Mail className="w-3 h-3" />
                          {b.owner.email}
                        </a>
                        {b.owner.phone && (
                          <div className="inline-flex items-center gap-1 text-xs text-text-secondary mt-0.5">
                            <Phone className="w-3 h-3" />
                            {b.owner.phone}
                          </div>
                        )}
                        {b.owner.emailOptIn && (
                          <span className="ml-2 inline-block text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Email OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-text-secondary">
                        {b.city}, {b.state}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${tier.cls}`}
                        >
                          {b.tier === 'FEATURED' && <Star className="w-3 h-3" />}
                          {b.tier === 'EXPERT_PARTNER' && <Star className="w-3 h-3" fill="currentColor" />}
                          {tier.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${status.cls}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <time
                          className="text-xs text-text-secondary"
                          dateTime={b.claimedAt}
                          title={new Date(b.claimedAt).toLocaleString()}
                        >
                          {formatRelative(b.claimedAt)}
                        </time>
                        {b.featuredAt && (
                          <div className="text-[10px] text-amber-600 mt-0.5">
                            ★ Featured {formatRelative(b.featuredAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="inline-flex items-center gap-2">
                          {b.status === 'APPROVED' && (
                            <a
                              href={`/business/${b.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-secondary hover:text-[#007a7f] border border-slate-200 rounded hover:border-[#007a7f]"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          )}
                          <Link
                            href={`/dashboard/edit?id=${b.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-[#007a7f] hover:bg-[#006467] rounded"
                          >
                            Edit
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-xl p-4 ${accent}`}>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value.toLocaleString()}</div>
      <div className="text-xs font-bold uppercase tracking-wider mt-1 opacity-80">{label}</div>
    </div>
  )
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <th className="text-left px-4 py-3 font-bold">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-text transition ${active ? 'text-text' : ''}`}
      >
        {label}
        {active && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`
  if (diffSec < 2592000) return `${Math.round(diffSec / 86400)}d ago`
  if (diffSec < 31536000) return `${Math.round(diffSec / 2592000)}mo ago`
  return `${Math.round(diffSec / 31536000)}y ago`
}
