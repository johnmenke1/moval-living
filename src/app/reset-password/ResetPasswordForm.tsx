'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to reset password')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-text mb-2">Invalid Reset Link</h2>
            <p className="text-sm text-text-secondary mb-5">This password reset link is missing required information. Please request a new one.</p>
            <Link href="/forgot-password" className="text-primary text-sm hover:underline">Request new reset link →</Link>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full mx-auto px-4">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">M</div>
              <span className="text-xl font-bold text-text">moval<span className="text-primary">.living</span></span>
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-text mb-2">Password Reset!</h2>
            <p className="text-sm text-text-secondary mb-5">Your password has been updated. You can now sign in with your new password.</p>
            <Link href="/login" className="btn-primary inline-block">Sign In</Link>
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
          <h1 className="text-2xl font-bold text-text">Set New Password</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
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
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={event => setConfirm(event.target.value)}
                className="input"
                placeholder="Repeat your password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : 'Update Password'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              <Link href="/login" className="text-primary hover:underline">Cancel</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
