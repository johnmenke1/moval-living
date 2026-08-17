/* eslint-disable no-console */
/**
 * scripts/enrich-park-photos.mts
 *
 * Step 9b of the /parks roadmap: populate Park.photoUrls[] with up to
 * 6 Google Places photos per park. Step 9a (capture-park-photos.mts)
 * gave us a single hero per park from the City's GIS layer; this
 * script expands each park into a multi-photo gallery using the
 * Google Places API (New).
 *
 * Why Google Places (vs. trusting only the City)
 * ----------------------------------------------
 * - The City's pic_url is the *official* image but it's a single stock
 *   photo — useful as a hero, not for a gallery.
 * - Google Places photos are user-submitted + community-curated; for
 *   a community site like moval.living, that's a richer asset.
 * - Up to 10 photos per place; we'll pick the top 6 by author-area
 *   popularity heuristic (or just first 6 if no signal).
 *
 * Flow
 * ----
 *   1. For each park with `photoUrls.length < 3` (skip already-enriched):
 *      a. Text Search (New): "<name>" + "<address or 'Moreno Valley'>"
 *         → capture placeId. Skip if already have one.
 *      b. Place Details (New) with X-Goog-FieldMask: photos,name,displayName
 *         → photos[] (up to 10 entries, each with `name` resource).
 *      c. For each photo, GET /v1/{name}/media?key=…&maxWidthPx=1200
 *         (default: redirect to a googleusercontent URL — we follow to
 *         download the raw JPEG bytes).
 *      d. Upload each JPEG to Vercel Blob at
 *         parks/{slug}/photo-{i}-{hash}.jpg (deterministic path;
 *         FNV-1a hash).
 *   2. Write the resulting photoUrls[] back to the DB row.
 *   3. Set heroPhotoUrl to the first uploaded photo (if not already
 *      set from step 9a).
 *
 * Idempotence
 * -----------
 * Re-running:
 *   - Skips rows whose photoUrls.length >= MIN_PHOTOS (3).
 *   - Pass --force to re-resolve + re-upload regardless.
 *
 * Quota
 * -----
 * Each park = 1 Text Search + 1 Place Details + N Photo media requests
 * (N up to 6). At MAX_PARALLEL=2 this avoids tripping 429s.
 *
 * Run:  DATABASE_URL=… BLOB_READ_WRITE_TOKEN=… GOOGLE_PLACES_API_KEY=… \
 *       node --experimental-strip-types scripts/enrich-park-photos.mts
 *       (with optional --force flag)
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { put } from '@vercel/blob'

// --- Config -----------------------------------------------------------------

const FORCE = process.argv.includes('--force')
const DRY_RUN = process.argv.includes('--dry-run')
const MAX_PARALLEL = 2 // google-maps quota
const MIN_PHOTOS = 3 // skip a row already at or above this count
const MAX_PHOTOS = 6 // cap per park (matches ParkCard grid)

// --- Preconditions ----------------------------------------------------------

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!DRY_RUN && !PLACES_KEY) {
  console.error('[enrich-photos] ❌ GOOGLE_PLACES_API_KEY is not set in env.')
  console.error('    Vercel → Project → Settings → Environment Variables should set this.')
  console.error('    (Use --dry-run to validate the script without contacting Google.)')
  process.exit(1)
}
if (!DRY_RUN && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('[enrich-photos] ❌ BLOB_READ_WRITE_TOKEN is not set in env.')
  console.error('    Vercel → Storage → Blob store → .env.local tab.')
  process.exit(1)
}

// --- Types ------------------------------------------------------------------

interface ParkTarget {
  parkId: string
  slug: string
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  /** Existing photos already in the DB (for --force re-runs). */
  existing: string[]
  /** Existing Google Place id if we have one. */
  existingPlaceId: string | null
}

interface PhotoRef {
  /** Google Places resource name, e.g. "places/PLACE_ID/photos/PHOTO_RESOURCE" */
  name: string
  widthPx: number
  heightPx: number
  /** Optional attribution (TODO: render in UI). */
  authorAttribution?: string
}

