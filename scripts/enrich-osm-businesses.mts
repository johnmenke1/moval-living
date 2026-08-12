/**
 * enrich-osm-businesses.mts
 *
 * For each APPROVED business in our DB that has empty Google data fields,
 * look up the Google Place ID, fetch full details + photos, and update.
 *
 * Use case: We imported ~334 businesses from OpenStreetMap that have only
 * name + lat/lng + address. They need phone, website, hours, rating,
 * reviews, and photos to look complete in the directory.
 *
 * Flow per business:
 *   1. Text Search "{name} Moreno Valley CA" with locationBias=lat/lng (250m)
 *   2. Pick best match (closest distance, name overlap)
 *   3. Place Details for full record (phone, website, hours, rating, photos)
 *   4. Download logo + cover + 2 extras to S3
 *   5. UPDATE Business with new fields + photo URLs
 *
 * Flags:
 *   --dry-run              Show what would be enriched, no DB writes
 *   --limit=N              Only enrich first N businesses (for testing)
 *   --only=slug            Only enrich businesses in this category
 *   --only-osm             Only enrich businesses whose description starts with "OSM import:" (default behavior)
 *   --skip-photos          Don't download/upload photos
 *
 * Required env:
 *   DATABASE_URL
 *   GOOGLE_PLACES_API_KEY
 *   BLOB_READ_WRITE_TOKEN  (only if uploading photos; auto-set in Vercel deploys)
 *
 * Usage:
 *   # Test with 5 (no photos)
 *   DATABASE_URL=... GOOGLE_PLACES_API_KEY=... \
 *     npx tsx scripts/enrich-osm-businesses.mts --dry-run --skip-photos --limit=5
 *
 *   # Full run with photos
 *   DATABASE_URL=... GOOGLE_PLACES_API_KEY=... BLOB_READ_WRITE_TOKEN=... \
 *     npx tsx scripts/enrich-osm-businesses.mts
 */

import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { put } from '@vercel/blob'

// ─── Env ────────────────────────────────────────────────────────────────────
function loadEnv(path: string): Record<string, string> {
  try {
    const text = readFileSync(path, 'utf8')
    const env: Record<string, string> = {}
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]] = v
    }
    return env
  } catch { return {} }
}
const fileEnv = { ...loadEnv('./.env'), ...loadEnv('./.env.local') }
for (const [k, v] of Object.entries(fileEnv)) if (!process.env[k]) process.env[k] = v

const DATABASE_URL = process.env.DATABASE_URL!
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }
if (!GOOGLE_PLACES_API_KEY) { console.error('GOOGLE_PLACES_API_KEY not set'); process.exit(1) }

// ─── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flags: Record<string, string | boolean> = {}
for (const a of args) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  if (m) flags[m[1]] = m[2] ?? true
}
const DRY_RUN = !!flags['dry-run']
const SKIP_PHOTOS = !!flags['skip-photos']
const LIMIT = typeof flags['limit'] === 'string' ? parseInt(flags['limit'], 10) : null
const ONLY_SLUG = typeof flags['only'] === 'string' ? flags['only'] : null
const FORCE_RE_ENRICH = !!flags['force'] // Re-enrich even if googleBusiness is set (for hours fix, etc.)

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseAddress(address: string) {
  const parts = address.split(',').map(p => p.trim())
  let city = 'Moreno Valley', state = 'CA', zip = '', street = address
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    const zm = last.match(/\d{5}/); if (zm) zip = zm[0]
    const sm = last.match(/[A-Z]{2}/); if (sm) state = sm[0]
    if (parts.length >= 3) city = parts[parts.length - 2].replace(/, USA$/, '').trim()
    street = parts[0]
  }
  return { street, city, state, zip }
}

