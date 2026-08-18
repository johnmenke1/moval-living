'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Calendar,
} from 'lucide-react'
import VenueAutocomplete, { type VenueOption } from './VenueAutocomplete'

type FormState = {
  sourceUrl: string
  title: string
  date: string         // YYYY-MM-DD from <input type="date">
  startTime: string    // HH:MM from <input type="time">
  endTime: string      // HH:MM, optional
  // Venue picker: user types in the autocomplete, picks one from the
  // dropdown if a canonical Venue exists. venueId is set when they pick;
  // address / city / state / zip are auto-filled from that Venue but the
  // user can still edit them (in case of typos or to override).
  venueName: string
  venueId: string | null
  address: string
  city: string
  state: string
  zip: string
  // Caption pasted by the submitter when auto-extract failed (IG captcha
  // wall, etc). Sent as `caption` to the API; the server uses it as
  // `sourcePostCaption` if non-empty, so admin reviewers see the actual
  // post text and can promote to an Event with a real description.
  caption: string
  submitterNote: string
  // Honeypot — must remain empty.
  website: string
}

const INITIAL: FormState = {
  sourceUrl: '',
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  venueName: '',
  venueId: null,
  address: '',
  city: '',
  state: 'CA',
  zip: '',
  caption: '',
  submitterNote: '',
  website: '',
}

const MAX_TITLE = 200
const MAX_VENUE = 200
const MAX_ADDRESS = 300
const MAX_CITY = 100
const MAX_ZIP = 10
const MAX_CAPTION = 2000
const MAX_NOTE = 600

function canSubmit(f: FormState): boolean {
  return (
    /^https?:\/\/.+/.test(f.sourceUrl) &&
    f.title.trim().length >= 2 &&
    f.date.length === 10 &&          // YYYY-MM-DD
    f.startTime.length === 5          // HH:MM
  )
}

