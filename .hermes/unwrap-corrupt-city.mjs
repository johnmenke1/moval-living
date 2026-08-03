// One-shot regex-unwrap for the bad city="CA 92557" pattern.
// Mirrors the OLD buggy parseAddress, in reverse.
//
// READ the audit first. READ this carefully. READ the dry-run output.
//
// This script does NOT call Google Places — it just unwraps the in-DB string
// into the two fields it was meant to represent. It's brittle (matches the
// SAME bug that corrupted the data, in reverse), but it's a 30-second fix
// for all 499 records without spending 500 Google API calls.
//
// Use this when:
//   - You trust Google's structured data is the same as what was originally parsed
//   - You want a 1-second fix vs a 10-minute fix
//   - You're OK with "good enough" — 99% of the corrupted rows will unwrap cleanly
//
// Do NOT use this if:
//   - You want street addresses upgraded (e.g. "Ave" → "Avenue"). This script
//     only moves city/state/zip; addresses stay as-is.
//
// Run: node .hermes/unwrap-corrupt-city.mjs [--dry-run] [--limit N] [--only id1,id2,...]

import { config } from 'dotenv'
config({ path: '.env.live-audit' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set — .env.live-audit missing?')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity
const onlyIdx = args.indexOf('--only')
const onlyIds = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null

// Pattern: "CA 92557", "CA 92557-1234", or "CA92557" (no space)
const STATE_ZIP = /^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/

const isCorrupt = (b) =>
  /^(usa?)$/i.test(b.state || '') &&
  STATE_ZIP.test((b.city || '').trim())

async function main() {
  let businesses
  if (onlyIds) {
    businesses = await prisma.business.findMany({
      where: { id: { in: onlyIds } },
      select: { id: true, name: true, slug: true, address: true, city: true, state: true, zip: true },
    })
  } else {
    const all = await prisma.business.findMany({
      select: { id: true, name: true, slug: true, address: true, city: true, state: true, zip: true },
    })
    businesses = all.filter(isCorrupt)
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Processing ${Math.min(businesses.length, limit)} of ${businesses.length} businesses\n`)
  if (businesses.length === 0) {
    console.log('Nothing matches the unwrap pattern (state="US" + city="CA 92557" shape).')
    return
  }

  let updated = 0
  let failed = 0

  for (const [i, b] of businesses.slice(0, limit).entries()) {
    const m = (b.city || '').trim().match(STATE_ZIP)
    if (!m) {
      console.log(`  [${i + 1}/${businesses.length}] SKIP (no match): ${b.name} city="${b.city}"`)
      failed++
      continue
    }
    const [, newState, newZip] = m
    console.log(`  [${i + 1}/${businesses.length}] ${b.name}`)
    console.log(`    before: state="${b.state}" city="${b.city}" zip="${b.zip}"`)
    console.log(`    after:  state="${newState}" city=""        zip="${newZip}"`)

    if (!dryRun) {
      await prisma.business.update({
        where: { id: b.id },
        data: { state: newState, city: '', zip: newZip },
      })
    }
    updated++
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`  updated:  ${updated}${dryRun ? ' (would be)' : ''}`)
  console.log(`  failed:   ${failed}`)
  if (dryRun) console.log(`\n  Re-run without --dry-run to apply.`)
}

main()
  .catch((e) => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
