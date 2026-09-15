/**
 * HMAC-SHA256 signature helpers for the Moval.Living <-> HeadsUpCRM claim
 * bridge. PARALLEL COPY of src/lib/moval-claim/signature.ts on the CRM
 * side - both implementations MUST stay byte-identical. If you change
 * one, change both.
 *
 * Header: X-Claim-Signature: sha256=<hex hmac>
 * HMAC input: "<timestamp>.<raw-body>" (replay-protected)
 * Replay window: 5 minutes (MAX_TIMESTAMP_SKEW_MS)
 * Constant-time compare on verify.
 *
 * Failure modes return a tagged 'reason' so logs can distinguish config
 * bugs from forgery attempts.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000

export function getSharedSecret(): string | null {
  const s = process.env.MOVAL_CLAIM_SHARED_SECRET
  return s && s.length >= 32 ? s : null
}

export function signClaimPayload(rawBody: string, timestamp: number, secret: string): string {
  const h = createHmac('sha256', secret)
  h.update(`${timestamp}.${rawBody}`)
  return `sha256=${h.digest('hex')}`
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing-secret' | 'missing-header' | 'malformed-signature' | 'expired' | 'invalid-signature' }

export function verifyClaimSignature(opts: {
  rawBody: string
  signatureHeader: string | null
  timestampHeader: string | null
  secret: string
  maxSkewMs?: number
  now?: number
}): VerifyResult {
  const { secret } = opts
  if (!secret) return { ok: false, reason: 'missing-secret' }

  const sig = opts.signatureHeader
  const ts = opts.timestampHeader
  if (!sig || !ts) return { ok: false, reason: 'missing-header' }
  if (!sig.startsWith('sha256=') || sig.length !== 'sha256='.length + 64) {
    return { ok: false, reason: 'malformed-signature' }
  }

  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum) || tsNum <= 0) return { ok: false, reason: 'malformed-signature' }

  const now = opts.now ?? Date.now()
  const skewMs = now - tsNum * 1000
  if (Math.abs(skewMs) > (opts.maxSkewMs ?? MAX_TIMESTAMP_SKEW_MS)) {
    return { ok: false, reason: 'expired' }
  }

  const expected = signClaimPayload(opts.rawBody, tsNum, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'invalid-signature' }
  }
  return { ok: true }
}
