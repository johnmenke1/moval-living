/* eslint-disable no-console */
/**
 * scripts/seed-parks.mts
 *
 * One-time seed: loads curated City of Moreno Valley park data
 * (scripts/parks-curated.ts, generated from the City's ArcGIS feature
 * services) and upserts into the `Park` Prisma table.
 *
 * Idempotent — re-running updates existing rows by slug without
 * duplicating. Run with:
 *
 *   pnpm tsx scripts/seed-parks.mts               # apply changes
 *   pnpm tsx scripts/seed-parks.mts --dry-run     # preview only
 *
 * Requires env: DATABASE_URL in .env.local (auto-loaded by prisma.config.ts).
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PARKS_CURATED, type CuratedPark } from './parks-curated.ts'

const DRY_RUN = process.argv.includes('--dry-run')

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

/** Heuristic: cities 9-digit zip-on-Street-Address lookup. Pulled from City CSV;
 *  MoVal ZIPs: 92551, 92553, 92555, 92557, 92560-ish. We'll default to null;
 *  the address cards on /parks use street address which is what matters for a map. */
function inferZip(address: string | null): string | null {
  // Quick ZIP parse — MoVal addresses don't include a ZIP, leave null.
  // Admin can fill in later if Google Places lookup populates postalAddress.
  return null
}

function ampsFor(p: CuratedPark) {
  return {
    slug: p.slug,
    name: p.name,
    type: p.type,
    address: p.address || null,
    city: 'Moreno Valley',
    state: 'CA',
    zip: inferZip(p.address),
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    amenities: p.amenities,
    // We don't store acres / ada as top-level columns — fold into blurb for now.
    blurb: makeBlurb(p),
    // coordinates, address, amenities come directly from the City's data.
    // We do NOT set googlePlaceId yet — that's the next step (a follow-up
    // script that looks each park up via Google Places searchText).
  }
}

function makeBlurb(p: CuratedPark): string {
  // Short editorial description assembled from the City dataset.
  const acresPart = p.acres ? `${p.acres.trim()}-acre` : 'neighborhood'
  const adaPart = p.ada ? ', ADA-accessible' : ''
  const highlights = p.amenities.slice(0, 4).join(', ')
  const tail = highlights ? ` with ${highlights}` : ''
  return `City of Moreno Valley ${acresPart} park${adaPart}${tail}. Source: City GIS.`
}

async function main() {
  if (DRY_RUN) {
    console.log(`[seed-parks] DRY RUN — would upsert ${PARKS_CURATED.length} parks`)
    for (const p of PARKS_CURATED) {
      console.log(`  - [${p.type.padEnd(10)}] ${p.slug.padEnd(45)} "${p.name}"`)
    }
    return
  }

  let created = 0
  let updated = 0

  for (const p of PARKS_CURATED) {
    const exists = await prisma.park.findUnique({ where: { slug: p.slug } })
    const data = ampsFor(p)
    if (!exists) {
      await prisma.park.create({ data })
      created += 1
      console.log(`  + [${p.type.padEnd(10)}] ${p.slug}`)
    } else if (
      exists.address !== data.address ||
      exists.latitude !== data.latitude ||
      exists.longitude !== data.longitude ||
      JSON.stringify(exists.amenities) !== JSON.stringify(data.amenities) ||
      exists.type !== data.type ||
      exists.name !== data.name
    ) {
      // Update only the fields that drifted. Don't trash the user-edited
      // description / photo URLs / featured flag from the admin panel.
      await prisma.park.update({
        where: { slug: p.slug },
        data: {
          name: data.name,
          type: data.type,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          amenities: data.amenities,
        },
      })
      updated += 1
      console.log(`  ~ [${p.type.padEnd(10)}] ${p.slug}`)
    } else {
      console.log(`  · [${p.type.padEnd(10)}] ${p.slug} (no change)`)
    }
  }

  console.log(
    `[seed-parks] ✅ ${PARKS_CURATED.length} parks processed: ${created} created, ${updated} updated, ${PARKS_CURATED.length - created - updated} unchanged`
  )
}

main()
  .catch((err) => {
    console.error('[seed-parks] ❌', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
