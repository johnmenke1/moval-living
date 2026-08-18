'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  ImagePlus,
  X,
  ExternalLink,
  Search,
} from 'lucide-react'

// Event field enum values come from Prisma schema. Keep in sync with
// prisma/schema.prisma (EventCategory, VenueTag, EventTier).
export const EVENT_CATEGORIES = [
  // SPORTS was split in 2026-08 so residents can filter to their level.
  'HS_SPORTS',
  'COLLEGE_SPORTS',
  'LEAGUE_SPORTS',
  'POLITICAL',
  'MUSIC',
  'ARTS',
  'EDUCATIONAL',
  'FUNDRAISERS',
  'COMMUNITY',
  'FAMILY',
  'FOOD_DRINK',
  'HOLIDAY_CELEBRATIONS',
] as const

export const VENUE_TAGS = [
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

export const EVENT_TIERS = ['STANDARD', 'HONORABLE_MENTION', 'HERO'] as const

export interface Event {
  id: string
  slug: string
  // Shareable tickets URL slug — when set, /tickets/<ticketsSlug> renders a
  // public event detail page. Null = no shareable URL.
  ticketsSlug: string | null
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  venueName: string | null
  venueTag: string
  category: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  heroImageUrl: string | null
  ticketUrl: string | null
  isFree: boolean
  // Spanish-language flag. Mirrors Business.seHablaEspanol. When true, the
  // event is primarily delivered in Spanish (or bilingual).
  esEnEspanol: boolean
  tier: string
  source: string
  sourceUrl: string | null
  createdAt: string
  updatedAt: string
  // Optional link to a Business listing. When null, the event is standalone.
  businessId: string | null
  business: { id: string; name: string; slug: string } | null
}

// Convert ISO datetime → the value expected by <input type="datetime-local">.
// datetime-local renders in the user's local timezone; we send ISO back on save.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const tzOffset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

export interface LinkableBusiness {
  id: string
  name: string
  slug: string
  tagline: string | null
  address: string
  city: string
}

export default function EditEventClient({ event }: { event: Event }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [form, setForm] = useState({
    title: event.title,
    description: event.description ?? '',
    startsAt: isoToLocalInput(event.startsAt),
    endsAt: event.endsAt ? isoToLocalInput(event.endsAt) : '',
    isFree: event.isFree,
    esEnEspanol: event.esEnEspanol,
    ticketUrl: event.ticketUrl ?? '',
    tier: event.tier,
    ticketsSlug: event.ticketsSlug ?? '',
    venueName: event.venueName ?? '',
    venueTag: event.venueTag,
    category: event.category ?? '',
    address: event.address ?? '',
    city: event.city ?? '',
    state: event.state ?? '',
    zip: event.zip ?? '',
  })

  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(event.heroImageUrl)

  // Tickets-slug live uniqueness check. status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  // The input also surfaces a help preview URL when a valid slug is typed.
  const [slugCheck, setSlugCheck] = useState<
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'available' }
    | { status: 'taken'; byTitle: string }
    | { status: 'invalid'; reason: string }
  >({ status: 'idle' })

  // Linked business — search-as-you-type picker
  const [selectedBusiness, setSelectedBusiness] = useState<LinkableBusiness | null>(
    event.business
      ? { id: event.business.id, name: event.business.name, slug: event.business.slug, tagline: null, address: '', city: '' }
      : null
  )
  const [bizQuery, setBizQuery] = useState('')
  const [bizResults, setBizResults] = useState<LinkableBusiness[]>([])
  const [bizSearching, setBizSearching] = useState(false)
  const [showBizResults, setShowBizResults] = useState(false)

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
    if (field in fieldErrors) {
      setFieldErrors((prev) => {
        const n = { ...prev }
        delete n[field]
        return n
      })
    }
  }

  const fieldError = (key: string) => fieldErrors[key]
  const errClass = (key: string) =>
    fieldError(key) ? 'border-red-500 ring-1 ring-red-200' : ''

  const handleHeroUpload = async (file: File) => {
    setUploadError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('eventId', event.id)
      const res = await fetch('/api/admin/events/upload-hero', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      setHeroImageUrl(data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleClearHero = () => {
    setHeroImageUrl(null)
    setSaved(false)
  }

  // Debounced business search — uses the existing admin search endpoint.
  // Only fires when the query is at least 2 chars to avoid hammering the API.
  const handleBusinessSearch = async (q: string) => {
    setBizQuery(q)
    if (q.trim().length < 2) {
      setBizResults([])
      setShowBizResults(false)
      return
    }
    setBizSearching(true)
    try {
      const res = await fetch(`/api/admin/businesses/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Search failed')
      setBizResults(data.businesses ?? [])
      setShowBizResults(true)
    } catch (err) {
      setBizResults([])
      setShowBizResults(false)
    } finally {
      setBizSearching(false)
    }
  }

  // Live uniqueness check for ticketsSlug. Debounced 400ms; skipped when
  // empty, when unchanged from the initial value, or when the format is
  // invalid (server also validates on save, but a fast client check
  // surfaces typos before the user clicks Save).
  useEffect(() => {
    const slug = form.ticketsSlug.trim()
    if (!slug) {
      setSlugCheck({ status: 'idle' })
      return
    }
    if (slug === (event.ticketsSlug ?? '')) {
      // Unchanged — no need to check; this is always available to the current event.
      setSlugCheck({ status: 'available' })
      return
    }
    // Format check mirrors server Zod regex.
    const formatOk = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
    if (!formatOk) {
      setSlugCheck({
        status: 'invalid',
        reason: 'Lowercase letters, digits, and hyphens only. Cannot start or end with a hyphen.',
      })
      return
    }
    setSlugCheck({ status: 'checking' })
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/events/check-tickets-slug?slug=${encodeURIComponent(slug)}&excludeId=${event.id}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Check failed')
        if (data.available) {
          setSlugCheck({ status: 'available' })
        } else {
          setSlugCheck({ status: 'taken', byTitle: data.usedByTitle ?? 'another event' })
        }
      } catch (err) {
        setSlugCheck({
          status: 'invalid',
          reason: err instanceof Error ? err.message : 'Could not check slug',
        })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form.ticketsSlug, event.id, event.ticketsSlug])

  const handlePickBusiness = (b: LinkableBusiness) => {
    setSelectedBusiness(b)
    setBizQuery('')
    setBizResults([])
    setShowBizResults(false)
    setSaved(false)
  }

  const handleClearBusiness = () => {
    setSelectedBusiness(null)
    setBizQuery('')
    setBizResults([])
    setShowBizResults(false)
    setSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      isFree: form.isFree,
      esEnEspanol: form.esEnEspanol,
      ticketUrl: form.ticketUrl.trim() || null,
      tier: form.tier,
      ticketsSlug: form.ticketsSlug.trim() || null,
      venueName: form.venueName.trim() || null,
      venueTag: form.venueTag,
      category: form.category || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      heroImageUrl: heroImageUrl,
      businessId: selectedBusiness?.id ?? null,
    }

    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.fields) setFieldErrors(data.fields)
        throw new Error(data?.error || 'Save failed')
      }
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container-max py-8">
        <Link
          href="/dashboard?tab=events-admin"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Events
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text mb-1">Edit Event</h1>
          <p className="text-text-secondary">
            <code className="px-1.5 py-0.5 rounded bg-slate-100 text-xs font-mono text-text-secondary">
              {event.slug}
            </code>
            <span className="mx-2 text-slate-300">·</span>
            <span className="text-xs">
              last updated {new Date(event.updatedAt).toLocaleString()}
            </span>
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saved && (
          <div className="flex items-start gap-2 p-4 mb-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Saved ✓</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SLUG — /tickets/[slug] shareable path */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-text mb-1">Tickets Slug</h2>
            <p className="text-xs text-text-secondary mb-4">
              The path fragment for this event's shareable URL on moval.living — <strong>not</strong> the full ticket-purchase URL.
              Use lowercase letters, digits, and hyphens only (e.g.{' '}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-[11px] font-mono">teen-silent-summer-bash</code>
              {' '}gives you{' '}
              <code className="px-1 py-0.5 rounded bg-slate-100 text-[11px] font-mono">moval.living/tickets/teen-silent-summer-bash</code>).
              For the actual Eventbrite / vendor URL, use the <strong>Ticket URL</strong> field above. Leave blank to keep the original source URL as the primary link.
            </p>
            <div className="space-y-2">
              <div className="flex items-stretch gap-2">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-text-secondary text-sm font-mono">
                  moval.living/tickets/
                </span>
                <input
                  type="text"
                  value={form.ticketsSlug}
                  onChange={(e) => update('ticketsSlug', e.target.value.toLowerCase())}
                  placeholder="teen-silent-summer-bash"
                  className={`flex-1 px-3 py-2 rounded-r-lg border border-slate-200 text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errClass('ticketsSlug')}`}
                />
              </div>
              {(() => {
                const s = slugCheck
                if (s.status === 'idle' && !form.ticketsSlug.trim()) {
                  return <p className="text-xs text-text-secondary">Leave blank to keep the original source URL as the primary link.</p>
                }
                if (s.status === 'checking') {
                  return <p className="text-xs text-text-secondary">Checking availability…</p>
                }
                if (s.status === 'invalid') {
                  return <p className="text-xs text-red-600">{s.reason}</p>
                }
                if (s.status === 'taken') {
                  return <p className="text-xs text-red-600">Taken — already used by &ldquo;{s.byTitle}&rdquo;.</p>
                }
                if (s.status === 'available' && form.ticketsSlug.trim()) {
                  return (
                    <p className="text-xs text-green-700">
                      ✓ Available — public URL will be{' '}
                      <a
                        href={`https://moval.living/tickets/${form.ticketsSlug.trim()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono underline hover:no-underline"
                      >
                        /tickets/{form.ticketsSlug.trim()}
                      </a>
                    </p>
                  )
                }
                return null
              })()}
              {fieldError('ticketsSlug') && (
                <p className="text-xs text-red-600 mt-1">{fieldError('ticketsSlug')}</p>
              )}
            </div>
          </section>

          {/* CORE */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-text mb-4">Core</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errClass('title')}`}
                  required
                />
                {fieldError('title') && (
                  <p className="text-xs text-red-600 mt-1">{fieldError('title')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    Starts at
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => update('startsAt', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errClass('startsAt')}`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    Ends at <span className="text-text-secondary font-normal">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => update('endsAt', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errClass('endsAt')}`}
                  />
                  {fieldError('endsAt') && (
                    <p className="text-xs text-red-600 mt-1">{fieldError('endsAt')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    Ticket URL <span className="text-text-secondary font-normal">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.ticketUrl}
                    onChange={(e) => update('ticketUrl', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errClass('ticketUrl')}`}
                  />
                  {fieldError('ticketUrl') && (
                    <p className="text-xs text-red-600 mt-1">{fieldError('ticketUrl')}</p>
                  )}
                </div>
                <div className="flex items-center pt-6 flex-wrap gap-x-6 gap-y-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isFree}
                      onChange={(e) => update('isFree', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    Free event
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.esEnEspanol}
                      onChange={(e) => update('esEnEspanol', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    En Espa&ntilde;ol
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* TIER */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-text mb-1">Tier</h2>
            <p className="text-xs text-text-secondary mb-4">
              HERO cards occupy the top of the public events page. Change with care.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {EVENT_TIERS.map((t) => (
                <label
                  key={t}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    form.tier === t
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={t}
                    checked={form.tier === t}
                    onChange={() => update('tier', t)}
                    className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-semibold text-text text-sm">
                      {t === 'HERO' ? '⭐ Hero' : t === 'HONORABLE_MENTION' ? 'Honorable Mention' : 'Standard'}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {t === 'HERO'
                        ? 'Top of the page, large card'
                        : t === 'HONORABLE_MENTION'
                          ? 'Highlighted in the listing'
                          : 'Standard listing'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* VENUE / LOCATION */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-text mb-4">Venue & Location</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    Venue name
                  </label>
                  <input
                    type="text"
                    value={form.venueName}
                    onChange={(e) => update('venueName', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Moreno Valley High School Gym"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    Venue tag
                  </label>
                  <select
                    value={form.venueTag}
                    onChange={(e) => update('venueTag', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {VENUE_TAGS.map((v) => (
                      <option key={v} value={v}>
                        {v.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">— None —</option>
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                <div className="col-span-3 md:col-span-3">
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-1 md:col-span-1">
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    maxLength={2}
                    onChange={(e) => update('state', e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errClass('state')}`}
                  />
                </div>
                <div className="col-span-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-text mb-1.5">
                    ZIP
                  </label>
                  <input
                    type="text"
                    value={form.zip}
                    onChange={(e) => update('zip', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${errClass('zip')}`}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* LINKED BUSINESS */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-text mb-1">Linked Business</h2>
            <p className="text-xs text-text-secondary mb-4">
              Link this event to a local Business listing. When set, the venue name on the public event card becomes a click-through to the business profile.
            </p>

            {selectedBusiness ? (
              <div className="flex items-center justify-between p-4 rounded-lg border border-primary/30 bg-primary/5">
                <div>
                  <p className="font-semibold text-text">{selectedBusiness.name}</p>
                  <p className="text-xs text-text-secondary">
                    <a href={`/business/${selectedBusiness.slug}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      /business/{selectedBusiness.slug}
                    </a>
                    {selectedBusiness.tagline && ` · ${selectedBusiness.tagline}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearBusiness}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-text text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <X className="w-4 h-4" /> Unlink
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={bizQuery}
                  onChange={(e) => handleBusinessSearch(e.target.value)}
                  onFocus={() => bizResults.length > 0 && setShowBizResults(true)}
                  placeholder="Search businesses by name…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {bizSearching && (
                  <p className="text-xs text-text-secondary mt-1">Searching…</p>
                )}
                {showBizResults && bizResults.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {bizResults.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => handlePickBusiness(b)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                        >
                          <p className="font-semibold text-text text-sm">{b.name}</p>
                          <p className="text-xs text-text-secondary">{b.address}, {b.city}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {showBizResults && !bizSearching && bizResults.length === 0 && bizQuery.length >= 2 && (
                  <p className="text-xs text-text-secondary mt-2">No approved businesses match &ldquo;{bizQuery}&rdquo;.</p>
                )}
              </div>
            )}
          </section>

          {/* MEDIA */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-text mb-4">Hero Image</h2>
            {uploadError && (
              <div className="flex items-start gap-2 p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                {heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroImageUrl}
                    alt="Hero"
                    className="w-40 h-40 rounded-lg object-cover bg-slate-100"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-lg bg-slate-100 flex items-center justify-center text-text-secondary text-xs">
                    No image
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 cursor-pointer transition-colors">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4" />
                  )}
                  {uploading ? 'Uploading…' : 'Upload new image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleHeroUpload(file)
                      e.target.value = ''
                    }}
                  />
                </label>
                {heroImageUrl && (
                  <button
                    type="button"
                    onClick={handleClearHero}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-text text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    <X className="w-4 h-4" /> Remove image
                  </button>
                )}
                <p className="text-xs text-text-secondary">
                  JPEG / PNG / WEBP / GIF. Max 10MB. Stored on Vercel Blob.
                </p>
              </div>
            </div>
          </section>

          {/* READ-ONLY META */}
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-text mb-4">Source (read-only)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Source platform
                </p>
                <p className="text-text">{event.source}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Original URL
                </p>
                {event.sourceUrl ? (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                  >
                    {event.sourceUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <p className="text-text-secondary">—</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Created
                </p>
                <p className="text-text">{new Date(event.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Last updated
                </p>
                <p className="text-text">{new Date(event.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </section>

          {/* ACTIONS */}
          <div className="sticky bottom-0 bg-slate-50/80 backdrop-blur border-t border-slate-200 -mx-4 px-4 py-4 flex items-center gap-3">
            <Link
              href="/dashboard?tab=events-admin"
              className="px-5 py-2 rounded-lg bg-white border border-slate-200 text-text text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && !saving && (
              <span className="inline-flex items-center gap-1 text-green-700 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
