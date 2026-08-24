/**
 * Helpers for the email-change confirmation flow.
 *
 * Pure functions only — no DB, no React, no SES. Lives outside the
 * API routes and components so tests can import without pulling
 * Next.js deps.
 *
 * Flow:
 *   1. POST /api/profile/email-change/request — auth required,
 *      accepts { newEmail }, generates a token, persists the request
 *      row, sends SES email to NEW address with a confirmation link.
 *   2. GET /api/profile/email-change/confirm?token=... — validates
 *      token (not expired, not used), atomically marks used + swaps
 *      Owner.email.
 *
 * Threat model:
 *   - The token is a 256-bit random secret (32 bytes, base64url).
 *   - Tokens are single-use. Once used, marked used; reused attempts
 *     reject with 410 Gone.
 *   - Tokens expire in 1 hour. After expiry, the user re-requests.
 *   - The link is emailed to the NEW address, so an attacker would
 *     need both the Owner session AND access to the new mailbox to
 *     complete the swap. The attacker would also already know the
 *     Owner's current email (it's public on reviews + votes).
 *
 * Edge cases:
 *   - newEmail already in use by another Owner → reject 409 at request.
 *     The user knows their own current email so they don't get an
 *     enumeration signal they didn't already have.
 *   - Existing pending request for same Owner → invalidated before
 *     issuing the new token. The new request supersedes the old.
 *   - Token not present / not base64url / wrong length → 400.
 *   - Token expired → 410.
 *   - Token already used → 410.
 */

import { z } from 'zod'

/** Token shape (URL-safe base64 of 32 random bytes = 43 chars). */
export const EMAIL_CHANGE_TOKEN_BYTES = 32

/** Token lifetime. Short enough to limit exposure, long enough for a typical email roundtrip. */
export const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/** Email regex — same shape as the register form for consistency. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Zod schema for the request body. */
export const emailChangeRequestSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => EMAIL_REGEX.test(s), {
      message: 'Enter a valid email address',
    })
    // Same basic length cap as the Owner.email column.
    .max(254, 'Email is too long'),
})

export type EmailChangeRequestInput = z.infer<typeof emailChangeRequestSchema>

/**
 * Validate that `newEmail` differs from `currentEmail`.
 *
 * Returns the validation error message, or null if valid.
 * Exposed separately from the schema so the route can issue a more
 * specific error than "Invalid email" when the user submits their
 * own current email.
 */
export function isDifferentFromCurrent(
  newEmail: string,
  currentEmail: string,
): boolean {
  return newEmail.trim().toLowerCase() !== currentEmail.trim().toLowerCase()
}

/**
 * Compute the expiry Date for a new token, given a `now` reference.
 * Exposed for testing.
 */
export function computeTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + EMAIL_CHANGE_TOKEN_TTL_MS)
}

/**
 * Returns true if the request's expiresAt is in the past relative to
 * `now`. Caller passes the row directly so the helper stays pure.
 */
export function isTokenExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime()
}

/**
 * Returns true if the request has been marked used.
 * Used at confirmation time to reject replays.
 */
export function isTokenUsed(usedAt: Date | null): boolean {
  return usedAt !== null
}

/**
 * Build the confirmation URL that gets embedded in the email.
 *
 * Takes the base URL from env so it works in dev (localhost) and
 * prod (moval.living) without callers having to know which.
 *
 * The URL includes ONLY the token — no ownerId, no newEmail. The
 * token alone is the credential; embedding more would make the URL
 * self-documenting to anyone who intercepts it, and we already
 * trust token-only auth for our scale.
 */
export function buildConfirmationUrl(
  baseUrl: string,
  token: string,
): string {
  // Trim trailing slash on the base to avoid double-slash.
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/api/profile/email-change/confirm?token=${encodeURIComponent(token)}`
}

/**
 * Validate a token string from the URL.
 *
 * Returns null if valid, or a short error string if not. Caller
 * should map to 400 (malformed) or 410 (expired/used).
 *
 * Note: this only checks shape — checking expiry/used requires the
 * DB row. That happens in the route, not here.
 */
export function validateTokenShape(
  token: string | null | undefined,
): { ok: true } | { ok: false; reason: 'missing' | 'malformed' } {
  if (!token) return { ok: false, reason: 'missing' }
  // base64url: A-Z a-z 0-9 - _ (no padding)
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return { ok: false, reason: 'malformed' }
  }
  return { ok: true }
}