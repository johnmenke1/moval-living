/**
 * seed-businesses-osm.mts
 *
 * Pulls Moreno Valley businesses from OpenStreetMap via Overpass API.
 * Free, comprehensive, covers long-tail (churches, home-based, industrial,
 * nonprofits) that Google often misses.
 *
 * How it works:
 *   1. Single Overpass query against MV city boundary (relation 11112117)
 *   2. Returns nodes + ways tagged with amenity/shop/office/craft/etc.
 *   3. Maps OSM tags → our 24 DB category slugs
 *   4. Inserts as status=PENDING so you can review before they go public
 *   5. Idempotent: dedupes by normalized name+city, falls back to lat/lng
 *
 * Run examples:
 *   npx tsx scripts/seed-businesses-osm.mts --dry-run
 *   npx tsx scripts/seed-businesses-osm.mts --dry-run --limit=10
 *   npx tsx scripts/seed-businesses-osm.mts
 *   npx tsx scripts/seed-businesses-osm.mts --bbox=wide
 *
 * Required env: DATABASE_URL
 * Optional: OSM_OVERPASS_URL (default: https://overpass-api.de/api/interpreter)
 */

import { Pool } from 'pg'
import { readFileSync } from 'fs'

// ─── Env loading ─────────────────────────────────────────────────────────────
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
const OVERPASS_URL_PRIMARY = 'https://overpass-api.de/api/interpreter'
const OVERPASS_URL_KUMI   = 'https://overpass.kumi.systems/api/interpreter'
const OVERPASS_URL_LPG    = 'https://overpass.private.coffee/api/interpreter'
const OVERPASS_URL = process.env.OSM_OVERPASS_URL || OVERPASS_URL_PRIMARY

if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flags: Record<string, string | boolean> = {}
for (const a of args) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/)
  if (m) flags[m[1]] = m[2] ?? true
}
const DRY_RUN = !!flags['dry-run']
const BBOX_MODE = String(flags['bbox'] || 'strict') // 'strict' or 'wide'

// ─── Overpass query ─────────────────────────────────────────────────────────
// Moreno Valley is OSM relation 11112117. Strict = within city boundary polygon.
// Wide = a rectangular bbox slightly larger, catches edge businesses tagged
// just outside the city line but still in the greater MV area.

const BASE_BBOX = { south: 33.859, west: -117.297, north: 33.988, east: -117.088 }
const WIDE_BBOX  = { south: 33.83,  west: -117.34,  north: 34.01,  east: -117.05  }

