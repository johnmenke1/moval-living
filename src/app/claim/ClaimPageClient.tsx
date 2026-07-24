'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Building2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { signIn } from 'next-auth/react'

export default function ClaimPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const slug = searchParams.get('slug')

  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Step 1: validate token and fetch business name
  const validateToken = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/claim/verify?token=${encodeURIComponent(token!)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid claim link')
      setBusinessName(data.business.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired claim link')
    } finally {
      setLoading(false)
    }
  }

  // Load token validation on mount
  if (token && !businessName && !error) {
    validateToken()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !token) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/claim/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: email.trim().toLowerCase() }),
      })

      // Send magic link for the claimer to sign in — callback completes the claim
      await signIn('email', { email: email.trim().toLowerCase(), redirect: false, callbackUrl: `/claim/complete?token=${token}` })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // No token in URL — show generic claim page
  if (!token) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">M</div>
              <span className="text-xl font-bold text-text">moval<span className="text-primary">.living</span></span>
            </Link>
            <h1 className="text-2xl font-bold text-text">Claim Your Listing</h1>
            <p className="text-text-secondary mt-2">Enter the claim link you received after submitting your business.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your claim link appears to be missing. Please use the full link from your submission confirmation email.</span>
            </div>
            <div className="mt-4 text-center">
              <Link href="/my-submissions" className="text-primary text-sm hover:underline">
                Find my submission instead →
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">M</div>
            <span className="text-xl font-bold text-text">moval<span className="text-primary">.living</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-text">Claim Your Listing</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
          {!error ? (
            <>
              {/* Business being claimed */}
              {businessName && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Claiming</p>
                    <p className="font-semibold text-text">{businessName}</p>
                  </div>
                </div>
              )}

              {!sent ? (
                <>
                  <p className="text-sm text-text-secondary mb-5">
                    Enter your email and we&apos;ll send a secure sign-in link. Clicking it will instantly link this listing to your account.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="label">Email address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="input"
                        placeholder="you@yourbusiness.com"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="btn-primary w-full justify-center flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending link...</> : <><UserPlus className="w-4 h-4" /> Send Sign-In Link</>}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h2 className="text-lg font-bold text-text mb-2">Check your inbox</h2>
                  <p className="text-sm text-text-secondary">
                    We sent a sign-in link to <strong>{email}</strong>. Click the link to instantly claim <strong>{businessName}</strong> and access your dashboard.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-text mb-2">Invalid or Expired Link</h2>
              <p className="text-sm text-text-secondary mb-5">{error}</p>
              <Link href="/my-submissions" className="text-primary text-sm hover:underline">
                Find my submission instead →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
