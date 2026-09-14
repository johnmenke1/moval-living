'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Loader2, AlertCircle, Save } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
}

interface Props {
  categories: Category[]
}

// Maps Zod field names to human-readable labels for the validation
// toast on field errors. Mirrors the FIELD_LABELS pattern in
// EditBusinessClient so the dashboard feels consistent.
const FIELD_LABELS: Record<string, string> = {
  name: 'business name',
  slug: 'URL slug',
  categoryId: 'category',
  description: 'description',
  address: 'street address',
  city: 'city',
  state: 'state',
  zip: 'ZIP code',
  phone: 'phone',
  email: 'email',
  website: 'website',
  facebook: 'Facebook URL',
  instagram: 'Instagram URL',
  yelp: 'Yelp URL',
  hours: 'hours',
  logo: 'logo',
  coverImage: 'cover image',
  googleBusiness: 'Google Place ID',
  latitude: 'latitude',
  longitude: 'longitude',
  tagline: 'tagline',
  expertPartnerSlug: 'Expert Partner URL slug',
}

const DEFAULT_HOURS: Record<string, { open: string; close: string; closed: boolean }> = {
  mon: { open: '9:00 AM', close: '5:00 PM', closed: false },
  tue: { open: '9:00 AM', close: '5:00 PM', closed: false },
  wed: { open: '9:00 AM', close: '5:00 PM', closed: false },
  thu: { open: '9:00 AM', close: '5:00 PM', closed: false },
  fri: { open: '9:00 AM', close: '5:00 PM', closed: false },
  sat: { open: '9:00 AM', close: '5:00 PM', closed: false },
  sun: { open: '9:00 AM', close: '5:00 PM', closed: true },
}

const dayLabels: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

// Convert a display string like "9:00 AM" to a Date in HH:MM (24h) —
// only used for the lat/lng numeric inputs. The hours grid keeps the
// human format for editing.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

