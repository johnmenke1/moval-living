/**
 * GET /api/external/moval-business-claimed-since?since=<iso>&limit=<n>
 *
 * Outbound query endpoint hit by the HeadsUpCRM daily catch-up cron
 * (src/workers/syncMovalBusinessClaims on the CRM). Returns all website
 * Business rows that were claimed or unclaimed since `since`, with enough
 * fields for the CRM to mirror them onto its own moval-businesses rows.
 *
 *   ?since  ISO 8601 timestamp (required) - the floor. We return rows with
 *           claimedAt > since OR (claimedAt is null AND updatedAt > since)
 *           so unclaim events are also surfaced.
 *   ?limit  default 500, max 1000 - safety cap on a single page.
 *
 * Auth: same shared-secret HMAC scheme as the inbound webhook - the CRM
 * signs the canonical query string ("since=...&limit=...") and the
 * X-Claim-Signature header. See src/lib/moval-claim/signature.ts on the
 * CRM side for the parallel helper.
 *
 * Returns:
 *   {
 *     serverTime: ISO 8601 - use as the next call's `since` for paging,
 *     rows: [
 *       {
 *         websiteBusinessId: string,  // cuid - matches the CRM's externalId
 *         event: 'claimed' | 'unclaimed',
 *         claimedAt: ISO 8601 | null,
 *         ownerEmail: string | null,
 *         ownerName: string | null,
 *       }
 *     ],
 *     hasMore: boolean   // true when `limit` was hit; client should re-call
 *                        // with since=serverTime to keep paging
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getSharedSecret,
  verifyClaimSignature,
} from '@/lib/moval-claim/signature'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = getSharedSecret()
  if (!secret) {
    return NextResponse.json(
      { error: 'MOVAL_CLAIM_SHARED_SECRET not set on website' },
      { status: 500 },
    )
  }

  const url = new URL(req.url)
  // Canonicalize: only the keys we accept, in a fixed order, so the HMAC
  // is reproducible regardless of how the client orders query params.
  const since = url.searchParams.get('since') ?? ''
  const limitRaw = Number(url.searchParams.get('limit') ?? '500')
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 1000) : 500
  const canonicalQuery = `since=${encodeURIComponent(since)}&limit=${limit}`

  const sig = req.headers.get('x-claim-signature')
  const ts = req.headers.get('x-claim-timestamp')

  const verify = verifyClaimSignature({
    rawBody: canonicalQuery,
    signatureHeader: sig,
    timestampHeader: ts,
    secret,
  })
  if (!verify.ok) {
    return NextResponse.json(
      { error: 'signature-verification-failed', reason: verify.reason },
      { status: 401 },
    )
  }

  const sinceDate = new Date(since)
  if (!since || Number.isNaN(sinceDate.getTime())) {
    return NextResponse.json({ error: 'missing-or-invalid-since' }, { status: 400 })
  }

  // Pull rows whose claim state changed since `sinceDate`.
  //   claimedAt > since           -> newly claimed
  //   claimedAt IS NULL AND
  //     updatedAt > since AND
  //     ownerId IS NULL           -> recently unclaimed (admin removed owner)
  //   (Rows that have always been unclaimed have updatedAt <= sinceDate
  //    because they haven't been touched, so they don't pollute the result.)
  //
  // We also include rows that flipped owner from one Owner to another
  // (i.e. updatedAt > since with claimedAt set, but we just return them
  // and the CRM will idempotently re-apply).
  const rows = await prisma.business.findMany({
    where: {
      OR: [
        { claimedAt: { gt: sinceDate } },
        { AND: [{ claimedAt: null }, { updatedAt: { gt: sinceDate } }, { ownerId: null }] },
      ],
    },
    select: {
      id: true,
      claimedAt: true,
      updatedAt: true,
      ownerId: true,
      owner: { select: { email: true, name: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit + 1, // +1 sentinel for hasMore
  })

  const hasMore = rows.length > limit
  const trimmed = hasMore ? rows.slice(0, limit) : rows

  const result = {
    serverTime: new Date().toISOString(),
    rows: trimmed.map((r) => ({
      websiteBusinessId: r.id,
      event: r.claimedAt ? 'claimed' : 'unclaimed',
      claimedAt: r.claimedAt ? r.claimedAt.toISOString() : null,
      ownerEmail: r.owner?.email ?? null,
      ownerName: r.owner?.name ?? null,
    })),
    hasMore,
  }

  return NextResponse.json(result)
}
