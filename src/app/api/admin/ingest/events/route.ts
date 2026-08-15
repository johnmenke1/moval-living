/**
 * POST /api/admin/ingest/events
 *
 * Internal-only endpoint: takes a list of events from city calendars,
 * venue websites, etc. and creates PENDING Submissions for admin review.
 *
 * Skips Playwright capture (not IG/FB) — admin sees a row with all the
 * editorial metadata already filled in, just needs to pick tier + hero.
 *
 * Auth: admin session OR CRON_SECRET (for the weekly review run)
 *
 * Body:
 *   {
 *     events: [
 *       {
 *         sourceUrl: string      // link to the source (city page, venue site)
 *         title: string
 *         startsAt: string       // ISO datetime
 *         endsAt?: string        // ISO datetime
 *         venueName: string
 *         city: string           // "Moreno Valley" | "Redlands" | etc.
 *         venueTag?: string      // VenueTag enum value; defaults to OTHER
 *         description?: string   // optional editorial context
 *       }
 *     ]
 *   }
 *
 * Response:
 *   { ingested: number, results: [{ title, slug, status, error? }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { nextSubmissionSlug } from '@/lib/submission-slug'

const ingestSchema = z.object({
  events: z.array(
    z.object({
      sourceUrl: z.string().url().max(2000),
      title: z.string().trim().min(2).max(200),
      startsAt: z.string().trim().min(1),
      endsAt: z.string().trim().optional(),
      venueName: z.string().trim().min(2).max(200),
      city: z.string().trim().min(2).max(100),
      venueTag: z.enum([
        'FOX_RIVERSIDE',
        'RIVERSIDE_MUNICIPAL_AUDITORIUM',
        'RIVERSIDE_CONVENTION_CENTER',
        'UCR',
        'CBU',
        'RIVERSIDE_ART_MUSEUM',
        'RIVERSIDE_METROPOLITAN_MUSEUM',
        'REDLANDS_BOWL',
        'REDLANDS_THEATER_FESTIVAL',
        'MOVAL_HIGH_SCHOOL',
        'OTHER',
      ]).optional(),
      description: z.string().trim().max(2000).optional(),
    })
  ),
})

export async function POST(req: NextRequest) {
  // Two auth paths
  const cronSecret = process.env.CRON_SECRET
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  const isCron = cronSecret && bearer === cronSecret

  if (!isCron) {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Parse + validate
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = ingestSchema.safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: `Validation failed — ${issues}` }, { status: 400 })
  }

  const results: Array<{ title: string; slug?: string; status: 'created' | 'duplicate' | 'error'; error?: string }> = []

  for (const e of parsed.data.events) {
    try {
      // Skip duplicates by sourceUrl — same source = same event
      const existing = await prisma.submission.findFirst({
        where: { sourceUrl: e.sourceUrl },
      })
      if (existing) {
        results.push({ title: e.title, slug: existing.slug, status: 'duplicate' })
        continue
      }

      const startsAt = new Date(e.startsAt)
      if (isNaN(startsAt.getTime())) {
        results.push({ title: e.title, status: 'error', error: 'Invalid startsAt date' })
        continue
      }
      const endsAt = e.endsAt ? new Date(e.endsAt) : null
      if (e.endsAt && endsAt && isNaN(endsAt.getTime())) {
        results.push({ title: e.title, status: 'error', error: 'Invalid endsAt date' })
        continue
      }

      const slug = await nextSubmissionSlug()
      // Use venue tag as author handle — Fox shows up as 'foxriverside',
      // MoVal events as 'cityofmorenovalley', etc. Makes the queue
      // scannable by venue.
      const handleMap: Record<string, string> = {
        FOX_RIVERSIDE: 'foxriverside',
        REDLANDS_BOWL: 'redlands.bowl',
        REDLANDS_THEATER_FESTIVAL: 'redlands.theater',
        RIVERSIDE_MUNICIPAL_AUDITORIUM: 'riverside.auditorium',
        RIVERSIDE_CONVENTION_CENTER: 'riverside.convention',
        UCR: 'ucriverside',
        CBU: 'calbaptist',
        RIVERSIDE_ART_MUSEUM: 'riverside.artmuseum',
        RIVERSIDE_METROPOLITAN_MUSEUM: 'riverside.metro',
        MOVAL_HIGH_SCHOOL: 'movalschools',
      }
      const handle = handleMap[e.venueTag || 'OTHER'] || 'cityofmorenovalley'
      const submission = await prisma.submission.create({
        data: {
          slug,
          sourceUrl: e.sourceUrl,
          // 'OTHER' covers city calendars, venue sites, etc. — not IG/FB
          sourcePlatform: 'OTHER',
          sourceAuthorHandle: handle,
          title: e.title,
          startsAt,
          endsAt,
          venueName: e.venueName,
          submitterNote: e.description ?? null,
          // Mark as already-captured so admin knows this was curated
          sourceCapturedAt: new Date(),
          status: 'PENDING',
        },
      })

      results.push({ title: e.title, slug: submission.slug, status: 'created' })
    } catch (err) {
      results.push({
        title: e.title,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ingested: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'duplicate').length,
    results,
  })
}
