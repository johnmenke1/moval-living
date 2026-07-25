import { describe, expect, it } from 'vitest'
import { hashMagicLinkToken, safeCallbackPath } from './magic-link'

describe('safeCallbackPath', () => {
  it('accepts local application paths', () => {
    expect(safeCallbackPath('/dashboard')).toBe('/dashboard')
    expect(safeCallbackPath('/claim/complete?token=abc')).toBe('/claim/complete?token=abc')
  })

  it('blocks protocol-relative and external redirects', () => {
    expect(safeCallbackPath('//evil.example')).toBe('/dashboard')
    expect(safeCallbackPath('https://evil.example')).toBe('/dashboard')
  })
})

describe('hashMagicLinkToken', () => {
  it('matches the token-plus-secret lookup key used by Auth.js email callbacks', () => {
    expect(hashMagicLinkToken('plain-token', 'secret')).toBe(
      'cd918a5515f4660bb271411be2e9fe4ead69133bac232c6103edf6a94ba5ffe1',
    )
  })
})
