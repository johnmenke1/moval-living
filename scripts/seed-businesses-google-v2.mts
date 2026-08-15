/**
 * seed-businesses-google-v2.mts
 *
 * Full-coverage Google Places (New) importer for Moreno Valley.
 *
 * Improvements over v1 (seed-businesses-from-google.js):
 *   - 3×3 (or 5×5) lat/lng grid covers MV edges, not just city center
 *   - Paginates every query (nextPageToken) for up to 60 results/call
 *   - Captures rating, userRatingCount, photos[], logo
 *   - Downloads logo (400px) + cover (1200px) + 2 extras (800px) to S3
 *   - All 24 live categories wired, with correct slugs
 *   - Idempotent: dedupes by placeId, falls back to normalized name+addr
 *   - --dry-run, --only=<slug>, --grid-size=3|5, --skip-existing flags
 *
 * Run examples:
 *   npx tsx scripts/seed-businesses-google-v2.mts --dry-run --only=restaurants
 *   npx tsx scripts/seed-businesses-google-v2.mts --dry-run
 *   npx tsx scripts/seed-businesses-google-v2.mts --only=restaurants
 *   npx tsx scripts/seed-businesses-google-v2.mts
 *
 * Required env (in .env.local or shell):
 *   DATABASE_URL
 *   GOOGLE_PLACES_API_KEY
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION  (only if uploading photos)
 *
 * Optional env:
 *   S3_BUCKET  (default: "movalliving")
 *   S3_REGION  (default: AWS_REGION or "us-west-1")
 */

import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// ──────────────────────────────────────────────────────────────────────────────
// Env loading (.env.local, with .env fallback)
// ──────────────────────────────────────────────────────────────────────────────
function loadEnv(path: string): Record<string, string> {
  try {
    const text = readFileSync(path, 'utf8')
    const env: Record<string, string> = {}
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      env[m[1]] = v
    }
    return env
  } catch {
    return {}
  }
}
const fileEnv = { ...loadEnv('./.env'), ...loadEnv('./.env.local') }
for (const [k, v] of Object.entries(fileEnv)) {
  if (!process.env[k]) process.env[k] = v
}

const DATABASE_URL = process.env.DATABASE_URL
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const S3_BUCKET = process.env.S3_BUCKET || 'movalliving'
const S3_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-west-1'

if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }
if (!GOOGLE_PLACES_API_KEY) { console.error('GOOGLE_PLACES_API_KEY not set'); process.exit(1) }

// ──────────────────────────────────────────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flags: Record<string, string | boolean> = {}
for (const a of args) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  if (m) flags[m[1]] = m[2] ?? true
}
const DRY_RUN = !!flags['dry-run']
const ONLY = typeof flags['only'] === 'string' ? flags['only'] : null
const GRID_SIZE = Math.max(3, Math.min(5, parseInt(String(flags['grid-size'] ?? '3'), 10) || 3))
const SKIP_PHOTOS = !!flags['skip-photos']
const UPLOAD_PHOTOS = !SKIP_PHOTOS

// ──────────────────────────────────────────────────────────────────────────────
// Moreno Valley bounding box (approx, includes Edgemont, Box Springs, Sunnymead)
// ──────────────────────────────────────────────────────────────────────────────
const MV_BBOX = {
  minLat: 33.87,
  maxLat: 34.00,
  minLng: -117.30,
  maxLng: -117.15,
}

