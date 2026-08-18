'use client'

/**
 * LiveEventsPanel — admin UI for editing/deleting approved Event rows.
 *
 * Renders one row per approved event with a thumbnail, title, date, venue,
 * category, and tier. Each row has Edit and Delete actions. The Edit action
 * opens a modal containing a form over the full set of editable Event fields
 * plus a hero image uploader.
 *
 * The form mirrors the PATCH /api/admin/events/[id] endpoint field-by-field.
 * Image upload uses a separate POST /api/admin/events/[id]/upload-hero
 * endpoint (multipart/form-data) rather than base64 — lighter on the wire
 * and reuses the Vercel Blob bucket set up by the FAL pipeline.
 *
 * After a successful save or delete, we call router.refresh() so the
 * /dashboard page re-fetches its propless data and the row count updates.
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  Upload,
  ImageIcon,
  AlertTriangle,
  Search,
} from 'lucide-react'
import { clsx } from 'clsx'

// Mirror the enums from PATCH /api/admin/events/[id] so the dropdowns stay
// in sync. If you add a value to one of these enums in prisma/schema.prisma,
// mirror it here.
const VENUE_TAGS = [
  'FOX_RIVERSIDE',
  'RIVERSIDE_MUNICIPAL_AUDITORIUM',
  'RIVERSIDE_CONVENTION_CENTER',
  'UCR',
  'CBU',
  'RIVERSIDE_ART_MUSEUM',
  'RIVERSIDE_METROPOLITAN_MUSEUM',
  'REDLANDS_BOWL',
  'REDLANDS_THEATER_FESTIVAL',
  'MOVAL_HIGH_SCHOOL',
  'OTHER',
] as const

const CATEGORIES = [
  'SPORTS',
  'MUSIC',
  'EDUCATIONAL',
  'FUNDRAISERS',
  'COMMUNITY',
  'ARTS',
  'FAMILY',
] as const

const TIERS = ['STANDARD', 'HONORABLE_MENTION', 'HERO'] as const

export interface LiveEvent {
  id: string
  slug: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  venueName: string | null
  venueTag: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  category: string | null
  tier: string
  ticketUrl: string | null
  isFree: boolean
  sourceUrl: string | null
  sourceAuthorHandle: string | null
  sourceAuthorUrl: string | null
  heroImageUrl: string | null
  createdAt: string
}

interface Props {
  events: LiveEvent[]
}

interface FormState {
  title: string
  description: string
  startsAt: string
  endsAt: string
  venueName: string
  venueTag: string
  address: string
  city: string
  state: string
  zip: string
  category: string
  tier: string
  ticketUrl: string
  isFree: boolean
  sourceUrl: string
  sourceAuthorHandle: string
  sourceAuthorUrl: string
}

function eventToForm(e: LiveEvent): FormState {
  // datetime-local needs YYYY-MM-DDTHH:mm in LOCAL time, not UTC.
  // We strip the timezone offset and the seconds so the input picks the
  // user's intended moment rather than re-converting.
  function toLocalInput(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return {
    title: e.title,
    description: e.description ?? '',
    startsAt: toLocalInput(e.startsAt),
    endsAt: toLocalInput(e.endsAt),
    venueName: e.venueName ?? '',
    venueTag: e.venueTag,
    address: e.address ?? '',
    city: e.city ?? '',
    state: e.state ?? '',
    zip: e.zip ?? '',
    category: e.category ?? '',
    tier: e.tier,
    ticketUrl: e.ticketUrl ?? '',
    isFree: e.isFree,
    sourceUrl: e.sourceUrl ?? '',
    sourceAuthorHandle: e.sourceAuthorHandle ?? '',
    sourceAuthorUrl: e.sourceAuthorUrl ?? '',
  }
}

function formToPatchPayload(f: FormState): Record<string, unknown> {
  // Only send fields that are actually filled. Empty strings become null
  // (so the API can clear them); datetimes are kept as ISO strings for the
  // server-side zod parser.
  const out: Record<string, unknown> = {
    title: f.title,
    tier: f.tier,
    venueTag: f.venueTag,
    isFree: f.isFree,
  }
  if (f.description) out.description = f.description
  else out.description = null

  if (f.startsAt) out.startsAt = new Date(f.startsAt).toISOString()
  if (f.endsAt) out.endsAt = new Date(f.endsAt).toISOString()
  else out.endsAt = null

  if (f.venueName) out.venueName = f.venueName
  else out.venueName = null

  out.address = f.address || null
  out.city = f.city || null
  out.state = f.state || null
  out.zip = f.zip || null

  // category can be empty string (clear) or a known enum value
  out.category = (CATEGORIES as readonly string[]).includes(f.category) ? f.category : null

  out.ticketUrl = f.ticketUrl || null
  out.sourceUrl = f.sourceUrl || null
  out.sourceAuthorHandle = f.sourceAuthorHandle || null
  out.sourceAuthorUrl = f.sourceAuthorUrl || null

  return out
}

export default function LiveEventsPanel({ events }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<LiveEvent | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<LiveEvent | null>(null)
  const [search, setSearch] = useState('')

  const filtered = search
    ? events.filter((e) => {
        const q = search.toLowerCase()
        return (
          e.title.toLowerCase().includes(q) ||
          (e.venueName ?? '').toLowerCase().includes(q) ||
          (e.category ?? '').toLowerCase().includes(q) ||
          (e.venueTag ?? '').toLowerCase().includes(q)
        )
      })
    : events

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-xl font-semibold text-text">
          Live Events
          <span className="ml-2 text-sm text-text-secondary font-normal">
            ({events.length} total, {filtered.length} shown)
          </span>
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="search"
            placeholder="Search title, venue, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-72 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((e) => (
          <EventRow
            key={e.id}
            event={e}
            onEdit={() => setEditing(e)}
            onDelete={() => setConfirmDelete(e)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-secondary">
            {events.length === 0 ? 'No live events yet.' : 'No events match your search.'}
          </div>
        )}
      </div>

      {editing && (
        <EditEventModal
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}

      {confirmDelete && (
        <DeleteConfirmModal
          event={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onDeleted={() => {
            setConfirmDelete(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: LiveEvent
  onEdit: () => void
  onDelete: () => void
}) {
  const date = new Date(event.startsAt)
  const dateLabel = isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
      <div className="w-16 h-16 flex-shrink-0 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
        {event.heroImageUrl ? (
          <img
            src={event.heroImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-6 h-6 text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-text truncate">{event.title}</div>
        <div className="text-sm text-text-secondary truncate">
          {dateLabel} · {event.venueName ?? 'No venue'} · {event.category ?? 'uncategorized'}
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          <span className={clsx(
            'inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1',
            event.tier === 'HERO' && 'bg-amber-100 text-amber-700',
            event.tier === 'HONORABLE_MENTION' && 'bg-slate-100 text-slate-700',
            event.tier === 'STANDARD' && 'bg-slate-50 text-slate-600',
          )}>
            {event.tier}
          </span>
          {event.venueTag !== 'OTHER' && (
            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              {event.venueTag}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary hover:text-white transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  )
}

function EditEventModal({
  event,
  onClose,
  onSaved,
}: {
  event: LiveEvent
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(() => eventToForm(event))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(event.heroImageUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPatchPayload(form)),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `Save failed: ${res.status}`)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(file: File) {
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/events/${event.id}/upload-hero`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `Upload failed: ${res.status}`)
      }
      const j = await res.json()
      setHeroImageUrl(j.heroImageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Event</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          {/* Hero image upload */}
          <section>
            <label className="block text-sm font-medium text-text mb-2">Hero Image</label>
            <div className="flex items-center gap-4">
              <div className="w-32 h-20 bg-slate-100 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileUpload(f)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading…' : 'Upload new image'}
                </button>
                <p className="text-xs text-text-secondary mt-1">JPEG, PNG, WebP, or GIF up to 8MB.</p>
              </div>
            </div>
          </section>

          <FieldRow label="Title">
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className={inputClass}
            />
          </FieldRow>

          <FieldRow label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={4}
              className={inputClass}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Starts at">
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setField('startsAt', e.target.value)}
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label="Ends at">
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setField('endsAt', e.target.value)}
                className={inputClass}
              />
            </FieldRow>
          </div>

          <FieldRow label="Venue name">
            <input
              type="text"
              value={form.venueName}
              onChange={(e) => setField('venueName', e.target.value)}
              className={inputClass}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Venue tag">
              <select
                value={form.venueTag}
                onChange={(e) => setField('venueTag', e.target.value)}
                className={inputClass}
              >
                {VENUE_TAGS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Category">
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                className={inputClass}
              >
                <option value="">— Uncategorized —</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FieldRow>
          </div>

          <FieldRow label="Address">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              className={inputClass}
            />
          </FieldRow>

          <div className="grid grid-cols-3 gap-4">
            <FieldRow label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label="State">
              <input
                type="text"
                value={form.state}
                onChange={(e) => setField('state', e.target.value)}
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label="Zip">
              <input
                type="text"
                value={form.zip}
                onChange={(e) => setField('zip', e.target.value)}
                className={inputClass}
              />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Tier">
              <select
                value={form.tier}
                onChange={(e) => setField('tier', e.target.value)}
                className={inputClass}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Free?">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={form.isFree}
                  onChange={(e) => setField('isFree', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Free event</span>
              </label>
            </FieldRow>
          </div>

          <FieldRow label="Ticket URL">
            <input
              type="url"
              value={form.ticketUrl}
              onChange={(e) => setField('ticketUrl', e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </FieldRow>

          <details className="border border-slate-200 rounded-lg">
            <summary className="p-3 cursor-pointer text-sm font-medium text-text-secondary hover:text-text">
              Source attribution (advanced)
            </summary>
            <div className="p-3 pt-0 space-y-3">
              <FieldRow label="Source URL">
                <input
                  type="url"
                  value={form.sourceUrl}
                  onChange={(e) => setField('sourceUrl', e.target.value)}
                  className={inputClass}
                />
              </FieldRow>
              <FieldRow label="Author handle">
                <input
                  type="text"
                  value={form.sourceAuthorHandle}
                  onChange={(e) => setField('sourceAuthorHandle', e.target.value)}
                  className={inputClass}
                  placeholder="@user"
                />
              </FieldRow>
              <FieldRow label="Author URL">
                <input
                  type="url"
                  value={form.sourceAuthorUrl}
                  onChange={(e) => setField('sourceAuthorUrl', e.target.value)}
                  className={inputClass}
                />
              </FieldRow>
            </div>
          </details>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({
  event,
  onClose,
  onDeleted,
}: {
  event: LiveEvent
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `Delete failed: ${res.status}`)
      }
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text">Delete event?</h3>
            <p className="text-sm text-text-secondary mt-1">
              This will permanently remove <span className="font-medium">{event.title}</span> from the
              public /events page. The originating submission, if any, will keep its
              APPROVED status but its event link will be cleared.
            </p>
          </div>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Deleting…' : 'Delete event'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text-secondary mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white'
