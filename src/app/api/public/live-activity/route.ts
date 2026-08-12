import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/live-activity
 *
 * Returns a unified, time-sorted feed of recent public activity on the
 * site. Powers the homepage "MoVal right now" ticker.
 *
 * Event types mixed:
 *   - claim       — Business.claimedAt (someone claimed a listing)
 *   - featured    — Business.featuredAt (someone upgraded to FEATURED/EXPERT_PARTNER)
 *   - review      — Review.createdAt   (a verified-looking review landed)
 *   - nominate    — BestOfNomination.createdAt (a public nomination was submitted)
 *
 * Privacy: only first names are surfaced. Reviews use `authorName` which
 * is captured at submission time — we take the first whitespace-delimited
 * token. Same pattern for nominations.
 *
 * Performance: 4 small queries against indexed columns. The route is
 * `force-dynamic` so visitors get fresh data on every page load. The
 * frontend ticker lazy-fetches and re-renders every 30s, so we don't
 * need to add a separate cron — this endpoint is the source of truth.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WINDOW_DAYS = 30
const PER_STREAM_CAP = 30 // generous — we dedupe + sort downstream

type ActivityEvent = {
  id: string
  type: 'claim' | 'featured' | 'review' | 'nominate'
  createdAt: string
  // Lightweight, renderable payload. The ticker component decides how to
  // format the final sentence from these fields.
  actorName: string // first name only
  businessName: string
  businessSlug: string
  // Optional extras
  detail?: string // e.g. review star rating, nomination category
  rating?: number
  categoryName?: string
}

function firstName(full: string | null | undefined): string {
  if (!full) return 'Someone'
  const trimmed = full.trim()
  if (!trimmed) return 'Someone'
  return trimmed.split(/\s+/)[0]
}

export async function GET() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  // Run the four queries in parallel — independent reads.
  const [claims, features, reviews, nominations] = await Promise.all([
    // 1. Claims — first time ownerId was set
    prisma.business.findMany({
      where: {
        claimedAt: { not: null, gte: since },
        status: 'APPROVED', // hide claims against un-published listings
      },
      orderBy: { claimedAt: 'desc' },
      take: PER_STREAM_CAP,
      select: {
        id: true,
        slug: true,
        name: true,
        claimedAt: true,
        owner: { select: { name: true } },
      },
    }),
    // 2. Features — first time tier flipped to FEATURED/EXPERT_PARTNER
    prisma.business.findMany({
      where: {
        featuredAt: { not: null, gte: since },
        // Only surface businesses that are currently premium — keeps the
        // ticker honest ("X is Featured" not "X was once Featured").
        tier: { in: ['FEATURED', 'EXPERT_PARTNER'] },
        status: 'APPROVED',
      },
      orderBy: { featuredAt: 'desc' },
      take: PER_STREAM_CAP,
      select: {
        id: true,
        slug: true,
        name: true,
        featuredAt: true,
        tier: true,
        owner: { select: { name: true } },
      },
    }),
    // 3. Reviews — exclude flagged ones
    prisma.review.findMany({
      where: {
        createdAt: { gte: since },
        flagged: false,
        business: { status: 'APPROVED' },
      },
      orderBy: { createdAt: 'desc' },
      take: PER_STREAM_CAP,
      select: {
        id: true,
        createdAt: true,
        rating: true,
        authorName: true,
        business: { select: { name: true, slug: true } },
      },
    }),
    // 4. Nominations — only show APPROVED (per spec: invisible until
    // admin approves). Pending nominations are private.
    prisma.bestOfNomination.findMany({
      where: {
        status: 'APPROVED',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: PER_STREAM_CAP,
      select: {
        id: true,
        createdAt: true,
        nominatorName: true,
        categoryName: true,
        businessName: true,
        business: { select: { slug: true } },
      },
    }),
  ])

  // Normalize to a single shape and merge.
  const events: ActivityEvent[] = []

  for (const b of claims) {
    if (!b.claimedAt) continue
    events.push({
      id: `claim:${b.id}`,
      type: 'claim',
      createdAt: b.claimedAt.toISOString(),
      actorName: firstName(b.owner?.name),
      businessName: b.name,
      businessSlug: b.slug,
    })
  }

  for (const b of features) {
    if (!b.featuredAt) continue
    events.push({
      id: `featured:${b.id}`,
      type: 'featured',
      createdAt: b.featuredAt.toISOString(),
      actorName: firstName(b.owner?.name),
      businessName: b.name,
      businessSlug: b.slug,
      detail: b.tier === 'EXPERT_PARTNER' ? 'Expert Partner' : 'Featured',
    })
  }

  for (const r of reviews) {
    events.push({
      id: `review:${r.id}`,
      type: 'review',
      createdAt: r.createdAt.toISOString(),
      actorName: firstName(r.authorName),
      businessName: r.business.name,
      businessSlug: r.business.slug,
      rating: r.rating,
    })
  }

  for (const n of nominations) {
    events.push({
      id: `nominate:${n.id}`,
      type: 'nominate',
      createdAt: n.createdAt.toISOString(),
      actorName: firstName(n.nominatorName),
      businessName: n.businessName,
      businessSlug: n.business?.slug ?? '',
      categoryName: n.categoryName,
    })
  }

  // Sort newest first, then dedupe by id (in case the same business
  // appears in multiple streams within the same minute).
  events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const dedupe = new Map<string, ActivityEvent>()
  for (const e of events) dedupe.set(e.id, e)
  const out = Array.from(dedupe.values()).slice(0, 20)

  return NextResponse.json(out, {
    headers: {
      // 30s edge cache — enough to blunt traffic spikes, short enough
      // that the ticker feels live. Ticker component re-fetches every 30s.
      'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
    },
  })
}