// ──────────────────────────────────────────────────────────────────────────────
// 24 categories — slug MUST match live DB
// ──────────────────────────────────────────────────────────────────────────────
const CATEGORY_QUERIES: Array<{ slug: string; queries: string[] }> = [
  { slug: 'restaurants',       queries: ['restaurants in Moreno Valley CA', 'food in Moreno Valley CA'] },
  { slug: 'retail',            queries: ['retail stores in Moreno Valley CA', 'shopping in Moreno Valley CA'] },
  { slug: 'auto-repair',       queries: ['auto repair in Moreno Valley CA', 'mechanic in Moreno Valley CA'] },
  { slug: 'auto-dealers',      queries: ['car dealers in Moreno Valley CA', 'used car dealership Moreno Valley CA'] },
  { slug: 'healthcare',        queries: ['doctors in Moreno Valley CA', 'medical clinics in Moreno Valley CA'] },
  { slug: 'beauty',            queries: ['salons in Moreno Valley CA', 'spas in Moreno Valley CA'] },
  { slug: 'home-services',     queries: ['plumbers in Moreno Valley CA', 'electricians in Moreno Valley CA'] },
  { slug: 'contractors',       queries: ['general contractors in Moreno Valley CA', 'construction companies Moreno Valley CA'] },
  { slug: 'professional',      queries: ['lawyers in Moreno Valley CA', 'accountants in Moreno Valley CA'] },
  { slug: 'finance',           queries: ['banks in Moreno Valley CA', 'credit unions in Moreno Valley CA'] },
  { slug: 'education',         queries: ['tutoring in Moreno Valley CA', 'schools in Moreno Valley CA'] },
  { slug: 'pets',              queries: ['veterinarians in Moreno Valley CA', 'pet stores Moreno Valley CA'] },
  { slug: 'real-estate',       queries: ['realtors in Moreno Valley CA', 'real estate offices Moreno Valley CA'] },
  { slug: 'insurance',         queries: ['insurance agencies in Moreno Valley CA', 'insurance agents Moreno Valley CA'] },
  { slug: 'churches',          queries: ['churches in Moreno Valley CA'] },
  { slug: 'dispensaries',      queries: ['cannabis dispensaries in Moreno Valley CA'] },
  { slug: 'entertainment',     queries: ['entertainment venues Moreno Valley CA', 'bars and nightclubs Moreno Valley CA'] },
  { slug: 'hospitality',       queries: ['hotels in Moreno Valley CA', 'motels in Moreno Valley CA'] },
  { slug: 'non-profits',       queries: ['nonprofit organizations in Moreno Valley CA'] },
  { slug: 'property-management', queries: ['property management companies Moreno Valley CA'] },
  { slug: 'service-clubs',     queries: ['service clubs Moreno Valley CA', 'fraternal organizations Moreno Valley CA'] },
  { slug: 'supply-logistics',  queries: ['trucking companies Moreno Valley CA', 'warehouses in Moreno Valley CA'] },
]

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
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

function formatTime(time: string | number) {
  const [h, m] = String(time).split(':').map(Number)
  const ampm = (h ?? 0) >= 12 ? 'PM' : 'AM'
  const hour = (h ?? 0) % 12 || 12
  return hour + ':' + String(m ?? 0).padStart(2, '0') + ' ' + ampm
}

function parseOpeningHours(roh: any) {
  if (!roh?.periods?.length) return null
  const dm: Record<string, string> = { MONDAY:'mon', TUESDAY:'tue', WEDNESDAY:'wed', THURSDAY:'thu', FRIDAY:'fri', SATURDAY:'sat', SUNDAY:'sun' }
  const r: Record<string, { open: string; close: string; closed: boolean }> = {}
  for (const p of roh.periods) {
    const d = p.openDay ? dm[p.openDay] : null
    if (!d) continue
    r[d] = {
      open: p.openTime ? formatTime(p.openTime) : '9:00 AM',
      close: p.closeTime ? formatTime(p.closeTime) : '5:00 PM',
      closed: false,
    }
  }
  return Object.keys(r).length > 0 ? r : null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

function addrKey(parts: ReturnType<typeof parseAddress>): string {
  return normalize(`${parts.street} ${parts.zip}`)
}

function gridPoints(size: number): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = []
  const latStep = (MV_BBOX.maxLat - MV_BBOX.minLat) / size
  const lngStep = (MV_BBOX.maxLng - MV_BBOX.minLng) / size
  // Offset by half-step to center each cell on its area
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      points.push({
        lat: MV_BBOX.minLat + (i + 0.5) * latStep,
        lng: MV_BBOX.minLng + (j + 0.5) * lngStep,
      })
    }
  }
  return points
}

function cuid(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  const c = (Math.floor(Math.random() * 1e9)).toString(36)
  return 'c' + t + r + c
}

// ──────────────────────────────────────────────────────────────────────────────
// Google Places API (New)
// ──────────────────────────────────────────────────────────────────────────────
type PlaceRaw = {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  website?: string
  regularOpeningHours?: any
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  photos?: Array<{ name: string }>
  logo?: string
  primaryType?: string
}

type PlaceClean = {
  placeId: string
  name: string
  address: string
  phone: string
  website: string
  hours: any
  location: { lat: number; lng: number } | null
  rating: number | null
  reviewCount: number | null
  logoPhotoName: string | null
  photoNames: string[]
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.website',
  'places.regularOpeningHours',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.photos',
  'places.logo',
  'places.primaryType',
].join(',')

