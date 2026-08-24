/**
 * Helpers for tying reviews to Owner accounts.
 *
 * Three functions:
 *   - matchOwnerByEmail: lookup an Owner by normalized email (used in
 *     the migration backfill + the API route for fresh reviews)
 *   - buildReviewPrefill: pull (name, email) from a session so the
 *     review form can pre-populate for logged-in users
 *   - normalizeEmail: shared lowercase + trim
 */

import { describe, expect, it } from 'vitest'
import {
  buildReviewPrefill,
  canBackfillReview,
  normalizeReviewEmail,
} from './review-owner-helpers'

describe('buildReviewPrefill', () => {
  it('returns the session name + email for a logged-in owner', () => {
    const prefill = buildReviewPrefill({
      name: 'Sarah K.',
      email: 'sarah@example.com',
    })
    expect(prefill).toEqual({
      authorName: 'Sarah K.',
      authorEmail: 'sarah@example.com',
      prefillLocked: true,
    })
  })

  it('falls back to email prefix when name is missing', () => {
    const prefill = buildReviewPrefill({
      name: null,
      email: 'sarah@example.com',
    })
    expect(prefill.authorName).toBe('sarah')
    expect(prefill.authorEmail).toBe('sarah@example.com')
  })

  it('returns null fields for an anonymous session', () => {
    const prefill = buildReviewPrefill(null)
    expect(prefill).toEqual({
      authorName: '',
      authorEmail: '',
      prefillLocked: false,
    })
  })

  it('returns unlocked prefill for empty session name (user can edit)', () => {
    const prefill = buildReviewPrefill({
      name: '',
      email: 'sarah@example.com',
    })
    expect(prefill.authorName).toBe('sarah')
    // No real name on file — show as editable so user can pick something
    // better than the email prefix.
    expect(prefill.prefillLocked).toBe(false)
  })
})

describe('canBackfillReview', () => {
  it('returns true when a non-empty email matches an Owner', () => {
    expect(canBackfillReview({ authorEmail: 'FOO@bar.com' })).toBe(true)
  })

  it('returns false when email is null', () => {
    expect(canBackfillReview({ authorEmail: null })).toBe(false)
  })

  it('returns false when email is empty after trim', () => {
    expect(canBackfillReview({ authorEmail: '   ' })).toBe(false)
  })
})

describe('normalizeReviewEmail', () => {
  it('lowercases + trims', () => {
    expect(normalizeReviewEmail('  Foo@BAR.com  ')).toBe('foo@bar.com')
  })

  it('returns empty string for null', () => {
    expect(normalizeReviewEmail(null)).toBe('')
  })

  it('returns empty string for whitespace-only', () => {
    expect(normalizeReviewEmail('   ')).toBe('')
  })
})