export default function SubmitEventForm() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<{ slug: string } | null>(null)

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit(form)) return
    setSubmitting(true)
    setError('')
    try {
      // Combine date + time into a proper UTC ISO string. <input
      // type="datetime-local"> gives a wall-clock string like "2026-08-30T18:00"
      // with NO timezone. The user picked 6:00 PM in *their* local timezone
      // (always Pacific in practice — that's where the team is). The naive
      // approach of sending that string and letting the server `new Date()`
      // it is dangerous: server TZ may differ (dev = Pacific, prod = UTC on
      // Vercel), and the parse silently reinterprets the value.
      //
      // Instead, parse the value as a real Date in the browser (which gives
      // the correct absolute instant — Date constructor treats naive strings
      // as local), then send the .toISOString() string. The server stores
      // it verbatim as a UTC instant; rendering it back as Pacific on the
      // public site yields the same wall-clock time the user picked.
      const startsAtDate = form.startTime
        ? new Date(`${form.date}T${form.startTime}`)
        : new Date(`${form.date}T00:00`)
      const startsAt = startsAtDate.toISOString()
      const endsAt = form.endTime
        ? new Date(`${form.date}T${form.endTime}`).toISOString()
        : undefined

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: form.sourceUrl,
          title: form.title,
          startsAt,
          endsAt,
          venueName: form.venueName.trim() || undefined,
          venueId: form.venueId || undefined,
          address: form.address.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          zip: form.zip.trim() || undefined,
          caption: form.caption.trim() || undefined,
          submitterNote: form.submitterNote || undefined,
          website: form.website,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Submission failed — please try again')
      }
      setSubmitted({ slug: data.slug })
      setTimeout(() => {
        document.getElementById('submission-success')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ─────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        id="submission-success"
        className="bg-white rounded-2xl border border-slate-100 p-10 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-text mb-2">Thanks for submitting!</h2>
        <p className="text-text-secondary max-w-md mx-auto mb-2">
          Your event has been added to our review queue.
        </p>
        <p className="text-sm text-text-secondary mb-6">
          Card reference: <code className="px-2 py-1 rounded bg-slate-100 font-mono">{submitted.slug}</code>
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Calendar className="w-4 h-4" /> See community events
          </Link>
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL)
              setSubmitted(null)
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 text-text text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Submit another
          </button>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 space-y-6"
    >
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-text mb-1">Tell us about the event</h2>
        <p className="text-sm text-text-secondary mb-5">
          Paste the post URL from Instagram, Facebook, or anywhere — we&apos;ll fetch a preview
          for our moderators. You give us the basics; we&apos;ll handle the rest.
        </p>

        <div className="space-y-4">
          <Field label="Post URL" required hint="Instagram, Facebook, or any link. We'll use this for moderation context.">
            <input
              type="url"
              required
              value={form.sourceUrl}
              onChange={(e) => update('sourceUrl', e.target.value)}
              placeholder="https://www.instagram.com/p/..."
              maxLength={2000}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </Field>

          <Field label="Event title" required hint={`${form.title.length} / ${MAX_TITLE} characters`}>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Summer Bash at the Mall"
              maxLength={MAX_TITLE}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Event date" required>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Start time" required>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => update('startTime', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="End time (optional)">
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => update('endTime', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>
          </div>

          <Field
            label="Venue (optional)"
            hint={form.venueId
              ? 'Linked to a known venue — address filled in below. You can edit if needed.'
              : 'Type to search our venue directory, or type a custom name and add the address yourself.'}
          >
            <VenueAutocomplete
              value={form.venueName}
              onChange={(next) => {
                update('venueName', next.venueName)
                update('venueId', next.venueId)
              }}
              onPick={(v) => {
                // Auto-fill address fields from the picked Venue. User can
                // still override any field after.
                update('address', v.address)
                update('city', v.city)
                update('state', v.state)
                update('zip', v.zip)
              }}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-4">
              <Field label="Address (optional)" hint={`${form.address.length} / ${MAX_ADDRESS} characters`}>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="123 Main St"
                  maxLength={MAX_ADDRESS}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="City" hint={`${form.city.length} / ${MAX_CITY}`}>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="Moreno Valley"
                  maxLength={MAX_CITY}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
            <div className="sm:col-span-1">
              <Field label="State">
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value)}
                  placeholder="CA"
                  maxLength={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
            <div className="sm:col-span-2 sm:col-start-5">
              <Field label="ZIP" hint={`${form.zip.length} / ${MAX_ZIP}`}>
                <input
                  type="text"
                  value={form.zip}
                  onChange={(e) => update('zip', e.target.value)}
                  placeholder="92553"
                  maxLength={MAX_ZIP}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
          </div>

          <Field
            label="Post caption (optional)"
            hint={`${form.caption.length} / ${MAX_CAPTION} characters — paste from Instagram / Facebook if we couldn't auto-fetch it.`}
          >
            <textarea
              value={form.caption}
              onChange={(e) => update('caption', e.target.value)}
              placeholder="If the post caption didn't auto-load, paste it here so moderators can see what the post said."
              rows={4}
              maxLength={MAX_CAPTION}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
            />
          </Field>

          <Field label="A note for our moderators (optional)" hint={`${form.submitterNote.length} / ${MAX_NOTE} characters`}>
            <textarea
              value={form.submitterNote}
              onChange={(e) => update('submitterNote', e.target.value)}
              placeholder="Anything that might help us review this — context, who you are, why you submitted it."
              rows={3}
              maxLength={MAX_NOTE}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
            />
          </Field>

          {/* Honeypot — hidden from real users via CSS. Bots fill every field. */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
          >
            <label htmlFor="website-hp">Website</label>
            <input
              id="website-hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-100">
        <p className="text-xs text-text-secondary mt-4 mb-4">
          All submissions are reviewed by our team before appearing on the events page. We
          typically review within 1–2 days.
        </p>
        <button
          type="submit"
          disabled={!canSubmit(form) || submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Submit for review
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ── Small helpers (kept local — not worth a separate file) ───────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-text-secondary">{hint}</p>}
    </div>
  )
}
