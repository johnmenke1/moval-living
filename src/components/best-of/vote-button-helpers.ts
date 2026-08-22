/**
 * VoteButton helpers — pure functions used by the VoteButton component
 * and its tests. Kept in a separate file (no 'use client') so unit tests
 * can import them without dragging React into the test runner.
 */

/**
 * Cookie prefix used by client-side optimistic UI to mark a nominee as
 * "voted" so subsequent navigations can skip the network check. Cleared
 * on retract + on sign-out.
 */
export const VOTED_STATE_COOKIE_PREFIX = 'bestof_voted_'

/**
 * Build the /login?returnTo=... URL with the intent=vote marker so the
 * login page can route us back here after auth.
 */
export function buildLoginRedirectUrl(currentPath: string): string {
  const params = new URLSearchParams({
    returnTo: currentPath,
    intent: 'vote',
  })
  return `/login?${params.toString()}`
}

/**
 * Decode a returnTo param, falling back to "/" if it's missing or invalid.
 */
export function buildReturnTo(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '/'
  // Reject anything that isn't a same-origin path
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
