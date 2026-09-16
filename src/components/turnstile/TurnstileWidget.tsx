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
 *                                    If unset, the widget renders a hidden
 *                                    input with an empty token (server falls
 *                                    back to "skip" so dev still works).
 *
 * Cloudflare test keys for local dev:
 *   Site key:    1x00000000000000000000AA
 *   Secret key:  1x0000000000000000000000000000000AA
 *   Both produce a token that always passes siteverify.
 */

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

  // Dev fallback: no key configured. Render an empty token so the form
  // POSTs `turnstileToken: ''` and the server's `verifyTurnstileOrSkip`
  // skips verification. (Logged loudly in server logs so it's noticed.)
  if (!siteKey) {
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
    </div>
  )
}
