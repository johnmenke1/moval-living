/**
 * Public register page — used by visitors who want to vote but don't
 * have an Owner account yet. Wraps the existing /api/auth/register
 * endpoint which already auto-verifies the email (so new accounts can
 * immediately vote) and signs them in via NextAuth Credentials.
 */

import { describe, expect, it } from 'vitest'
import { registerSchema, buildRegisterUrl } from './register-helpers'

describe('registerSchema', () => {
  it('accepts a valid email + 8+ char password + name', () => {
    const parsed = registerSchema.parse({
      email: 'sarah@example.com',
      password: 'hunter2hunter2',
      name: 'Sarah K.',
    })
    expect(parsed.email).toBe('sarah@example.com')
    expect(parsed.name).toBe('Sarah K.')
  })

  it('lowercases and trims the email', () => {
    const parsed = registerSchema.parse({
      email: '  Sarah@Example.COM  ',
      password: 'hunter2hunter2',
      name: 'Sarah',
    })
    expect(parsed.email).toBe('sarah@example.com')
  })

  it('rejects passwords shorter than 8 characters', () => {
    expect(() =>
      registerSchema.parse({
        email: 'sarah@example.com',
        password: 'short',
        name: 'Sarah',
      }),
    ).toThrow()
  })

  it('rejects malformed emails', () => {
    expect(() =>
      registerSchema.parse({
        email: 'not-an-email',
        password: 'hunter2hunter2',
        name: 'Sarah',
      }),
    ).toThrow()
  })

  it('defaults emailOptIn to false (CAN-SPAM explicit consent)', () => {
    const parsed = registerSchema.parse({
      email: 'sarah@example.com',
      password: 'hunter2hunter2',
      name: 'Sarah',
    })
    expect(parsed.emailOptIn).toBe(false)
  })
})

describe('buildRegisterUrl', () => {
  it('encodes returnTo so post-signin lands the user back on the vote page', () => {
    const url = buildRegisterUrl('/best-of/best-coffee')
    expect(url).toBe('/register?returnTo=%2Fbest-of%2Fbest-coffee')
  })

  it('returns the plain path when no returnTo given', () => {
    expect(buildRegisterUrl(null)).toBe('/register')
  })
})
