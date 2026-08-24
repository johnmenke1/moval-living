/**
 * Helpers for the review-edit flow.
 *
 * Pure functions only — no DB, no React. Lives outside the API route
 * and component so tests can import without pulling Next.js deps.
 */

export interface ReviewEditInput {
  /** New rating value, 1-5. */
  rating?: number
  /** New content. Trimmed; must be non-empty when provided. */
  content?: string
}

export interface ReviewEditValidationError {
  /** Field that failed validation. */
  field: 'rating' | 'content'
  message: string
}

/**
 * Max content length. Mirrors the implicit cap from the public
 * /business/[slug] review form (which is a textarea with a
 * 5,000 char visual cap). Keeps DB rows bounded — content is
 * stored as @db.Text so technically unlimited, but in practice
 * 5,000 chars is the upper bound we want to commit to.
 */
export const REVIEW_CONTENT_MAX = 5000

/**
 * Validate a review edit payload. Returns null on success, or the
 * first validation error. Caller is responsible for returning 400
 * with the error message.
 *
 * Validation rules:
 *   - rating (optional): integer 1-5
 *   - content (optional): non-empty after trim, ≤ 5000 chars
 *   - at least one of {rating, content} must be provided (otherwise
 *     it's a no-op patch — reject early so we don't write an
 *     `updatedAt` bump for nothing)
 */
export function validateReviewEdit(
  input: ReviewEditInput,
): ReviewEditValidationError | null {
  const hasRating = input.rating !== undefined
  const hasContent = input.content !== undefined
  if (!hasRating && !hasContent) {
    return { field: 'content', message: 'Provide a rating or content to edit' }
  }
  if (hasRating) {
    if (typeof input.rating !== 'number' || !Number.isInteger(input.rating)) {
      return { field: 'rating', message: 'Rating must be an integer' }
    }
    if (input.rating < 1 || input.rating > 5) {
      return { field: 'rating', message: 'Rating must be between 1 and 5' }
    }
  }
  if (hasContent) {
    if (typeof input.content !== 'string') {
      return { field: 'content', message: 'Content must be a string' }
    }
    const trimmed = input.content.trim()
    if (trimmed.length === 0) {
      return { field: 'content', message: 'Content cannot be empty' }
    }
    if (trimmed.length > REVIEW_CONTENT_MAX) {
      return {
        field: 'content',
        message: `Content cannot exceed ${REVIEW_CONTENT_MAX} characters`,
      }
    }
  }
  return null
}

/**
 * Build the Prisma update payload from a validated edit input.
 *
 * Trims content and only includes the fields the caller provided.
 * Empty object means "no-op" — caller should not call this with an
 * empty payload (validateReviewEdit catches that case).
 */
export function buildReviewEditPayload(
  input: ReviewEditInput,
): { rating?: number; content?: string } {
  const data: { rating?: number; content?: string } = {}
  if (input.rating !== undefined) data.rating = input.rating
  if (input.content !== undefined) data.content = input.content.trim()
  return data
}

/**
 * Build a confirmation prompt for the user before saving their
 * edit. Uses window.confirm() (plain text) — same as delete.
 */
export function buildEditConfirmPrompt(
  hasContentChange: boolean,
  hasRatingChange: boolean,
): string {
  if (hasContentChange && hasRatingChange) {
    return 'Save changes to your review?'
  }
  if (hasContentChange) {
    return 'Save your edited review?'
  }
  if (hasRatingChange) {
    return 'Save your new rating?'
  }
  // Should not happen — caller should have validated first. Defensive.
  return 'Save changes?'
}