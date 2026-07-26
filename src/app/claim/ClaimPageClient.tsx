'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, Building2, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'

export default function ClaimPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const slug = searchParams.get('slug')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)
  const [businessName, setBusinessName] = useState('')

  // Step 1: validate token and fetch business name
  useEffect(() => {
    if (!token) return
    if (businessName || error) return
    let cancelled = false
    setValidating(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/claim/verify?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || 'Invalid claim link')
        setBusinessName(data.business.name)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invalid or expired claim link')
        }
      } finally {
        if (!cancelled) setValidating(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || !token) return

    setLoading(true)
    setError('')

    try {
      // Re-verify the claim token is still valid
      const verifyRes = await fetch(`/api/claim/verify?token=${encodeURIComponent(token)}`)
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Invalid or expired claim link')
      setBusinessName(verifyData.business.name)

      // Register + sign in
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || undefined,
        }),
      })

      const regData = await regRes.json()
      if (!regRes.ok) throw new Error(regData.error || 'Failed to create account')

      // Claim completes via redirect — the session cookie is now set
      router.push(`/claim/complete?token=${encodeURIComponent(token)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  // No token in URL
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
              <Link href="/my-submissions" className="text-primary text-sm hover:underline">Find my submission instead →</Link>
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
                    Create your account to claim and manage <strong>{businessName || 'this listing'}</strong>.
                    Your password is used for all future sign-ins.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={e => setFirstName(e.target.value)}
                          className="input"
                          placeholder="Jane"
                          autoComplete="given-name"
                        />
                      </div>
                      <div>
                        <label className="label">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={e => setLastName(e.target.value)}
                          className="input"
                          placeholder="Smith"
                          autoComplete="family-name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Email address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="input"
                        placeholder="you@yourbusiness.com"
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div>
                      <label className="label">Create Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="input pr-10"
                          placeholder="At least 8 characters"
                          required
                          minLength={8}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">Used for all future sign-ins. Minimum 8 characters.</p>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !email.trim() || !password || password.length < 8}
                      className="btn-primary w-full justify-center flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : <><UserPlus className="w-4 h-4" /> Create Account &amp; Claim Listing</>}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h2 className="text-lg font-bold text-text mb-2">You're all set!</h2>
                  <p className="text-sm text-text-secondary">Redirecting to your dashboard...</p>
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
              <Link href="/my-submissions" className="text-primary text-sm hover:underline">Find my submission instead →</Link>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-text-secondary mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
