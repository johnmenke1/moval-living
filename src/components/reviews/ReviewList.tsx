'use client'

import { useState } from 'react'
import { Star, Send, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildReviewPrefill } from '@/lib/review-owner-helpers'

interface Review {
  id: string
  authorName: string
  authorEmail: string | null
  rating: number
  content: string
  response: string | null
  createdAt: Date
}

// Format dates consistently on both server and client without locale-dependent toLocaleDateString.
function formatReviewDate(date: Date): string {
  const d = new Date(date)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

interface ReviewListProps {
  businessId: string
  businessSlug: string
  initialReviews: Review[]
  /** Optional session — when present, the form pre-populates
   *  authorName/authorEmail and locks the fields so the review is
   *  reliably tied to the logged-in Owner. */
  session?: { name: string | null; email: string } | null
  googleBusinessId?: string | null
  googleRating?: number | null
  googleReviewCount?: number | null
  googleMapsUrl?: string | null
}

export function ReviewList({ businessId, businessSlug, initialReviews, session, googleBusinessId, googleRating, googleReviewCount, googleMapsUrl }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [showForm, setShowForm] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)
  const [rating, setRating] = useState(0)
  // When the user is logged in, pre-populate from their profile and
  // lock the fields. The "use different name" link lets them opt
  // out for a single review without affecting their profile.
  const prefill = buildReviewPrefill(session ?? null)
  const [authorName, setAuthorName] = useState(prefill.authorName)
  const [authorEmail, setAuthorEmail] = useState(prefill.authorEmail)
  const [nameLocked, setNameLocked] = useState(prefill.prefillLocked)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const showGoogleBadge = !!(googleBusinessId && googleRating && googleReviewCount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || !authorName.trim() || !content.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/businesses/${businessSlug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: authorName.trim(), authorEmail: authorEmail.trim(), rating, content: content.trim() }),
      })

      if (!res.ok) throw new Error('Failed to submit review')
      const newReview = await res.json()
      setReviews([newReview, ...reviews])
      setSuccess(true)
      setShowForm(false)
      setRating(0)
      setAuthorName('')
      setAuthorEmail('')
      setContent('')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Google Reviews Badge */}
      {showGoogleBadge && (
        <div className="mb-8 p-5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Google G logo mark */}
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-text">{googleRating!.toFixed(1)}</span>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(star => (
                    <Star
                      key={star}
                      className={cn(
                        'w-3.5 h-3.5',
                        star <= Math.round(googleRating!)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-300'
                      )}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-text">{googleReviewCount!.toLocaleString()}</span> reviews on Google
              </p>
            </div>
          </div>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm py-2 px-4 shrink-0 text-center"
            >
              View on Google →
            </a>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text">
          Local Reviews {reviews.length > 0 && <span className="text-text-secondary font-normal">({reviews.length})</span>}
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary text-sm py-2 px-4"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-text mb-4">Write a Review</h3>
          
          {/* Star Rating */}
          <div className="mb-4">
            <label className="label">Your Rating <span className="text-error">*</span></label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      star <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                    )}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 text-sm text-text-secondary">{rating} / 5</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">
                Your Name <span className="text-error">*</span>
                {nameLocked && (
                  <button
                    type="button"
                    onClick={() => setNameLocked(false)}
                    className="ml-2 text-xs font-normal text-primary hover:underline"
                  >
                    Use a different name
                  </button>
                )}
              </label>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                className="input"
                placeholder="Jane Smith"
                required
                readOnly={nameLocked}
                aria-readonly={nameLocked}
              />
            </div>
            <div>
              <label className="label">
                Email {session ? '(linked to your account)' : '(optional, not published)'}
              </label>
              <input
                type="email"
                value={authorEmail}
                onChange={e => setAuthorEmail(e.target.value)}
                className="input"
                placeholder="jane@email.com"
                readOnly={Boolean(session)}
                aria-readonly={Boolean(session)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Your Review <span className="text-error">*</span></label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="input min-h-[120px] resize-none"
              placeholder="Share your experience with this business..."
              required
            />
          </div>

          {error && <p className="text-error text-sm mb-4">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary text-sm">
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(''); setSuccess(false) }}
              className="text-sm text-text-secondary hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {success && !showForm && (
        <div className="bg-success/10 text-success text-sm p-4 rounded-lg mb-6 flex items-center gap-2">
          ✅ Your review has been submitted and will appear shortly!
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <User className="w-12 h-12 mx-auto mb-4 text-slate-200" />
          <p className="font-medium text-text mb-1">No reviews yet</p>
          <p className="text-sm">Be the first to share your experience!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map(review => (
            <div key={review.id} className="border-b border-slate-100 pb-6 last:border-0 last:pb-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {review.authorName[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-text">{review.authorName}</p>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(star => (
                        <Star
                          key={star}
                          className={cn(
                            'w-3.5 h-3.5',
                            star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-text-secondary">
                  {formatReviewDate(review.createdAt)}
                </span>
              </div>
              <p className="text-text-secondary leading-relaxed ml-13">{review.content}</p>
              {review.response && (
                <div className="ml-13 mt-3 bg-blue-50 border-l-4 border-primary p-3 rounded-r-lg">
                  <p className="text-xs font-semibold text-primary mb-1">Owner Response</p>
                  <p className="text-sm text-text-secondary">{review.response}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
