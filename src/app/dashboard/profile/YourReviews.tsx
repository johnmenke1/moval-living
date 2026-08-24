'use client'

/**
 * YourReviews — fetches and displays the current Owner's reviews.
 *
 * Hydrates from server-side props (no flash of empty state on first
 * paint) then polls /api/profile/reviews every 30s so newly-submitted
 * reviews appear without a manual refresh.
 *
 * Why polling:
 *   - Users may leave a review on a business page and navigate
 *     straight to /dashboard/profile. Server-side props alone
 *     would show stale data unless we coordinate a router.refresh
 *     across the navigation. Polling handles it without coordination.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, AlertCircle, MessageSquare, ExternalLink, Trash2, Loader2 } from 'lucide-react'
import type { ReviewPageItem } from './your-reviews-helpers'
import { buildDeleteConfirmPrompt } from './review-delete-helpers'

interface YourReviewsProps {
  initialReviews: ReviewPageItem[]
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

function ReviewRow({
  review,
  onDeleted,
}: {
  review: ReviewPageItem
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (deleting || pending) return
    const confirmed = window.confirm(
      buildDeleteConfirmPrompt(review.business.name),
    )
    if (!confirmed) return

    setError(null)
    setDeleting(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not delete your review')
      }
      onDeleted(review.id)
      // Trigger a router refresh so any cache that holds the deleted
      // review (server component tree, anyone) re-renders.
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <Link
            href={`/business/${review.business.slug}`}
            className="text-sm font-bold text-text hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            {review.business.name}
            <ExternalLink className="w-3 h-3 text-text-secondary" />
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <Stars rating={review.rating} />
            <span className="text-xs text-text-secondary">
              {review.formattedDate}
            </span>
            {review.flagged && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Under review
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || pending}
          aria-label={`Delete your review of ${review.business.name}`}
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-red-600 disabled:opacity-50 disabled:cursor-wait px-2 py-1 rounded transition-colors"
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Delete
        </button>
      </div>
      <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
        {review.content}
      </p>
      {review.response && (
        <div className="mt-3 pl-3 border-l-2 border-primary/30 text-xs text-text-secondary italic">
          <span className="font-semibold not-italic text-primary">
            Business response:
          </span>{' '}
          {review.response}
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </article>
  )
}

export function YourReviews({ initialReviews }: YourReviewsProps) {
  const [reviews, setReviews] = useState<ReviewPageItem[]>(initialReviews)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/profile/reviews', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          // Shouldn't happen — server-side guard already redirected
          // anonymous users. Treat silently.
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setReviews(data.reviews ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh')
    }
  }

  function handleDeleted(id: string) {
    // Optimistic remove — the row disappears immediately, the polling
    // load() call 30s later will confirm the server-side state matches.
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  useEffect(() => {
    // Skip the first load — initialReviews already has the data.
    // Start polling after a short delay so we don't double-fetch on
    // mount.
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (reviews.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <MessageSquare className="w-6 h-6 text-slate-400" />
        </div>
        <h2 className="text-sm font-bold text-text mb-1">No reviews yet</h2>
        <p className="text-xs text-text-secondary mb-4 max-w-md mx-auto">
          You haven&apos;t left any reviews. Find a local business you love and
          share your experience — your reviews are tied to your profile.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white font-semibold text-sm px-4 py-2 rounded-lg hover:shadow-md transition-all"
        >
          Browse businesses
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
      {error && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />
          Couldn&apos;t refresh: {error}
        </div>
      )}
      {reviews.map((r) => (
        <ReviewRow key={r.id} review={r} onDeleted={handleDeleted} />
      ))}
    </div>
  )
}