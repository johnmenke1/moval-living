'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ChevronRight, ChevronLeft, Upload } from 'lucide-react'
import { categories as fallbackCategories, type Category } from '@/data/categories'
import GMBImporter from '@/components/forms/GMBImporter'

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

const steps = [
  { num: 1, label: 'Basics' },
  { num: 2, label: 'Location' },
  { num: 3, label: 'Contact' },
  { num: 4, label: 'Description' },
  { num: 5, label: 'Photos' },
  { num: 6, label: 'Deal' },
  { num: 7, label: 'Review' },
]

interface GMBPlace {
  placeId: string
  name: string
  address: string
  phone: string
  website: string
  type: string
  hours: Record<string, { open: string; close: string; closed: boolean }> | null
  photos: { name: string }[]
  location: { lat: number; lng: number } | null
}

export default function SubmitPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>(fallbackCategories)
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)

  // Pull the canonical category list from the DB on mount.
  // The static fallback list is only used until this resolves (typically <200ms).
  // Why: the DB uses CUIDs as primary keys, but the form sends slugs. The API
  // resolves either, but we still want the dropdown to show whatever the DB
  // actually has (single source of truth = prisma/seed.ts).
  useEffect(() => {
    let cancelled = false
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then((rows: Category[]) => {
        if (cancelled) return
        if (Array.isArray(rows) && rows.length > 0) setCategories(rows)
      })
      .catch(() => {/* keep fallbackCategories — show offline copy */})
      .finally(() => { if (!cancelled) setCategoriesLoaded(true) })
    return () => { cancelled = true }
  }, [])

  const [form, setForm] = useState({
    name: '',
    tagline: '',
    categoryId: '',
    address: '',
    city: 'Moreno Valley',
    state: 'CA',
    zip: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    facebook: '',
    instagram: '',
    yelp: '',
    hours: null as Record<string, { open: string; close: string; closed: boolean }> | null,
    latitude: null as number | null,
    longitude: null as number | null,
    hasCoupon: false,
    couponHeadline: '',
    couponDescription: '',
    couponCode: '',
    couponExpiresAt: '',
  })

  const update = (field: string, value: string | boolean | Record<string, unknown>) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleGMBImport = (place: GMBPlace) => {
    const parsed = parseAddress(place.address)
    setForm(prev => ({
      ...prev,
      name: place.name || prev.name,
      address: place.address || prev.address,
      phone: place.phone || prev.phone,
      website: place.website || prev.website,
      hours: place.hours || prev.hours,
      latitude: place.location?.lat || null,
      longitude: place.location?.lng || null,
      city: parsed.city !== prev.city ? parsed.city : prev.city,
      state: 'CA',
      zip: parsed.zip || prev.zip,
    }))
    setStep(1)
  }

  const parseAddress = (address: string) => {
    // Try to extract city, state, zip from a formatted US address
    // e.g. "123 Main St, Moreno Valley, CA 92553, USA"
    const parts = address.split(',').map(p => p.trim())
    let city = 'Moreno Valley'
    let state = 'CA'
    let zip = ''
    let street = address

    if (parts.length >= 2) {
      // Last part is usually "CA 92553, USA" or "CA 92553"
      const last = parts[parts.length - 1]
      const zipMatch = last.match(/\d{5}/)
      const stateMatch = last.match(/[A-Z]{2}/)
      if (zipMatch) zip = zipMatch[0]
      if (stateMatch) state = stateMatch[0]

      // Second-to-last might be the city
      if (parts.length >= 3) {
        city = parts[parts.length - 2].replace(/, USA$/, '').trim()
      }

      // First part is usually the street
      street = parts[0]
    }

    return { address: street, city, state, zip }
  }

  const canProceed = () => {
    if (step === 1) return form.name.trim() && form.categoryId
    if (step === 2) return form.address.trim() && form.zip.trim()
    if (step === 3) return form.email.trim() || form.phone.trim()
    if (step === 4) return form.description.trim().length >= 50
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hours: form.hours || undefined,
          latitude: form.latitude,
          longitude: form.longitude,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Submission failed')
      }
      const { slug, claimToken, name } = await res.json()
      router.push(`/submit/success?name=${encodeURIComponent(name)}&slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(claimToken)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <h1 className="text-3xl font-bold text-text mb-2">List Your Business</h1>
          <p className="text-text-secondary">Get your business in front of thousands of Moreno Valley residents — free.</p>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Steps — hidden on step 0 */}
          {step > 0 && (
            <div className="flex items-center justify-between mb-10">
              {steps.map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <div className={`flex flex-col items-center ${step >= s.num ? 'text-primary' : 'text-slate-300'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${step >= s.num ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-400 bg-white'}`}>
                      {step > s.num ? '✓' : s.num}
                    </div>
                    <span className="text-xs mt-1 hidden sm:block">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-8 sm:w-16 h-0.5 mx-1 ${step > s.num ? 'bg-primary' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            {error && (
              <div className="bg-error/10 border border-error/20 text-error text-sm p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            {/* Step 0: GMB Import */}
            {step === 0 && (
              <GMBImporter onSelect={handleGMBImport} onSkip={() => setStep(1)} />
            )}

            {/* Step 1: Basics */}
            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-text mb-4">Basic Information</h2>
                <div>
                  <label className="label">Business Name <span className="text-error">*</span></label>
                  <input value={form.name} onChange={e => update('name', e.target.value)} className="input" placeholder="Joe's Auto Repair" />
                </div>
                <div>
                  <label className="label">Tagline <span className="text-text-secondary font-normal">(optional)</span></label>
                  <input value={form.tagline} onChange={e => update('tagline', e.target.value)} className="input" placeholder="Your trusted auto care specialists" />
                </div>
                <div>
                  <label className="label">
                    Category <span className="text-error">*</span>
                    {!categoriesLoaded && (
                      <span className="ml-2 text-text-secondary font-normal text-xs">(loading latest…)</span>
                    )}
                  </label>
                  <select value={form.categoryId} onChange={e => update('categoryId', e.target.value)} className="input">
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-text mb-4">Business Location</h2>
                <div>
                  <label className="label">Street Address <span className="text-error">*</span></label>
                  <input value={form.address} onChange={e => update('address', e.target.value)} className="input" placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="label">City</label>
                    <input value={form.city} onChange={e => update('city', e.target.value)} className="input" readOnly={form.city === 'Moreno Valley'} />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input value={form.state} onChange={e => update('state', e.target.value)} className="input" readOnly />
                  </div>
                </div>
                <div>
                  <label className="label">ZIP Code <span className="text-error">*</span></label>
                  <input value={form.zip} onChange={e => update('zip', e.target.value)} className="input" placeholder="92553" />
                </div>
              </div>
            )}

            {/* Step 3: Contact */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-text mb-4">Contact Information</h2>
                <div>
                  <label className="label">Phone Number</label>
                  <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className="input" placeholder="(951) 555-0100" />
                </div>
                <div>
                  <label className="label">Email <span className="text-text-secondary font-normal">(public)</span></label>
                  <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="input" placeholder="contact@business.com" />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input value={form.website} onChange={e => update('website', e.target.value)} className="input" placeholder="https://yourbusiness.com" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Facebook URL</label>
                    <input value={form.facebook} onChange={e => update('facebook', e.target.value)} className="input" placeholder="https://facebook.com/..." />
                  </div>
                  <div>
                    <label className="label">Instagram URL</label>
                    <input value={form.instagram} onChange={e => update('instagram', e.target.value)} className="input" placeholder="https://instagram.com/..." />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Description */}
            {step === 4 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-text mb-4">Business Description</h2>
                <div>
                  <label className="label">
                    Tell customers about your business <span className="text-error">*</span>
                    <span className="text-text-secondary font-normal ml-2">({form.description.length} / 2000 chars, min 50)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                    className="input min-h-[200px] resize-none"
                    placeholder="Describe what makes your business special, what services you offer, your history, and what customers can expect..."
                    maxLength={2000}
                  />
                  <p className="text-xs text-text-secondary mt-1.5">Tip: Rich descriptions with 300+ words rank better in search.</p>
                </div>
              </div>
            )}

            {/* Step 5: Photos */}
            {step === 5 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-text mb-4">Photos <span className="text-text-secondary font-normal text-base">(optional)</span></h2>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center">
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-text-secondary text-sm mb-1">Drag and drop photos here, or click to browse</p>
                  <p className="text-text-secondary text-xs">PNG, JPG up to 5MB each. You can add up to 5 photos after your listing is approved.</p>
                </div>
                <p className="text-sm text-text-secondary">
                  📷 <strong>Pro tip:</strong> Great photos dramatically increase inquiry rates. You can add photos from your dashboard after claiming your listing.
                </p>
              </div>
            )}

            {/* Step 6: Deal */}
            {step === 6 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-text mb-4">Special Offer <span className="text-text-secondary font-normal text-base">(optional)</span></h2>
                <p className="text-sm text-text-secondary">Give customers a reason to choose you — add a deal or discount to your listing.</p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => update('hasCoupon', !form.hasCoupon)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.hasCoupon ? 'bg-primary' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.hasCoupon ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm font-medium text-text">{form.hasCoupon ? 'Deal is active' : 'No deal currently'}</span>
                </div>

                {form.hasCoupon && (
                  <div className="space-y-4 bg-slate-50 rounded-xl p-5">
                    <div>
                      <label className="label">Deal Headline <span className="text-error">*</span></label>
                      <input
                        value={form.couponHeadline}
                        onChange={e => update('couponHeadline', e.target.value)}
                        className="input"
                        placeholder="e.g. 20% off your first service"
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <label className="label">Deal Details <span className="text-error">*</span></label>
                      <textarea
                        value={form.couponDescription}
                        onChange={e => update('couponDescription', e.target.value)}
                        className="input min-h-[80px] resize-none"
                        placeholder="e.g. Must mention this listing. Cannot be combined with other offers. Valid for new customers only."
                        maxLength={300}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Promo Code <span className="text-text-secondary font-normal">(optional)</span></label>
                        <input
                          value={form.couponCode}
                          onChange={e => update('couponCode', e.target.value.toUpperCase())}
                          className="input font-mono"
                          placeholder="SAVE20"
                          maxLength={20}
                        />
                      </div>
                      <div>
                        <label className="label">Expires <span className="text-text-secondary font-normal">(optional)</span></label>
                        <input
                          type="date"
                          value={form.couponExpiresAt}
                          onChange={e => update('couponExpiresAt', e.target.value)}
                          className="input"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 7: Review */}
            {step === 7 && (
              <div className="space-y-5">
                <h2 className="text-xl font-bold text-text mb-4">Review & Submit</h2>
                <div className="bg-slate-50 rounded-xl p-5 space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-text-secondary">Business Name:</span>
                    <span className="font-medium col-span-2">{form.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-text-secondary">Category:</span>
                    <span className="font-medium col-span-2">{categories.find(c => c.id === form.categoryId)?.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-text-secondary">Address:</span>
                    <span className="font-medium col-span-2">{form.address}, {form.city}, {form.state} {form.zip}</span>
                  </div>
                  {form.phone && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-text-secondary">Phone:</span>
                      <span className="font-medium col-span-2">{form.phone}</span>
                    </div>
                  )}
                  {form.email && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-text-secondary">Email:</span>
                      <span className="font-medium col-span-2">{form.email}</span>
                    </div>
                  )}
                  {form.website && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-text-secondary">Website:</span>
                      <span className="font-medium col-span-2">{form.website}</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-text-secondary font-medium mb-2">Description preview:</p>
                  <p className="text-sm text-text-secondary bg-slate-50 p-4 rounded-xl line-clamp-4">{form.description}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
                  ✅ Your listing will be reviewed within 1–2 business days. You&apos;ll receive an email once it&apos;s live.
                </div>
              </div>
            )}

            {/* Navigation — hidden on step 0 */}
            {step > 0 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                {step > 1 ? (
                  <button onClick={() => setStep((s => (s - 1) as Step))} className="btn-outline text-sm py-2.5 flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <button onClick={() => setStep(0)} className="text-sm text-text-secondary hover:text-text transition-colors">
                    ← Search again
                  </button>
                )}

                {step < 5 ? (
                  <button
                    onClick={() => setStep((s => (s + 1) as Step))}
                    disabled={!canProceed()}
                    className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : step < 6 ? (
                  <button
                    onClick={() => setStep((s => (s + 1) as Step))}
                    disabled={!canProceed()}
                    className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : step < 7 ? (
                  <button
                    onClick={() => setStep((s => (s + 1) as Step))}
                    disabled={!canProceed()}
                    className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !canProceed()}
                    className="btn-accent text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit Listing'} <CheckCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
