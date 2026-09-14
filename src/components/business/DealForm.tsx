'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, X, Trash2 } from 'lucide-react'

// Compact form used by DealsManager for both create and edit. Mounted
// inside a collapsible section so the dashboard list stays uncluttered.
//
// All fields are local state — the parent (DealsManager) holds the
// authoritative list and refreshes via router.refresh() on success.
//
// Props:
//   businessId — required for both create + edit (used in POST, ignored
//                in PATCH since the parent already knows the deal's
//                businessId)
//   deal?      — when set, this form is in edit mode and pre-fills
//                from the row
//   onDone()   — called after a successful create or update so the
//                parent can collapse the form / reset its own state

export interface DealFormValues {
  id: string
  headline: string
  description: string | null
  code: string | null
  imageUrl: string | null
  startsAt: string | null
  expiresAt: string | null
  displayOrder: number
  isActive: boolean
}

interface Props {
  businessId: string
  deal?: DealFormValues
  onDone: () => void
  onCancel: () => void
}

// Format a Date (or ISO string) into the <input type="datetime-local">
// wire format: YYYY-MM-DDTHH:mm. Returns "" when null/invalid — the
// datetime-local input handles empty strings as "no value".
function toDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return ''
  // toISOString is always UTC; slice off the seconds + Z so we get
  // YYYY-MM-DDTHH:mm in UTC. The browser will display it in local time
  // (per the input's spec) so this round-trips cleanly.
  return date.toISOString().slice(0, 16)
}

export function DealForm({ businessId, deal, onDone, onCancel }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [headline, setHeadline] = useState(deal?.headline ?? '')
  const [description, setDescription] = useState(deal?.description ?? '')
  const [code, setCode] = useState(deal?.code ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(deal?.imageUrl ?? null)
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(deal?.startsAt ?? null))
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocal(deal?.expiresAt ?? null))
  const [displayOrder, setDisplayOrder] = useState(deal?.displayOrder ?? 0)
  const [isActive, setIsActive] = useState(deal?.isActive ?? true)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleImageUpload = async (file: File) => {
    setUploadError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('businessId', businessId)
      fd.append('type', 'deal')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setImageUrl(data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    // Send ISO strings (or null) for dates — the Zod schema on the
    // server expects either an ISO datetime or null. Empty strings
    // from the datetime-local inputs need to become null here.
    const payload: Record<string, unknown> = {
      headline: headline.trim(),
      description: description.trim() || null,
      code: code.trim() || null,
      imageUrl,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      displayOrder: Number(displayOrder) || 0,
      isActive,
    }

    try {
      const url = deal ? `/api/deals/${deal.id}` : '/api/deals'
      const method = deal ? 'PATCH' : 'POST'
      if (!deal) {
        payload.businessId = businessId
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.fields) {
          setFieldErrors(data.fields)
          const firstField = Object.keys(data.fields)[0]
          setError(firstField ? `Please fix the "${firstField}" field.` : 'Please fix the highlighted fields.')
        } else {
          throw new Error(data.error || 'Failed to save')
        }
        return
      }

      // Refresh the server-rendered list under the form so a new deal
      // shows up immediately. startTransition keeps the UI responsive
      // while the refresh lands.
      startTransition(() => router.refresh())
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl border border-slate-100 p-5">
      {error && (
        <div className="bg-error/10 border border-error/20 text-error text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="label block mb-1.5">Headline</label>
        <input
          type="text"
          required
          maxLength={120}
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className={`input ${fieldErrors.headline ? 'border-red-500 ring-1 ring-red-200' : ''}`}
          placeholder="$5 off any large pizza"
        />
        {fieldErrors.headline && (
          <p className="text-xs text-error mt-1">{fieldErrors.headline}</p>
        )}
      </div>

      <div>
        <label className="label block mb-1.5">Description (optional)</label>
        <textarea
          maxLength={1000}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`input resize-none ${fieldErrors.description ? 'border-red-500 ring-1 ring-red-200' : ''}`}
          placeholder="Mention any restrictions, valid locations, or how to redeem."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label block mb-1.5">Promo Code (optional)</label>
          <input
            type="text"
            maxLength={40}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`input font-mono ${fieldErrors.code ? 'border-red-500 ring-1 ring-red-200' : ''}`}
            placeholder="MOVE25"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Display Order</label>
          <input
            type="number"
            min={0}
            max={9999}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            className={`input ${fieldErrors.displayOrder ? 'border-red-500 ring-1 ring-red-200' : ''}`}
          />
          <p className="text-xs text-text-secondary mt-1">Lower numbers show first. 0 = default.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label block mb-1.5">Starts (optional)</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Expires (optional)</label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {/* Image upload — uses /api/upload type='deal'. Same UX as
          BusinessCard's photo gallery: drop zone + preview + remove. */}
      <div>
        <label className="label block mb-1.5">Image (optional)</label>
        <div className="flex items-center gap-4">
          {imageUrl ? (
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Deal preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center w-32 h-32 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary hover:text-primary cursor-pointer transition-colors">
              <span className="text-xs">Upload</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                  e.target.value = ''
                }}
              />
            </label>
          )}
          {uploading && (
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading…
            </div>
          )}
        </div>
        {uploadError && (
          <p className="text-xs text-error mt-1">{uploadError}</p>
        )}
        <p className="text-xs text-text-secondary mt-1.5">JPG, PNG, WebP or GIF · max 10MB</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`isActive-${deal?.id ?? 'new'}`}
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
        <label htmlFor={`isActive-${deal?.id ?? 'new'}`} className="text-sm text-text">
          Active — show on the public <code className="text-xs bg-slate-100 px-1 rounded">/deals</code> page
        </label>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          type="submit"
          disabled={saving || uploading}
          className="btn-primary"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {deal ? 'Save changes' : 'Create deal'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        {deal && (
          <DeleteDealButton dealId={deal.id} onDeleted={onDone} />
        )}
      </div>
    </form>
  )
}

// Inline delete button — separate small component so its own loading
// state doesn't compete with the form's save state. Calls DELETE
// /api/deals/[id] then calls onDeleted() so the parent can collapse
// the form.
function DeleteDealButton({ dealId, onDeleted }: { dealId: string; onDeleted: () => void }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!confirm('Delete this deal? This cannot be undone.')) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Delete failed')
      }
      startTransition(() => router.refresh())
      onDeleted()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {deleteError && <span className="text-xs text-error">{deleteError}</span>}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center gap-1 text-sm font-medium text-error hover:text-error/80 transition-colors disabled:opacity-50"
      >
        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Delete
      </button>
    </div>
  )
}
