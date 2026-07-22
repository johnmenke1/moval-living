'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ClaimPage() {
  const router = useRouter()
  const [businessSlug, setBusinessSlug] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessSlug.trim() || !email.trim()) {
      setError('Please fill in all fields.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessSlug: businessSlug.trim(), email: email.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to initiate claim')
      }

      router.push('/claim/success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container-max py-16">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold text-text text-center mb-2">Claim Your Business</h1>
          <p className="text-text-secondary text-center mb-8">Already have a listing? Verify your ownership to manage it.</p>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Business URL Slug</label>
                <input
                  value={businessSlug}
                  onChange={e => setBusinessSlug(e.target.value)}
                  className="input"
                  placeholder="e.g. joes-auto-repair-a1b2c3"
                />
                <p className="text-xs text-text-secondary mt-1">Found in the URL: moval.living/business/[slug]</p>
              </div>
              <div>
                <label className="label">Your Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@yourbusiness.com"
                />
              </div>
              {error && <p className="text-error text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full disabled:opacity-50"
              >
                {submitting ? 'Verifying...' : 'Claim Business'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-text-secondary">
                Want to add a new business?{' '}
                <Link href="/submit" className="text-primary font-medium hover:underline">Submit here</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