export default function ManualAddBusinessClient({ categories }: Props) {
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    slug: '',
    categoryId: categories[0]?.id ?? '',
    tagline: '',
    description: '',
    address: '',
    city: 'Moreno Valley',
    state: 'CA',
    zip: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    website: '',
    facebook: '',
    instagram: '',
    yelp: '',
    status: 'APPROVED' as 'PENDING' | 'APPROVED' | 'REJECTED',
    tier: 'FREE' as 'FREE' | 'FEATURED' | 'EXPERT_PARTNER',
    isExpertPartner: false,
    expertPartnerSlug: '',
    seHablaEspanol: false,
    chamberMember: false,
    hispanicChamberMember: false,
    googleBusiness: '',
  })

  const [hoursJson, setHoursJson] = useState(JSON.stringify(DEFAULT_HOURS))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Image upload — same shape as EditBusinessClient's logo/cover
  // handlers. We can't actually upload until the business exists, so
  // the upload happens in TWO phases:
  //   1. Upload the file to /api/upload with type=logo|cover BEFORE
  //      submitting the form. The blob path is businesses/{tempId}/...
  //      — but we don't have a businessId yet, so we use a sentinel.
  //      Wait — /api/upload REQUIRES a businessId. So image upload
  //      for a brand-new business needs a different path.
  //
  // Simpler: send a multipart/form-data POST with type=logo|cover
  // and a synthetic businessId like "manual-{nanoid(6)}" — the
  // server only checks auth, it doesn't verify the business exists.
  // Actually re-reading /api/upload/route.ts: it does `findUnique`
  // on businessId and returns 404 if missing. So we DO need to create
  // the business first.
  //
  // Resolution: skip image upload at create time and let admin add
  // images via /dashboard/edit?id=... after creation. The form
  // surfaces a note that explains this.
  //
  // (If you ever want inline image upload at creation, the right move
  // is a separate /api/admin/upload that takes a "pending" flag and
  // doesn't require businessId. Not in scope here.)

  const update = (field: string, value: string | boolean) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-derive slug from name when slug hasn't been manually edited
      // (or when name changes AND slug matches the previous derivation).
      if (field === 'name') {
        const derived = slugify(String(value))
        if (prev.slug === '' || prev.slug === slugify(prev.name)) {
          next.slug = derived
        }
      }
      return next
    })
    setSaved(false)
    if (field in fieldErrors) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n })
    }
  }

  const fieldError = (key: string) => fieldErrors[key]
  const errClass = (key: string) =>
    fieldError(key) ? 'border-red-500 ring-1 ring-red-200' : ''

  // Coerce JSON safely — same pattern EditBusinessClient uses.
  function normalizeHours(input: unknown): Record<string, { open: string; close: string; closed: boolean }> {
    const out: Record<string, { open: string; close: string; closed: boolean }> = {}
    for (const day of Object.keys(DEFAULT_HOURS)) {
      const v = (input && typeof input === 'object' ? (input as Record<string, unknown>)[day] : null) as { open?: unknown; close?: unknown; closed?: unknown } | null
      out[day] = {
        open: typeof v?.open === 'string' ? v.open : DEFAULT_HOURS[day].open,
        close: typeof v?.close === 'string' ? v.close : DEFAULT_HOURS[day].close,
        closed: typeof v?.closed === 'boolean' ? v.closed : DEFAULT_HOURS[day].closed,
      }
    }
    return out
  }

  const hours = normalizeHours(JSON.parse(hoursJson))
  const updateHours = (day: string, field: string, value: string | boolean) => {
    const updated = JSON.parse(hoursJson)
    updated[day] = { ...updated[day], [field]: value }
    setHoursJson(JSON.stringify(updated))
    setSaved(false)
  }

  // Image upload — same shape as EditBusinessClient's logo/cover
  // handlers. We can't actually upload until the business exists, so
  // the upload happens in TWO phases:
  //   1. Upload the file to /api/upload with type=logo|cover BEFORE
  //      submitting the form. The blob path is businesses/{tempId}/...
  //      — but we don't have a businessId yet, so we use a sentinel.
  //      Wait — /api/upload REQUIRES a businessId. So image upload
  //      for a brand-new business needs a different path.
  //
  // Simpler: send a multipart/form-data POST with type=logo|cover
  // and a synthetic businessId like "manual-{nanoid(6)}" — the
  // server only checks auth, it doesn't verify the business exists.
  // Actually re-reading /api/upload/route.ts: it does `findUnique`
  // on businessId and returns 404 if missing. So we DO need to create
  // the business first.
  //
  // Resolution: skip image upload at create time and let admin add
  // images via /dashboard/edit?id=... after creation. The form
  // surfaces a note that explains this.
  //
  // (If you ever want inline image upload at creation, the right move
  // is a separate /api/admin/upload that takes a "pending" flag and
  // doesn't require businessId. Not in scope here.)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})

    const hours = JSON.parse(hoursJson)

    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      categoryId: form.categoryId,
      tagline: form.tagline || null,
      description: form.description,
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      facebook: form.facebook || null,
      instagram: form.instagram || null,
      yelp: form.yelp || null,
      hours,
      status: form.status,
      tier: form.tier,
      isExpertPartner: form.isExpertPartner,
      expertPartnerSlug: form.expertPartnerSlug || null,
      seHablaEspanol: form.seHablaEspanol,
      chamberMember: form.chamberMember,
      hispanicChamberMember: form.hispanicChamberMember,
      googleBusiness: form.googleBusiness || null,
    }

    try {
      const res = await fetch('/api/admin/businesses/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.fields) {
          setFieldErrors(data.fields)
          const firstField = Object.keys(data.fields)[0]
          const fieldLabel = firstField ? FIELD_LABELS[firstField] || firstField : null
          setError(
            fieldLabel
              ? `Please fix the ${fieldLabel} field.`
              : 'Please fix the highlighted fields.'
          )
        } else {
          throw new Error(data.error || 'Failed to create business')
        }
        return
      }

      const data = await res.json()
      setSaved(true)
      // Redirect to the new business page so the admin sees their
      // creation live. router.push then router.refresh to make sure
      // server components pick up the new row.
      router.push(`/business/${data.business.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-error/10 border border-error/20 text-error text-sm p-4 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-4 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Business created — taking you to the live listing.
        </div>
      )}

      {/* Lifecycle controls — status + tier + Expert Partner. These
          are admin-only toggles so they sit at the top where they're
          impossible to miss. */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
        <h2 className="text-lg font-bold text-text mb-5">Listing Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as 'PENDING' | 'APPROVED' | 'REJECTED')}
              className="input"
            >
              <option value="APPROVED">APPROVED — visible publicly</option>
              <option value="PENDING">PENDING — hidden until reviewed</option>
              <option value="REJECTED">REJECTED — hidden</option>
            </select>
            <p className="text-xs text-text-secondary mt-1">Default APPROVED matches the Google import path.</p>
          </div>
          <div>
            <label className="label block mb-1.5">Tier</label>
            <select
              value={form.tier}
              onChange={(e) => update('tier', e.target.value as 'FREE' | 'FEATURED' | 'EXPERT_PARTNER')}
              className="input"
            >
              <option value="FREE">FREE</option>
              <option value="FEATURED">FEATURED</option>
              <option value="EXPERT_PARTNER">EXPERT_PARTNER</option>
            </select>
            <p className="text-xs text-text-secondary mt-1">Visual treatment + filters.</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isExpertPartner}
              onChange={(e) => update('isExpertPartner', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>Mark as Expert Partner</span>
          </label>
          {form.isExpertPartner && (
            <div className="pl-6">
              <label className="label block mb-1.5">Expert Partner URL slug</label>
              <input
                type="text"
                maxLength={120}
                value={form.expertPartnerSlug}
                onChange={(e) => update('expertPartnerSlug', e.target.value)}
                className={`input ${errClass('expertPartnerSlug')}`}
                placeholder="acme-plumbing"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.seHablaEspanol}
              onChange={(e) => update('seHablaEspanol', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>Se habla español</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.chamberMember}
              onChange={(e) => update('chamberMember', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>Moreno Valley Chamber member</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hispanicChamberMember}
              onChange={(e) => update('hispanicChamberMember', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>Hispanic Chamber member</span>
          </label>
        </div>
      </div>

      {/* Basics */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 space-y-4">
        <h2 className="text-lg font-bold text-text">Basics</h2>
        <div>
          <label className="label block mb-1.5">Business Name</label>
          <input
            type="text"
            required
            maxLength={160}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className={`input ${errClass('name')}`}
            placeholder="Acme Plumbing"
          />
          {fieldError('name') && <p className="text-xs text-error mt-1">{fieldError('name')}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">URL Slug (optional)</label>
            <input
              type="text"
              maxLength={160}
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              className={`input font-mono text-sm ${errClass('slug')}`}
              placeholder="acme-plumbing"
            />
            <p className="text-xs text-text-secondary mt-1">
              Auto-derived from name. Edit to customize. A random 6-char suffix is appended to avoid collisions.
            </p>
            {fieldError('slug') && <p className="text-xs text-error mt-1">{fieldError('slug')}</p>}
          </div>
          <div>
            <label className="label block mb-1.5">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => update('categoryId', e.target.value)}
              className={`input ${errClass('categoryId')}`}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldError('categoryId') && <p className="text-xs text-error mt-1">{fieldError('categoryId')}</p>}
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Tagline (optional)</label>
          <input
            type="text"
            maxLength={240}
            value={form.tagline}
            onChange={(e) => update('tagline', e.target.value)}
            className={`input ${errClass('tagline')}`}
            placeholder="24/7 emergency plumbing in Moreno Valley"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Description</label>
          <textarea
            required
            rows={4}
            minLength={10}
            maxLength={2000}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className={`input resize-none ${errClass('description')}`}
            placeholder="2-3 sentences about the business, what they offer, and why locals choose them."
          />
          <p className="text-xs text-text-secondary mt-1">Minimum 10 characters.</p>
          {fieldError('description') && <p className="text-xs text-error mt-1">{fieldError('description')}</p>}
        </div>
      </div>

      {/* Location */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 space-y-4">
        <h2 className="text-lg font-bold text-text">Location</h2>
        <div>
          <label className="label block mb-1.5">Street Address</label>
          <input
            type="text"
            required
            maxLength={240}
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            className={`input ${errClass('address')}`}
            placeholder="12345 Main St"
          />
          {fieldError('address') && <p className="text-xs text-error mt-1">{fieldError('address')}</p>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="label block mb-1.5">City</label>
            <input
              type="text"
              required
              maxLength={120}
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className={`input ${errClass('city')}`}
            />
          </div>
          <div>
            <label className="label block mb-1.5">State</label>
            <input
              type="text"
              required
              maxLength={2}
              value={form.state}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
              className={`input uppercase ${errClass('state')}`}
              placeholder="CA"
            />
          </div>
          <div>
            <label className="label block mb-1.5">ZIP</label>
            <input
              type="text"
              maxLength={10}
              value={form.zip}
              onChange={(e) => update('zip', e.target.value)}
              className={`input ${errClass('zip')}`}
              placeholder="92553"
            />
            {fieldError('zip') && <p className="text-xs text-error mt-1">{fieldError('zip')}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Latitude (optional)</label>
            <input
              type="text"
              value={form.latitude}
              onChange={(e) => update('latitude', e.target.value)}
              className={`input ${errClass('latitude')}`}
              placeholder="33.9425"
            />
            <p className="text-xs text-text-secondary mt-1">Paste from Google Maps.</p>
          </div>
          <div>
            <label className="label block mb-1.5">Longitude (optional)</label>
            <input
              type="text"
              value={form.longitude}
              onChange={(e) => update('longitude', e.target.value)}
              className={`input ${errClass('longitude')}`}
              placeholder="-117.2296"
            />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 space-y-4">
        <h2 className="text-lg font-bold text-text">Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Phone</label>
            <input
              type="tel"
              maxLength={50}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={`input ${errClass('phone')}`}
              placeholder="(951) 555-1234"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Email</label>
            <input
              type="email"
              maxLength={320}
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className={`input ${errClass('email')}`}
              placeholder="hello@acmeplumbing.com"
            />
            {fieldError('email') && <p className="text-xs text-error mt-1">{fieldError('email')}</p>}
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Website</label>
          <input
            type="url"
            maxLength={500}
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
            className={`input ${errClass('website')}`}
            placeholder="https://acmeplumbing.com"
          />
          {fieldError('website') && <p className="text-xs text-error mt-1">{fieldError('website')}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label block mb-1.5">Facebook</label>
            <input
              type="url"
              maxLength={500}
              value={form.facebook}
              onChange={(e) => update('facebook', e.target.value)}
              className={`input ${errClass('facebook')}`}
              placeholder="https://facebook.com/acme"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Instagram</label>
            <input
              type="url"
              maxLength={500}
              value={form.instagram}
              onChange={(e) => update('instagram', e.target.value)}
              className={`input ${errClass('instagram')}`}
              placeholder="https://instagram.com/acme"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Yelp</label>
            <input
              type="url"
              maxLength={500}
              value={form.yelp}
              onChange={(e) => update('yelp', e.target.value)}
              className={`input ${errClass('yelp')}`}
              placeholder="https://yelp.com/biz/acme"
            />
          </div>
        </div>
      </div>

      {/* Hours — same 7-day grid EditBusinessClient uses, but with
          a "Use defaults" reset button so admin can wipe quickly. */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text">Hours</h2>
          <button
            type="button"
            onClick={() => setHoursJson(JSON.stringify(DEFAULT_HOURS))}
            className="text-xs text-text-secondary hover:text-primary"
          >
            Reset to defaults
          </button>
        </div>
        <div className="space-y-2">
          {Object.keys(DEFAULT_HOURS).map(day => (
            <div key={day} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3 sm:col-span-2 text-sm text-text-secondary">{dayLabels[day]}</div>
              <input
                type="text"
                value={hours[day].open}
                onChange={(e) => updateHours(day, 'open', e.target.value)}
                className="input col-span-3 sm:col-span-3 text-sm"
                placeholder="9:00 AM"
              />
              <input
                type="text"
                value={hours[day].close}
                onChange={(e) => updateHours(day, 'close', e.target.value)}
                className="input col-span-3 sm:col-span-3 text-sm"
                placeholder="5:00 PM"
              />
              <label className="col-span-3 sm:col-span-4 inline-flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={hours[day].closed}
                  onChange={(e) => updateHours(day, 'closed', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                Closed
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Google Place link — optional. If supplied, the server runs
          the same duplicate-check the import path uses. */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 space-y-3">
        <h2 className="text-lg font-bold text-text">Google Place (optional)</h2>
        <p className="text-sm text-text-secondary">
          If you&apos;re adding a business that&apos;s already on Google, paste its Google Place ID here. The form will refuse to create a duplicate.
        </p>
        <input
          type="text"
          maxLength={500}
          value={form.googleBusiness}
          onChange={(e) => update('googleBusiness', e.target.value)}
          className={`input font-mono text-sm ${errClass('googleBusiness')}`}
          placeholder="ChIJ..."
        />
        {fieldError('googleBusiness') && <p className="text-xs text-error mt-1">{fieldError('googleBusiness')}</p>}
      </div>

      {/* Image upload — see note in handleSubmit. We don't support
          inline upload at create-time because /api/upload requires
          an existing businessId. Admin adds images after creation
          via /dashboard/edit?id=... */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">About images</p>
        <p>
          Logo and cover image upload requires an existing business row. After creating the business, you&apos;ll be redirected to its live page — from there, click <strong>Edit Listing</strong> in the dashboard to upload images.
        </p>
      </div>

      <div className="flex items-center gap-3 sticky bottom-0 bg-slate-50 py-4 -mx-2 px-2 border-t border-slate-100">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Create business
        </button>
        <Link href="/dashboard" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
