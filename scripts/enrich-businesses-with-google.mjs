/**
 * enrich-businesses-with-google.mjs
 *
 * Two-phase enrichment for businesses that have NO googleBusiness (place_id):
 *
 * Phase 1 — Lookup: searchText API to find each business's place_id
 *   - Uses name + city as query
 *   - Verifies result is in/near Moreno Valley via locationBias
 *   - Writes place_id to googleBusiness field
 *   - If no match in Google, skips (most churches, schools, mom-and-pops
 *     aren't on Google Places)
 *
 * Phase 2 — Details: for each business that now has a place_id:
 *   - Pulls rating, reviewCount, photos via Places Details
 *   - Downloads each photo, uploads to Vercel Blob (permanent URLs)
 *   - Picks logo (square, business-authored), cover (landscape, large),
 *     and up to 6 gallery photos
 *   - Writes logo, coverImage, photos[] with blob URLs
 *
 * Storage: photos stored in Vercel Blob at businesses/google-imports/{slug}/
 * (NOT Google's expiring CDN URLs — those die in 30 days)
 *
 * Cost: ~$0.032 per searchText call + ~$0.032 per Details call.
 *   For 521 businesses, expect:
 *     - ~$16.67 on lookups (one per business)
 *     - ~$8-11 on Details (only ones that got matched)
 *     - Total: ~$25-28 of your $200/mo Google credit
 *   Vercel Blob: free tier covers ~150MB easily (500 businesses × 6 photos × 50KB)
 *
 * Usage:
 *   node scripts/enrich-businesses-with-google.mjs --limit=50 --dry-run
 *   node scripts/enrich-businesses-with-google.mjs --limit=50
 *   node scripts/enrich-businesses-with-google.mjs   # full run, no limit
 *
 * Flags:
 *   --limit=N       process only first N (testing)
 *   --dry-run       print what would change, write nothing
 *   --lookup-only   do only Phase 1 (find place_ids), skip Details/photos
 *   --details-only  do only Phase 2 (skip lookup), assume place_ids exist
 */

import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { put } from '@vercel/blob'

// ── env ──────────────────────────────────────────────────────────────────
const lines = readFileSync('./.env.local', 'utf8').split('\n')
const get = k => {
  const l = lines.find(x => x.startsWith(k + '='))
  if (!l) return ''
  let v = l.split('=').slice(1).join('=').trim()
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
  return v
}
const KEY = get('GOOGLE_PLACES_API_KEY')
const BLOB_TOKEN = get('BLOB_READ_WRITE_TOKEN')
if (!KEY) { console.error('GOOGLE_PLACES_API_KEY not set in .env.local'); process.exit(1) }
if (!BLOB_TOKEN) { console.error('BLOB_READ_WRITE_TOKEN not set in .env.local'); process.exit(1) }

// ── flags ────────────────────────────────────────────────────────────────
const rawArgs = process.argv.slice(2).filter(a => a.startsWith('--'))
const args = {}
for (const a of rawArgs) {
  const eq = a.indexOf('=')
  if (eq !== -1) args[a.slice(2, eq)] = a.slice(eq + 1)
  else args[a.slice(2)] = true
}
const LIMIT = args.limit ? parseInt(args.limit, 10) : null
const DRY_RUN = !!args['dry-run']
const LOOKUP_ONLY = !!args['lookup-only']
const DETAILS_ONLY = !!args['details-only']

// ── constants ────────────────────────────────────────────────────────────
// Moreno Valley center for locationBias (improves searchText accuracy)
const MV_LAT = 33.9375
const MV_LNG = -117.2306
const LOCATION_BIAS = {
  locationBias: {
    circle: {
      center: { latitude: MV_LAT, longitude: MV_LNG },
      radius: 8000.0,  // 8km — slightly larger than M.V. for border businesses
    },
  },
}

// ── helpers ──────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function slug(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