function parseOpeningHours(roh: any): any | null {
  if (!roh?.periods?.length) return null
  // Google Places API (New) returns day numbers 0-6 (Sunday=0, Saturday=6)
  // But the response uses lowercase day strings only via weekdayDescriptions, not periods
  const dn: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
  const r: Record<string, any> = {}
  for (const p of roh.periods) {
    const openDay = p.open?.day
    if (openDay === undefined || openDay === null) continue
    const closeDay = p.close?.day ?? openDay
    const d = dn[openDay]
    if (!d) continue
    const openStr = `${String(p.open.hour).padStart(2, '0')}:${String(p.open.minute || 0).padStart(2, '0')}`
    const closeStr = p.close ? `${String(p.close.hour).padStart(2, '0')}:${String(p.close.minute || 0).padStart(2, '0')}` : null
    // Handle periods that span midnight (close day != open day)
    if (closeDay !== openDay && closeStr) {
      // Just use the close day for the close time — business logic ignores this edge case
      r[d] = { open: openStr, close: closeStr }
    } else {
      r[d] = { open: openStr, close: closeStr }
    }
  }
  return Object.keys(r).length ? r : null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

// Jaccard similarity for name matching (handles "Marinaj Banquets" vs "Marinaj Banquet & Events")
function nameScore(a: string, b: string): number {
  const aa = new Set(normalize(a).split(''))
  const bb = new Set(normalize(b).split(''))
  let inter = 0
  for (const c of aa) if (bb.has(c)) inter++
  const union = new Set([...aa, ...bb]).size
  return union === 0 ? 0 : inter / union
}

// ─── Google Places API (New) ────────────────────────────────────────────────
type PlaceRaw = {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  regularOpeningHours?: any
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  photos?: Array<{ name: string }>
  primaryType?: string
  types?: string[]
}

async function searchPlacesByNameAndLoc(name: string, lat: number, lng: number): Promise<PlaceRaw[]> {
  // Text Search with locationBias = small circle around the OSM lat/lng
  const url = 'https://places.googleapis.com/v1/places:searchText'
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType',
    },
    body: JSON.stringify({
      textQuery: `${name} Moreno Valley CA`,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 250 } },
      maxResultCount: 5,
    }),
  })
  if (!r.ok) {
    if (r.status === 429) console.warn(`  WARN: rate-limited (429), sleeping 30s...`)
    if (r.status === 429) { await new Promise(res => setTimeout(res, 30000)); return [] }
    console.warn(`  WARN: Text Search ${r.status}: ${(await r.text()).slice(0, 200)}`)
    return []
  }
  const d = await r.json()
  return d.places || []
}

async function getPlaceDetails(placeId: string): Promise<PlaceRaw | null> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`
  const r = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,regularOpeningHours.weekdayDescriptions,regularOpeningHours.openNow,regularOpeningHours.periods,location,rating,userRatingCount,photos,primaryType,types',
    },
  })
  if (!r.ok) {
    console.warn(`  WARN: Place Details ${r.status}: ${(await r.text()).slice(0, 200)}`)
    return null
  }
  return await r.json()
}

// ─── Photo handling (Vercel Blob) ───────────────────────────────────────────
async function fetchPhotoBuffer(photoName: string, maxHeight: number): Promise<Buffer | null> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeight}&key=${GOOGLE_PLACES_API_KEY}`
  const r = await fetch(url, { redirect: 'follow' })
  if (!r.ok) return null
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 2048) return null // Skip "no image" placeholders
  return buf
}

async function uploadPhoto(key: string, buf: Buffer): Promise<string | null> {
  try {
    const blob = await put(key, buf, {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
    })
    return blob.url
  } catch (e: any) {
    console.warn(`  WARN: Vercel Blob upload failed for ${key}: ${e.message?.slice(0, 80)}`)
    return null
  }
}