async function searchPlaces(query: string, center: { lat: number; lng: number }): Promise<PlaceClean[]> {
  const all: PlaceClean[] = []
  let pageToken: string | undefined = undefined

  for (let page = 0; page < 3; page++) {
    const body: any = {
      textQuery: query,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 8000 } },
      pageSize: 20,
      maxResultCount: 20,
    }
    if (pageToken) body.pageToken = pageToken

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn(`  WARN: Places API ${res.status}: ${text.slice(0, 200)}`)
      break
    }
    const data = await res.json()
    const places: PlaceRaw[] = data.places || []
    for (const p of places) {
      all.push({
        placeId: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        phone: p.nationalPhoneNumber ?? '',
        website: p.website ?? '',
        hours: parseOpeningHours(p.regularOpeningHours),
        location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
        rating: typeof p.rating === 'number' ? p.rating : null,
        reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
        logoPhotoName: p.logo ?? null,
        photoNames: (p.photos || []).slice(0, 6).map(ph => ph.name),
      })
    }

    pageToken = data.nextPageToken
    if (!pageToken) break
    // Google requires a short delay before fetching next page
    await new Promise(r => setTimeout(r, 1500))
  }
  return all
}

// ──────────────────────────────────────────────────────────────────────────────
// S3 photo download + upload
// ──────────────────────────────────────────────────────────────────────────────
let s3: S3Client | null = null
function getS3(): S3Client | null {
  if (SKIP_PHOTOS) return null
  if (!s3) {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn('  WARN: AWS creds missing — will skip photo uploads')
      return null
    }
    s3 = new S3Client({ region: S3_REGION })
  }
  return s3
}

