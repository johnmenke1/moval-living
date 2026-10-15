'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ImagePlus, X, CheckCircle2 } from 'lucide-react'
import { TurnstileWidget } from '@/components/turnstile/TurnstileWidget'

const inputCls =
  'w-full rounded-xl bg-[#160b24] border border-[#3a1d57] px-3 py-2.5 text-sm text-white placeholder:text-purple-300/50 focus:outline-none focus:ring-2 focus:ring-orange-400'

export function EnterForm({ categories, maxPhotos }: { categories: string[]; maxPhotos: number }) {
  const [files, setFiles] = useState<File[]>([])
  const [showExact, setShowExact] = useState(false)
  const [token, setToken] = useState('')
  // Turnstile tokens are single-use: after ANY submit attempt we remount the widget for a fresh one.
  const [captchaKey, setCaptchaKey] = useState(0)
  const [inAppBrowser, setInAppBrowser] = useState(false)
  const captchaConfigured = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').length >= 16
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  useEffect(() => {
    // Facebook / Instagram / TikTok in-app browsers often block or break the security check.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInAppBrowser(/FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Line\/|MicroMessenger/i.test(navigator.userAgent))
  }, [])

  function resetCaptcha() {
    setToken('')
    setCaptchaKey((k) => k + 1)
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const next = [...files, ...Array.from(list)].slice(0, maxPhotos)
    setFiles(next)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (captchaConfigured && !token) {
      return setError(
        'The security check hasn\'t finished yet. Wait for the green checkmark above the button, then tap Submit again. If it never appears, open this page in Chrome or Safari.',
      )
    }
    const fd = new FormData(e.currentTarget)
    fd.delete('photos')
    files.forEach((f) => fd.append('photos', f))
    fd.set('showExactAddress', String(showExact))
    fd.set('turnstileToken', token)
    setSubmitting(true)
    try {
      const res = await fetch('/api/halloween/entries', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // The server may already have spent this token - get a fresh one for the retry.
        resetCaptcha()
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      resetCaptcha()
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-2xl border border-green-400/40 bg-green-400/10 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
        <h2 className="font-halloween text-3xl text-white mt-3">You&apos;re in the crypt! 🎃</h2>
        <p className="mt-2 text-purple-100/90">
          Thanks for entering. Your address will appear on the map once a volunteer approves it.
        </p>
        <Link href="/halloween" className="inline-block mt-5 rounded-xl bg-orange-500 hover:bg-orange-400 text-[#1b0b2e] font-bold px-6 py-3">
          Back to the map
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <fieldset className="space-y-4">
        <legend className="font-halloween text-2xl text-white mb-1">Your display</legend>
        <div>
          <label className="block text-sm text-purple-200 mb-1" htmlFor="displayName">Display name</label>
          <input id="displayName" name="displayName" maxLength={80} placeholder="e.g. The Garcia Graveyard (optional)" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm text-purple-200 mb-1" htmlFor="tagline">Tagline</label>
          <input id="tagline" name="tagline" maxLength={120} placeholder="One spooky line (optional)" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm text-purple-200 mb-1" htmlFor="description">Tell us about it</label>
          <textarea id="description" name="description" maxLength={800} rows={4}
            placeholder="What makes your decorations special? Animatronics, lights, a theme, a story… (optional)" className={inputCls} />
        </div>
        {categories.length > 0 && (
          <div>
            <label className="block text-sm text-purple-200 mb-1" htmlFor="category">Category</label>
            <select id="category" name="category" className={inputCls} defaultValue="">
              <option value="">No preference</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div>
          <span className="block text-sm text-purple-200 mb-1">Photos (up to {maxPhotos}, JPG/PNG/WebP, 10 MB each — add at least one)</span>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, i) => (
              <div key={src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Photo ${i + 1}`} className="h-28 w-28 rounded-xl object-cover border border-[#3a1d57]" />
                <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 rounded-full bg-black/80 p-1"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {files.length < maxPhotos && (
              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#5a2d85] text-purple-200 hover:bg-[#2a1546]">
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs mt-1">Add photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
              </label>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-halloween text-2xl text-white mb-1">Where is it?</legend>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className="block text-sm text-purple-200 mb-1" htmlFor="streetAddress">Street address * (Moreno Valley)</label>
            <input id="streetAddress" name="streetAddress" required minLength={5} maxLength={160} autoComplete="street-address" placeholder="1234 Main St" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-purple-200 mb-1" htmlFor="zip">ZIP</label>
            <input id="zip" name="zip" inputMode="numeric" pattern="\d{5}" maxLength={5} autoComplete="postal-code" placeholder="92553" className={inputCls} />
          </div>
        </div>
        <div className="rounded-xl border border-[#3a1d57] bg-[#160b24] p-4 space-y-3 text-sm">
          <p className="text-purple-200">How should your home appear on the public map?</p>
          <label className="flex gap-3 cursor-pointer">
            <input type="radio" name="privacy" checked={!showExact} onChange={() => setShowExact(false)} className="mt-1 accent-orange-500" />
            <span><span className="font-semibold text-white">Near my street</span> <span className="text-purple-300/70">(recommended)</span><br />
              <span className="text-purple-300/70">Shows an approximate pin and your street name only.</span></span>
          </label>
          <label className="flex gap-3 cursor-pointer">
            <input type="radio" name="privacy" checked={showExact} onChange={() => setShowExact(true)} className="mt-1 accent-orange-500" />
            <span><span className="font-semibold text-white">Exact address</span><br />
              <span className="text-purple-300/70">Shows the exact pin and full address so visitors can find your display.</span></span>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-halloween text-2xl text-white mb-1">How can we reach you? <span className="text-sm font-normal text-purple-300/70">(optional)</span></legend>
        <p className="text-sm text-purple-200/80 -mt-1">
          Entries are anonymous by default. Add a phone if our volunteers need to reach you about your display.
        </p>
        <div>
          <label className="block text-sm text-purple-200 mb-1" htmlFor="contactPhone">Phone</label>
          <input id="contactPhone" name="contactPhone" type="tel" maxLength={40} autoComplete="tel" className={inputCls} />
        </div>
      </fieldset>

      
      {inAppBrowser && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Tip: you&apos;re in an in-app browser (Facebook, Instagram, etc.). If the security check below doesn&apos;t finish, tap the
          menu (⋮ or …) and choose <strong>Open in browser</strong> - your answers will be there waiting if you copy this page&apos;s link.
        </p>
      )}

      <TurnstileWidget key={captchaKey} theme="dark" onVerify={setToken} onExpire={() => setToken('')} onError={() => setToken('')} />

      {error && <p role="alert" className="rounded-xl bg-red-500/15 border border-red-400/40 px-4 py-3 text-sm text-red-200">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-[#1b0b2e] font-bold py-3.5 text-lg transition">
        {submitting ? 'Submitting…' : 'Submit my home 🎃'}
      </button>
    </form>
  )
}
