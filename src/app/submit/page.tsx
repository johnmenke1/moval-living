'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ChevronRight, ChevronLeft, Upload } from 'lucide-react'
import { categories } from '@/data/categories'

type Step = 1 | 2 | 3 | 4 | 5 | 6

const steps = [
  { num: 1, label: 'Basics' },
  { num: 2, label: 'Location' },
  { num: 3, label: 'Contact' },
  { num: 4, label: 'Description' },
  { num: 5, label: 'Photos' },
  { num: 6, label: 'Review' },
]

export default function SubmitPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
  })

  const update = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
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
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Submission failed')
      }
      router.push('/submit/success')
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
          {/* Progress Steps */}
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

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            {error && (
              <div className="bg-error/10 border border-error/20 text-error text-sm p-4 rounded-lg mb-6">
                {error}
              </div>
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
                  <label className="label">Category <span className="text-error">*</span></label>
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
                    <input value={form.city} onChange={e => update('city', e.target.value)} className="input" readOnly />
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

            {/* Step 6: Review */}
            {step === 6 && (
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

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
              {step > 1 ? (
                <button onClick={() => setStep((s => (s - 1) as Step))} className="btn-outline text-sm py-2.5 flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <Link href="/" className="text-sm text-text-secondary hover:text-text transition-colors">Cancel</Link>
              )}

              {step < 6 ? (
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
          </div>
        </div>
      </div>
    </div>
  )
}
