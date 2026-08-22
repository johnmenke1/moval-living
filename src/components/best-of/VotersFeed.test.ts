/**
 * VotersFeed tests — pure helpers (initials + gradient) extracted from
 * the React component for testability without a DOM.
 */

import { describe, expect, it } from 'vitest'
import { initials, avatarGradientForName } from './VotersFeed'

describe('initials', () => {
  it('returns first letters of first two words', () => {
    expect(initials('Sarah K.')).toBe('SK')
    expect(initials('John Menke')).toBe('JM')
  })

  it('uppercases and handles single name', () => {
    expect(initials('sarah')).toBe('S')
  })

  it('falls back to empty string for empty input', () => {
    expect(initials('')).toBe('')
    expect(initials('   ')).toBe('')
  })
})

describe('avatarGradientForName', () => {
  it('returns a deterministic pair for the same input', () => {
    const a = avatarGradientForName('Sarah K.')
    const b = avatarGradientForName('Sarah K.')
    expect(a).toEqual(b)
  })

  it('produces distinct hues for different inputs', () => {
    const a = avatarGradientForName('Sarah K.')
    const b = avatarGradientForName('John M.')
    // Not testing exact hues — just that the gradient changes
    expect(a).not.toEqual(b)
  })

  it('returns valid hsl() strings', () => {
    const [from, to] = avatarGradientForName('Test User')
    expect(from).toMatch(/^hsl\(\d+, 65%, 45%\)$/)
    expect(to).toMatch(/^hsl\(\d+, 60%, 35%\)$/)
  })
})
