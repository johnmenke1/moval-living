'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Check, Vote as VoteIcon, AlertCircle } from 'lucide-react'
import {
  VOTED_STATE_COOKIE_PREFIX,
  buildLoginRedirectUrl,
} from './vote-button-helpers'

export {
  VOTED_STATE_COOKIE_PREFIX,
  buildLoginRedirectUrl,
}

interface VoteButtonProps {
  nomineeId: string
  nomineeName: string
  categorySlug: string
  initialVoted: boolean
  initialVoteId?: string
  signedIn: boolean
  variant?: 'default' | 'small'
}

export function VoteButton({
  nomineeId,
  nomineeName,
  categorySlug,
  initialVoted,
  initialVoteId,
  signedIn,
  variant = 'default',
}: VoteButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [voted, setVoted] = useState(initialVoted)
  const [voteId, setVoteId] = useState<string | undefined>(initialVoteId)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setError(null)

    if (!signedIn) {
      const target = buildLoginRedirectUrl(
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : `/best-of/${categorySlug}`,
      )
      router.push(target)
      return
    }

    if (voted && voteId) {
      const ok = window.confirm(
        `Retract your vote for ${nomineeName}? You can vote again later.`,
      )
      if (!ok) return
      setLoading(true)
      try {
        const res = await fetch(`/api/best-of/votes/${voteId}`, { method: 'DELETE' })
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

    setLoading(true)
    setVoted(true)
    try {
      const res = await fetch('/api/best-of/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomineeId }),
      })
      if (!res.ok) {
        setVoted(false)
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not record your vote')
      }
      const data = await res.json()
      setVoteId(data.voteId)
      document.cookie = `${VOTED_STATE_COOKIE_PREFIX}${nomineeId}=${data.voteId}; Max-Age=2592000; Path=/; SameSite=Lax`
      router.push(`/best-of/voted/${data.voteId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record your vote')
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel = !signedIn
    ? 'Sign in to vote'
    : voted
      ? 'Voted'
      : 'Vote'

  if (variant === 'small') {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading || isPending}
          aria-pressed={voted}
          aria-label={buttonLabel}
          className={[
            'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all',
            voted
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              : 'bg-primary text-white hover:bg-primary/90',
            (loading || isPending) && 'opacity-60 cursor-wait',
          ].filter(Boolean).join(' ')}
        >
          {loading || isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : voted ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <VoteIcon className="w-3.5 h-3.5" />
          )}
          <span>{buttonLabel}</span>
        </button>
        {error && (
          <div className="flex items-start gap-1 text-xs text-red-700">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    )
  }

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
        ].filter(Boolean).join(' ')}
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
