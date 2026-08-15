import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { nextSubmissionSlug } from '@/lib/submission-slug'
import { captureOembed, detectPlatform } from '@/lib/submission-oembed'

const submissionSchema = z.object({
  sourceUrl: z.string().trim().url().max(2000),
  title: z.string().trim().min(2).max(200),
  // Accept the local datetime string from <input type="datetime-local">,
  // which is timezone-naive. We treat it as UTC for storage.
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().optional(),
  venueName: z.string().trim().max(200).optional(),
  submitterNote: z.string().trim().max(600).optional(),
  // Honeypot — must be empty. Bots fill every field they see; real users
  // can't see this one (it's hidden in the form with CSS).
  website: z.string().max(0).optional().or(z.literal('')),
})

// In-memory rate limiter — matches the pattern in best-of nominations.
// 10 submissions per IP per hour is generous for a community calendar;
// bump if legitimate use starts hitting it.
const recentSubmissions = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 10

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const recent = recentSubmissions.get(key) ?? []
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const filtered = recent.filter((t) => t > cutoff)
  if (filtered.length >= RATE_LIMIT_MAX) {
    recentSubmissions.set(key, filtered)
    return false
  }
  filtered.push(now)
  recentSubmissions.set(key, filtered)
  return true
}

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 }
    )
  }

  // Parse + validate
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = submissionSchema.safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return NextResponse.json({ error: `Validation failed — ${issues}` }, { status: 400 })
  }

  const { sourceUrl, title, startsAt, endsAt, venueName, submitterNote, website } = parsed.data

  // Honeypot — silently drop the submission if the hidden field is filled.
  // Don't tell the bot we caught it; just return a fake success.
  if (website && website.length > 0) {
    return NextResponse.json({ submissionId: 'ok', slug: 'ok' })
  }

  // Reject duplicate submissions by sourceUrl. Same post URL = same event.
  const existing = await prisma.submission.findFirst({ where: { sourceUrl } })
  if (existing) {
    return NextResponse.json(
      {
        error: 'This post has already been submitted.',
        duplicateSlug: existing.slug,
      },
      { status: 409 }
    )
  }

  // Parse dates. The form sends timezone-naive ISO strings via
  // datetime-local inputs; we treat them as UTC for storage.
  const startsAtDate = new Date(startsAt)
  if (isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: 'Invalid event date' }, { status: 400 })
  }
  const endsAtDate = endsAt ? new Date(endsAt) : null
  if (endsAt && endsAtDate && isNaN(endsAtDate.getTime())) {
    return NextResponse.json({ error: 'Invalid end time' }, { status: 400 })
  }

  // Detect platform + fetch oEmbed for the prep card.
  // Both are best-effort — if either fails we still create the Submission,
  // just with null thumbnail/author fields for the admin to fill manually.
  const platform = detectPlatform(sourceUrl)
  const oembed = await captureOembed(sourceUrl, platform)

  // Generate slug MM-DD-YY-a, MM-DD-YY-b, ...
  const slug = await nextSubmissionSlug()

  const submission = await prisma.submission.create({
    data: {
      slug,
      sourceUrl,
      sourcePlatform: platform,
      sourceAuthorHandle: oembed.authorHandle,
      sourceAuthorUrl: oembed.authorUrl,
      sourceThumbnailUrl: oembed.thumbnailUrl,
      sourceCapturedAt: oembed.capturedAt,
      title,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      venueName: venueName ?? null,
      submitterNote: submitterNote ?? null,
      status: 'PENDING',
    },
  })

  return NextResponse.json({
    submissionId: submission.id,
    slug: submission.slug,
  })
}
