'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, Star, MapPin, Upload, Trash2,
  CheckCircle2, XCircle, ImagePlus,
} from 'lucide-react'
import type { ParkType } from '@/lib/parks'
import { typeLabel } from '@/lib/parks'
import { AMENITIES, isKnownAmenity } from '@/lib/park-amenities'

interface ParkEditorPark {
  id: string
  slug: string
  name: string
  type: ParkType
  address: string | null
  city: string
  state: string
  zip: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  website: string | null
  amenities: string[]
  googlePlaceId: string | null
  googleRating: number | null
  googleReviewCount: number | null
  heroPhotoUrl: string | null
  photoUrls: string[]
  blurb: string | null
  description: string | null
  // Curated FAQs. Shape: { q: string, a: string }[] — rendered as
  // <details> on the detail page AND emitted as Schema.org FAQPage.
  faqsJson: { q: string; a: string }[] | null
  featured: boolean
  isActive: boolean
  updatedAt: string
  createdAt: string
}

interface Props {
  initialPark: ParkEditorPark
}

export function ParkEditor({ initialPark }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [park, setPark] = useState(initialPark)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof ParkEditorPark>(key: K, value: ParkEditorPark[K]) {
    setPark((p) => ({ ...p, [key]: value }))
  }

  function toggleAmenity(slug: string) {
    setPark((p) => {
      const has = p.amenities.includes(slug)
      return {
        ...p,
        amenities: has ? p.amenities.filter((s) => s !== slug) : [...p.amenities, slug],
      }
    })
  }

  function setFaqs(updater: (cur: { q: string; a: string }[]) => { q: string; a: string }[]) {
    setPark((p) => ({ ...p, faqsJson: updater(p.faqsJson ?? []) }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSavedAt(null)
    try {
      const res = await fetch(`/api/admin/parks/${park.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: park.name,
          address: park.address,
          latitude: park.latitude,
          longitude: park.longitude,
          phone: park.phone,
          website: park.website,
          blurb: park.blurb,
          description: park.description,
          faqsJson: park.faqsJson ?? null,
          amenities: park.amenities.filter(isKnownAmenity),
          featured: park.featured,
          isActive: park.isActive,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Save failed (${res.status})`)
      }
      const j = await res.json()
      setPark(j.park)
      setSavedAt(new Date().toLocaleTimeString())
      startTransition(() => router.refresh())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/parks/${park.slug}/photos`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Upload failed (${res.status})`)
      }
      const j = await res.json()
      setPark((p) => ({
        ...p,
        photoUrls: j.park.photoUrls,
        heroPhotoUrl: j.park.heroPhotoUrl,
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function deletePhoto(url: string) {
    if (!confirm('Remove this photo permanently?')) return
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/parks/${park.slug}/photos?url=${encodeURIComponent(url)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Delete failed (${res.status})`)
      }
      const j = await res.json()
      setPark((p) => ({
        ...p,
        photoUrls: j.park.photoUrls,
        heroPhotoUrl: j.park.heroPhotoUrl,
      }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function setHero(url: string) {
    setError(null)
    try {
      const res = await fetch(`/api/admin/parks/${park.slug}/photos/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrls: park.photoUrls, heroPhotoUrl: url }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Set hero failed (${res.status})`)
      }
      const j = await res.json()
      setPark((p) => ({ ...p, heroPhotoUrl: j.park.heroPhotoUrl }))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push('/dashboard/parks')}
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> Back to parks list
        </button>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text" style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}>
                {park.name}
              </h1>
              <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded bg-primary/10 text-primary">
                {typeLabel(park.type)}
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-1">
              <Link href={`/parks#${park.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary inline-flex items-center gap-1">
                View on public page ↗
              </Link>
              <span className="mx-2">·</span>
              <code className="text-xs">{park.slug}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedAt && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 inline-flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Saved at {savedAt}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Identity card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-text mb-4">Identity</h2>
            <div className="flex flex-col gap-3">
              <Field label="Name">
                <input
                  type="text"
                  value={park.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
                />
              </Field>
              <Field label="Address">
                <input
                  type="text"
                  value={park.address ?? ''}
                  onChange={(e) => update('address', e.target.value || null)}
                  placeholder="Street address"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <input
                    type="text"
                    value={park.city}
                    onChange={(e) => update('city', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
                  />
                </Field>
                <Field label="ZIP">
                  <input
                    type="text"
                    value={park.zip ?? ''}
                    onChange={(e) => update('zip', e.target.value || null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <input
                    type="number"
                    step="any"
                    value={park.latitude ?? ''}
                    onChange={(e) =>
                      update('latitude', e.target.value === '' ? null : parseFloat(e.target.value))
                    }
                    placeholder="33.9425"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:border-primary focus:outline-none"
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    type="number"
                    step="any"
                    value={park.longitude ?? ''}
                    onChange={(e) =>
                      update('longitude', e.target.value === '' ? null : parseFloat(e.target.value))
                    }
                    placeholder="-117.2297"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:border-primary focus:outline-none"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <input
                    type="tel"
                    value={park.phone ?? ''}
                    onChange={(e) => update('phone', e.target.value || null)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
                  />
                </Field>
                <Field label="Website">
                  <input
                    type="url"
                    value={park.website ?? ''}
                    onChange={(e) => update('website', e.target.value || null)}
                    placeholder="https://…"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Editorial card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-text mb-4">Editorial</h2>
            <div className="flex flex-col gap-3">
              <Field label={`Blurb (${(park.blurb ?? '').length}/280)`}>
                <textarea
                  value={park.blurb ?? ''}
                  onChange={(e) => update('blurb', e.target.value.slice(0, 280) || null)}
                  rows={2}
                  placeholder="One or two sentences — shown on cards."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none resize-y"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={park.description ?? ''}
                  onChange={(e) => update('description', e.target.value || null)}
                  rows={5}
                  placeholder="Long-form description for the detail page."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none resize-y"
                />
              </Field>
            </div>
          </section>

          {/* FAQs card — Schema.org FAQPage + visible <details> on the
              public detail page. Add up to 20 Q/A pairs that are worth
              surfacing (unique-to-this-park info that isn't in the
              description). */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-text">FAQs ({(park.faqsJson ?? []).length})</h2>
              <button
                type="button"
                onClick={() => setFaqs((cur) => [...cur, { q: '', a: '' }])}
                disabled={(park.faqsJson ?? []).length >= 20}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold disabled:opacity-40"
              >
                + Add FAQ
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Rendered as collapsible entries on the detail page + a Schema.org
              FAQPage block in the page metadata for SEO rich results.
            </p>
            {(park.faqsJson ?? []).length === 0 ? (
              <div className="text-xs text-text-secondary text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                No FAQs yet. Click "Add FAQ" to add one.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(park.faqsJson ?? []).map((f, i) => (
                  <div
                    key={`faq-edit-${i}`}
                    className="rounded-lg border border-slate-200 p-3 flex flex-col gap-2 bg-background/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                        FAQ #{i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFaqs((cur) => cur.filter((_, j) => j !== i))
                        }
                        className="text-xs text-red-600 hover:underline font-semibold"
                        aria-label={`Remove FAQ ${i + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                    <Field label={`Question (${f.q.length}/280)`}>
                      <input
                        type="text"
                        value={f.q}
                        onChange={(e) =>
                          setFaqs((cur) =>
                            cur.map((row, j) =>
                              j === i ? { ...row, q: e.target.value.slice(0, 280) } : row,
                            ),
                          )
                        }
                        placeholder="e.g. Where is the pump track inside the park?"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none"
                      />
                    </Field>
                    <Field label={`Answer (${f.a.length}/2000)`}>
                      <textarea
                        value={f.a}
                        onChange={(e) =>
                          setFaqs((cur) =>
                            cur.map((row, j) =>
                              j === i ? { ...row, a: e.target.value.slice(0, 2000) } : row,
                            ),
                          )
                        }
                        rows={3}
                        placeholder="Short, factual answer."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-primary focus:outline-none resize-y"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Amenities card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-text mb-1">Amenities</h2>
            <p className="text-xs text-text-secondary mb-4">
              {park.amenities.length} selected · shown as filter chips on the public page
            </p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = park.amenities.includes(a.slug)
                return (
                  <button
                    key={a.slug}
                    type="button"
                    onClick={() => toggleAmenity(a.slug)}
                    className={
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ' +
                      (on
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-text-secondary hover:bg-slate-200')
                    }
                  >
                    {on ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3 opacity-40" />}
                    {a.label}
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Status card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-text mb-4">Status</h2>
            <div className="flex flex-col gap-3">
              <label className="inline-flex items-center justify-between cursor-pointer">
                <span className="text-sm">Active (visible on /parks)</span>
                <input
                  type="checkbox"
                  checked={park.isActive}
                  onChange={(e) => update('isActive', e.target.checked)}
                  className="rounded border-slate-300"
                />
              </label>
              <label className="inline-flex items-center justify-between cursor-pointer">
                <span className="text-sm">Featured</span>
                <input
                  type="checkbox"
                  checked={park.featured}
                  onChange={(e) => update('featured', e.target.checked)}
                  className="rounded border-slate-300"
                />
              </label>
            </div>
          </section>

          {/* Google card (read-only summary) */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-text mb-2">Google</h2>
            {park.googleRating != null ? (
              <div className="text-sm">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{park.googleRating.toFixed(1)}</span>
                  <span className="text-text-secondary">({park.googleReviewCount ?? 0} reviews)</span>
                </div>
                {park.googlePlaceId && (
                  <div className="mt-2 text-xs text-text-secondary font-mono break-all">
                    {park.googlePlaceId}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-secondary">Not yet enriched from Google Places.</p>
            )}
          </section>

          {/* Photos card */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-text">Photos ({park.photoUrls.length})</h2>
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer">
                <Upload className="w-3 h-3" />
                {uploading ? 'Uploading…' : 'Upload'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadPhoto(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            {park.photoUrls.length === 0 ? (
              <div className="text-xs text-text-secondary text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                <ImagePlus className="w-6 h-6 mx-auto mb-1 opacity-50" />
                No photos yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {park.photoUrls.map((url) => {
                  const isHero = url === park.heroPhotoUrl
                  return (
                    <div
                      key={url}
                      className={
                        'relative aspect-square rounded-lg overflow-hidden border-2 ' +
                        (isHero ? 'border-primary' : 'border-slate-200')
                      }
                    >
                      <Image
                        src={url}
                        alt=""
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                      {isHero && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-primary text-white text-[10px] font-bold uppercase tracking-wide">
                          Hero
                        </span>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-1 bg-gradient-to-t from-black/60 to-transparent">
                        {!isHero && (
                          <button
                            type="button"
                            onClick={() => setHero(url)}
                            className="px-1.5 py-0.5 rounded bg-white/90 hover:bg-white text-[10px] font-bold"
                          >
                            Set hero
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePhoto(url)}
                          className="p-1 rounded bg-white/90 hover:bg-red-50 text-red-600"
                          aria-label="Delete photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-text-secondary mb-1">{label}</span>
      {children}
    </label>
  )
}
