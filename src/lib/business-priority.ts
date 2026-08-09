/**
 * Business sort priority used by the homepage and the search/category
 * pages so listings appear in a consistent, curated order.
 *
 * The homepage applies this AFTER filtering to only elevated listings
 * (FEATURED + EXPERT_PARTNER tier + BestOf winners). The search and
 * category pages apply this to ALL approved businesses so the same
 * hierarchy holds end-to-end — visitors always see Expert Partners
 * first, then BestOf+Featured/EP, then Featured/EP only, then BestOf
 * only, then everything else.
 *
 * Within a tier the caller is expected to apply a secondary sort
 * (newest first, rating, name, etc.) — `compareBusinesses` does that
 * secondary sort by createdAt desc.
 */

export interface PriorityBusiness {
  tier: string
  isBestOfWinner: boolean
  isExpertPartner: boolean
  createdAt?: Date | string
}

/** Lower = higher priority. Tiers:
 *   0 = Expert Partner (any combination — EP wins outright)
 *   1 = Best Of + (FEATURED or EXPERT_PARTNER tier)
 *   2 = (FEATURED or EXPERT_PARTNER tier) only — no BestOf, no EP flag
 *   3 = Best Of only — no Featured/EP tier, no EP flag
 *   4 = everything else (regular FREE listings) */
export function businessPriority(b: PriorityBusiness): number {
  if (b.isExpertPartner) return 0
  const elevated = b.tier === 'FEATURED' || b.tier === 'EXPERT_PARTNER'
  if (b.isBestOfWinner && elevated) return 1
  if (elevated) return 2
  if (b.isBestOfWinner) return 3
  return 4
}

/**
 * Compare two businesses by priority tier, then by createdAt desc as a
 * stable secondary sort. Use with Array.prototype.sort.
 */
export function compareBusinesses<T extends PriorityBusiness>(a: T, b: T): number {
  const diff = businessPriority(a) - businessPriority(b)
  if (diff !== 0) return diff
  // Within a tier, keep most recent first. Defensive: createdAt may be a
  // string (Prisma with certain drivers) or a Date.
  const at = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt ?? 0).getTime()
  const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt ?? 0).getTime()
  return bt - at
}