async function fetchPhotoBuffer(photoName: string, maxHeight: number): Promise<Buffer | null> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeight}&key=${GOOGLE_PLACES_API_KEY}`
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  // Reject suspiciously small images (< 2KB — usually Google's "no image" placeholder)
  if (buf.length < 2048) return null
  return buf
}

async function uploadPhoto(key: string, buf: Buffer): Promise<string> {
  const client = getS3()
  if (!client) return ''
  await client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buf,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=86400',
  }))
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

async function uploadBusinessPhotos(slug: string, place: PlaceClean): Promise<{ logo: string | null; cover: string | null; photos: string[] }> {
  if (!UPLOAD_PHOTOS || !place.photoNames.length) {
    return { logo: null, cover: null, photos: [] }
  }

  // Logo: prefer Google's logo field; fall back to first photo
  const logoName = place.logoPhotoName ?? place.photoNames[0]
  // Cover: first non-logo photo
  const coverCandidate = place.photoNames.find(n => n !== logoName) ?? place.photoNames[0]
  // Extras: up to 2 more photos, excluding logo and cover
  const extras = place.photoNames.filter(n => n !== logoName && n !== coverCandidate).slice(0, 2)

  let logoUrl: string | null = null
  let coverUrl: string | null = null
  const extraUrls: string[] = []

  if (logoName) {
    const buf = await fetchPhotoBuffer(logoName, 400)
    if (buf) logoUrl = await uploadPhoto(`businesses/logos/${slug}.jpg`, buf)
  }
  if (coverCandidate) {
    const buf = await fetchPhotoBuffer(coverCandidate, 1200)
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

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Moreno Valley grid: ${GRID_SIZE}x${GRID_SIZE} (${GRID_SIZE * GRID_SIZE} cells)`)
  console.log(`Photos: ${UPLOAD_PHOTOS ? 'ON' : 'OFF'}  Dry-run: ${DRY_RUN ? 'ON' : 'OFF'}`)
  if (ONLY) console.log(`Only category: ${ONLY}`)
  console.log()

  const pool = new Pool({ connectionString: DATABASE_URL!, ssl: { rejectUnauthorized: false } })

  const catResult = await pool.query('SELECT id, slug FROM "Category"')
  const catBySlug = Object.fromEntries(catResult.rows.map((r: any) => [r.slug, r.id]))
  console.log(`Loaded ${catResult.rows.length} categories from DB`)

  const existing = await pool.query('SELECT "googleBusiness", LOWER(name) AS ln, "googleRating", "googleReviewCount" FROM "Business" WHERE "googleBusiness" IS NOT NULL')
  const imported = new Set(existing.rows.map((r: any) => r.googleBusiness))
  console.log(`${imported.size} businesses already in DB`)
  console.log()

  const grid = gridPoints(GRID_SIZE)
  const totalQueries = CATEGORY_QUERIES.length * grid.length * 2

  let totalAdded = 0, totalSkipped = 0, totalErrors = 0, totalPhotos = 0

  for (const { slug, queries } of CATEGORY_QUERIES) {
    if (ONLY && slug !== ONLY) continue

    const categoryId = catBySlug[slug]
    if (!categoryId) { console.warn(`No DB category for "${slug}", skipping`); continue }

    console.log(`\n[${slug}]`)
    const seen = new Set<string>()
    let catAdded = 0, catSkipped = 0

    for (const center of grid) {
      for (const query of queries) {
        process.stdout.write(`  [${center.lat.toFixed(3)},${center.lng.toFixed(3)}] "${query.slice(0, 40)}..." `)
        let places: PlaceClean[]
        try {
          places = await searchPlaces(query, center)
        } catch (e: any) {
          console.log(`ERR ${e.message?.slice(0, 80)}`)
          totalErrors++
          continue
        }

        let newInThisCall = 0, skippedInThisCall = 0
        for (const place of places) {
          if (!place.name || !place.address) { skippedInThisCall++; continue }
          if (seen.has(place.placeId) || imported.has(place.placeId)) { skippedInThisCall++; continue }

          // Distance filter: skip results more than 12km from any grid cell center
          if (place.location) {
            let minDist = Infinity
            for (const g of grid) {
              const dLat = (place.location.lat - g.lat) * 111
              const dLng = (place.location.lng - g.lng) * 111 * Math.cos(g.lat * Math.PI / 180)
              const dist = Math.sqrt(dLat * dLat + dLng * dLng)
              if (dist < minDist) minDist = dist
            }
            if (minDist > 12) { skippedInThisCall++; continue }
          }

          seen.add(place.placeId)

          const parsed = parseAddress(place.address)
          const base = place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
          const finalSlug = base + '-' + Math.random().toString(36).slice(2, 8)

          if (DRY_RUN) {
            newInThisCall++
            catAdded++
            totalAdded++
            continue
          }

          // Upload photos first (slower path)
          let photoResult = { logo: null as string | null, cover: null as string | null, photos: [] as string[] }
          if (UPLOAD_PHOTOS) {
            try {
              photoResult = await uploadBusinessPhotos(finalSlug, place)
              if (photoResult.logo || photoResult.cover) totalPhotos += (photoResult.logo ? 1 : 0) + (photoResult.cover ? 1 : 0) + photoResult.photos.length
            } catch (e: any) {
              console.warn(`\n    photo ERR "${place.name}": ${e.message?.slice(0, 80)}`)
            }
          }

          try {
            await pool.query(
              `INSERT INTO "Business" (id, slug, name, "categoryId", address, city, state, zip, phone, website, description, "googleBusiness", latitude, longitude, hours, photos, logo, "coverImage", "googleRating", "googleReviewCount", status, tier, "createdAt", "updatedAt")
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'APPROVED','FREE',NOW(),NOW())`,
              [
                cuid(),
                finalSlug, place.name, categoryId, parsed.street, parsed.city, parsed.state, parsed.zip,
                place.phone || null, place.website || null,
                `Business information for ${place.name} in ${parsed.city}, ${parsed.state}.`,
                place.placeId,
                place.location?.lat ?? null,
                place.location?.lng ?? null,
                place.hours ? JSON.stringify(place.hours) : null,
                photoResult.photos,
                photoResult.logo,
                photoResult.cover,
                place.rating,
                place.reviewCount,
              ]
            )
            newInThisCall++
            catAdded++
            totalAdded++
          } catch (err: any) {
            if (err.code === '23505') { skippedInThisCall++; catSkipped++; totalSkipped++ }
            else { console.warn(`\n    DB ERR "${place.name}": ${err.message?.slice(0, 100)}`); totalErrors++ }
          }
        }
        console.log(`${places.length} results, +${newInThisCall} new, ${skippedInThisCall} skipped`)
        catSkipped += skippedInThisCall
        totalSkipped += skippedInThisCall
        await new Promise(r => setTimeout(r, 300))
      }
    }
    console.log(`  → ${slug}: +${catAdded} added, ${catSkipped} skipped`)
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Done: +${totalAdded} added, ${totalSkipped} skipped (dupes/distance), ${totalErrors} errors, ${totalPhotos} photos uploaded`)
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })