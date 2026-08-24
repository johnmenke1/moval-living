'use client'

/**
 * EmailChangeForm — Owner-initiated email change UI.
 *
 * Submits POST /api/profile/email-change/request which sends a
 * confirmation link to the NEW address. The link must be clicked
 * within 1 hour to swap.
 *
 * Surface states:
 *   - idle: form ready
 *   - sending: PATCH in flight
 *   - sent: success, show "check your inbox at <newEmail>"
 *   - error: display server-side error message
 *
 * The success message tells the user to check the NEW inbox
 * (not their current one). The link in that email is what
 * completes the swap.
 */

import { useState } from 'react'

export function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const [newEmail, setNewEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    setError(null)
    setSent(null)
    setSending(true)
    try {
      const res = await fetch('/api/profile/email-change/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error ?? 'Could not send confirmation email')
      }
      setSent(newEmail)
      setNewEmail('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-slate-200">
      <h2 className="text-sm font-bold text-text mb-1">
        Change your email address
      </h2>
      <p className="text-xs text-text-secondary mb-3">
        Currently signed in as <strong>{currentEmail}</strong>. To switch to a
        different email, enter it below — we'll send a confirmation link to
        the new address.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="new-email@example.com"
          aria-label="New email address"
          disabled={sending}
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-slate-50 disabled:opacity-70"
        />
        <button
          type="submit"
          disabled={sending || !newEmail.trim()}
          className="inline-flex items-center justify-center text-sm font-semibold bg-gradient-to-br from from-[#007a7f] to to-[#00405c] text-white px-4 py-2 rounded-lg hover:shadow-md disabled:opacity-50 disabled:cursor-wait transition-all"
        >
          {sending ? 'Sending…' : 'Send confirmation link'}
        </button>
      </form>
      {sent && (
        <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          ✓ Confirmation link sent to <strong>{sent}</strong>. The change
          takes effect when you click that link — check your inbox (and
          spam folder).
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}