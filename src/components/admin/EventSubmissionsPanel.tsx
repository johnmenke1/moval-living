'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  CheckCircle,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Inbox,
  ImageIcon,
  Copy,
  Pencil,
  Search,
} from 'lucide-react'

interface Submission {
  id: string
  slug: string
  sourceUrl: string
  sourcePlatform: 'INSTAGRAM' | 'FACEBOOK' | 'OTHER'
  sourceAuthorHandle: string | null
  sourceAuthorUrl: string | null
  sourceThumbnailUrl: string | null
  // Original IG/FB post text — captured at submission time via Playwright.
  // Becomes Event.description and Event.sourcePostExcerpt on approve.
  sourcePostCaption: string | null
  // Our CDN hero URL — populated by the daily cron via fal generation.
  // Becomes Event.heroImageUrl on approve.
  thumbnailUrl: string | null
  sourcePostExcerpt: string | null
  title: string
  startsAt: string
  endsAt: string | null
  venueName: string | null
  submitterNote: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE'
  createdAt: string
  /** ID of the Event this submission was promoted to (when status === 'APPROVED'). */
  promotedToEventId: string | null
}

interface EventForDuplicate {
  id: string
  slug: string
  title: string
  startsAt: string
  venueName: string | null
}

interface Props {
  initialSubmissions: Submission[]
  existingEvents: EventForDuplicate[]
}

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE' | 'ALL'

