/**
 * Server-side Cloudflare Turnstile verification.
 *
 * Used by every public email-sending route (claim, forgot-password,
 * best-of nomination, partner lead, email-change, contact) to block the
 * SES abuse pattern where a bot hammers a public form to fire unsolicited
 * emails to real people.
 *
 * Env:
 *   TURNSTILE_SECRET_KEY — server-only secret from Cloudflare dashboard.
 *   If unset, `verifyTurnstileOrSkip` returns `{ ok: true, skipped: true }`
 *   (warns in logs once per process). DO NOT ship to production without
 *   the secret configured — this is a safety valve for dev only.
 *
 * Cloudflare test secret for local dev (always passes):
 *   1x0000000000000000000000000000000AA
 *
 * See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

interface TurnstileVerifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

type VerifyResult =
  | { ok: true; skipped?: true }
  | { ok: false; reason: string }

let warnedMissingSecret = false

export async function verifyTurnstileOrSkip(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<VerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (!warnedMissingSecret) {
      console.warn(
        '[Turnstile] TURNSTILE_SECRET_KEY is not set — skipping verification. ' +
          'Public email-sending forms are unprotected. Set the secret in env.',
      )
      warnedMissingSecret = true
    }
    return { ok: true, skipped: true }
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing-token' }
  }

  let res: Response
  try {
    const body = new URLSearchParams()
    body.set('secret', secret)
    body.set('response', token)
    if (remoteIp) body.set('remoteip', remoteIp)

    res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (e) {
    // Network blip — fail closed: do NOT send the email. The user can retry.
    const msg = e instanceof Error ? e.message : 'network error'
    console.error('[Turnstile] siteverify fetch failed:', msg)
    return { ok: false, reason: 'verification-unavailable' }
  }

  if (!res.ok) {
    console.error('[Turnstile] siteverify non-200:', res.status)
    return { ok: false, reason: `verification-http-${res.status}` }
  }

  let data: TurnstileVerifyResponse
  try {
    data = await res.json()
  } catch {
    return { ok: false, reason: 'verification-bad-json' }
  }

  if (!data.success) {
    console.warn(
      '[Turnstile] token rejected:',
      data['error-codes']?.join(',') || 'unknown',
    )
    return { ok: false, reason: 'token-rejected' }
  }

  return { ok: true }
}
