/**
 * Best Of composite scoring engine
 *
 * Factor weights (must sum to 1.0):
 *   googleRating          20%
 *   googleReviewCount     15%
 *   yearsActive           15%
 *   localOwnership        10%
 *   uniqueness            15%
 *   communityInvolvement  10%
 *   personalVisitReview   15%
 *
 * Normalization:
 *   googleRating      → raw (0–5) / 5 × 0.20
 *   googleReviewCount → relative to category max / max × 0.15
 *   yearsActive      → relative to category max / max × 0.15
 *   editorial scores → raw (0–10) / 10 × weight
 *
 * Returns the composite score (0–100) and per-factor breakdown.
 */

export const FACTOR_WEIGHTS: Record<string, number> = {
  googleRating:          0.20,
  googleReviewCount:     0.15,
  yearsActive:           0.15,
  localOwnership:        0.10,
  uniqueness:            0.15,
  communityInvolvement:  0.10,
  personalVisitReview:   0.15,
}

export const FACTOR_ORDER = [
  'googleRating',
  'googleReviewCount',
  'yearsActive',
  'localOwnership',
  'uniqueness',
  'communityInvolvement',
  'personalVisitReview',
] as const

export type Factor = typeof FACTOR_ORDER[number]

export interface FactorScore {
  factor: string
  /** Actual entry value (0-5 for googleRating, raw count for reviews, 0-10 for editorial) */
  rawValue: number
  /** 0-100 weighted contribution added to composite */
  normalizedScore: number
  weight: number
}

/**
 * Compute per-factor scores and the composite for a single entry,
 * given the max review count and max yearsActive in its category.
 */
export function computeScores(
  entry: {
    googleRating: number | null
    googleReviewCount: number | null
    yearsActive: number | null
    localOwnership: number
    uniqueness: number
    communityInvolvement: number
    personalVisitReview: number
  },
  categoryMax: { maxReviews: number; maxYears: number }
): { factors: FactorScore[]; composite: number } {
  const factors: FactorScore[] = []
  let composite = 0

  // googleRating: 0–5 → contribution 0–20
  const gRating = entry.googleRating ?? 0
  const gRatingNorm = (gRating / 5) * 20
  factors.push({ factor: 'googleRating', rawValue: gRating, weight: 0.20, normalizedScore: gRatingNorm })
  composite += gRatingNorm

  // googleReviewCount: relative → contribution 0–15
  const reviewCount = entry.googleReviewCount ?? 0
  const maxReviews = categoryMax.maxReviews || 1
  const reviewNorm = (Math.min(reviewCount, maxReviews) / maxReviews) * 15
  factors.push({ factor: 'googleReviewCount', rawValue: reviewCount, weight: 0.15, normalizedScore: reviewNorm })
  composite += reviewNorm

  // yearsActive: relative → contribution 0–15
  const years = entry.yearsActive ?? 0
  const maxYears = categoryMax.maxYears || 1
  const yearsNorm = (Math.min(years, maxYears) / maxYears) * 15
  factors.push({ factor: 'yearsActive', rawValue: years, weight: 0.15, normalizedScore: yearsNorm })
  composite += yearsNorm

  // Editorial scores: 0–10 → weighted contribution 0–100
  for (const factor of ['localOwnership', 'uniqueness', 'communityInvolvement', 'personalVisitReview'] as const) {
    const raw = entry[factor] ?? 0
    const weight = FACTOR_WEIGHTS[factor]
    const norm = (raw / 10) * (weight * 100)
    factors.push({ factor, rawValue: raw, weight, normalizedScore: norm })
    composite += norm
  }

  return { factors, composite: Math.round(composite * 100) / 100 }
}