// --- 1. Gather targets ------------------------------------------------------

async function gatherTargets(): Promise<ParkTarget[]> {
  const dbParks = await prisma.park.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      googlePlaceId: true,
      photoUrls: true,
      heroPhotoUrl: true,
    },
  })

  // Skip parks that already meet the threshold unless --force.
  return dbParks
    .filter((p) => {
      if (FORCE) return true
      // Only enrich if (a) no place id, OR (b) too-few photos.
      const photosCount =
        p.photoUrls?.filter((u) => !u.includes('maps.gstatic')).length ?? 0
      return !p.googlePlaceId || photosCount < MIN_PHOTOS
    })
    .map((p) => ({
      parkId: p.id,
      slug: p.slug,
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      existing: p.photoUrls ?? [],
      existingPlaceId: p.googlePlaceId,
    }))
}

// --- 2. Google Places API helpers ------------------------------------------

async function findPlaceId(
  t: ParkTarget,
): Promise<{ placeId: string; photoNames: PhotoRef[] } | null> {
  if (!PLACES_KEY) return null

  // Strategy: Text Search (New) with the park name + city. The result
  // already gives us `id` (place_id) and `photos[]`, so we can skip a
  // second Place Details request when Text Search returns photos.
  //
  // The endpoint requires X-Goog-FieldMask — without it the API errors.
  const query = `${t.name}, Moreno Valley, CA${t.address ? `, ${t.address}` : ''}`
  const url = `https://places.googleapis.com/v1/places:searchText`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: t.latitude && t.longitude
        ? {
            circle: {
              center: { latitude: t.latitude, longitude: t.longitude },
              radius: 1500,
            },
          }
        : undefined,
      maxResultCount: 1,
    }),
  })

  if (!res.ok) {
    console.warn(`  ⚠️ ${t.slug}: Text Search returned HTTP ${res.status} for "${query}"`)
    return null
  }

  const json: {
    places?: Array<{
      id: string
      displayName?: { text?: string }
      photos?: Array<{
        name: string
        widthPx?: number
        heightPx?: number
      }>
    }>
  } = await res.json()

  const place = json.places?.[0]
  if (!place?.id) return null

  const photoNames: PhotoRef[] = (place.photos ?? []).slice(0, MAX_PHOTOS).map((p) => ({
    name: p.name,
    widthPx: p.widthPx ?? 0,
    heightPx: p.heightPx ?? 0,
  }))

  return { placeId: place.id, photoNames }
}

async function fetchPhotoMedia(photoName: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  // GET https://places.googleapis.com/v1/NAME/media?key=…&maxWidthPx=1200
  // The endpoint returns a 302 redirect to a stable
  // lh3.googleusercontent.com URL — we follow to get the raw bytes.
  const url = `https://places.googleapis.com/v1/${encodeURI(photoName)}/media?key=${PLACES_KEY}&maxWidthPx=1200`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    console.warn(`  ⚠️ photo ${photoName}: HTTP ${res.status}`)
    return null
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const ab = await res.arrayBuffer()
  return { buffer: Buffer.from(ab), contentType }
}

// --- 3. Upload helpers ------------------------------------------------------

