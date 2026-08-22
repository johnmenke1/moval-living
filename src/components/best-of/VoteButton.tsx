'use client'

/**
 * VoteButton — registered-voter voting action.
 *
 * Renders one of three states:
 *   - Anonymous:  "Sign in to vote" → redirects to /login?returnTo=...
 *   - Signed in, hasn't voted: "Vote" → POSTs and flips to "Voted ✓"
 *   - Signed in, already voted: "Voted ✓ · Retract" → DELETE on retract
 *
 * Optimistic UI: we flip to the new state before the network call
 * resolves, and roll back on error. The success toast + retract UI
 * gives Google Reviews-style feedback.
 *
 * The button knows whether the user has already voted via the
 * `initialVoted` prop, which the server component computes from the
 * session before rendering. This avoids a flash of "Vote" → "Voted"
 * on first paint.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Check, Vote as VoteIcon, AlertCircle } from 'lucide-react'

// Helpers live in a separate file so unit tests can import them without
// pulling React into the test runner. We both import (for internal use)
// and re-export (so consumers can import everything from this file).
import {
  VOTED_STATE_COOKIE_PREFIX,
  buildLoginRedirectUrl,
  buildReturnTo,
} from './vote-button-helpers'

export {
  VOTED_STATE_COOKIE_PREFIX,
  buildLoginRedirectUrl,
  buildReturnTo,
}

interface VoteButtonProps {
  nomineeId: string
  nomineeName: string
  categorySlug: string
  initialVoted: boolean
  initialVoteId?: string
  signedIn: boolean
}

export function VoteButton({
  nomineeId,
  nomineeName,
  categorySlug,
  initialVoted,
  initialVoteId,
  signedIn,
}: VoteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [voted, setVoted] = useState(initialVoted)
  const [voteId, setVoteId] = useState<string | undefined>(initialVoteId)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setError(null)

    // Anonymous → send to /login with a returnTo back to this page
    if (!signedIn) {
      const target = buildLoginRedirectUrl(
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : `/best-of/${categorySlug}`,
      )
      router.push(target)
      return
    }

    // Already voted → show retract UI
    if (voted && voteId) {
      const ok = window.confirm(
        `Retract your vote for ${nomineeName}? You can vote again later.`,
      )
      if (!ok) return
      setLoading(true)
      try {
        const res = await fetch(`/api/best-of/votes/${voteId}`, {
          method: 'DELETE',
        })
        if (!res.ok && res.status !== 204) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Could not retract vote')
        }
        setVoted(false)
        setVoteId(undefined)
        document.cookie = `${VOTED_STATE_COOKIE_PREFIX}${nomineeId}=; Max-Age=0; Path=/`
        startTransition(() => router.refresh())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not retract vote')
      } finally {
        setLoading(false)
      }
      return
    }

    // Cast vote
    setLoading(true)
    // Optimistic update — flip UI before the request resolves
    setVoted(true)
    try {
      const res = await fetch('/api/best-of/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeId }),
      })
      if (!res.ok) {
        // Roll back optimistic update
        setVoted(false)
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not record your vote')
      }
      const data = await res.json()
      setVoteId(data.voteId)
      // Cookie hint for client-side state across navigations
      document.cookie = `${VOTED_STATE_COOKIE_PREFIX}${nomineeId}=${data.voteId}; Max-Age=2592000; Path=/; SameSite=Lax`
      // Refresh server data so the vote count + voters feed update
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record your vote')
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel = !signedIn
    ? 'Sign in to vote'
    : voted
      ? `Voted ✓ for ${nomineeName}`
      : `Vote for ${nomineeName}`

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || isPending}
        aria-pressed={voted}
        aria-label={buttonLabel}
        className={[
          'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all',
          voted
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            : 'bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white hover:shadow-md hover:from-[#008a8f] hover:to-[#00556e]',
          (loading || isPending) && 'opacity-60 cursor-wait',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {loading || isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : voted ? (
          <Check className="w-4 h-4" />
        ) : (
          <VoteIcon className="w-4 h-4" />
        )}
        <span>{buttonLabel}</span>
      </button>

      {voted && signedIn && (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading || isPending}
          className="text-xs text-text-secondary hover:text-text underline w-full text-center"
        >
          Retract vote
        </button>
      )}

      {!signedIn && (
        <p className="text-xs text-text-secondary text-center">
          New to MoVal.living?{' '}
          <Link
            href={buildLoginRedirectUrl(
              typeof window !== 'undefined'
                ? window.location.pathname + window.location.search
                : `/best-of/${categorySlug}`,
            ).replace('/login', '/register')}
            className="text-primary hover:underline font-medium"
          >
            Create an account
          </Link>
        </p>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
