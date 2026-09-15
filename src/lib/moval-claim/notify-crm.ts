/**
 * Best-effort outbound webhook to HeadsUpCRM when a Moval.Living Business
 * is claimed or unclaimed. Mirrors src/lib/moval-claim/signature.ts on
 * both sides - same env var, same header scheme.
 *
 * Returns void. Never throws. The /claim/complete page must NEVER be
 * blocked on this - claim success is recorded locally first, then we try
 * to notify the CRM. If the CRM is down or rejects, we log and move on;
 * the daily catch-up cron on the CRM will pick up the drift within 24h.
 *
 * Failure mode policy: any error here is logged to stderr and swallowed.
 * The operator can see "claim webhook failed" entries in Vercel logs and
 * know to check the catch-up cron too.
 */

import { createHmac } from 'crypto'
import { getSharedSecret, signClaimPayload } from '@/lib/moval-claim/signature'

const CRM_BASE_URL = process.env.CRM_BASE_URL ?? 'https://headsupcrm.com'
const WEBHOOK_PATH = '/api/external/moval-business-claim'
const TIMEOUT_MS = 5_000

export type ClaimEvent = 'claimed' | 'unclaimed' | 'verified'

export interface ClaimWebhookPayload {
  websiteBusinessId: string
  event: ClaimEvent
  claimedAt?: string
  ownerEmail?: string
  ownerName?: string
}

export async function notifyCrmOfClaimChange(payload: ClaimWebhookPayload): Promise<void> {
  const secret = getSharedSecret()
  if (!secret) {
    console.warn('[claim-webhook] MOVAL_CLAIM_SHARED_SECRET not set - skipping (catch-up cron will still sync)')
    return
  }

  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signClaimPayload(body, timestamp, secret)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${CRM_BASE_URL}${WEBHOOK_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Claim-Signature': signature,
        'X-Claim-Timestamp': String(timestamp),
      },
      body,
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(
        `[claim-webhook] CRM responded ${res.status} for ${payload.websiteBusinessId} event=${payload.event}: ${text.slice(0, 200)}`,
      )
      return
    }

    const json = await res.json().catch(() => null)
    console.log(
      `[claim-webhook] ok: business=${payload.websiteBusinessId} event=${payload.event} response=${JSON.stringify(json)}`,
    )
  } catch (err) {
    console.warn(
      `[claim-webhook] failed to reach CRM for ${payload.websiteBusinessId} event=${payload.event}: ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    clearTimeout(timer)
  }
}

// Re-export crypto for callers that want to sign a query string (the
// daily-catch-up cron uses this pattern). Kept here so the entire
// outbound crypto surface is in one file.
export { createHmac }
