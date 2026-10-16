import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db, halloweenEntry } from '@/db'
import { isUniqueViolation } from '@/db/errors'
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
  // Only streetAddress is required; everything else is collected best-effort.
  displayName: z.string().trim().max(80).optional().or(z.literal('')),
  tagline: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(800).optional().or(z.literal('')),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  // Entry form is anonymous; name/email are only used when volunteers need to reach the resident.
  contactName: z.string().trim().min(2).max(120).optional().or(z.literal('')),
  contactEmail: z.string().trim().email().max(320).optional().or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  streetAddress: z.string().trim().min(5).max(160),
  zip: z.string().trim().regex(/^\d{5}$/, 'Use a 5-digit ZIP').optional().or(z.literal('')),
  showExactAddress: z.enum(['true', 'false']).default('false'),
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
  try {
    return await handlePost(req)
  } catch (err) {
    // Capture everything we can so the worker logs are useful next time something
    // fails in production. DrizzleQueryError hides the real pg error on .cause,
    // so we serialize the full chain.
    const chain: { name?: string; message: string; code?: string; stack?: string }[] = []
    let cur: unknown = err
    let depth = 0
    while (cur && depth < 5) {
      const e = cur as { name?: string; message?: string; code?: unknown; cause?: unknown; stack?: string }
      chain.push({
        name: e.name,
        message: e.message ?? '(no message)',
        code: typeof e.code === 'string' ? e.code : undefined,
        stack: e.stack?.split('\n').slice(0, 5).join('\n'),
      })
      cur = e.cause
      depth += 1
    }
    console.error('[halloween] unhandled POST error chain:', JSON.stringify(chain, null, 2))
    const topMsg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Server error while processing your entry: ${topMsg}` },
      { status: 500 },
    )
  }
}

/**
 * DB-backed per-IP rate limit. Best-effort: if the lookup fails for any reason
 * (Hyperdrive pool issue, transient DB error, schema drift on first deploy of a
 * new index, etc.) we log a warning and let the submission through. The real
 * duplicate protection is the address-uniqueness check below; Turnstile stops
 * bots; the admin queue rejects anything that slips through. A flaky rate-limit
 * query should never block every submission on the page.
 */
async function rateLimitedForIp(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(halloweenEntry)
      .where(and(eq(halloweenEntry.ipHash, ipHash), gt(halloweenEntry.createdAt, since)))
    return (row?.n ?? 0) >= MAX_ENTRIES_PER_IP_PER_DAY
  } catch (err) {
    console.warn('[halloween] rate-limit check failed; allowing submission', err)
    return false
  }
}

/**
 * Address-uniqueness precheck. Best-effort: if the lookup fails for any
 * transient reason, log a warning and let the submission through. The unique
 * index on "HalloweenEntry"."addressKey" will still reject duplicates at INSERT
 * time, and the caller turns a 23505 into a 409.
 */
async function findExistingEntry(key: string): Promise<{ id: string } | null> {
  try {
    return (
      (await db.query.halloweenEntry.findFirst({
        where: eq(halloweenEntry.addressKey, key),
        columns: { id: true },
      })) ?? null
    )
  } catch (err) {
    console.warn('[halloween] address-uniqueness precheck failed; relying on DB unique index', err)
    return null
  }
}

async function handlePost(req: NextRequest) {
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

  // Photos are optional (address is the only required field). Sanity-check what's provided.
  const files = form.getAll('photos').filter((v): v is File => typeof v !== 'string' && v.size > 0)
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

  const ip = clientIp(req.headers)
  const turnstile = await verifyTurnstileOrSkip(f.turnstileToken ?? '', ip === 'unknown' ? null : ip)
  if (!turnstile.ok) {
    const missing = turnstile.reason === 'missing-token'
    return NextResponse.json(
      {
        code: 'captcha',
        reason: turnstile.reason,
        error: missing
          ? "The security check didn't finish loading. Wait for the green checkmark above the button and try again - or open this page in Chrome or Safari."
          : 'The security check expired or was already used. We refreshed it - please tap Submit once more.',
      },
      { status: 403 },
    )
  }

  const ipHash = ip === 'unknown' ? null : await hashIp(ip)

  if (ipHash && (await rateLimitedForIp(ipHash))) {
    return NextResponse.json({ error: 'Too many entries from this network today.' }, { status: 429 })
  }

  const key = addressKey(f.streetAddress, f.zip || null)
  if (await findExistingEntry(key)) {
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
        displayName: f.displayName || null,
        tagline: f.tagline || null,
        description: f.description || null,
        category: f.category || null,
        contactName: f.contactName ? f.contactName : null,
        contactEmail: f.contactEmail ? f.contactEmail.toLowerCase() : null,
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
    if (isUniqueViolation(err)) {
      // Precheck was bypassed (findExistingEntry failed and let the insert through);
      // the unique index on "HalloweenEntry"."addressKey" caught the duplicate.
      return NextResponse.json(
        { error: 'That address has already been entered. Contact us if this is a mistake.' },
        { status: 409 },
      )
    }
    console.error('[halloween] insert failed', err)
    return NextResponse.json({ error: 'Could not save your entry. Please try again.' }, { status: 500 })
  }

  // Best-effort admin notification - never blocks the response.
  const adminTo = process.env.ADMIN_NOTIFY_EMAIL
  if (adminTo) {
    const outside = geo && !insideMorenoValleyArea(geo.lat, geo.lng)
    const hasContact = !!(f.contactName || f.contactEmail)
    const contactLine = hasContact
      ? `By ${f.contactName || 'Anonymous'}${f.contactEmail ? ` <${f.contactEmail}>` : ''}\n`
      : ''
    const contactHtml = hasContact
      ? `<p>By ${escapeHtml(f.contactName || 'Anonymous')}${f.contactEmail ? ` &lt;${escapeHtml(f.contactEmail)}&gt;` : ''}</p>`
      : ''
    await Promise.race([
      sendEmail({
        to: adminTo,
        subject: `New Haunted Homes entry: ${f.displayName || 'Anonymous home'}`,
        text: `${f.displayName || 'Anonymous home'}\n${f.streetAddress}, ${city}\n${contactLine}${geo ? '' : 'GEOCODING FAILED - set the pin manually.\n'}${outside ? 'WARNING: address resolves outside the Moreno Valley area.\n' : ''}Review: https://www.moval.living/dashboard/halloween`,
        html: `<p><strong>${escapeHtml(f.displayName || 'Anonymous home')}</strong><br>${escapeHtml(f.streetAddress)}, ${city}</p>${contactHtml}${geo ? '' : '<p><strong>Geocoding failed - set the pin manually.</strong></p>'}${outside ? '<p><strong>Address resolves outside the Moreno Valley area.</strong></p>' : ''}<p><a href="https://www.moval.living/dashboard/halloween">Review entries</a></p>`,
      }).catch((e) => console.warn('[halloween] admin email failed', e)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])
  }

  return NextResponse.json({ ok: true, id: created.id })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
