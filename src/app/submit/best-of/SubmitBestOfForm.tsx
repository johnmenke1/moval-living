'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Send,
} from 'lucide-react'

const REASON_MIN = 80
const REASON_MAX = 600

type FormState = {
  businessName: string
  categoryName: string
  nominatorName: string
  nominatorEmail: string
  reason: string
  emailOptIn: boolean
  // Honeypot — must remain empty.
  website: string
}

const INITIAL: FormState = {
  businessName: '',
  categoryName: '',
  nominatorName: '',
  nominatorEmail: '',
  reason: '',
  emailOptIn: false,
  website: '',
}

export default function SubmitBestOfForm() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<{ nominationId: string } | null>(null)

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSubmit = () => {
    return (
      form.businessName.trim().length >= 2 &&
      form.categoryName.trim().length >= 2 &&
      form.nominatorName.trim().length >= 1 &&
      /.+@.+\..+/.test(form.nominatorEmail) &&
      form.reason.trim().length >= REASON_MIN &&
      form.reason.trim().length <= REASON_MAX
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/best-of/nominations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Submission failed — please try again')
      }
      setSubmitted({ nominationId: data.nominationId })
      setTimeout(() => {
        document.getElementById('nomination-success')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        id="nomination-success"
        className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-10 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-text mb-2">Thanks for the nomination!</h2>
        <p className="text-text-secondary max-w-md mx-auto mb-6">
          We just sent a thank-you note to <strong>{form.nominatorEmail}</strong>. Our editors
          review every nomination personally — if we move forward, you&apos;ll see it on the Best Of
          page soon.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/best-of"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Trophy className="w-4 h-4" /> See Best Of
          </Link>
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL)
              setSubmitted(null)
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-text text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Nominate another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 space-y-8"
    >
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1 — The business */}
      <div>
        <h2 className="text-lg font-bold text-text mb-1">Tell us about the business</h2>
        <p className="text-sm text-text-secondary mb-5">
          Don&apos;t worry if there&apos;s no category yet — suggest one in the next field.
        </p>

        <div className="space-y-5">
          <Field label="Business name" required>
            <input
              type="text"
              required
              value={form.businessName}
              onChange={e => update('businessName', e.target.value)}
              placeholder="e.g. Taqueria 2 Potrillos"
              maxLength={200}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </Field>

          <Field
            label="What category should they win?"
            required
            hint="If a category doesn&apos;t exist, we&apos;ll create one based on community demand."
          >
            <input
              type="text"
              required
              value={form.categoryName}
              onChange={e => update('categoryName', e.target.value)}
              placeholder='e.g. "Best Tacos" or "Best Dog Walker"'
              maxLength={120}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </Field>

          <Field
            label="Why is this business great?"
            required
            hint={`${form.reason.trim().length} / ${REASON_MAX} — minimum ${REASON_MIN} characters`}
          >
            <textarea
              required
              value={form.reason}
              onChange={e => update('reason', e.target.value)}
              placeholder="What makes them stand out? Tell us about the experience, the people, the food, the service — whatever it is that makes you a fan."
              rows={6}
              maxLength={REASON_MAX}
              minLength={REASON_MIN}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
            />
          </Field>
        </div>
      </div>

      {/* Section 2 — About you */}
      <div className="pt-6 border-t border-slate-100">
        <h2 className="text-lg font-bold text-text mb-1">About you</h2>
        <p className="text-sm text-text-secondary mb-5">
          So we can let you know if your nomination makes the list.
        </p>

        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Your name" required>
              <input
                type="text"
                required
                value={form.nominatorName}
                onChange={e => update('nominatorName', e.target.value)}
                placeholder="First and last"
                maxLength={120}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>

            <Field label="Your email" required>
              <input
                type="email"
                required
                value={form.nominatorEmail}
                onChange={e => update('nominatorEmail', e.target.value)}
                placeholder="you@example.com"
                maxLength={320}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </Field>
          </div>

          <Checkbox
            checked={form.emailOptIn}
            onChange={v => update('emailOptIn', v)}
            label={
              <>
                Send me moval.living news &amp; updates <span className="text-text-secondary font-normal">(newsletter, new Best-Of picks, local spotlights)</span>
              </>
            }
          />

          {/* Honeypot — hidden from real users via CSS. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="website-hp">Website</label>
            <input
              id="website-hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={e => update('website', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="pt-6 border-t border-slate-100">
        <p className="text-xs text-text-secondary mb-4">
          By submitting, you agree we may contact you about this nomination. We don&apos;t share your
          email with anyone.
        </p>
        <button
          type="submit"
          disabled={!canSubmit() || submitting}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Submit nomination
              <ChevronRight className="w-4 h-4 opacity-70" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ── Small helpers (kept local — not worth a separate file) ────────────────

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
      <label className="block text-sm font-medium text-text mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-text-secondary">{hint}</p>}
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: React.ReactNode
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary accent-primary"
      />
      <span className="text-sm text-text leading-snug">{label}</span>
    </label>
  )
}