function slugHash(slug: string, ...parts: string[]): string {
  // FNV-1a — deterministic 8-char hex so two parks' photos never collide.
  let h = 2166136261 >>> 0
  const s = [slug, ...parts].join('|')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

async function uploadParkPhoto(
  t: ParkTarget,
  i: number,
  photo: PhotoRef,
): Promise<string | null> {
  const media = await fetchPhotoMedia(photo.name)
  if (!media) return null

  const path = `parks/${t.slug}/photo-${String(i).padStart(2, '0')}-${slugHash(t.slug, photo.name)}.jpg`
  const blob = await put(path, media.buffer, {
    access: 'public',
    contentType: media.contentType,
    addRandomSuffix: false,
  })
  return blob.url
}

// --- 4. Per-park pipeline ---------------------------------------------------

async function enrichOne(t: ParkTarget): Promise<{
  slug: string
  status: 'ok' | 'failed' | 'skipped'
  uploaded?: number
  placeId?: string
  error?: string
}> {
  try {
    // 1. Place lookup
    let placeId = t.existingPlaceId
    let photoNames: PhotoRef[] = []
    if (placeId) {
      // We already have a place id but no photos — skip place lookup.
      // (Could re-fetch photos here via Place Details; for now assume
      //  photoUrls.length < MIN_PHOTOS means we need to redo.)
      if (t.existing.length >= MIN_PHOTOS) {
        return { slug: t.slug, status: 'skipped' }
      }
    }
    const found = await findPlaceId(t)
    if (!found) {
      return { slug: t.slug, status: 'failed', error: 'no place id' }
    }
    placeId = found.placeId
    photoNames = found.photoNames
    if (photoNames.length === 0) {
      // Update place id anyway so we don't re-search.
      await prisma.park.update({
        where: { id: t.parkId },
        data: { googlePlaceId: placeId },
      })
      return { slug: t.slug, status: 'ok', uploaded: 0, placeId }
    }

    // 2. Upload each photo (sequentially per park; throttle = MAX_PARALLEL).
    const urls: string[] = []
    for (let i = 0; i < photoNames.length; i++) {
      const photo = photoNames[i]
      const url = await uploadParkPhoto(t, i, photo)
      if (url) urls.push(url)
    }

    // 3. Persist: keep any pre-existing photos (e.g. City hero from
    //    step 9a), then prepend the new Google photos.
    const existingKeepers = t.existing.filter((u) => {
      // Drop pre-existing entries that came from a prior step 9b run
      // (their URL contains "/photo-" which we use for re-runs).
      const isStep9b = /\/parks\/[^/]+\/photo-/.test(u)
      return !isStep9b
    })
    const combined = [...existingKeepers, ...urls].slice(0, MAX_PHOTOS)
    const heroPhotoUrl =
      combined[0] && !t.existing.some((u) => u.includes('hero-')) ? combined[0] : undefined

    await prisma.park.update({
      where: { id: t.parkId },
      data: {
        googlePlaceId: placeId,
        photoUrls: { set: combined },
        ...(heroPhotoUrl ? { heroPhotoUrl } : {}),
      },
    })

    return { slug: t.slug, status: 'ok', uploaded: urls.length, placeId }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { slug: t.slug, status: 'failed', error }
  }
}

// --- 5. Main ---------------------------------------------------------------

async function main() {
  const targets = await gatherTargets()
  console.log(`[enrich-photos] ${FORCE ? 'FORCE re-enrich' : 'skip already-enriched parks (≥ ' + MIN_PHOTOS + ' photos)'}${DRY_RUN ? ' [DRY RUN]' : ''}`)
  console.log(`[enrich-photos] ${targets.length} park(s) to process`)

  if (DRY_RUN) {
    for (const t of targets.slice(0, 8)) {
      console.log(`  - ${t.slug.padEnd(45)} "${t.name}" @ ${t.address ?? '(no addr)'}, has ${t.existing.length} photo(s)`)
    }
    if (targets.length > 8) console.log(`  …and ${targets.length - 8} more`)
    console.log('[enrich-photos] DRY RUN — no API calls, no uploads, no DB writes')
    return
  }

  const results: Array<Awaited<ReturnType<typeof enrichOne>>> = []
  for (let i = 0; i < targets.length; i += MAX_PARALLEL) {
    const slice = targets.slice(i, i + MAX_PARALLEL)
    const batch = await Promise.all(slice.map(enrichOne))
    results.push(...batch)
    for (const r of batch) {
      const icon = r.status === 'ok' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌'
      const detail = r.uploaded != null ? `+${r.uploaded} photos` : r.error ?? ''
      console.log(`  ${icon} ${r.slug.padEnd(45)} ${detail}`)
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const failed = results.filter((r) => r.status === 'failed').length
  console.log(`[enrich-photos] ✅ ${ok} ok · ⏭️ ${skipped} skipped · ❌ ${failed} failed (of ${results.length})`)

  await prisma.$disconnect()
  await pool.end()
}

await main()
