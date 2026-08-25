'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Loader2, Star, Users } from 'lucide-react'

export type UserRsvpStatus = 'GOING' | 'INTERESTED' | null

interface RsvpButtonsProps {
  slug: string
  initialStatus: UserRsvpStatus
  goingCount: number
  interestedCount: number
  isAuthenticated: boolean
}

export function RsvpButtons({
  slug,
  initialStatus,
  goingCount,
  interestedCount,
  isAuthenticated,
}: RsvpButtonsProps) {
  const router = useRouter()
  const [status, setStatus] = useState<UserRsvpStatus>(initialStatus)
  const [counts, setCounts] = useState({ going: goingCount, interested: interestedCount })
  const [loading, setLoading] = useState<UserRsvpStatus | 'removing' | null>(null)

  async function updateStatus(next: 'GOING' | 'INTERESTED') {
    if (loading) return
    setLoading(next)
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not save your RSVP')
      }
      setStatus(next)
      setCounts((prev) => {
        const wasGoing = status === 'GOING'
        const wasInterested = status === 'INTERESTED'
        const nextGoing = next === 'GOING' ? prev.going + (wasGoing ? 0 : 1) : prev.going - (wasGoing ? 1 : 0)
        const nextInterested = next === 'INTERESTED' ? prev.interested + (wasInterested ? 0 : 1) : prev.interested - (wasInterested ? 1 : 0)
        return { going: Math.max(0, nextGoing), interested: Math.max(0, nextInterested) }
      })
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  async function removeStatus() {
    if (loading) return
    setLoading('removing')
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/rsvp`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not remove your RSVP')
      }
      setCounts((prev) => ({
        going: status === 'GOING' ? Math.max(0, prev.going - 1) : prev.going,
        interested: status === 'INTERESTED' ? Math.max(0, prev.interested - 1) : prev.interested,
      }))
      setStatus(null)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-text font-semibold mb-2">
          <Users className="w-4 h-4 text-primary" />
          {counts.going > 0 ? `${counts.going} going` : 'Be the first to RSVP'}
          {counts.interested > 0 && <span className="text-text-secondary font-normal"> · {counts.interested} interested</span>}
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Sign in to let others know you&apos;re attending or interested.
        </p>
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/events/${slug}`)}`}
          className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          Sign in to RSVP
        </Link>
      </div>
    )
  }

  const goingActive = status === 'GOING'
  const interestedActive = status === 'INTERESTED'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 text-text font-semibold mb-4">
        <Users className="w-4 h-4 text-primary" />
        {counts.going} going
        {counts.interested > 0 && <span className="text-text-secondary font-normal"> · {counts.interested} interested</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => (goingActive ? removeStatus() : updateStatus('GOING'))}
          disabled={loading !== null}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors disabled:opacity-60 ${
            goingActive
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-slate-100 text-text hover:bg-slate-200'
          }`}
        >
          {loading === 'GOING' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : goingActive ? (
            <>
              <Check className="w-4 h-4" /> Going
            </>
          ) : (
            'I\'m going'
          )}
        </button>

        <button
          type="button"
          onClick={() => (interestedActive ? removeStatus() : updateStatus('INTERESTED'))}
          disabled={loading !== null}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors disabled:opacity-60 ${
            interestedActive
              ? 'bg-accent text-white hover:bg-accent/90'
              : 'bg-slate-100 text-text hover:bg-slate-200'
          }`}
        >
          {loading === 'INTERESTED' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : interestedActive ? (
            <>
              <Star className="w-4 h-4 fill-current" /> Interested
            </>
          ) : (
            'Interested'
          )}
        </button>
      </div>

      {status && (
        <button
          type="button"
          onClick={removeStatus}
          disabled={loading !== null}
          className="mt-3 w-full text-xs text-text-secondary hover:text-red-600 transition-colors"
        >
          {loading === 'removing' ? 'Removing…' : 'Remove my RSVP'}
        </button>
      )}
    </div>
  )
}
