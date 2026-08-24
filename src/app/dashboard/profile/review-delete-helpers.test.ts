/**
 * Helpers for the review-delete confirmation flow.
 *
 * Pure functions only — no DB, no React. Lives outside the API route
 * and component so tests can import without pulling Next.js deps.
 */

import { describe, expect, it } from 'vitest'
import {
  buildDeleteConfirmPrompt,
  ownerOwnsReview,
  type ReviewOwnershipRow,
} from './review-delete-helpers'

describe('ownerOwnsReview', () => {
  it('returns true when the ownerId matches the session ownerId', () => {
    const review: ReviewOwnershipRow = {
      id: 'r_1',
      ownerId: 'owner_123',
      authorEmail: 'sarah@example.com',
    }
    expect(ownerOwnsReview(review, 'owner_123')).toBe(true)
  })

  it('returns false when the ownerId does not match', () => {
    const review: ReviewOwnershipRow = {
      id: 'r_2',
      ownerId: 'owner_456',
      authorEmail: 'sarah@example.com',
    }
    expect(ownerOwnsReview(review, 'owner_123')).toBe(false)
  })

  it('falls back to authorEmail match when ownerId is null (legacy)', () => {
    const review: ReviewOwnershipRow = {
      id: 'r_3',
      ownerId: null,
      authorEmail: 'sarah@EXAMPLE.com',
    }
    expect(ownerOwnsReview(review, 'owner_123', 'sarah@example.com')).toBe(true)
  })

  it('returns false when ownerId is null and emails do not match', () => {
    const review: ReviewOwnershipRow = {
      id: 'r_4',
      ownerId: null,
      authorEmail: 'sarah@example.com',
    }
    expect(
      ownerOwnsReview(review, 'owner_123', 'someone-else@example.com'),
    ).toBe(false)
  })

  it('returns false when ownerId is null and no sessionEmail is provided', () => {
    const review: ReviewOwnershipRow = {
      id: 'r_5',
      ownerId: null,
      authorEmail: 'sarah@example.com',
    }
    expect(ownerOwnsReview(review, 'owner_123')).toBe(false)
  })
})

describe('buildDeleteConfirmPrompt', () => {
  it('returns a confirmation question with the business name', () => {
    const prompt = buildDeleteConfirmPrompt('Goat & Vine Coffee')
    expect(prompt).toBe('Delete your review of Goat & Vine Coffee?')
  })

  it('handles names with ampersands', () => {
    const prompt = buildDeleteConfirmPrompt('Goat & Vine')
    expect(prompt).toBe('Delete your review of Goat & Vine?')
  })

  it('passes through the business name verbatim (window.confirm() is plain text)', () => {
    // Native browser confirm() renders the message as text, not HTML.
    // We deliberately do NOT escape here — that's the safe behavior.
    const prompt = buildDeleteConfirmPrompt('<script>alert(1)</script>')
    expect(prompt).toBe('Delete your review of <script>alert(1)</script>?')
  })
})