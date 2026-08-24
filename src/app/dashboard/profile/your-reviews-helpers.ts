/**
 * Pure helpers for the "Your reviews" surface on /dashboard/profile.
 *
 * formatReviewTimestamp: locale-stable date formatter (the same
 *   pattern used in ReviewList.tsx — same shape "Aug 22, 2026" so
 *   date strings are consistent across the app). Avoids
 *   toLocaleDateString to prevent hydration mismatches (#418).
 *
 * buildReviewsPageResponse: shape the API row into the page payload,
 *   computing formattedDate at the boundary so the client doesn't
 *   have to.
 *
 * buildEmptyReviewsResponse: canonical empty state.
 */

interface ReviewRow {
  id: string
  rating: number
  content: string
  authorName: string
  authorEmail: string | null
  response: string | null
  flagged: boolean
  createdAt: string // ISO
  business: { id: string; name: string; slug: string }
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export function formatReviewTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const month = MONTHS[d.getUTCMonth()]
  // Pad day to 2 chars so "Aug  2, 2026" lines up with "Aug 22, 2026"
  const day = String(d.getUTCDate()).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${month} ${day}, ${year}`
}

export interface ReviewPageItem {
  id: string
  rating: number
  content: string
  authorName: string
  authorEmail: string | null
  response: string | null
  flagged: boolean
  createdAt: string
  formattedDate: string
  business: { id: string; name: string; slug: string }
}

export function buildReviewsPageResponse(row: ReviewRow): ReviewPageItem {
  return {
    id: row.id,
    rating: row.rating,
    content: row.content,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    response: row.response,
    flagged: row.flagged,
    createdAt: row.createdAt,
    formattedDate: formatReviewTimestamp(row.createdAt),
    business: row.business,
  }
}

export function buildEmptyReviewsResponse(): {
  reviews: ReviewPageItem[]
  total: number
} {
  return { reviews: [], total: 0 }
}