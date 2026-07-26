'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to process request')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">M</div>
            <span className="text-xl font-bold text-text">moval<span className="text-primary">.living</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-text">Reset Your Password</h1>
          <p className="text-text-secondary mt-1">Enter your email and we'll send you a reset link</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {!sent ? (
            <>
              <p className="text-sm text-text-secondary mb-5">
                Enter the email address associated with your owner account. If an account exists, we&apos;ll send a password reset link valid for 1 hour.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    className="input"
                    placeholder="you@yourbusiness.com"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-text mb-2">Check your inbox</h2>
              <p className="text-sm text-text-secondary">
                We sent a password reset link to <strong>{email}</strong>. If an account exists, you&apos;ll receive it within a few minutes.
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Remember your password?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