// ── Google Places: searchText → place_id ─────────────────────────────────
async function findPlaceId(name, address) {
  // Build query: name + first street segment from address
  let q = name
  if (address) {
    const street = address.split(',')[0].trim()
    if (street && street.length > 4 && street !== name) q = `${name}, ${street}`
  }
  q += ', Moreno Valley, CA'
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({
        textQuery: q,
        maxResultCount: 3,
        ...LOCATION_BIAS,
      }),
    })
    if (!r.ok) return { error: `searchText HTTP ${r.status}`, places: [] }
    const j = await r.json()
    return { error: null, places: j.places || [] }
  } catch (e) {
    return { error: e.message, places: [] }
  }
}

// ── Google Places: Details → rating, photos ──────────────────────────────
async function fetchPlaceDetails(placeId) {
  const mask = 'displayName,rating,userRatingCount,photos'
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': mask },
    })
    if (!r.ok) return { error: `Details HTTP ${r.status}`, details: null }
    const j = await r.json()
    return { error: null, details: j }
  } catch (e) {
    return { error: e.message, details: null }
  }
}

// ── Photo picker heuristics ──────────────────────────────────────────────
function pickLogo(photos, bizName) {
  if (!photos.length) return null
  // Prefer business-authored photos (owner uploads)
  const authored = photos.filter(p =>
    (p.authorAttributions || []).some(a => {
      const an = (a.displayName || '').toLowerCase()
      return an && (an === bizName.toLowerCase() || an.includes(bizName.toLowerCase().split(' ')[0]))
    })
  )
  const pool = authored.length ? authored : photos
  // Most-square aspect ratio (closest to 1:1)
  return pool.sort((a, b) => {
    const ar = (p) => Math.abs(1 - (p.widthPx || 1) / (p.heightPx || 1))
    return ar(a) - ar(b)
  })[0]
}

function pickCover(photos, bizName) {
  if (!photos.length) return null
  const authored = photos.filter(p =>
    (p.authorAttributions || []).some(a => {
      const an = (a.displayName || '').toLowerCase()
      return an && (an === bizName.toLowerCase() || an.includes(bizName.toLowerCase().split(' ')[0]))
    })
  )
  const pool = authored.length ? authored : photos
  // Largest area, prefer landscape (wider than tall)
  return pool.sort((a, b) => {
    const area = (p) => (p.widthPx || 0) * (p.heightPx || 0)
    const landscape = (p) => (p.widthPx || 0) >= (p.heightPx || 0) ? 1 : 0
    return (landscape(b) - landscape(a)) || (area(b) - area(a))
  })[0]
}

function pickGallery(photos, logo, cover, maxN = 6) {
  const seen = new Set()
  const out = []
  for (const p of [cover, logo, ...photos]) {
    if (!p || seen.has(p.name)) continue
    seen.add(p.name)
    out.push(p)
    if (out.length >= maxN) break
  }
  return out
}

