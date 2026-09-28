'use client'

/**
 * TurnstileWidget — Cloudflare Turnstile CAPTCHA wrapper.
 *
 * Used by every public form on the site that could send email via SES, to
 * prevent the kind of abuse reported on 2026-09-15 (someone hammering
 * `/api/claim/request` with random emails to send claim-link spam to
 * real business owners). See moval-living-dev SKILL for the full list.
 *
 * Props:
 *   onVerify(token)   — required. Receives the Turnstile token. Pass to the
 *                       form's fetch body as `turnstileToken`.
 *   onError(error)    — optional. Called on widget failure.
 *   onExpire()        — optional. Called when the token expires (300s).
 *
 * Env:
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY — public site key from Cloudflare dashboard.
 *                                    If unset OR malformed (length outside 16-60,
 *                                    contains whitespace/escape chars, etc.),
 *                                    the widget renders a hidden input with an
 *                                    empty token and logs a console warning. The
 *                                    server's `verifyTurnstileOrSkip` skips
 *                                    verification when the secret is also unset,
 *                                    so the form still POSTs successfully.
 *
 * Cloudflare test keys for local dev:
 *   Site key:    1x00000000000000000000AA
 *   Secret key:  1x0000000000000000000000000000000AA
 *   Both produce a token that always passes siteverify.
 */

import { useEffect, useRef } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError?: (error: string) => void
  onExpire?: () => void
  /** Optional className for the outer wrapper. */
  className?: string
  /** Theme: 'auto' | 'light' | 'dark'. Defaults to 'auto'. */
  theme?: 'auto' | 'light' | 'dark'
}

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  className,
  theme = 'auto',
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // Dev fallback: no key configured (or the key is malformed — e.g. has
  // a literal "\n" suffix from a bad paste). Render an empty token so
  // the form POSTs `turnstileToken: ''` and the server's
  // `verifyTurnstileOrSkip` skips verification. The length + charset
  // heuristic is loose on purpose: production Cloudflare Turnstile
  // sitekeys are 16-40 chars (the format has shifted over time), so
  // we accept anything 16-60 chars with no whitespace/escape/stray-
  // quote characters.
  const looksLikeValidKey =
    typeof siteKey === 'string'
    && siteKey.length >= 16
    && siteKey.length <= 60
    && !/[\s\\"]/.test(siteKey) // no whitespace, escaped chars, or stray quotes

  if (!siteKey || !looksLikeValidKey) {
    if (typeof window !== 'undefined' && siteKey) {
      // Surface a console hint so dev sees the bad key without breaking prod
      console.warn(
        '[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY looks malformed; rendering fallback. Got:',
        JSON.stringify(siteKey),
      )
    }
    return (
      <div className={className} data-turnstile="missing-key">
        {/* Empty token — server side will skip verification when secret is also unset */}
        <input type="hidden" value="" readOnly aria-hidden />
      </div>
    )
  }

  return (
    <div className={className}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={onVerify}
        onError={(err) => onError?.(typeof err === 'string' ? err : 'turnstile-error')}
        onExpire={onExpire}
        options={{
          theme,
          size: 'flexible',
        }}
      />
      {/* Watchdog: detects the case where Cloudflare's widget
          completely fails to load (e.g. domain not authorized for
          the sitekey, network blocking challenges.cloudflare.com)
          and surfaces a clearer message via onError. Critical: only
          fires when NO success signal has been seen AND no token is
          present in the hidden response field. After the user solves
          the CAPTCHA, onSuccess fires AND Cloudflare fills the
          hidden input — both of those cancel the watchdog. */}
      <TurnstileWatchdog onFailure={onError} />
    </div>
  )
}

/**
 * Watchdog: after 8 seconds, check whether the Turnstile widget has
 * either:
 *   - Called onSuccess (token issued) → cancel, no error
 *   - Filled the hidden cf-turnstile-response input with a token → cancel
 *   - Neither → assume the challenge never loaded, call onFailure.
 *
 * Implementation notes:
 *   - The watchdog polls via setInterval, NOT a single setTimeout.
 *     setTimeout has the problem that the user might solve the
 *     CAPTCHA at second 7.5 and we'd still fire at second 8. setInterval
 *     checks every 250ms and stops itself the moment success is seen.
 *   - Uses refs (not state) for the success tracker so re-renders from
 *     parent state changes (email input, claiming flag, etc.) don't
 *     reset the watchdog.
 *   - Renders nothing.
 */
function TurnstileWatchdog({
  onFailure,
}: {
  onFailure?: (reason: string) => void
}) {
  // useRef for the callback so it survives re-renders without
  // re-triggering the polling effect. Otherwise every parent
  // state change (email input, claiming flag) would create a new
  // onFailure reference and reset the watchdog.
  const onFailureRef = useRef(onFailure)
  useEffect(() => {
    onFailureRef.current = onFailure
  }, [onFailure])

  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    let fired = false

    let attempts = 0
    const MAX_ATTEMPTS = 32 // 32 * 250ms = 8 seconds
    const interval = setInterval(() => {
      if (cancelled || fired) {
        clearInterval(interval)
        return
      }
      attempts += 1

      // Success signal: Cloudflare filled the hidden response input
      // with a real token (after the user solves the challenge).
      const responseInput = document.querySelector<HTMLInputElement>(
        'input[name="cf-turnstile-response"]',
      )
      if (responseInput && responseInput.value && responseInput.value.length > 0) {
        cancelled = true
        clearInterval(interval)
        return
      }

      // Timeout: 8s passed with no token AND no iframe → failure
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval)
        const container = document.getElementById('cf-turnstile')
        const hasIframe = container ? container.querySelector('iframe') : null
        if (!hasIframe && !cancelled) {
          fired = true
          console.warn(
            '[Turnstile] watchdog: no token or iframe after 8s. ' +
              'This usually means the sitekey is not authorized for this domain ' +
              'in the Cloudflare dashboard, or the user is on a network blocking challenges.cloudflare.com.',
          )
          onFailureRef.current?.(
            'CAPTCHA failed to load — the site key may not be authorized for this domain. Please contact the site administrator.',
          )
        }
      }
    }, 250)

    return () => clearInterval(interval)
  }, []) // Run once on mount; ref handles callback updates.

  return null
}