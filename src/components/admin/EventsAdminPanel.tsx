'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, Search, Pencil, Eye, Building2, Archive, ArchiveRestore } from 'lucide-react'

export interface EventRow {
  id: string
  slug: string
  shareUrl: string | null
  title: string
  startsAt: string
  endsAt: string | null
  venueName: string | null
  tier: string
  category: string | null
  archivedAt: string | null
  business: { id: string; name: string; slug: string } | null
}

interface Props {
  events: EventRow[]
  archivedEvents: EventRow[]
}

type ViewMode = 'active' | 'archived'

export default function EventsAdminPanel({ events, archivedEvents }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<ViewMode>('active')
  const [pending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  // The active list excludes archived (the page server already filters) and
  // we use archivedEvents when the admin toggles the view.
  const sourceList = viewMode === 'archived' ? archivedEvents : events

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sourceList.filter((e) => {
      if (tier !== 'ALL' && e.tier !== tier) return false
      if (!q) return true
      return (
        e.title.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q) ||
        (e.venueName ?? '').toLowerCase().includes(q)
      )
    })
  }, [sourceList, query, tier])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

  const tierColor = (t: string) =>
    t === 'HERO'
      ? 'bg-amber-100 text-amber-800'
      : t === 'HONORABLE_MENTION'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-slate-100 text-slate-700'

  // Archive / un-archive action. Calls PATCH /api/admin/events/[id]/archive
  // with { archived: boolean }. The page refreshes via router.refresh() so
  // the server re-fetches the live + archived lists.
  const toggleArchive = async (eventId: string, nextArchived: boolean) => {
    setActionError('')
    setActionId(eventId)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: nextArchived }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Archive failed')
      startTransition(() => router.refresh())
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Archive failed')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      {actionError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {actionError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search by title, slug, or venue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All tiers</option>
          <option value="STANDARD">Standard</option>
          <option value="HONORABLE_MENTION">Honorable Mention</option>
          <option value="HERO">Hero</option>
        </select>
        {/* Active / Archived toggle — pill style. Active is the default; archived
            shows events 30+ days past their end (or auto-archived manually). */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'active'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            Active ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('archived')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'archived'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            Archived ({archivedEvents.length})
          </button>
        </div>
        <span className="text-xs text-text-secondary">
          {filtered.length} of {sourceList.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-text-secondary">
            {viewMode === 'archived'
              ? 'No archived events. The auto-archive cron hides events 30+ days past their end.'
              : 'No events match this filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-text-secondary">
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">
                    {viewMode === 'archived' ? 'Archived' : 'Starts'}
                  </th>
                  <th className="px-4 py-3 font-semibold hidden lg:table-cell">Venue</th>
                  <th className="px-4 py-3 font-semibold">Tier</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 font-semibold hidden lg:table-cell">Business</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text truncate max-w-[280px]">
                        {e.title}
                      </p>
                      <code className="text-[10px] font-mono text-text-secondary">
                        {e.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-text-secondary">
                      {viewMode === 'archived' && e.archivedAt
                        ? formatDate(e.archivedAt)
                        : formatDate(e.startsAt)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-text-secondary">
                      {e.venueName ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded ${tierColor(e.tier)}`}
                      >
                        {e.tier.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-text-secondary">
                      {e.category ? e.category.replace('_', ' ') : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {e.business ? (
                        <a
                          href={`/business/${e.business.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors max-w-[180px] truncate"
                          title={e.business.name}
                        >
                          <Building2 className="w-3 h-3 shrink-0" />
                          {e.business.name}
                        </a>
                      ) : (
                        <span className="text-text-secondary text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/dashboard/events/edit?id=${e.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </Link>
                        <a
                          href={e.shareUrl || `/events/${e.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={e.shareUrl ? 'Open Share URL' : 'Open event page'}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-text text-xs font-semibold hover:bg-slate-50 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                        </a>
                        {/* Archive / Unarchive toggle. Disabled while the
                            request is in flight so we don't double-fire. */}
                        <button
                          type="button"
                          disabled={pending && actionId === e.id}
                          onClick={() => toggleArchive(e.id, !e.archivedAt)}
                          title={
                            e.archivedAt
                              ? 'Restore to active listings'
                              : 'Hide from public listings (reversible)'
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-text-secondary text-xs font-semibold hover:bg-slate-50 hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {e.archivedAt ? (
                            <>
                              <ArchiveRestore className="w-3 h-3" /> Restore
                            </>
                          ) : (
                            <>
                              <Archive className="w-3 h-3" /> Archive
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}