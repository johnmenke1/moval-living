import { describe, expect, it } from 'vitest'
import {
  buildEditConfirmPrompt,
  buildReviewEditPayload,
  REVIEW_CONTENT_MAX,
  validateReviewEdit,
  type ReviewEditInput,
} from './review-edit-helpers'

describe('validateReviewEdit', () => {
  it('accepts a rating-only edit', () => {
    expect(validateReviewEdit({ rating: 4 })).toBeNull()
  })

  it('accepts a content-only edit', () => {
    expect(validateReviewEdit({ content: 'Updated thoughts here' })).toBeNull()
  })

  it('accepts both fields together', () => {
    expect(
      validateReviewEdit({ rating: 5, content: 'This place is amazing' }),
    ).toBeNull()
  })

  it('rejects an empty payload (no fields)', () => {
    const err = validateReviewEdit({})
    expect(err).toEqual({
      field: 'content',
      message: 'Provide a rating or content to edit',
    })
  })

  it('rejects rating below 1', () => {
    const err = validateReviewEdit({ rating: 0 })
    expect(err?.field).toBe('rating')
  })

  it('rejects rating above 5', () => {
    const err = validateReviewEdit({ rating: 6 })
    expect(err?.field).toBe('rating')
  })

  it('rejects non-integer rating', () => {
    const err = validateReviewEdit({ rating: 4.5 })
    expect(err?.field).toBe('rating')
  })

  it('rejects empty content', () => {
    expect(validateReviewEdit({ content: '' })?.field).toBe('content')
    expect(validateReviewEdit({ content: '   ' })?.field).toBe('content')
  })

  it('rejects content over the max length', () => {
    const long = 'a'.repeat(REVIEW_CONTENT_MAX + 1)
    const err = validateReviewEdit({ content: long })
    expect(err?.field).toBe('content')
    expect(err?.message).toMatch(/exceed/)
  })

  it('accepts content at exactly the max length', () => {
    const exact = 'a'.repeat(REVIEW_CONTENT_MAX)
    expect(validateReviewEdit({ content: exact })).toBeNull()
  })

  it('rejects non-string content', () => {
    // Cast to bypass TS — testing runtime behavior.
    const err = validateReviewEdit({ content: 12345 as unknown as string })
    expect(err?.field).toBe('content')
  })
})

describe('buildReviewEditPayload', () => {
  it('includes only provided fields', () => {
    expect(buildReviewEditPayload({ rating: 5 })).toEqual({ rating: 5 })
    expect(buildReviewEditPayload({ content: 'hello' })).toEqual({
      content: 'hello',
    })
  })

  it('trims content', () => {
    const data = buildReviewEditPayload({ content: '  hello world  ' })
    expect(data.content).toBe('hello world')
  })

  it('preserves the exact rating value', () => {
    expect(buildReviewEditPayload({ rating: 3 }).rating).toBe(3)
  })

  it('returns both fields when both are provided', () => {
    expect(
      buildReviewEditPayload({ rating: 4, content: 'great spot' }),
    ).toEqual({ rating: 4, content: 'great spot' })
  })
})

describe('buildEditConfirmPrompt', () => {
  it('uses the combined message when both fields change', () => {
    expect(buildEditConfirmPrompt(true, true)).toBe('Save changes to your review?')
  })

  it('mentions edited content when only content changes', () => {
    expect(buildEditConfirmPrompt(true, false)).toBe(
      'Save your edited review?',
    )
  })

  it('mentions new rating when only rating changes', () => {
    expect(buildEditConfirmPrompt(false, true)).toBe('Save your new rating?')
  })

  it('fails gracefully when neither field changes', () => {
    // Defensive — this should not happen if validateReviewEdit ran.
    expect(buildEditConfirmPrompt(false, false)).toBe('Save changes?')
  })
})

// Reference sample for ergonomic field-by-field access in tests.
const _sample: ReviewEditInput = { rating: 5, content: 'loved it' }
void _sample