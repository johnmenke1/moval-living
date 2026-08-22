/**
 * VoteButton — registered-voter voting action.
 *
 * Behavior:
 * - Anonymous visitor: redirects to /login?returnTo=...&intent=vote
 * - Signed-in, not voted: casts the vote on click, shows "Voted" state
 * - Signed-in, already voted: shows "Voted ✓" with retract option
 * - Error: surfaces the API error inline (e.g., "verify your email first")
 *
 * This is a client component because we need optimistic UI + post-click
 * state transitions. The page-level server component fetches the initial
 * "did this user vote for this nominee?" state and passes it as a prop,
 * so the button can render correctly on first paint without a flash.
 */

import { describe, expect, it } from 'vitest'
import {
  buildLoginRedirectUrl,
  buildReturnTo,
  VOTED_STATE_COOKIE_PREFIX,
} from './vote-button-helpers'

describe('buildLoginRedirectUrl', () => {
  it('encodes the current path as returnTo', () => {
    const url = buildLoginRedirectUrl('/best-of/best-coffee')
    expect(url).toBe('/login?returnTo=%2Fbest-of%2Fbest-coffee&intent=vote')
  })

  it('handles paths with query strings and hashes', () => {
    const url = buildLoginRedirectUrl('/best-of/x?foo=bar#section')
    // encodeURIComponent encodes / ? # = & consistently
    expect(url).toContain('returnTo=')
    expect(decodeURIComponent(url)).toContain('returnTo=/best-of/x?foo=bar#section')
  })
})

describe('buildReturnTo', () => {
  it('returns the decoded path', () => {
    expect(buildReturnTo('/best-of/best-coffee')).toBe('/best-of/best-coffee')
  })

  it('falls back to "/" on invalid input', () => {
    expect(buildReturnTo(null)).toBe('/')
    expect(buildReturnTo('')).toBe('/')
  })
})

describe('VOTED_STATE_COOKIE_PREFIX', () => {
  it('starts with "bestof_voted_" so it can be cleared on sign-out', () => {
    expect(VOTED_STATE_COOKIE_PREFIX).toMatch(/^bestof_voted_/)
  })
})