async function downloadAndUploadPhotos(slug: string, photoNames: string[]): Promise<{ logo: string | null; cover: string | null; photos: string[] }> {
  if (!photoNames.length) return { logo: null, cover: null, photos: [] }
  if (SKIP_PHOTOS) return { logo: null, cover: null, photos: [] }

  // Pick: photo[0] for logo, photo[1] for cover, photo[2,3] for extras
  const logoName = photoNames[0]
  const coverName = photoNames[1] ?? photoNames[0]
  const extras = photoNames.slice(2, 4)

  let logoUrl: string | null = null
  let coverUrl: string | null = null
  const extraUrls: string[] = []

  if (logoName) {
    const buf = await fetchPhotoBuffer(logoName, 400)
    if (buf) logoUrl = await uploadPhoto(`businesses/logos/${slug}.jpg`, buf)
  }
  if (coverName && coverName !== logoName) {
    const buf = await fetchPhotoBuffer(coverName, 1200)
    if (buf) coverUrl = await uploadPhoto(`businesses/covers/${slug}.jpg`, buf)
  }
  for (let i = 0; i < extras.length; i++) {
    const buf = await fetchPhotoBuffer(extras[i], 800)
    if (buf) {
      const url = await uploadPhoto(`businesses/photos/${slug}-${i + 1}.jpg`, buf)
      if (url) extraUrls.push(url)
    }
  }
  return { logo: logoUrl, cover: coverUrl, photos: extraUrls }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('Google Places enrichment for OSM-imported businesses')
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}  Photos: ${SKIP_PHOTOS ? 'OFF' : 'ON'}`)
  if (LIMIT) console.log(`Limit: ${LIMIT} businesses`)
  if (ONLY_SLUG) console.log(`Only category: ${ONLY_SLUG}`)
  console.log()

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

  // Get candidates: APPROVED businesses that came from OSM (description starts with "OSM import:")
  // AND have no googleBusiness ID yet (not previously enriched), unless --force
  const candidatesQuery = `
    SELECT b.id, b.slug, b.name, b.latitude, b.longitude, b.address, c.slug AS category
    FROM "Business" b
    JOIN "Category" c ON c.id = b."categoryId"
    WHERE b.status = 'APPROVED'
      AND b.description LIKE 'OSM import:%'
      ${FORCE_RE_ENRICH ? '' : 'AND (b."googleBusiness" IS NULL OR b."googleBusiness" = \'\')'}
    ORDER BY c.slug, b.name
    ${LIMIT ? `LIMIT ${LIMIT}` : ''}
  `
  const candidatesRes = await pool.query(candidatesQuery)
  let businesses = candidatesRes.rows as Array<{
    id: string; slug: string; name: string; latitude: number; longitude: number
    address: string; category: string
  }>

  if (ONLY_SLUG) {
    businesses = businesses.filter(b => b.category === ONLY_SLUG)
  }

  console.log(`Candidates: ${businesses.length}`)
  console.log()

  if (businesses.length === 0) {
    console.log('Nothing to enrich.')
    await pool.end()
    return
  }

  // Stats per category
  const byCat: Record<string, number> = {}
  for (const b of businesses) byCat[b.category] = (byCat[b.category] || 0) + 1
  console.log('By category:')
  for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(22)} ${n}`)
  }
  console.log()

  let enriched = 0, notFound = 0, errors = 0, photos = 0
  const startTime = Date.now()

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i]
    const progress = `[${i + 1}/${businesses.length}]`

    try {
      // Step 1: Text Search
      const places = await searchPlacesByNameAndLoc(biz.name, biz.latitude, biz.longitude)
      if (places.length === 0) {
        console.log(`${progress} ✗ NOT FOUND: ${biz.name} (${biz.category})`)
        notFound++
        continue
      }

      // Step 2: Pick best match — highest name score within 100m of OSM lat/lng
      let best: PlaceRaw | null = null
      let bestScore = 0
      for (const p of places) {
        if (!p.location) continue
        const distKm = Math.sqrt(
          Math.pow((p.location.latitude - biz.latitude) * 111, 2) +
          Math.pow((p.location.longitude - biz.longitude) * 111 * Math.cos(biz.latitude * Math.PI / 180), 2)
        )
        if (distKm > 0.1) continue // 100m
        const score = nameScore(p.displayName?.text || '', biz.name)
        if (score > bestScore) {
          bestScore = score
          best = p
        }
      }

      if (!best || bestScore < 0.5) {
        console.log(`${progress} ✗ NO MATCH: ${biz.name} (best score ${bestScore.toFixed(2)})`)
        notFound++
        continue
      }

      // Step 3: Place Details for full record
      const details = await getPlaceDetails(best.id)
      if (!details) { errors++; continue }

      // Step 4: Photos
      const photoResult = SKIP_PHOTOS
        ? { logo: null, cover: null, photos: [] }
        : await downloadAndUploadPhotos(biz.slug, details.photos?.map(p => p.name) || [])

      if (photoResult.logo || photoResult.cover) {
        photos += (photoResult.logo ? 1 : 0) + (photoResult.cover ? 1 : 0) + photoResult.photos.length
      }

      // Step 5: UPDATE DB
      const updates: string[] = []
      const values: any[] = []
      let vi = 1

      const parsedAddr = details.formattedAddress ? parseAddress(details.formattedAddress) : null
      if (parsedAddr && (!biz.address || biz.address.includes('(no street on file)'))) {
        updates.push(`address = $${vi++}`)
        values.push(parsedAddr.street)
        updates.push(`city = $${vi++}`)
        values.push(parsedAddr.city)
        updates.push(`state = $${vi++}`)
        values.push(parsedAddr.state)
        updates.push(`zip = $${vi++}`)
        values.push(parsedAddr.zip)
      }
      if (details.nationalPhoneNumber) {
        updates.push(`phone = $${vi++}`)
        values.push(details.nationalPhoneNumber)
      }
      if (details.websiteUri) {
        updates.push(`website = $${vi++}`)
        values.push(details.websiteUri)
      }
      const hours = parseOpeningHours(details.regularOpeningHours)
      if (hours) {
        updates.push(`hours = $${vi++}`)
        values.push(JSON.stringify(hours))
      }
      if (typeof details.rating === 'number') {
        updates.push(`"googleRating" = $${vi++}`)
        values.push(details.rating)
      }
      if (typeof details.userRatingCount === 'number') {
        updates.push(`"googleReviewCount" = $${vi++}`)
        values.push(details.userRatingCount)
      }
      if (photoResult.logo) {
        updates.push(`logo = $${vi++}`)
        values.push(photoResult.logo)
      }
      if (photoResult.cover) {
        updates.push(`"coverImage" = $${vi++}`)
        values.push(photoResult.cover)
      }
      if (photoResult.photos.length) {
        updates.push(`photos = $${vi++}`)
        values.push(photoResult.photos)
      }
      updates.push(`"googleBusiness" = $${vi++}`)
      values.push(details.id)
      updates.push(`"updatedAt" = NOW()`)
      values.push(biz.id)

      if (DRY_RUN) {
        console.log(`${progress} ✓ (dry) ${biz.name} → ${details.displayName?.text} (score ${bestScore.toFixed(2)}, ${photoResult.logo ? 'L' : '-'}${photoResult.cover ? 'C' : '-'})`)
      } else {
        await pool.query(`UPDATE "Business" SET ${updates.join(', ')} WHERE id = $${vi}`, values)
        console.log(`${progress} ✓ ${biz.name} → ${details.displayName?.text} (phone: ${details.nationalPhoneNumber || '?'}, rating: ${details.rating ?? '?'})`)
      }
      enriched++

      // Rate limit politeness: ~3 QPS to avoid burst
      await new Promise(r => setTimeout(r, 350))
    } catch (e: any) {
      console.warn(`${progress} ERR: ${biz.name}: ${e.message?.slice(0, 100)}`)
      errors++
      if (e.message?.includes('429')) await new Promise(r => setTimeout(r, 30000))
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log(`Done in ${elapsed}s`)
  console.log(`Enriched: ${enriched}`)
  console.log(`Not found: ${notFound}`)
  console.log(`Errors: ${errors}`)
  console.log(`Photos uploaded: ${photos}`)
  if (DRY_RUN) console.log('(DRY-RUN: no DB changes)')
  console.log('═══════════════════════════════════════════════════════')

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })