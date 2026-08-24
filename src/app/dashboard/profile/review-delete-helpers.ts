/**
 * Helpers for the review-delete confirmation flow.
 *
 * Pure functions only — no DB, no React. Lives outside the API route
 * and component so tests can import without pulling Next.js deps.
 */

export interface ReviewOwnershipRow {
  id: string
  ownerId: string | null
  authorEmail: string | null
}

/**
 * Returns true when the session owner "owns" this review — either
 * via the modern ownerId FK, OR via a legacy email match for reviews
 * left before the Review.ownerId migration.
 *
 * For a legitimate delete, BOTH paths are trustworthy:
 *   - ownerId matches → user is logged in as the Owner who left this
 *     review (only possible if they were signed in when they wrote it)
 *   - authorEmail matches (case-insensitive) → user is logged in with
 *     the same email they used when they left the review anonymously
 *
 * If neither matches, return false → 403.
 */
export function ownerOwnsReview(
  review: ReviewOwnershipRow,
  sessionOwnerId: string,
  sessionEmail?: string | null,
): boolean {
  if (review.ownerId && review.ownerId === sessionOwnerId) return true
  if (
    sessionEmail &&
    review.authorEmail &&
    review.authorEmail.trim().toLowerCase() === sessionEmail.trim().toLowerCase()
  ) {
    return true
  }
  return false
}

/**
 * Build a human-readable confirmation prompt for deleting a review.
 *
 * Used as the message passed to window.confirm() in the browser,
 * so this is rendered as plain text by the native dialog — NOT
 * as HTML. The dialog itself does not interpret HTML, so a
 * business name like '<script>alert(1)</script>' will display
 * verbatim as text in the dialog. That's the safe outcome.
 *
 * If we ever switch to a custom React-based confirmation dialog,
 * wrap the business name in JSX (which auto-escapes) instead of
 * interpolating raw HTML here.
 */
export function buildDeleteConfirmPrompt(businessName: string): string {
  return `Delete your review of ${businessName}?`
}