// ── Photo download + Vercel Blob upload ──────────────────────────────────
async function uploadPhotoToBlob(photo, bizSlug, label, maxWidth) {
  // Google's photo media URL. We follow the 302 redirect and stream the
  // final image bytes to Vercel Blob for permanent storage.
  const mediaUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=${maxWidth}&key=${KEY}`
  try {
    const r = await fetch(mediaUrl, { redirect: 'follow' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    const contentType = r.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('webp') ? 'webp'
      : 'jpg'
    const blobPath = `businesses/google-imports/${bizSlug}/${label}.${ext}`
    const blob = await put(blobPath, buf, {
      access: 'public',
      contentType,
      token: BLOB_TOKEN,
    })
    return blob.url
  } catch (e) {
    return null
  }
}

// ── DB pool ──────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: get('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
})

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const stats = {
    processed: 0,
    placeIdsFound: 0,
    placeIdsNotFound: 0,
    ratingSet: 0,
    logoSet: 0,
    coverSet: 0,
    photosSet: 0,
    noPhotosFromGoogle: 0,
    apiErrors: 0,
    blobErrors: 0,
  }

  // ── load candidates ────────────────────────────────────────────────
  // For lookup: businesses with no place_id
  // For details: businesses WITH place_id (will be enriched in this run too)
  let candidates
  if (DETAILS_ONLY) {
    candidates = (await pool.query(`
      SELECT id, name, address, city, "googleBusiness", logo, "coverImage", photos
      FROM "Business"
      WHERE "googleBusiness" IS NOT NULL AND "googleBusiness" != ''
        AND status = 'APPROVED'
        AND (logo IS NULL OR "coverImage" IS NULL OR array_length(photos, 1) IS NULL)
      ORDER BY id
    `)).rows
  } else if (LOOKUP_ONLY) {
    candidates = (await pool.query(`
      SELECT id, name, address, city, "googleBusiness"
      FROM "Business"
      WHERE ("googleBusiness" IS NULL OR "googleBusiness" = '')
        AND status = 'APPROVED'
        AND name IS NOT NULL AND name != ''
      ORDER BY id
    `)).rows
  } else {
    // Default: all APPROVED businesses with no place_id
    candidates = (await pool.query(`
      SELECT id, name, address, city, "googleBusiness", logo, "coverImage", photos
      FROM "Business"
      WHERE ("googleBusiness" IS NULL OR "googleBusiness" = '')
        AND status = 'APPROVED'
        AND name IS NOT NULL AND name != ''
      ORDER BY id
    `)).rows
  }
  if (LIMIT) candidates = candidates.slice(0, LIMIT)
  console.log(`Processing ${candidates.length} candidates${DRY_RUN ? ' (DRY RUN)' : ''}${LOOKUP_ONLY ? ' (LOOKUP ONLY)' : ''}${DETAILS_ONLY ? ' (DETAILS ONLY)' : ''}\n`)

  for (const biz of candidates) {
    stats.processed++
    process.stdout.write(`[${stats.processed}/${candidates.length}] ${biz.name.slice(0, 40).padEnd(40)} `)

    // ── Phase 1: searchText → place_id ───────────────────────────────
    let placeId = biz.googleBusiness
    if (!placeId) {
      const { error, places } = await findPlaceId(biz.name, biz.address)
      if (error) {
        console.log(`✗ lookup error: ${error}`)
        stats.apiErrors++
        continue
      }
      if (places.length === 0) {
        console.log(`⊘ no Google match`)
        stats.placeIdsNotFound++
        continue
      }
      placeId = places[0].id
      stats.placeIdsFound++
      if (DRY_RUN) {
        console.log(`→ would set place_id=${placeId} (matched: ${places[0].displayName?.text || '?'})`)
        continue
      }
      await pool.query(
        'UPDATE "Business" SET "googleBusiness" = $1, "updatedAt" = NOW() WHERE id = $2',
        [placeId, biz.id]
      )
      console.log(`→ place_id set (${places[0].displayName?.text || '?'}); `)
      process.stdout.write('   ')
      // Small delay between API calls
      await sleep(150)
    }

    if (LOOKUP_ONLY) continue

    // ── Phase 2: Details → rating + photos ───────────────────────────
    const { error, details } = await fetchPlaceDetails(placeId)
    if (error || !details) {
      console.log(`✗ details error: ${error}`)
      stats.apiErrors++
      continue
    }

    const newRating = details.rating ?? null
    const newReviewCount = details.userRatingCount ?? null
    const photos = details.photos || []

    // Pick logo + cover + gallery
    const bizName = details.displayName?.text || biz.name
    const logoPhoto = pickLogo(photos, bizName)
    const coverPhoto = pickCover(photos, bizName)
    const galleryPhotos = pickGallery(photos, logoPhoto, coverPhoto, 6)

    if (photos.length === 0) {
      // Update rating only, no photos
      if (!DRY_RUN) {
        await pool.query(
          'UPDATE "Business" SET "googleRating" = $1, "googleReviewCount" = $2, "updatedAt" = NOW() WHERE id = $3',
          [newRating, newReviewCount, biz.id]
        )
      }
      stats.ratingSet++
      stats.noPhotosFromGoogle++
      console.log(`rating=${newRating} (no photos in Google)`)
      continue
    }

    // Upload photos to Vercel Blob
    const bizSlug = slug(biz.name) || biz.id.slice(-8)
    let logoUrl = null
    let coverUrl = null
    let galleryUrls = []

    if (logoPhoto && (!biz.logo || DRY_RUN)) {
      logoUrl = await uploadPhotoToBlob(logoPhoto, bizSlug, 'logo', 400)
      if (!logoUrl) stats.blobErrors++
      else stats.logoSet++
    }

    if (coverPhoto && (!biz.coverImage || DRY_RUN)) {
      coverUrl = await uploadPhotoToBlob(coverPhoto, bizSlug, 'cover', 1200)
      if (!coverUrl) stats.blobErrors++
      else stats.coverSet++
    }

    // Upload gallery (max 6, includes logo+cover)
    for (let i = 0; i < galleryPhotos.length; i++) {
      const p = galleryPhotos[i]
      // Skip if already used as logo or cover
      if (logoPhoto && p.name === logoPhoto.name && logoUrl) {
        galleryUrls.push(logoUrl)
        continue
      }
      if (coverPhoto && p.name === coverPhoto.name && coverUrl) {
        galleryUrls.push(coverUrl)
        continue
      }
      const url = await uploadPhotoToBlob(p, bizSlug, `photo-${i + 1}`, 800)
      if (url) galleryUrls.push(url)
      else stats.blobErrors++
    }
    if (galleryUrls.length) stats.photosSet++

    if (DRY_RUN) {
      console.log(`would upload: logo=${!!logoUrl}, cover=${!!coverUrl}, photos=${galleryUrls.length}, rating=${newRating}`)
      continue
    }

    // Build UPDATE
    const updates = {}
    if (newRating !== null) updates.googleRating = newRating
    if (newReviewCount !== null) updates.googleReviewCount = newReviewCount
    if (logoUrl) updates.logo = logoUrl
    if (coverUrl) updates.coverImage = coverUrl
    if (galleryUrls.length) updates.photos = galleryUrls

    if (Object.keys(updates).length === 0) {
      console.log(`already complete`)
      continue
    }

    updates.updatedAt = 'NOW()' // marker; replaced below
    const setClauses = Object.keys(updates).filter(k => k !== 'updatedAt').map((k, i) => `"${k}" = $${i + 1}`).join(', ')
    const values = Object.keys(updates).filter(k => k !== 'updatedAt').map(k => updates[k])
    values.push(biz.id)
    await pool.query(
      `UPDATE "Business" SET ${setClauses}, "updatedAt" = NOW() WHERE id = $${values.length}`,
      values
    )
    if (newRating !== null) stats.ratingSet++
    console.log(`✓ rating=${newRating}, logo=${!!logoUrl}, cover=${!!coverUrl}, photos=${galleryUrls.length}`)

    // Be nice to Google's API
    await sleep(150)
  }

  console.log('\n=== DONE ===')
  console.log(`Processed:           ${stats.processed}`)
  console.log(`Place IDs found:     ${stats.placeIdsFound}`)
  console.log(`Place IDs not found: ${stats.placeIdsNotFound}`)
  console.log(`Rating set:          ${stats.ratingSet}`)
  console.log(`Logo set:            ${stats.logoSet}`)
  console.log(`Cover set:           ${stats.coverSet}`)
  console.log(`Photos set:          ${stats.photosSet}`)
  console.log(`No photos from Google: ${stats.noPhotosFromGoogle}`)
  console.log(`API errors:          ${stats.apiErrors}`)
  console.log(`Blob upload errors:  ${stats.blobErrors}`)

  await pool.end()
}

main().catch(e => { console.error(e); pool.end(); process.exit(1) })