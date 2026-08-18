/**
 * GET /api/cron/archive-past-events
 *
 * Vercel Cron endpoint — runs daily at 03:00 PT via vercel.json.
 *
 * Auto-archives events that ended more than 30 days ago. The public /events
 * listing filters out events with archivedAt != null, so the effect is that
 * events quietly drop off the public listings one month after they happen.
 *
 * The admin can un-archive any event from the Live Events admin tab.
 *
 * "End" is interpreted as: endsAt if set, otherwise startsAt + 24h. Events
 * with no startsAt are skipped (data integrity issue; admin should fix).
 *
 * Auth: requires `x-cron-secret` header to match process.env.CRON_SECRET.
 *
 * Returns:
 *   { ok: true, archived: number }
 *   { ok: false, error: '...' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Plenty for an updateMany on <1k rows.

// How many days past an event's end we wait before auto-archiving. Set to
// 30 to give the admin a clear "what just happened" buffer and to keep
// recently-ended events searchable for venue reviews, audit, etc.
const ARCHIVE_AFTER_DAYS = 30

export async function GET(req: NextRequest) {
  // Auth: x-cron-secret header must match env
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86400000)

  try {
    // Archive events where:
    //   - not already archived
    //   - endsAt <= cutoff (or startsAt <= cutoff when no endsAt set)
    //
    // We use a single updateMany with a raw SQL fragment for the date
    // comparison because Prisma's where-clause doesn't have a "coalesce
    // endsAt + startsAt" operator.
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Event"
       SET "archivedAt" = NOW()
       WHERE "archivedAt" IS NULL
         AND COALESCE("endsAt", "startsAt" + INTERVAL '24 hours') <= $1`,
      cutoff,
    )

    return NextResponse.json({
      ok: true,
      archived: typeof result === 'number' ? result : 0,
      cutoff: cutoff.toISOString(),
      daysThreshold: ARCHIVE_AFTER_DAYS,
    })
  } catch (err) {
    console.error('[cron/archive-past-events] failed', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Archive failed' },
      { status: 500 },
    )
  }
}