'use client'

import { useState } from 'react'
import { Star, Send, User } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

export function ReviewList({ businessId, businessSlug, initialReviews }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [showForm, setShowForm] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)
  const [rating, setRating] = useState(0)
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-text">
          Reviews {reviews.length > 0 && <span className="text-text-secondary font-normal">({reviews.length})</span>}
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
              <label className="label">Your Name <span className="text-error">*</span></label>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                className="input"
                placeholder="Jane Smith"
                required
              />
            </div>
            <div>
              <label className="label">Email (optional, not published)</label>
              <input
                type="email"
                value={authorEmail}
                onChange={e => setAuthorEmail(e.target.value)}
                className="input"
                placeholder="jane@email.com"
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
