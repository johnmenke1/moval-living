import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { nextSubmissionSlug } from '@/lib/submission-slug'
import { captureSubmissionMetadata, detectPlatform, closeBrowser } from '@/lib/submission-capture'

const submissionSchema = z.object({
  sourceUrl: z.string().trim().url().max(2000),
  title: z.string().trim().min(2).max(200),
  // Accept the local datetime string from <input type="datetime-local">,
  // which is timezone-naive. We treat it as UTC for storage.
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().optional(),
  venueName: z.string().trim().max(200).optional(),
  // Optional FK into the Venue table. Set when the user picks from the
  // venue autocomplete dropdown. The server validates it exists.
  venueId: z.string().trim().max(50).optional(),
  // Address fields. When venueId is set, the server may overwrite these
  // from the canonical Venue (so admin can't accidentally create an event
  // with a mismatched address). When venueId is null, the submitter's
  // free-text address is preserved verbatim.
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(2).optional(),
  zip: z.string().trim().max(10).optional(),
  // Caption the submitter pasted from Instagram/Facebook when our auto-
  // extract couldn't (IG serves a captcha wall to unauthenticated browsers
  // for most posts now, so this happens often). If non-empty, used as the
  // `sourcePostCaption` so admin reviewers see the actual post text and
  // can promote to an Event with a real description.
  caption: z.string().trim().max(2000).optional(),
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

  const { sourceUrl, title, startsAt, endsAt, venueName, venueId, address, city, state, zip, caption, submitterNote, website } = parsed.data

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

  // Parse dates. The form sends a full ISO 8601 string with a Z suffix
  // (e.g. "2026-08-30T18:00:00.000Z") — generated client-side by passing the
  // <input type="datetime-local"> value through `new Date(...)` then
  // `.toISOString()` in the browser, so it represents the user's intended
  // wall-clock time in the browser's local TZ. We store it verbatim as a
  // UTC instant.
  const startsAtDate = new Date(startsAt)
  if (isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: 'Invalid event date' }, { status: 400 })
  }
  const endsAtDate = endsAt ? new Date(endsAt) : null
  if (endsAt && endsAtDate && isNaN(endsAtDate.getTime())) {
    return NextResponse.json({ error: 'Invalid end time' }, { status: 400 })
  }

  // If venueId was provided, validate it exists and pull the canonical
  // address from the Venue. We always overwrite the submitter's address
  // fields with the Venue's so admin doesn't see a mismatch. If the user
  // picked a known venue, the venue wins for address; they can edit after
  // promote if needed.
  let resolvedVenueId: string | null = null
  let resolvedVenueName: string | null = venueName ?? null
  let resolvedAddress: string | null = address ?? null
  let resolvedCity: string | null = city ?? null
  let resolvedState: string | null = state ?? null
  let resolvedZip: string | null = zip ?? null
  if (venueId) {
    const v = await prisma.venue.findUnique({ where: { id: venueId } })
    if (!v) {
      return NextResponse.json({ error: 'Selected venue not found' }, { status: 400 })
    }
    resolvedVenueId = v.id
    // Use the canonical Venue's name + address fields. Submitter's
    // venueName (if different) is dropped — the canonical name wins.
    resolvedVenueName = v.name
    resolvedAddress = v.address
    resolvedCity = v.city
    resolvedState = v.state
    resolvedZip = v.zip
  }

  // Detect platform + capture metadata via Playwright (real browser).
  // Best-effort — if the fetch fails we still create the Submission,
  // just with null fields for the admin to fill manually.
  const platform = detectPlatform(sourceUrl)
  const capture = await captureSubmissionMetadata(sourceUrl, platform)

  // Use the user-pasted caption as `sourcePostCaption` when auto-extract
  // failed (IG captcha wall, etc). Auto-extract takes precedence — admin
  // gets the richer version when it works; user paste is the fallback.
  const sourcePostCaption = capture.postCaption ?? caption ?? null

  // Generate slug MM-DD-YY-a, MM-DD-YY-b, ...
  const slug = await nextSubmissionSlug()

  const submission = await prisma.submission.create({
    data: {
      slug,
      sourceUrl,
      sourcePlatform: platform,
      sourceAuthorHandle: capture.authorHandle,
      sourceAuthorUrl: capture.authorUrl,
      sourceThumbnailUrl: capture.thumbnailUrl,
      sourcePostCaption,
      sourceCapturedAt: capture.capturedAt,
      title,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      venueName: resolvedVenueName,
      venueId: resolvedVenueId,
      address: resolvedAddress,
      city: resolvedCity,
      state: resolvedState,
      zip: resolvedZip,
      submitterNote: submitterNote ?? null,
      status: 'PENDING',
    },
  })

  return NextResponse.json({
    submissionId: submission.id,
    slug: submission.slug,
  })
}
