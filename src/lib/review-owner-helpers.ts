/**
 * Helpers for tying reviews to Owner accounts.
 *
 * Used by:
 *   - The /api/businesses/[slug]/reviews POST handler — when the
 *     session has an Owner, set Review.ownerId alongside the
 *     snapshotted authorName/authorEmail.
 *   - The migration backfill — match existing reviews to Owners by
 *     authorEmail so historical reviews also become retrievable as
 *     "reviews by this user".
 *   - The ReviewList client form — pre-populate authorName + email
 *     for logged-in users so they don't have to type them again.
 *
 * Snapshots are kept on purpose: the authorName + authorEmail fields
 * remain authoritative for display, mirroring how BestOfVote snapshots
 * voterNameSnapshot. If a user later renames themselves in
 * /dashboard/profile, their OLD reviews keep the name the user had at
 * review-time — same model as Google/Yelp.
 */

import { asc, sql } from 'drizzle-orm'
import { owner as ownerTable } from '../db/schema'

interface SessionOwner {
  name: string | null
  email: string
}

interface ReviewPrefill {
  authorName: string
  authorEmail: string
  /** True when the values come from a logged-in session and should
   *  be shown read-only (or with an "Edit" affordance). */
  prefillLocked: boolean
}

export function buildReviewPrefill(session: SessionOwner | null): ReviewPrefill {
  if (!session) {
    return { authorName: '', authorEmail: '', prefillLocked: false }
  }
  const email = session.email.trim()
  const trimmedName = session.name?.trim()
  // Fall back to email prefix so the user always has a non-empty name
  // to submit with. They can edit it before submitting if they want
  // a different display name on this specific review.
  const authorName = trimmedName || email.split('@')[0] || ''
  return {
    authorName,
    authorEmail: email,
    prefillLocked: Boolean(trimmedName),
  }
}

export function normalizeReviewEmail(email: string | null | undefined): string {
  if (!email) return ''
  return email.trim().toLowerCase()
}

export function canBackfillReview(review: { authorEmail: string | null }): boolean {
  return Boolean(normalizeReviewEmail(review.authorEmail))
}

/**
 * Find an Owner id by exact normalized email match.
 *
 * Used by the review backfill script to link legacy anonymous reviews
 * (no ownerId) to their original reviewer, by matching Review.authorEmail
 * against Owner.email. Case-insensitive (compares LOWER(column) to the
 * already-lowercased input).
 *
 * Returns `null` when:
 *   - The email is empty / malformed
 *   - No Owner row exists with this email
 *
 * Note: there can be multiple Owner rows for the same email (a soft edge
 * case — duplicate signups, etc.). We pick the OLDEST row by createdAt
 * so the original reviewer's account gets the credit, not a later signup
 * with the same address.
 */
type OwnerLookup = {
  query: {
    owner: {
      findFirst: (args: unknown) => Promise<{ id: string } | undefined>
    }
  }
}

export async function matchOwnerByEmail(
  database: OwnerLookup,
  rawEmail: string | null | undefined,
): Promise<string | null> {
  const email = normalizeReviewEmail(rawEmail)
  if (!email) return null
  const owner = await database.query.owner.findFirst({
    // `email` is already trimmed + lowercased, so compare against LOWER(column).
    where: sql`lower(${ownerTable.email}) = ${email}`,
    orderBy: asc(ownerTable.createdAt),
    columns: { id: true },
  })
  return owner?.id ?? null
}
