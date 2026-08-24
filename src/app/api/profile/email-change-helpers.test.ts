import { describe, expect, it } from 'vitest'
import {
  buildConfirmationUrl,
  computeTokenExpiry,
  emailChangeRequestSchema,
  EMAIL_CHANGE_TOKEN_BYTES,
  EMAIL_CHANGE_TOKEN_TTL_MS,
  isDifferentFromCurrent,
  isTokenExpired,
  isTokenUsed,
  validateTokenShape,
} from './email-change-helpers'

describe('emailChangeRequestSchema', () => {
  it('accepts a plain email and lowercases it', () => {
    const parsed = emailChangeRequestSchema.parse({ newEmail: 'User@Example.COM' })
    expect(parsed.newEmail).toBe('user@example.com')
  })

  it('trims whitespace', () => {
    const parsed = emailChangeRequestSchema.parse({ newEmail: '  a@b.com  ' })
    expect(parsed.newEmail).toBe('a@b.com')
  })

  it('rejects malformed email', () => {
    const result = emailChangeRequestSchema.safeParse({ newEmail: 'not an email' })
    expect(result.success).toBe(false)
  })

  it('rejects missing @', () => {
    const result = emailChangeRequestSchema.safeParse({ newEmail: 'a.com' })
    expect(result.success).toBe(false)
  })

  it('rejects missing TLD', () => {
    const result = emailChangeRequestSchema.safeParse({ newEmail: 'a@b' })
    expect(result.success).toBe(false)
  })

  it('rejects overlong email', () => {
    const long = 'a'.repeat(260) + '@b.com'
    const result = emailChangeRequestSchema.safeParse({ newEmail: long })
    expect(result.success).toBe(false)
  })

  it('accepts edge-of-valid-length email', () => {
    // 254 chars max — user@domain where domain part is short
    const local = 'a'.repeat(60)
    const email = `${local}@b.co`
    expect(email.length).toBeLessThanOrEqual(254)
    const result = emailChangeRequestSchema.safeParse({ newEmail: email })
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = emailChangeRequestSchema.safeParse({ newEmail: '' })
    expect(result.success).toBe(false)
  })
})

describe('isDifferentFromCurrent', () => {
  it('returns true when emails differ', () => {
    expect(isDifferentFromCurrent('new@example.com', 'old@example.com')).toBe(true)
  })

  it('returns false when emails are identical (different casing)', () => {
    expect(isDifferentFromCurrent('Alice@Example.com', 'alice@example.com')).toBe(false)
  })

  it('returns false when emails are identical (with whitespace)', () => {
    expect(isDifferentFromCurrent('  alice@example.com  ', 'alice@example.com')).toBe(false)
  })
})

describe('computeTokenExpiry', () => {
  it('returns a date 1 hour after the reference', () => {
    const now = new Date('2026-08-24T12:00:00Z')
    const expiry = computeTokenExpiry(now)
    expect(expiry.getTime() - now.getTime()).toBe(EMAIL_CHANGE_TOKEN_TTL_MS)
  })

  it('defaults to "now" when no argument is passed', () => {
    const before = Date.now()
    const expiry = computeTokenExpiry()
    const after = Date.now()
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + EMAIL_CHANGE_TOKEN_TTL_MS - 100)
    expect(expiry.getTime()).toBeLessThanOrEqual(after + EMAIL_CHANGE_TOKEN_TTL_MS + 100)
  })

  it('produces a future date relative to now', () => {
    const expiry = computeTokenExpiry()
    expect(expiry.getTime()).toBeGreaterThan(Date.now())
  })

  it('EMAIL_CHANGE_TOKEN_BYTES is 32 (matches our token generator)', () => {
    // Locks the size of the cryptographic token so the
    // validateTokenShape regex stays in sync if the policy changes.
    expect(EMAIL_CHANGE_TOKEN_BYTES).toBe(32)
  })
})

describe('isTokenExpired', () => {
  it('returns true when expiry is in the past', () => {
    const past = new Date(Date.now() - 1000)
    expect(isTokenExpired(past)).toBe(true)
  })

  it('returns false when expiry is in the future', () => {
    const future = new Date(Date.now() + 60_000)
    expect(isTokenExpired(future)).toBe(false)
  })

  it('returns true when expiry is exactly now (inclusive)', () => {
    const now = new Date()
    expect(isTokenExpired(now, now)).toBe(true)
  })
})

describe('isTokenUsed', () => {
  it('returns false when usedAt is null', () => {
    expect(isTokenUsed(null)).toBe(false)
  })

  it('returns true when usedAt is a Date', () => {
    expect(isTokenUsed(new Date())).toBe(true)
  })
})

describe('buildConfirmationUrl', () => {
  it('appends the token to the base URL', () => {
    const url = buildConfirmationUrl('https://www.moval.living', 'abc123')
    expect(url).toBe(
      'https://www.moval.living/api/profile/email-change/confirm?token=abc123',
    )
  })

  it('trims a trailing slash on the base URL', () => {
    const url = buildConfirmationUrl('https://www.moval.living/', 'abc')
    expect(url).toBe('https://www.moval.living/api/profile/email-change/confirm?token=abc')
  })

  it('URL-encodes the token', () => {
    // Base64url tokens shouldn't contain these characters, but be safe
    const url = buildConfirmationUrl('https://x.com', 'abc+def=')
    expect(url).toContain('token=abc%2Bdef%3D')
  })

  it('works with a localhost dev origin', () => {
    const url = buildConfirmationUrl('http://localhost:3000', 'tok')
    expect(url.startsWith('http://localhost:3000/api/')).toBe(true)
  })
})

describe('validateTokenShape', () => {
  it('accepts a 43-char base64url token (32 bytes encoded)', () => {
    const token = 'A'.repeat(43)
    expect(validateTokenShape(token)).toEqual({ ok: true })
  })

  it('rejects null', () => {
    expect(validateTokenShape(null)).toEqual({ ok: false, reason: 'missing' })
  })

  it('rejects undefined', () => {
    expect(validateTokenShape(undefined)).toEqual({ ok: false, reason: 'missing' })
  })

  it('rejects empty string', () => {
    expect(validateTokenShape('')).toEqual({ ok: false, reason: 'missing' })
  })

  it('rejects tokens shorter than 40 chars', () => {
    expect(validateTokenShape('abc')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects tokens longer than 60 chars', () => {
    expect(validateTokenShape('A'.repeat(100))).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects tokens with non-base64url characters', () => {
    expect(validateTokenShape('a'.repeat(43) + '!')).toEqual({ ok: false, reason: 'malformed' })
    expect(validateTokenShape('a'.repeat(43) + '+')).toEqual({ ok: false, reason: 'malformed' })
    expect(validateTokenShape('a'.repeat(43) + '/')).toEqual({ ok: false, reason: 'malformed' })
    expect(validateTokenShape('a'.repeat(43) + '=')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('accepts tokens with dashes and underscores (base64url alphabet)', () => {
    const token = ('-'.repeat(20) + '_'.repeat(23))
    expect(validateTokenShape(token).ok).toBe(true)
  })
})