export default function EventSubmissionsPanel({ initialSubmissions, existingEvents }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [duplicateFor, setDuplicateFor] = useState<string | null>(null)
  const [duplicateEventId, setDuplicateEventId] = useState('')

  const counts = {
    PENDING: submissions.filter((s) => s.status === 'PENDING').length,
    APPROVED: submissions.filter((s) => s.status === 'APPROVED').length,
    REJECTED: submissions.filter((s) => s.status === 'REJECTED').length,
    DUPLICATE: submissions.filter((s) => s.status === 'DUPLICATE').length,
    ALL: submissions.length,
  }

  // Apply status filter + case-insensitive substring match on the event
  // title. Empty query matches everything.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return submissions.filter((s) => {
      if (filter !== 'ALL' && s.status !== filter) return false
      if (!q) return true
      return s.title.toLowerCase().includes(q)
    })
  }, [submissions, filter, query])

  // Approve creates an Event from the Submission. The API fills in:
  //   - description = sourcePostExcerpt (if available) OR title
  //   - source = sourcePlatform
  //   - everything else passes through
  // Admin can then edit the new Event on the public Events page.
  const approve = async (id: string) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Approve failed')
      // Capture the new event id from the API response so the "Edit event"
      // link renders immediately on the just-approved submission without a
      // page refresh. Server pre-approval had promotedToEventId=null; the
      // DB has it set, but client state is stale until we write it back.
      const newEventId = data.event?.id ?? null
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'APPROVED' as const, promotedToEventId: newEventId ?? s.promotedToEventId }
            : s
        )
      )
      setExpanded(null)
      setSuccess(`Approved — card created as event "${data.event?.title ?? ''}"`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    }
  }

  const reject = async (id: string) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Reject failed')
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'REJECTED' as const } : s))
      )
      setExpanded(null)
      setSuccess('Rejected and removed from the queue')
      setTimeout(() => setSuccess(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  const markDuplicate = async (id: string) => {
    if (!duplicateEventId) {
      setError('Pick an event to link this submission to')
      return
    }
    setError('')
    try {
      const res = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', eventId: duplicateEventId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not mark as duplicate')
      // Carry the linked event id into local state so the "Edit event" link
      // renders immediately on the duplicate row, matching the approve flow.
      const linkedEventId = data.event?.id ?? null
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: 'DUPLICATE' as const, promotedToEventId: linkedEventId ?? s.promotedToEventId }
            : s
        )
      )
      setDuplicateFor(null)
      setDuplicateEventId('')
      setExpanded(null)
      setSuccess('Linked as duplicate — no new event created')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark as duplicate')
    }
  }

  return (
    <div>
      {error && (
        <div className="flex items-start gap-2 p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-4 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Search + filter row */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by event title…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
            }`}
          >
            {f}
            <span
              className={`inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] ${
                filter === f ? 'bg-white text-primary' : 'bg-white text-text-secondary'
              }`}
            >
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-text-secondary">
            {query.trim()
              ? `No submissions match "${query.trim()}" in this filter.`
              : 'No submissions match this filter.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s) => (
            <li
              key={s.id}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            >
              {/* Row header */}
              <button
                type="button"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="shrink-0">
                  {s.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.thumbnailUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover bg-slate-100"
                    />
                  ) : s.sourceThumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.sourceThumbnailUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover bg-slate-100"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-mono text-text-secondary">
                      {s.slug}
                    </code>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        s.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : s.status === 'APPROVED'
                            ? 'bg-green-100 text-green-700'
                            : s.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.sourcePlatform !== 'OTHER' && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {s.sourcePlatform}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-text truncate">{s.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {formatStartsAt(s.startsAt)}
                    {s.venueName ? ` · ${s.venueName}` : ''}
                    {' · '}
                    <span className="text-slate-400">submitted {relativeTime(s.createdAt)}</span>
                  </p>
                </div>

                {expanded === s.id ? (
                  <ChevronUp className="w-4 h-4 text-text-secondary shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
                )}
              </button>

              {/* Expanded detail */}
              {expanded === s.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-4">
                  {/* Original post */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      {s.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.thumbnailUrl}
                          alt=""
                          className="w-full rounded-lg object-cover bg-slate-100"
                          style={{ aspectRatio: '1/1' }}
                        />
                      ) : s.sourceThumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.sourceThumbnailUrl}
                          alt=""
                          className="w-full rounded-lg object-cover bg-slate-100"
                          style={{ aspectRatio: '1/1' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div
                          className="w-full rounded-lg bg-slate-100 flex items-center justify-center"
                          style={{ aspectRatio: '1/1' }}
                        >
                          <ImageIcon className="w-8 h-8 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-text-secondary mb-1">Original post</p>
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline break-all"
                        >
                          {s.sourceUrl}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {s.sourceAuthorHandle && (
                          <p className="text-xs text-text-secondary mt-1">by {s.sourceAuthorHandle}</p>
                        )}
                      </div>

                      {s.sourcePostCaption && (
                        <div>
                          <p className="text-xs font-semibold text-text-secondary mb-1">
                            Original post caption
                            <span className="ml-2 text-[10px] font-normal text-text-secondary/70">
                              (will become the Event description on approve)
                            </span>
                          </p>
                          <p className="text-sm bg-white rounded-lg border border-slate-100 p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {s.sourcePostCaption}
                          </p>
                        </div>
                      )}

                      {s.submitterNote && (
                        <div>
                          <p className="text-xs font-semibold text-text-secondary mb-1">
                            Submitter note
                          </p>
                          <p className="text-sm bg-white rounded-lg border border-slate-100 p-3">
                            {s.submitterNote}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission data — read-only since submitter filled it in */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ReadOnlyField label="Title" value={s.title} />
                    <ReadOnlyField
                      label="Starts"
                      value={formatStartsAt(s.startsAt)}
                    />
                    <ReadOnlyField
                      label="Ends"
                      value={s.endsAt ? formatStartsAt(s.endsAt) : '—'}
                    />
                    <ReadOnlyField
                      label="Venue"
                      value={s.venueName ?? '— (admin to fill)'}
                      warn={!s.venueName}
                    />
                    <ReadOnlyField
                      label="Slug"
                      value={s.slug}
                      mono
                    />
                    <ReadOnlyField
                      label="Submitted"
                      value={relativeTime(s.createdAt)}
                    />
                  </div>

                  {/* Actions — only on PENDING */}
                  {s.status === 'PENDING' && (
                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      <p className="text-xs font-semibold text-text-secondary">Actions</p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => approve(s.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve & create event
                        </button>
                        <button
                          type="button"
                          onClick={() => reject(s.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setDuplicateFor(duplicateFor === s.id ? null : s.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-text text-sm font-semibold hover:bg-slate-50 transition-colors"
                        >
                          <Copy className="w-4 h-4" /> Mark as duplicate
                        </button>
                      </div>

                      {duplicateFor === s.id && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                          <p className="text-sm text-text-secondary">
                            Pick the existing event this submission duplicates. No new event will be created.
                          </p>
                          <select
                            value={duplicateEventId}
                            onChange={(e) => setDuplicateEventId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                          >
                            <option value="">— Choose an event —</option>
                            {existingEvents.map((ev) => (
                              <option key={ev.id} value={ev.id}>
                                {formatStartsAt(ev.startsAt)} — {ev.title}
                                {ev.venueName ? ` @ ${ev.venueName}` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => markDuplicate(s.id)}
                              disabled={!duplicateEventId}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                            >
                              <CheckCircle className="w-4 h-4" /> Confirm duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDuplicateFor(null)
                                setDuplicateEventId('')
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-text text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {s.status === 'APPROVED' && (
                    <div className="space-y-2">
                      <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3">
                        ✓ Approved and promoted to an Event. Edit the event below to add venue address, hero image, and other details.
                      </p>
                      {s.promotedToEventId && (
                        <Link
                          href={`/dashboard/events/edit?id=${s.promotedToEventId}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                        >
                          <Pencil className="w-4 h-4" /> Edit event
                        </Link>
                      )}
                    </div>
                  )}

                  {s.status === 'REJECTED' && (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
                      ✗ Rejected — this submission was removed from the active queue.
                    </p>
                  )}

                  {s.status === 'DUPLICATE' && (
                    <p className="text-sm text-slate-700 bg-slate-100 rounded-lg p-3">
                      ↻ Linked as a duplicate of an existing event — no new event created.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
  mono = false,
  warn = false,
}: {
  label: string
  value: string
  mono?: boolean
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${warn ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100 bg-white'}`}
    >
      <p className="text-[10px] uppercase font-bold tracking-wider text-text-secondary mb-1">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} ${warn ? 'text-amber-800' : 'text-text'}`}>
        {value}
      </p>
    </div>
  )
}

function formatStartsAt(iso: string): string {
  const d = new Date(iso)
  // Display in user's local timezone
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
