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

/** Search-results priority (verified 2026-08-16): Expert Partner and
 * Featured/EP tier still lead, but BestOf is demoted *below* Featured-only
 * (instead of sitting above it, as on the homepage). The rationale per
 * Johnny: on /search, the visitor is browsing → Featured is the "paid
 * spotlight" tier, so it should rank above the editorial "Best Of" badge
 * when the two aren't combined. Use this on /search only.
 *
 *   0 = Expert Partner (any combination — EP wins outright)
 *   1 = FEATURED-or-EXPERT_PARTNER tier (BestOf+Featured combined also
 *       sits here, so a Featured BestOf winner doesn't fall behind a
 *       Featured-only listing)
 *   2 = Best Of only — no Featured/EP tier, no EP flag
 *   3 = everything else (regular FREE listings)
 *
 * Within a tier the secondary sort is alphabetical by name. The SAME
 * function is also used as the within-grouping sort on /search, so a
 * category section reads: EP → Featured → BestOf → Free, each tier A→Z. */
export function compareBusinessesForSearch<T extends PriorityBusiness & { name: string }>(a: T, b: T): number {
  const aIsEp = a.isExpertPartner || a.tier === 'EXPERT_PARTNER'
  const bIsEp = b.isExpertPartner || b.tier === 'EXPERT_PARTNER'
  const aElevated = a.tier === 'FEATURED' || a.tier === 'EXPERT_PARTNER'
  const bElevated = b.tier === 'FEATURED' || b.tier === 'EXPERT_PARTNER'

  let pa: number
  if (aIsEp) pa = 0
  else if (aElevated) pa = 1
  else if (a.isBestOfWinner) pa = 2
  else pa = 3

  let pb: number
  if (bIsEp) pb = 0
  else if (bElevated) pb = 1
  else if (b.isBestOfWinner) pb = 2
  else pb = 3

  if (pa !== pb) return pa - pb
  return a.name.localeCompare(b.name)
}
