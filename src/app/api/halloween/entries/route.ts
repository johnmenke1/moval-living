import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db, halloweenEntry } from '@/db'
import { verifyTurnstileOrSkip } from '@/lib/turnstile'
import { put } from '@/lib/storage'
import { sendEmail } from '@/lib/email'
import {
  HALLOWEEN_CONFIG,
  DEVICE_COOKIE,
  addressKey,
  clientIp,
  geocodeAddress,
  getContestState,
  hashIp,
  insideMorenoValleyArea,
  publicLocationFor,
  readDeviceCookie,
} from '@/lib/halloween'
import { getPublicEntries, getVotedEntryIds } from '@/lib/halloween-queries'

export const dynamic = 'force-dynamic'

// GET /api/halloween/entries - approved homes + vote counts + what this device voted for.
export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers)
  const [entries, deviceId, ipHash] = await Promise.all([
    getPublicEntries(),
    readDeviceCookie(req.cookies.get(DEVICE_COOKIE)?.value),
    ip === 'unknown' ? Promise.resolve(null) : hashIp(ip),
  ])
  const votedIds = await getVotedEntryIds(deviceId, ipHash)
  const res = NextResponse.json({ entries, votedIds, state: getContestState() })
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

const fieldsSchema = z.object({
  displayName: z.string().trim().min(3).max(80),
  tagline: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().min(20).max(800),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  streetAddress: z.string().trim().min(5).max(160),
  zip: z.string().trim().regex(/^\d{5}$/, 'Use a 5-digit ZIP').optional().or(z.literal('')),
  showExactAddress: z.enum(['true', 'false']).default('false'),
  agreeRules: z.literal('true', { message: 'You must accept the contest rules' }),
  website: z.string().max(500).optional(), // honeypot - must stay empty
  turnstileToken: z.string().optional(),
})

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_ENTRIES_PER_IP_PER_DAY = 3

export async function POST(req: NextRequest) {
  const state = getContestState()
  if (!state.submissionsOpen) {
    return NextResponse.json({ error: 'Entries are not being accepted right now.' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const raw: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === 'string') raw[k] = v
  const parsed = fieldsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const f = parsed.data

  // Honeypot - pretend success.
  if (f.website) return NextResponse.json({ ok: true })

  const ip = clientIp(req.headers)
  const turnstile = await verifyTurnstileOrSkip(f.turnstileToken ?? '', ip === 'unknown' ? null : ip)
  if (!turnstile.ok) {
    return NextResponse.json({ error: 'Bot protection check failed - please try again.' }, { status: 403 })
  }

  const ipHash = ip === 'unknown' ? null : await hashIp(ip)

  // DB-backed rate limit (in-memory limiters don't work across Worker isolates).
  if (ipHash) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(halloweenEntry)
      .where(and(eq(halloweenEntry.ipHash, ipHash), gt(halloweenEntry.createdAt, since)))
    if ((row?.n ?? 0) >= MAX_ENTRIES_PER_IP_PER_DAY) {
      return NextResponse.json({ error: 'Too many entries from this network today.' }, { status: 429 })
    }
  }

  // Photos
  const files = form.getAll('photos').filter((v): v is File => typeof v !== 'string' && v.size > 0)
  if (files.length < 1) {
    return NextResponse.json({ error: 'Please add at least one photo of your display.' }, { status: 400 })
  }
  if (files.length > HALLOWEEN_CONFIG.maxPhotos) {
    return NextResponse.json({ error: `Up to ${HALLOWEEN_CONFIG.maxPhotos} photos please.` }, { status: 400 })
  }
  for (const file of files) {
    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json({ error: 'Photos must be JPG, PNG or WebP.' }, { status: 400 })
    }
    if (file.size > HALLOWEEN_CONFIG.maxPhotoBytes) {
      return NextResponse.json({ error: 'Each photo must be under 10 MB.' }, { status: 400 })
    }
  }

  const key = addressKey(f.streetAddress, f.zip || null)
  const existing = await db.query.halloweenEntry.findFirst({
    where: eq(halloweenEntry.addressKey, key),
    columns: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'That address has already been entered. Contact us if this is a mistake.' }, { status: 409 })
  }

  const city = 'Moreno Valley'
  const geo = await geocodeAddress(f.streetAddress, city, f.zip || null)
  const showExact = f.showExactAddress === 'true'
  const pub = geo ? publicLocationFor(geo.lat, geo.lng, f.streetAddress, showExact) : null

  // Upload photos (after validation, so rejected submissions leave nothing behind).
  const photoUrls: string[] = []
  const stamp = Date.now()
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const blob = await put(`halloween/${new Date().getFullYear()}/${stamp}-${i}.${ALLOWED_TYPES[file.type]}`, file, {
      contentType: file.type,
      addRandomSuffix: true,
      access: 'public',
    })
    photoUrls.push(blob.url)
  }

  let created
  try {
    ;[created] = await db
      .insert(halloweenEntry)
      .values({
        displayName: f.displayName,
        tagline: f.tagline || null,
        description: f.description,
        category: f.category || null,
        contactName: f.contactName,
        contactEmail: f.contactEmail.toLowerCase(),
        contactPhone: f.contactPhone || null,
        streetAddress: f.streetAddress,
        city,
        zip: f.zip || null,
        addressKey: key,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
        showExactAddress: showExact,
        publicLatitude: pub?.publicLatitude ?? null,
        publicLongitude: pub?.publicLongitude ?? null,
        locationLabel: pub?.locationLabel ?? null,
        photoUrls,
        status: 'PENDING',
        ipHash,
      })
      .returning({ id: halloweenEntry.id })
  } catch (err) {
    console.error('[halloween] insert failed', err)
    return NextResponse.json({ error: 'Could not save your entry. Please try again.' }, { status: 500 })
  }

  // Best-effort admin notification - never blocks the response.
  const adminTo = process.env.ADMIN_NOTIFY_EMAIL
  if (adminTo) {
    const outside = geo && !insideMorenoValleyArea(geo.lat, geo.lng)
    await Promise.race([
      sendEmail({
      to: adminTo,
      subject: `New Haunted Homes entry: ${f.displayName}`,
      text: `${f.displayName}\n${f.streetAddress}, ${city}\nBy ${f.contactName} <${f.contactEmail}>\n${geo ? '' : 'GEOCODING FAILED - set the pin manually.\n'}${outside ? 'WARNING: address resolves outside the Moreno Valley area.\n' : ''}\nReview: https://www.moval.living/dashboard/halloween`,
      html: `<p><strong>${escapeHtml(f.displayName)}</strong><br>${escapeHtml(f.streetAddress)}, ${city}<br>By ${escapeHtml(f.contactName)} &lt;${escapeHtml(f.contactEmail)}&gt;</p>${geo ? '' : '<p><strong>Geocoding failed - set the pin manually.</strong></p>'}${outside ? '<p><strong>Address resolves outside the Moreno Valley area.</strong></p>' : ''}<p><a href="https://www.moval.living/dashboard/halloween">Review entries</a></p>`,
      }).catch((e) => console.warn('[halloween] admin email failed', e)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])
  }

  return NextResponse.json({ ok: true, id: created.id })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