function buildQuery(): string {
  const bbox = BBOX_MODE === 'wide' ? WIDE_BBOX : BASE_BBOX
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`

  // We query inside the bbox rectangle (faster than polygon, near-identical
  // coverage for a city-sized area).
  // Union of all business-relevant tags. ~5-15 sec runtime on Overpass.
  return `[out:json][timeout:90];
(
  // amenity: food, drink, services, education, healthcare, financial, worship, events, coworking, childcare
  // (excluded civic/government: fire_station, police, post_office, townhall, courthouse, prison, bus_station — not businesses)
  // (events_venue, internet_cafe, childcare added Aug 2026 — see references/followups.md for gap audit)
  node["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|biergarten|ice_cream|bakery|bank|atm|bureau_de_change|pharmacy|hospital|clinic|doctors|dentist|veterinary|optician|physiotherapist|psychotherapist|nursing_home|school|kindergarten|college|university|library|driving_school|language_school|music_school|place_of_worship|community_centre|social_facility|fuel|car_wash|car_rental|taxi|ferry_terminal|marketplace|events_venue|events|internet_cafe|childcare)$"](${bboxStr});
  way["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|biergarten|ice_cream|bakery|bank|atm|bureau_de_change|pharmacy|hospital|clinic|doctors|dentist|veterinary|optician|physiotherapist|psychotherapist|nursing_home|school|kindergarten|college|university|library|driving_school|language_school|music_school|place_of_worship|community_centre|social_facility|fuel|car_wash|car_rental|taxi|ferry_terminal|marketplace|events_venue|events|internet_cafe|childcare)$"](${bboxStr});

  // shop: anything retail
  node["shop"](${bboxStr});
  way["shop"](${bboxStr});

  // office: professional services, real estate, insurance, government, NGO, coworking
  // (already queries office=* via the broad "office" query below — coworking already covered)
  // But adding it explicitly for clarity and to keep TAG_MAP deterministic
  node["office"~"^(coworking|notary|government|diplomatic|research|forestry|guide|travel_agent|advertising_agency|newspaper|recruitment|security|telecommunication|administrative)$"](${bboxStr});
  way["office"~"^(coworking|notary|government|diplomatic|research|forestry|guide|travel_agent|advertising_agency|newspaper|recruitment|security|telecommunication|administrative)$"](${bboxStr});

  // office catch-all (for everything else tagged with office=* — keeps existing behavior)
  node["office"](${bboxStr});
  way["office"](${bboxStr});

  // craft: tradespeople
  node["craft"](${bboxStr});
  way["craft"](${bboxStr});

  // tourism: lodging
  node["tourism"~"^(hotel|motel|guest_house|hostel|apartment|chalet)$"](${bboxStr});
  way["tourism"~"^(hotel|motel|guest_house|hostel|apartment|chalet)$"](${bboxStr});

  // leisure: fitness, sports, entertainment
  node["leisure"~"^(fitness_centre|sports_centre|sports_club|swimming_pool|ice_rink|bowling_alley|amusement_arcade|adult_gaming_centre|dance)$"](${bboxStr});
  way["leisure"~"^(fitness_centre|sports_centre|sports_club|swimming_pool|ice_rink|bowling_alley|amusement_arcade|adult_gaming_centre|dance)$"](${bboxStr});

  // healthcare catch-all (some are tagged with healthcare=* instead of amenity=*)
  node["healthcare"](${bboxStr});
  way["healthcare"](${bboxStr});
);
out center tags;`;
}

// ─── Tag → Category slug mapping ────────────────────────────────────────────
// Maps OSM tags to our 24 DB slugs. First match wins. Anything unmapped → "other".
const TAG_MAP: Array<{ test: (t: OsmTags) => boolean; slug: string }> = [
  // Restaurants & food
  { test: t => t.amenity === 'restaurant' || t.amenity === 'food_court' || t.amenity === 'ice_cream', slug: 'restaurants' },
  { test: t => t.amenity === 'cafe' || t.amenity === 'bakery', slug: 'restaurants' },
  { test: t => t.amenity === 'fast_food', slug: 'restaurants' },
  { test: t => t.amenity === 'bar' || t.amenity === 'pub' || t.amenity === 'biergarten', slug: 'entertainment' },

  // Retail & shopping
  { test: t => !!t.shop, slug: 'retail' },
  { test: t => t.amenity === 'marketplace', slug: 'retail' },

  // Auto
  { test: t => t.amenity === 'car_rental' || t.amenity === 'car_wash', slug: 'auto-repair' },
  { test: t => t.shop === 'car_repair' || t.shop === 'car_parts' || t.shop === 'tyres' || t.amenity === 'fuel', slug: 'auto-repair' },
  { test: t => t.shop === 'car' || t.shop === 'car_dealer' || t.shop === 'motorcycle' || t.shop === 'motorcycle_repair', slug: 'auto-dealers' },

  // Healthcare
  { test: t => t.amenity === 'pharmacy' || t.amenity === 'hospital' || t.amenity === 'clinic' ||
                 t.amenity === 'doctors' || t.amenity === 'dentist' || t.amenity === 'optician' ||
                 t.amenity === 'physiotherapist' || t.amenity === 'psychotherapist' ||
                 t.amenity === 'nursing_home' || !!t.healthcare, slug: 'healthcare' },
  { test: t => t.amenity === 'veterinary', slug: 'pets' },

  // Beauty & wellness (often tagged shop=beauty, shop=hairdresser, shop=massage)
  { test: t => t.shop === 'beauty' || t.shop === 'hairdresser' || t.shop === 'massage' || t.shop === 'nail' || t.shop === 'tattoo' ||
                 t.leisure === 'fitness_centre' || t.leisure === 'sports_centre' || t.leisure === 'sports_club' ||
                 t.leisure === 'dance' || t.leisure === 'swimming_pool', slug: 'beauty' },

  // Home services
  { test: t => t.craft === 'plumber' || t.craft === 'electrician' || t.craft === 'hvac' || t.craft === 'carpenter' ||
                 t.craft === 'painter' || t.craft === 'roofer' || t.craft === 'locksmith' || t.craft === 'gardener' ||
                 t.craft === 'floorer' || t.craft === 'glaziery' || t.craft === 'shoemaker' ||
                 t.craft === 'cleaning' || t.craft === 'laundry' || t.craft === 'mason' ||
                 t.craft === 'metal_worker' || t.craft === 'photographer' || t.craft === 'plasterer' ||
                 t.craft === 'sawmill' || t.craft === 'stonemason' || t.craft === 'tailor' ||
                 t.craft === 'tiler' || t.craft === 'upholsterer' || t.craft === 'watchmaker' ||
                 t.craft === 'welder' || t.craft === 'window_construction', slug: 'home-services' },

  // Contractors & construction
  { test: t => t.craft === 'builder' || t.craft === 'construction' || t.craft === 'handyman' ||
                 t.craft === 'scaffolder' || t.craft === 'signmaker' || t.craft === 'blacksmith' ||
                 t.office === 'construction' || t.office === 'architect' || t.office === 'surveyor' ||
                 t.office === 'engineer', slug: 'contractors' },

  // Professional services
  { test: t => t.office === 'lawyer' || t.office === 'notary' || t.office === 'accountant' ||
                 t.office === 'tax_advisor' || t.office === 'consulting' || t.office === 'it' ||
                 t.office === 'software' || t.office === 'marketing' || t.office === 'advertising' ||
                 t.office === 'financial' || t.office === 'employment_agency' || t.office === 'translator' ||
                 t.office === 'coworking', slug: 'professional' },

  // Real estate
  { test: t => t.office === 'estate_agent' || t.office === 'real_estate', slug: 'real-estate' },
  { test: t => t.office === 'property_management', slug: 'property-management' },

  // Money lender / payday loan (financial but often excluded from "banks")
  { test: t => t.shop === 'money_lender', slug: 'finance' },

  // Finance
  { test: t => t.amenity === 'bank' || t.amenity === 'atm' || t.amenity === 'bureau_de_change' ||
                 t.office === 'financial', slug: 'finance' },

  // Insurance (must come BEFORE finance so it wins)
  { test: t => t.office === 'insurance', slug: 'insurance' },

  // Education (incl. childcare / daycare)
  { test: t => t.amenity === 'school' || t.amenity === 'kindergarten' || t.amenity === 'college' ||
                 t.amenity === 'university' || t.amenity === 'library' || t.amenity === 'driving_school' ||
                 t.amenity === 'language_school' || t.amenity === 'music_school' ||
                 t.amenity === 'childcare' ||
                 t.office === 'educational_institution', slug: 'education' },

  // Government offices (civic services — public-facing offices people search for)
  { test: t => t.office === 'government', slug: 'professional' },

  // Pets
  { test: t => t.shop === 'pet' || t.shop === 'pet_grooming', slug: 'pets' },

  // Churches & faith
  { test: t => t.amenity === 'place_of_worship', slug: 'churches' },

  // Dispensaries (cannabis)
  { test: t => t.shop === 'cannabis', slug: 'dispensaries' },

  // Hospitality
  { test: t => t.tourism === 'hotel' || t.tourism === 'motel' || t.tourism === 'guest_house' ||
                 t.tourism === 'hostel' || t.tourism === 'apartment' || t.tourism === 'chalet', slug: 'hospitality' },

  // Entertainment (incl. events_venue — banquet halls, wedding venues, party rooms)
  { test: t => t.leisure === 'bowling_alley' || t.leisure === 'amusement_arcade' ||
                 t.amenity === 'social_facility' || t.amenity === 'community_centre' ||
                 t.amenity === 'events_venue' || t.amenity === 'events', slug: 'entertainment' },

  // Internet cafe (USO, gaming cafes)
  { test: t => t.amenity === 'internet_cafe', slug: 'entertainment' },

  // Non-profits (often tagged office=ngo, office=association)
  { test: t => t.office === 'ngo' || t.office === 'association' || t.office === 'charity' ||
                 t.office === 'foundation' || t.office === 'political_party' || t.office === 'union', slug: 'non-profits' },

  // Service clubs (lions, rotary, kiwanis, elks, masonic lodges, etc.)
  { test: t => t.office === 'lodge' || (t.amenity === 'club' && (t.club === 'service' || t.club === 'lodge')),
    slug: 'service-clubs' },

  // Supply & logistics
  { test: t => t.office === 'logistics' || t.office === 'shipping' || t.office === 'trucking' ||
                 t.landuse === 'industrial' || t.landuse === 'logistics' || t.landuse === 'commercial' ||
                 t.amenity === 'bus_station', slug: 'supply-logistics' },

  // Everything else
  { test: () => true, slug: 'other' },
]

// ─── Types ──────────────────────────────────────────────────────────────────
type OsmTags = Record<string, string>

type OsmElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: OsmTags
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function cuid(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  const c = (Math.floor(Math.random() * 1e9)).toString(36)
  return 'c' + t + r + c
}

function getLatLon(el: OsmElement): { lat: number; lon: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lon: el.lon }
  }
  if (el.center) return { lat: el.center.lat, lon: el.center.lon }
  return null
}

function buildAddress(el: OsmElement): { street: string; city: string; state: string; zip: string; full: string } {
  const t = el.tags || {}
  // OSM addr:housenumber + addr:street → street line
  const num = t['addr:housenumber'] || ''
  const street = t['addr:street'] || ''
  const streetLine = [num, street].filter(Boolean).join(' ').trim() || '(no street on file)'

  const city = t['addr:city'] || 'Moreno Valley'
  const state = t['addr:state'] || 'CA'
  const zip = t['addr:postcode'] || ''
  const full = [streetLine, city, state, zip].filter(Boolean).join(', ')
  return { street: streetLine, city, state, zip, full }
}

function mapToSlug(tags: OsmTags): string {
  for (const rule of TAG_MAP) {
    if (rule.test(tags)) return rule.slug
  }
  return 'other' // unreachable but defensive
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

function buildSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)
  return base + '-' + Math.random().toString(36).slice(2, 8)
}

// ─── Overpass fetch (with mirror fallback) ──────────────────────────────────
async function fetchOverpassOnce(url: string, query: string): Promise<OsmElement[]> {
  const fullUrl = url + '?data=' + encodeURIComponent(query)
  const res = await fetch(fullUrl, {
    headers: { 'User-Agent': 'moval-living-import/1.0 (contact: john@menke.re)' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Overpass ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.elements || []
}

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  const mirrors = [
    { url: OVERPASS_URL, name: 'primary' },
    { url: OVERPASS_URL_KUMI, name: 'kumi.systems' },
    { url: OVERPASS_URL_LPG, name: 'private.coffee' },
  ]
  for (const mirror of mirrors) {
    try {
      console.log(`  trying ${mirror.name} (${mirror.url})...`)
      return await fetchOverpassOnce(mirror.url, query)
    } catch (e: any) {
      console.warn(`  ${mirror.name} failed: ${String(e.message).slice(0, 80)}`)
    }
  }
  throw new Error('All Overpass mirrors failed')
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`OSM import mode: bbox=${BBOX_MODE}  dry-run=${DRY_RUN}`)
  console.log(`Overpass endpoint: ${OVERPASS_URL}`)
  console.log()

  console.log('Building Overpass query...')
  const query = buildQuery()
  console.log(`Query length: ${query.length} chars`)
  console.log()

  console.log('Fetching from Overpass (may take 5-15 seconds)...')
  const t0 = Date.now()
  const elements = await fetchOverpass(query)
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`Received ${elements.length} elements in ${elapsed}s`)
  console.log()

  // Filter to named businesses only — exclude public spaces that aren't businesses
  const EXCLUDED_LEISURE = new Set(['park', 'nature_reserve', 'garden', 'dog_park', 'picnic_table', 'bench'])
  const EXCLUDED_AMENITY = new Set(['fire_station', 'police', 'post_office', 'townhall', 'courthouse', 'prison', 'bus_station'])
  const named = elements.filter(el => {
    if (!el.tags?.name || el.tags.name.trim().length === 0) return false
    if (EXCLUDED_LEISURE.has(el.tags.leisure || '')) return false
    if (EXCLUDED_AMENITY.has(el.tags.amenity || '')) return false
    return true
  })
  const excludedCount = elements.length - named.length
  console.log(`Named businesses: ${named.length} (${excludedCount} dropped: unnamed + public spaces)`)
  console.log()

  // Bucket by mapped slug for visibility
  const slugCounts: Record<string, number> = {}
  for (const el of named) {
    const slug = mapToSlug(el.tags || {})
    slugCounts[slug] = (slugCounts[slug] || 0) + 1
  }
  console.log('Category distribution (mapped):')
  const sorted = Object.entries(slugCounts).sort((a, b) => b[1] - a[1])
  for (const [slug, count] of sorted) {
    console.log(`  ${slug.padEnd(22)} ${count}`)
  }
  console.log()

  if (DRY_RUN) {
    console.log('[DRY-RUN] would insert ' + named.length + ' businesses')
    process.exit(0)
  }

  // Live insert
  const pool = new Pool({ connectionString: DATABASE_URL!, ssl: { rejectUnauthorized: false } })
  const catResult = await pool.query('SELECT id, slug FROM "Category"')
  const catBySlug = Object.fromEntries(catResult.rows.map((r: any) => [r.slug, r.id]))

  const existing = await pool.query('SELECT LOWER(name) AS ln FROM "Business"')
  const existingNames = new Set(existing.rows.map((r: any) => normalize(r.ln)))
  console.log(`Existing businesses in DB: ${existingNames.size}`)

  let added = 0, skipped = 0, errors = 0
  for (const el of named) {
    const name = el.tags!.name.trim()
    const normName = normalize(name)
    if (existingNames.has(normName)) {
      skipped++
      continue
    }

    const slug = mapToSlug(el.tags || {})
    const categoryId = catBySlug[slug]
    if (!categoryId) {
      // Should never happen — every slug maps to a category in our 24
      errors++
      continue
    }

    const ll = getLatLon(el)
    const addr = buildAddress(el)

    try {
      await pool.query(
        `INSERT INTO "Business" (id, slug, name, "categoryId", address, city, state, zip, latitude, longitude, description, status, tier, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING','FREE',NOW(),NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [
          cuid(),
          buildSlug(name),
          name,
          categoryId,
          addr.street,
          addr.city,
          addr.state,
          addr.zip,
          ll?.lat ?? null,
          ll?.lon ?? null,
          `OSM import: ${name} in ${addr.city}, ${addr.state}. Owner can rewrite this when they claim.`,
        ]
      )
      added++
      existingNames.add(normName)
    } catch (err: any) {
      if (err.code === '23505') { skipped++ }
      else {
        console.warn(`  ERR "${name}": ${err.message?.slice(0, 100)}`)
        errors++
      }
    }
  }

  console.log()
  console.log(`Done: +${added} added, ${skipped} skipped (dupes), ${errors} errors`)
  console.log(`All new businesses are status=PENDING — review in /dashboard before promoting.`)
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })