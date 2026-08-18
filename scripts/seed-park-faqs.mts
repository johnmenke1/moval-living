/* eslint-disable no-console */
/**
 * scripts/seed-park-faqs.mts
 *
 * Populate Park.faqsJson with templated Q&A entries derived from
 * the City of Moreno Valley's authoritative sources.
 *
 * Strategy (designed 2026-08-17 to balance correctness + scale):
 *
 *   1. PULL — fetch all parks + amenities from the City's ArcGIS
 *      feature service (MoValParks). This is the same data structure
 *      used by the City's own park map, so each park's templated FAQ
 *      is anchored to one authoritative source.
 *
 *   2. TEMPLATE — for each park, build 4-5 Q&A pairs:
 *      - "Where is <name> located?"           → address
 *      - "What amenities does <name> have?"   → amenities bullets (capped at 8)
 *      - "Is <name> ADA-accessible?"          → ADA: Yes/No + restroom details
 *      - "What are <name>'s hours?"           → 7am-10pm city-wide rule
 *      - "Can I reserve a picnic shelter?"    → gated on ActiveNet_Site + PicnicShelter
 *
 *   3. ENRICH - append hand-curated extras from
 *      scripts/data/park-curated-faqs.ts. These cover named features
 *      the GIS doesn't know (Flight Deck Bike Park at Morrison,
 *      Cottonwood Banquet Room capacity, Grand Ballroom at the CRC,
 *      Senior Community Center Banquet Hall, TownGate Community
 *      Center). Each curated entry is sourced to a City URL in its
 *      file comment.
 *
 *   4. WRITE - idempotent: park.faqsJson is overwritten with the new
 *      {templated + curated} array. Skip parks already current (length
 *      + non-stale heuristics) unless --force.
 *
 *   5. SKIP - parks without an ArcGIS match (e.g., the 5 sibling-added
 *      rec centers, which exist only in our DB). They get curated-only
 *      FAQs.
 *
 * Usage:
 *   DATABASE_URL=... node --experimental-strip-types ^
 *     scripts/seed-park-faqs.mts [--force] [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { CURATED_FAQS } from './data/park-curated-faqs.ts'

const FORCE = process.argv.includes('--force')
const DRY_RUN = process.argv.includes('--dry-run')

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const ARCGIS_BASE =
  'https://services2.arcgis.com/WgPlP3PNKC8Glejs/arcgis/rest/services/MoValParks/FeatureServer/0/query'

// --- ArcGIS fetch ----------------------------------------------------------

interface ArcGisRow {
  attributes: {
    OBJECTID: number
    name: string
    Address: string | null
    Amenities: string | null
    Acreage: string | number | null
    PicnicShelter: string | null
    Restroom: string | null
    ADA: string | null
    ['Barbecues']?: string | null
    ['BasketballCourt']?: string | null
    ['DrinkingFountain']?: string | null
    ['OffStParking']?: string | null
    ActiveNet_Site: string | null
    [k: string]: unknown
  }
  geometry: { x: number; y: number }
}

async function fetchAllParks(): Promise<ArcGisRow[]> {
  const url =
    `${ARCGIS_BASE}?where=1%3D1` +
    `&f=json` +
    `&outFields=*` +
    `&resultRecordCount=200` +
    `&returnGeometry=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}`)
  const json: { features: ArcGisRow[] } = await res.json()
  return json.features ?? []
}

// --- Templating ------------------------------------------------------------

/**
 * The City strings amenities as bullet lists separated by bullet
 * character. Some rows are dual-encoded. Trimming and deduping gives
 * us a clean amenities array.
 */
function splitAmenities(raw: string | null): string[] {
  if (!raw) return []
  return Array.from(new Set(
    raw
      .split(/[•]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 60),
  )).slice(0, 12)
}

interface FaqPair { q: string; a: string }

