'use client'

import { useCallback, useEffect, useState } from 'react'

interface AdminEntry {
  id: string
  displayName: string
  tagline: string | null
  description: string | null
  category: string | null
  contactName: string
  contactEmail: string
  contactPhone: string | null
  streetAddress: string
  city: string
  zip: string | null
  latitude: number | null
  longitude: number | null
  showExactAddress: boolean
  locationLabel: string | null
  photoUrls: string[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
  votes: number
  createdAt: string
}

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'

export default function HalloweenAdmin() {
  const [entries, setEntries] = useState<AdminEntry[]>([])
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/halloween/entries', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      setEntries((await res.json()).entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/halloween/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this entry and its votes permanently?')) return
    setBusy(id)
    try {
      await fetch(`/api/admin/halloween/entries/${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusy(null)
    }
  }

  const counts = {
    PENDING: entries.filter((e) => e.status === 'PENDING').length,
    APPROVED: entries.filter((e) => e.status === 'APPROVED').length,
    REJECTED: entries.filter((e) => e.status === 'REJECTED').length,
    ALL: entries.length,
  }
  const shown = entries.filter((e) => filter === 'ALL' || e.status === filter)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border ${filter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
            {f[0] + f.slice(1).toLowerCase()} ({counts[f]})
          </button>
        ))}
        <a href="/halloween" target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-slate-500 underline self-center">View public page</a>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && shown.length === 0 && <p className="text-sm text-slate-500">Nothing here.</p>}

      <div className="space-y-4">
        {shown.map((e) => (
          <EntryRow key={e.id} e={e} busy={busy === e.id} onPatch={(b) => patch(e.id, b)} onDelete={() => remove(e.id)} />
        ))}
      </div>
    </div>
  )
}

function EntryRow({ e, busy, onPatch, onDelete }: {
  e: AdminEntry
  busy: boolean
  onPatch: (b: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [lat, setLat] = useState(e.latitude?.toString() ?? '')
  const [lng, setLng] = useState(e.longitude?.toString() ?? '')
  const [reason, setReason] = useState(e.rejectionReason ?? '')
  const pinChanged = lat !== (e.latitude?.toString() ?? '') || lng !== (e.longitude?.toString() ?? '')
  const full = `${e.streetAddress}, ${e.city}, CA ${e.zip ?? ''}`

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{e.displayName}</h3>
          {e.tagline && <p className="text-sm text-slate-600">{e.tagline}</p>}
          <p className="text-xs text-slate-500 mt-1">
            {new Date(e.createdAt).toLocaleString()} · {e.votes} vote{e.votes === 1 ? '' : 's'} · {e.category ?? 'no category'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${e.status === 'APPROVED' ? 'bg-green-100 text-green-800' : e.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
          {e.status}
        </span>
      </div>

      {e.photoUrls.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {e.photoUrls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-28 w-auto rounded-lg object-cover" />
            </a>
          ))}
        </div>
      )}

      {e.description && <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{e.description}</p>}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div><dt className="inline text-slate-500">Contact: </dt><dd className="inline">{e.contactName} · <a className="underline" href={`mailto:${e.contactEmail}`}>{e.contactEmail}</a>{e.contactPhone ? ` · ${e.contactPhone}` : ''}</dd></div>
        <div><dt className="inline text-slate-500">Address: </dt><dd className="inline">{full} <a className="underline text-slate-500" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`}>check</a></dd></div>
        <div><dt className="inline text-slate-500">Public label: </dt><dd className="inline">{e.locationLabel ?? '-'} ({e.showExactAddress ? 'exact pin' : 'approximate pin'})</dd></div>
      </dl>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">Latitude
          <input value={lat} onChange={(ev) => setLat(ev.target.value)} className="block w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <label className="text-xs text-slate-500">Longitude
          <input value={lng} onChange={(ev) => setLng(ev.target.value)} className="block w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <button disabled={busy || !pinChanged || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))}
          onClick={() => onPatch({ latitude: parseFloat(lat), longitude: parseFloat(lng) })}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40">Save pin</button>
        <label className="flex items-center gap-2 text-sm text-slate-700 pb-1.5">
          <input type="checkbox" checked={e.showExactAddress} disabled={busy} onChange={(ev) => onPatch({ showExactAddress: ev.target.checked })} />
          Show exact address
        </label>
        {(e.latitude == null || e.longitude == null) && <span className="text-xs font-semibold text-red-600 pb-2">No pin yet - geocoding failed. Enter coordinates.</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {e.status !== 'APPROVED' && (
          <button disabled={busy} onClick={() => onPatch({ status: 'APPROVED', rejectionReason: null })}
            className="rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Approve</button>
        )}
        {e.status !== 'REJECTED' && (
          <>
            <input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason (optional, internal)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-56" />
            <button disabled={busy} onClick={() => onPatch({ status: 'REJECTED', rejectionReason: reason || null })}
              className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Reject</button>
          </>
        )}
        {e.status === 'APPROVED' && (
          <button disabled={busy} onClick={() => onPatch({ status: 'PENDING' })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">Unpublish</button>
        )}
        <button disabled={busy} onClick={onDelete} className="ml-auto rounded-lg text-red-600 hover:bg-red-50 px-3 py-2 text-sm disabled:opacity-50">Delete</button>
      </div>
    </article>
  )
}
