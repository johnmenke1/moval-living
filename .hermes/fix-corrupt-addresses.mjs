// One-shot fix script — re-fetches structured address from Google Places for
// every corrupted business and updates city/state/zip/address in the DB.
//
// Reuses the same addressComponents extraction as the live /api/places/search
// route, so the result is guaranteed consistent with the new import path.
//
// READ the audit (.hermes/audit-corrupt-addresses.mjs) before running this.
//
// Run: node .hermes/fix-corrupt-addresses.mjs [--dry-run] [--limit N] [--only id1,id2,...]
//
//   --dry-run   : print what would change, don't write to DB
//   --limit N   : process at most N businesses (good for testing)
//   --only IDs  : comma-separated business IDs to fix (skip the audit filter)
//
// By default (no flags): fixes every business that matches the corruption patterns.

import { config } from 'dotenv'
config({ path: '.env.live-audit' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set — .env.live-audit missing?')
  process.exit(1)
}
if (!process.env.GOOGLE_PLACES_API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY not set — .env.live-audit missing?')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// --- args ---
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity
const onlyIdx = args.indexOf('--only')
const onlyIds = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null

// --- corruption patterns (mirror the audit) ---
const isCorrupt = (b) =>
  /^(usa?)$/i.test(b.state || '') ||
  /^[A-Z]{2}\s+\d{5}/.test(b.city || '') ||
  !b.zip || b.zip.trim() === '' ||
  /\d/.test(b.city || '')

// --- structured address extraction (same logic as the live route) ---
function extractStructured(place) {
  const components = place.addressComponents || []
  const find = (type) => components.find((c) => c.types?.includes(type))
  const streetNumber = find('street_number')?.longText || find('street_number')?.shortText || ''
  const route = find('route')?.longText || find('route')?.shortText || ''
  const street = [streetNumber, route].filter(Boolean).join(' ').trim()
  const city =
    find('locality')?.longText ||
    find('postal_town')?.longText ||
    find('sublocality_level_1')?.longText ||
    ''
  const state = find('administrative_area_level_1')?.shortText || ''
  const zip = find('postal_code')?.shortText || ''
  return { street: street || place.formattedAddress || '', city, state, zip }
}

// --- fetch one place from Google Places API v1 ---
async function fetchPlace(placeId) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,addressComponents,formattedAddress',
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Places API ${res.status}: ${JSON.stringify(err).slice(0, 200)}`)
  }
  return res.json()
}

// --- main ---
async function main() {
  let businesses
  if (onlyIds) {
    businesses = await prisma.business.findMany({
      where: { id: { in: onlyIds } },
      select: {
        id: true, name: true, slug: true,
        address: true, city: true, state: true, zip: true,
        googleBusiness: true,
      },
    })
  } else {
    const all = await prisma.business.findMany({
      select: {
        id: true, name: true, slug: true,
        address: true, city: true, state: true, zip: true,
        googleBusiness: true,
      },
    })
    businesses = all.filter(isCorrupt)
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Processing ${Math.min(businesses.length, limit)} of ${businesses.length} businesses\n`)
  if (businesses.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let updated = 0
  let skipped = 0
  let failed = 0
  let noChange = 0

  for (const [i, b] of businesses.slice(0, limit).entries()) {
    if (!b.googleBusiness) {
      console.log(`  [${i + 1}/${businesses.length}] SKIP (no placeId): ${b.name}`)
      skipped++
      continue
    }

    try {
      const place = await fetchPlace(b.googleBusiness)
      const { street, city, state, zip } = extractStructured(place)

      // Sanity: we need at least state populated, otherwise the call returned
      // something unexpected (closed business, deleted, etc.)
      if (!state) {
        console.log(`  [${i + 1}/${businesses.length}] SKIP (no state in API response): ${b.name}`)
        skipped++
        continue
      }

      const newAddr = { address: street, city, state, zip }
      const changed =
        newAddr.address !== b.address ||
        newAddr.city !== b.city ||
        newAddr.state !== b.state ||
        newAddr.zip !== b.zip

      if (!changed) {
        console.log(`  [${i + 1}/${businesses.length}] NO CHANGE: ${b.name}`)
        noChange++
        continue
      }

      const oldSummary = `state=${b.state} city=${b.city} zip=${b.zip}`
      const newSummary = `state=${newAddr.state} city=${newAddr.city} zip=${newAddr.zip}`
      console.log(`  [${i + 1}/${businesses.length}] ${b.name}`)
      console.log(`    before: ${oldSummary}`)
      console.log(`    after:  ${newSummary}`)
      console.log(`    address: "${b.address}" → "${newAddr.address}"`)

      if (!dryRun) {
        await prisma.business.update({
          where: { id: b.id },
          data: newAddr,
        })
      }
      updated++
    } catch (e) {
      console.log(`  [${i + 1}/${businesses.length}] FAILED: ${b.name} — ${e.message}`)
      failed++
    }
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`  updated:  ${updated}${dryRun ? ' (would be)' : ''}`)
  console.log(`  no change: ${noChange}`)
  console.log(`  skipped:   ${skipped}`)
  console.log(`  failed:    ${failed}`)
  if (dryRun) {
    console.log(`\n  Re-run without --dry-run to apply.`)
  }
}

main()
  .catch((e) => {
    console.error('FATAL:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