function templatedFaqs(park: ArcGisRow['attributes']): FaqPair[] {
  const out: FaqPair[] = []
  const name = park.name

  // 1. Location
  if (park.Address) {
    out.push({
      q: `Where is ${name}?`,
      a: park.Address.includes('Moreno Valley')
        ? `${park.Address}, Moreno Valley, CA.`
        : `${park.Address}, Moreno Valley, CA`,
    })
  }

  // 2. Amenity list - capped to first 8 after deduping
  const amenList = splitAmenities(park.Amenities)
  if (amenList.length > 0) {
    out.push({
      q: `What amenities does ${name} have?`,
      a: `${name} features ${amenList.slice(0, 8).join(', ')}.${
        amenList.length > 8 ? ' Several additional amenities are also available on-site.' : ''
      }`,
    })
  }

  // 3. ADA accessibility
  const adaYes = (park.ADA ?? '').toLowerCase() === 'yes'
  const adaDetail =
    park['ADA Access'] && park['ADA Access'].toLowerCase() === 'yes'
      ? ' ADA Access is provided throughout key features such as restrooms and picnic shelters.'
      : park.Restroom && park.Restroom.toLowerCase() === 'yes'
        ? ' Restrooms are on-site (check signage for ADA-compliant facilities).'
        : ''
  if (adaYes || adaDetail) {
    out.push({
      q: `Is ${name} ADA-accessible?`,
      a: adaYes
        ? `Yes. ${name} is ADA-accessible.${adaDetail}`.trim()
        : `${adaDetail.trim()}`,
    })
  }

  // 4. Park hours - universal city rule (7am-10pm, all 36 facilities)
  out.push({
    q: `What are ${name}'s hours?`,
    a: `${name} is open Monday through Sunday, 7:00 AM to 10:00 PM, following City of Moreno Valley parks hours.`,
  })

  // 5. Picnic shelter reservation - only if applicable
  const picnic = (park.PicnicShelter ?? '').toLowerCase() === 'yes'
  const activeNet = park.ActiveNet_Site
  if (picnic && activeNet) {
    out.push({
      q: `Can I reserve a picnic shelter at ${name}?`,
      a: `Yes. ${name} has picnic shelters reservable through the City's ActiveNet reservation system. Availability and bookings are listed on the ActiveNet site (link from the city's park page).`,
    })
  }

  return out
}

// --- Main ------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[seed-park-faqs] DATABASE_URL is not set.')
    process.exit(1)
  }

  console.log(`[seed-park-faqs] ${FORCE ? 'FORCE re-seed' : 'skip-already-current'}${DRY_RUN ? ' [DRY RUN]' : ''}`)

  let arcgisParks: ArcGisRow[] = []
  try {
    arcgisParks = await fetchAllParks()
    console.log(`[seed-park-faqs] fetched ${arcgisParks.length} parks from MoValParks ArcGIS`)
  } catch (e) {
    console.error('[seed-park-faqs] could not fetch MoValParks ArcGIS:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  // Build name -> ArcGIS row index (matched case-insensitive, trimmed).
  const arcgisByName = new Map<string, ArcGisRow['attributes']>()
  for (const f of arcgisParks) {
    arcgisByName.set(normalizeName(f.attributes.name), f.attributes)
  }

  // Walk DB parks
  const dbParks = await prisma.park.findMany({
    select: { id: true, slug: true, name: true, faqsJson: true },
  })

  const writes: Array<{ slug: string; count: number; source: string }> = []
  const skips: string[] = []

  for (const p of dbParks) {
    if (!FORCE && Array.isArray(p.faqsJson) && p.faqsJson.length >= 4) {
      skips.push(p.slug)
      continue
    }

    const arc = arcgisByName.get(normalizeName(p.name))
        const templated = arc ? templatedFaqs(arc) : []
        const curated = CURATED_FAQS[p.slug] ?? []

    // Merge in order: templated FIRST (anchors to typical search queries),
    // curated LAST (named-feature richness).
    const faqs = [...templated, ...curated]

    if (faqs.length === 0) {
      skips.push(p.slug)
      continue
    }

    writes.push({
      slug: p.slug,
      count: faqs.length,
      source: `${templated.length} templated + ${curated.length} curated`,
    })

    if (!DRY_RUN) {
      await prisma.park.update({
        where: { id: p.id },
        data: { faqsJson: faqs },
      })
    }
  }

  console.log(`\n[seed-park-faqs] ${writes.length} parks updated, ${skips.length} skipped:`)
  for (const w of writes) {
    console.log(`  + ${w.slug.padEnd(45)} ${w.count.toString().padStart(2)} FAQs (${w.source})`)
  }
  if (skips.length) {
    console.log(`\n  skip: ${skips.join(', ')}`)
  }
  if (DRY_RUN) {
    console.log('\n[seed-park-faqs] DRY RUN - no DB writes')
  } else {
    console.log(`\n[seed-park-faqs] done - ${writes.length} parks seeded`)
  }

  await prisma.$disconnect()
  await pool.end()
}

/** Normalize the City attribute `name` for match against our DB slug map. */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
}

await main()
