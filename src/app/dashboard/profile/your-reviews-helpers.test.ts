/**
 * Helpers for the "Your reviews" surface on /dashboard/profile.
 *
 * Pure functions only — no DB, no React. Lives outside the API
 * route + component so tests can import without pulling Next.js
 * dependencies.
 */

import { describe, expect, it } from 'vitest'
import {
  formatReviewTimestamp,
  buildReviewsPageResponse,
  buildEmptyReviewsResponse,
} from './your-reviews-helpers'

describe('formatReviewTimestamp', () => {
  it('formats an ISO date as "Aug 22, 2026"', () => {
    expect(formatReviewTimestamp('2026-08-22T12:00:00Z')).toBe('Aug 22, 2026')
  })

  it('pads single-digit days to 2 chars so "Aug 2" becomes "Aug 02"', () => {
    expect(formatReviewTimestamp('2026-08-02T12:00:00Z')).toBe('Aug 02, 2026')
  })

  it('handles all 12 months without locale dependency', () => {
    const months = [
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
      '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01',
      '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01',
    ]
    const expected = [
      'Jan 01, 2026', 'Feb 01, 2026', 'Mar 01, 2026', 'Apr 01, 2026',
      'May 01, 2026', 'Jun 01, 2026', 'Jul 01, 2026', 'Aug 01, 2026',
      'Sep 01, 2026', 'Oct 01, 2026', 'Nov 01, 2026', 'Dec 01, 2026',
    ]
    months.forEach((iso, idx) => {
      expect(formatReviewTimestamp(iso + 'T00:00:00Z')).toBe(expected[idx])
    })
  })

  it('returns the original string for invalid input (does not throw)', () => {
    expect(formatReviewTimestamp('not-a-date')).toBe('not-a-date')
  })
})

describe('buildReviewsPageResponse', () => {
  it('maps a review row to the page shape', () => {
    const response = buildReviewsPageResponse({
      id: 'r_1',
      rating: 5,
      content: 'Great service',
      authorName: 'Sarah K.',
      authorEmail: 'sarah@example.com',
      response: null,
      flagged: false,
      createdAt: '2026-08-22T12:00:00Z',
      business: { id: 'b_1', name: 'Goat & Vine', slug: 'goat-vine' },
    })
    expect(response).toEqual({
      id: 'r_1',
      rating: 5,
      content: 'Great service',
      authorName: 'Sarah K.',
      authorEmail: 'sarah@example.com',
      response: null,
      flagged: false,
      createdAt: '2026-08-22T12:00:00Z',
      formattedDate: 'Aug 22, 2026',
      business: { id: 'b_1', name: 'Goat & Vine', slug: 'goat-vine' },
    })
  })

  it('passes through the response field when present', () => {
    const response = buildReviewsPageResponse({
      id: 'r_2',
      rating: 4,
      content: 'Good',
      authorName: 'A',
      authorEmail: null,
      response: 'Thanks for the kind words!',
      flagged: false,
      createdAt: '2026-08-22T12:00:00Z',
      business: { id: 'b_1', name: 'X', slug: 'x' },
    })
    expect(response.response).toBe('Thanks for the kind words!')
  })
})

describe('buildEmptyReviewsResponse', () => {
  it('returns the canonical empty state shape', () => {
    expect(buildEmptyReviewsResponse()).toEqual({
      reviews: [],
      total: 0,
    })
  })
})