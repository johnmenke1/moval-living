'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ChevronLeft, Loader2, AlertCircle, ImagePlus, X, Star } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
}

interface Business {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string
  categoryId: string
  email: string | null
  phone: string | null
  website: string | null
  address: string
  city: string
  state: string
  zip: string
  facebook: string | null
  instagram: string | null
  yelp: string | null
  googleBusiness: string | null
  googleRating: number | null
  googleReviewCount: number | null
  hours: Record<string, { open: string; close: string; closed: boolean }> | null
  hasCoupon: boolean
  coupon: { headline: string; description: string; code: string | null; expiresAt: string | null } | null
  tier: 'FREE' | 'FEATURED'
  logo: string | null
  coverImage: string | null
  photos: string[]
}

interface Props {
  business: Business
  categories: Category[]
}

export default function EditBusinessClient({ business, categories }: Props) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: business.name,
    tagline: business.tagline || '',
    categoryId: business.categoryId,
    address: business.address,
    city: business.city,
    state: business.state,
    zip: business.zip,
    phone: business.phone || '',
    email: business.email || '',
    website: business.website || '',
    description: business.description,
    facebook: business.facebook || '',
    instagram: business.instagram || '',
    yelp: business.yelp || '',
    googleRating: business.googleRating ?? '',
    googleReviewCount: business.googleReviewCount ?? '',
    googleBusiness: business.googleBusiness || '',
    hasCoupon: business.hasCoupon,
    couponHeadline: business.coupon?.headline || '',
    couponDescription: business.coupon?.description || '',
    couponCode: business.coupon?.code || '',
    couponExpiresAt: business.coupon?.expiresAt || '',
  })

  // Per-field validation errors from the server
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Image management
  const [logoUrl, setLogoUrl] = useState<string | null>(business.logo)
  const [coverUrl, setCoverUrl] = useState<string | null>(business.coverImage)
  const [photos, setPhotos] = useState<string[]>(business.photos)
  const [uploading, setUploading] = useState<string | null>(null) // 'logo' | 'cover' | 'photo[N]'
  const [uploadError, setUploadError] = useState('')

  const isFeatured = business.tier === 'FEATURED'

  const handleImageUpload = async (file: File, type: 'logo' | 'cover' | 'photo') => {
    setUploadError('')
    setUploading(type)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('businessId', business.id)
      fd.append('type', type)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const { url } = data
      if (type === 'logo') setLogoUrl(url)
      else if (type === 'cover') setCoverUrl(url)
      else if (type === 'photo') setPhotos(prev => [...prev, url])
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const handleDeletePhoto = async (url: string) => {
    try {
      const res = await fetch(`/api/upload?businessId=${business.id}&url=${encodeURIComponent(url)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setPhotos(prev => prev.filter(p => p !== url))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const uploadInput = (type: 'logo' | 'cover' | 'photo') => ({
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp,image/gif',
    className: 'hidden',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleImageUpload(file, type)
      e.target.value = ''
    },
  }) as React.InputHTMLAttributes<HTMLInputElement>

  // Hours — stored as JSON in a hidden field so submit handler can read them
  const [hoursJson, setHoursJson] = useState(JSON.stringify(
    business.hours || {
      mon: { open: '9:00 AM', close: '5:00 PM', closed: false },
      tue: { open: '9:00 AM', close: '5:00 PM', closed: false },
      wed: { open: '9:00 AM', close: '5:00 PM', closed: false },
      thu: { open: '9:00 AM', close: '5:00 PM', closed: false },
      fri: { open: '9:00 AM', close: '5:00 PM', closed: false },
      sat: { open: '9:00 AM', close: '5:00 PM', closed: false },
      sun: { open: '9:00 AM', close: '5:00 PM', closed: true },
    }
  ))

  const update = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
    // Clear field error when user starts editing
    if (field in fieldErrors) {
      setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n })
    }
  }

  const fieldError = (key: string) => fieldErrors[key]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const hours = JSON.parse(hoursJson)

      const res = await fetch(`/api/businesses/${business.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          tagline: form.tagline || null,
          categoryId: form.categoryId,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          description: form.description,
          facebook: form.facebook || null,
          instagram: form.instagram || null,
          yelp: form.yelp || null,
          hours,
          googleRating: form.googleRating ? Number(form.googleRating) : null,
          googleReviewCount: form.googleReviewCount ? Number(form.googleReviewCount) : null,
          googleBusiness: form.googleBusiness || null,
          hasCoupon: form.hasCoupon,
          coupon: form.hasCoupon && form.couponHeadline ? {
            headline: form.couponHeadline,
            description: form.couponDescription,
            code: form.couponCode || null,
            expiresAt: form.couponExpiresAt || null,
          } : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.fields) {
          setFieldErrors(data.fields)
          setError('Please fix the highlighted fields.')
        } else {
          throw new Error(data.error || 'Failed to save')
        }
        return
      }

      // Refresh Google reviews cache if this business has a Google Business ID
      if (business.googleBusiness) {
        fetch(`/api/businesses/${business.slug}/google-reviews?refresh=true`, { cache: 'no-store' })
      }

      setSaved(true)
      setFieldErrors({})
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const hours: Record<string, { open: string; close: string; closed: boolean }> =
    JSON.parse(hoursJson)
  const dayLabels: Record<string, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  }

  const updateHours = (day: string, field: string, value: string | boolean) => {
    const updated = JSON.parse(hoursJson)
    updated[day] = { ...updated[day], [field]: value }
    setHoursJson(JSON.stringify(updated))
    setSaved(false)
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-text mb-1">Edit Listing</h1>
          <p className="text-text-secondary">Update your business information on moval.living</p>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="max-w-2xl mx-auto">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error text-sm p-4 rounded-lg mb-6 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {uploadError && (
            <div className="bg-error/10 border border-error/20 text-error text-sm p-4 rounded-lg mb-6 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {uploadError}
            </div>
          )}

          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-4 rounded-lg mb-6 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Changes saved successfully!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Images */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text">Images</h2>
                {!isFeatured && (
                  <span className="text-xs text-text-secondary bg-slate-100 px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 inline mr-1 text-amber-500" />
                    Upgrade to add photo gallery
                  </span>
                )}
              </div>

              <div className="space-y-6">
                {/* Logo & Cover row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Logo */}
                  <div>
                    <label className="label mb-2 block">Business Logo</label>
                    <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center group hover:border-primary transition-colors">
                      {logoUrl ? (
                        <>
                          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer text-white text-xs font-medium text-center p-2">
                              <ImagePlus className="w-5 h-5 mx-auto mb-1" />
                              Change
                              <input {...uploadInput('logo')} />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-primary transition-colors">
                          <ImagePlus className="w-6 h-6 mb-1" />
                          <span className="text-xs">Upload</span>
                          <input {...uploadInput('logo')} />
                        </label>
                      )}
                      {uploading === 'logo' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1.5">JPG, PNG, WebP or GIF · max 10MB</p>
                  </div>

                  {/* Cover Image */}
                  <div>
                    <label className="label mb-2 block">Cover Image</label>
                    <div className="relative rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center group hover:border-primary transition-colors aspect-[16/9]">
                      {coverUrl ? (
                        <>
                          <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer text-white text-xs font-medium text-center p-2">
                              <ImagePlus className="w-5 h-5 mx-auto mb-1" />
                              Change
                              <input {...uploadInput('cover')} />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center justify-center text-slate-400 hover:text-primary transition-colors">
                          <ImagePlus className="w-6 h-6 mb-1" />
                          <span className="text-xs">Upload cover</span>
                          <input {...uploadInput('cover')} />
                        </label>
                      )}
                      {uploading === 'cover' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1.5">Displayed at the top of your listing · max 10MB</p>
                  </div>
                </div>

                {/* Photo Gallery — Featured only */}
                {isFeatured ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="label mb-0">Photo Gallery</label>
                      <span className="text-xs text-text-secondary">{photos.length} / 10</span>
                    </div>

                    {photos.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
                        {photos.map((url, i) => (
                          <div key={i} className="relative aspect-square rounded-lg border border-slate-200 overflow-hidden group">
                            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(url)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {photos.length < 10 && (
                      <label className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-primary hover:text-primary cursor-pointer transition-colors">
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-sm font-medium">Add photo</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(file, 'photo')
                            e.target.value = ''
                          }}
                        />
                        {uploading === 'photo' && <Loader2 className="w-4 h-4 animate-spin" />}
                      </label>
                    )}
                    <p className="text-xs text-text-secondary mt-1.5">Up to 10 photos · max 10MB each · JPG, PNG, WebP or GIF</p>
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-text-secondary bg-slate-50 rounded-xl">
                    <Star className="w-4 h-4 inline mr-1 text-amber-500" />
                    Photo gallery is available for{' '}
                    <Link href="/pricing" className="text-primary font-medium hover:underline">Featured</Link> listings
                    {' '}— up to 10 photos to showcase your business.
                  </div>
                )}
              </div>
            </div>

            {/* Basic Info */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-text mb-5">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Business Name</label>
                  <input value={form.name} onChange={e => update('name', e.target.value)} className="input" required />
                </div>
                <div>
                  <label className="label">Tagline <span className="text-text-secondary font-normal">(optional)</span></label>
                  <input value={form.tagline} onChange={e => update('tagline', e.target.value)} className="input" placeholder="Your trusted business tagline" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select value={form.categoryId} onChange={e => update('categoryId', e.target.value)} className="input">
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-text mb-5">Location</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Street Address</label>
                  <input value={form.address} onChange={e => update('address', e.target.value)} className="input" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="label">City</label>
                    <input value={form.city} onChange={e => update('city', e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input value={form.state} onChange={e => update('state', e.target.value)} className="input" readOnly />
                  </div>
                </div>
                <div>
                  <label className="label">ZIP Code</label>
                  <input
                    value={form.zip}
                    onChange={e => update('zip', e.target.value)}
                    className={`input${fieldError('zip') ? ' border-red-500 ring-1 ring-red-200' : ''}`}
                    placeholder="92553"
                  />
                  {fieldError('zip') && (
                    <p className="text-xs text-red-500 mt-1">{fieldError('zip')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-text mb-5">Contact Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className="input" placeholder="(951) 555-0100" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input value={form.website} onChange={e => update('website', e.target.value)} className="input" placeholder="https://..." />
                </div>
                <div>
                  <label className="label">Google Business Place ID <span className="text-text-secondary font-normal">(optional)</span></label>
                  <input value={form.googleBusiness} onChange={e => update('googleBusiness', e.target.value)} className="input font-mono text-xs" placeholder="ChIJ..." />
                  <p className="text-xs text-text-secondary mt-1">Paste from Google Places or your Business Profile URL</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Google Rating <span className="text-text-secondary font-normal">(0–5)</span></label>
                    <input type="number" step="0.1" min="0" max="5" value={form.googleRating} onChange={e => update('googleRating', e.target.value)} className="input" placeholder="4.5" />
                  </div>
                  <div>
                    <label className="label">Google Review Count</label>
                    <input type="number" min="0" value={form.googleReviewCount} onChange={e => update('googleReviewCount', e.target.value)} className="input" placeholder="128" />
                  </div>
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
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-text mb-5">Description</h2>
              <div>
                <label className="label">
                  Business Description
                  <span className="text-text-secondary font-normal ml-2">({form.description.length} / 2000 chars)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  className="input min-h-[180px] resize-none"
                  maxLength={2000}
                />
              </div>
            </div>

            {/* Hours */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-text mb-5">Hours of Operation</h2>
              <div className="space-y-3">
                {Object.entries(dayLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3 text-sm">
                    <span className="w-28 text-text-secondary shrink-0">{label}</span>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={!hours[key].closed}
                        onChange={e => updateHours(key, 'closed', !e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs text-text-secondary">Open</span>
                    </label>
                    {!hours[key].closed && (
                      <>
                        <input
                          type="text"
                          value={hours[key].open}
                          onChange={e => updateHours(key, 'open', e.target.value)}
                          className="input w-28 text-sm py-1.5"
                          placeholder="9:00 AM"
                        />
                        <span className="text-text-secondary">–</span>
                        <input
                          type="text"
                          value={hours[key].close}
                          onChange={e => updateHours(key, 'close', e.target.value)}
                          className="input w-28 text-sm py-1.5"
                          placeholder="5:00 PM"
                        />
                      </>
                    )}
                    {hours[key].closed && (
                      <span className="text-xs text-slate-400 italic">Closed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Deal */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8">
              <h2 className="text-lg font-bold text-text mb-5">Special Offer</h2>
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => update('hasCoupon', !form.hasCoupon)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.hasCoupon ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.hasCoupon ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm font-medium text-text">{form.hasCoupon ? 'Deal is active' : 'No deal'}</span>
              </div>
              {form.hasCoupon && (
                <div className="space-y-4 bg-slate-50 rounded-xl p-5">
                  <div>
                    <label className="label">Deal Headline</label>
                    <input value={form.couponHeadline} onChange={e => update('couponHeadline', e.target.value)} className="input" placeholder="e.g. 20% off first service" maxLength={80} />
                  </div>
                  <div>
                    <label className="label">Details</label>
                    <textarea value={form.couponDescription} onChange={e => update('couponDescription', e.target.value)} className="input min-h-[80px] resize-none" placeholder="Terms and conditions..." maxLength={300} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Promo Code <span className="text-text-secondary font-normal">(optional)</span></label>
                      <input value={form.couponCode} onChange={e => update('couponCode', e.target.value.toUpperCase())} className="input font-mono" placeholder="SAVE20" maxLength={20} />
                    </div>
                    <div>
                      <label className="label">Expires <span className="text-text-secondary font-normal">(optional)</span></label>
                      <input type="date" value={form.couponExpiresAt} onChange={e => update('couponExpiresAt', e.target.value)} className="input" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3">
              <Link href="/dashboard" className="btn-outline">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
