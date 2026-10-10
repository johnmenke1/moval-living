import { and, desc, gte, isNotNull } from 'drizzle-orm'
import { db, business } from '@/db'

/**
 * Server-side fetch for the admin "Claimed Businesses" page.
 *
 * A business is considered "claimed" iff it has an `ownerId` — i.e.
 * someone has completed the claim flow and verified ownership. The
 * `claimedAt` timestamp is set on first claim, so we can sort by recency
 * and bucket by age (last 7 / 30 / 90 days).
 *
 * Returns a lean shape (only what the list view needs) so the page
 * component doesn't pull unused columns across 1k+ rows. Includes the
 * owner name + email so admins can contact them without a second query.
 *
 * Ordered by `claimedAt DESC` so the most recent claims surface first —
 * the same ordering the live-activity ticker uses for "X just claimed…"
 * events, so the admin view stays consistent with public signals.
 */
export async function getClaimedBusinesses() {
  return db.query.business.findMany({
    where: isNotNull(business.ownerId),
    columns: { id: true, name: true, slug: true, claimedAt: true },
    with: {
      category: { columns: { name: true, slug: true } },
      owner: { columns: { id: true, name: true, email: true } },
    },
    orderBy: desc(business.claimedAt),
  })
}

/**
 * Summary stats for the page header chip ("8 claimed • 3 this month").
 * Cheap — single grouped query, no row data fetched.
 */
export async function getClaimedBusinessStats() {
  const now = Date.now()
  const day = 86400000
  const claimed = isNotNull(business.ownerId)
  const since = (days: number) => and(claimed, gte(business.claimedAt, new Date(now - days * day)))
  const [total, last7d, last30d, last90d] = await Promise.all([
    db.$count(business, claimed),
    db.$count(business, since(7)),
    db.$count(business, since(30)),
    db.$count(business, since(90)),
  ])
  return { total, last7d, last30d, last90d }
}

export type ClaimedBusinessRow = Awaited<ReturnType<typeof getClaimedBusinesses>>[number]
