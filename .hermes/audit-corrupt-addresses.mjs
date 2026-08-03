// One-shot audit script — reports businesses with corrupted city/state/zip
// from the old Google Places parseAddress bug. READ-ONLY, no writes.
//
// Patterns to look for:
//   1. state is "US" or "USA" (the country got matched as the state)
//   2. city matches /^[A-Z]{2}\s+\d{5}/ (state+zip got matched as city)
//   3. zip is empty for a US business (the bug stripped it)
//   4. city contains a digit, or zip contains a letter (intermixed)
//
// Run: node .hermes/audit-corrupt-addresses.mjs

import { config } from 'dotenv'
config({ path: '.env.live-audit' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set — check .env.live-audit')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const all = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      googleBusiness: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`\n=== TOTAL BUSINESSES: ${all.length} ===\n`)

  // Pattern 1: state is "US" or "USA" or any non-2-letter string
  const stateUS = all.filter(b => /^(usa?)$/i.test(b.state || ''))
  // Pattern 2: city looks like state+zip
  const cityLooksLikeStateZip = all.filter(b => /^[A-Z]{2}\s+\d{5}/.test(b.city || ''))
  // Pattern 3: zip is empty
  const zipEmpty = all.filter(b => !b.zip || b.zip.trim() === '')
  // Pattern 4: city has a digit (means state or zip got inlined)
  const cityHasDigit = all.filter(b => /\d/.test(b.city || ''))
  // Pattern 5: zip has a letter
  const zipHasLetter = all.filter(b => /[A-Za-z]/.test(b.zip || ''))
  // Pattern 6: address ends with ", USA" (didn't get split)
  const addressHasUSA = all.filter(b => /, USA$|, US$/.test(b.address || ''))

  const reportRow = (label, rows) => {
    console.log(`  ${label.padEnd(45)} ${rows.length.toString().padStart(4)}`)
  }
  console.log('PATTERN COUNTS:')
  reportRow('state = "US" or "USA"', stateUS)
  reportRow('city looks like "CA 92553"', cityLooksLikeStateZip)
  reportRow('zip is empty', zipEmpty)
  reportRow('city contains a digit', cityHasDigit)
  reportRow('zip contains a letter', zipHasLetter)
  reportRow('address ends with ", USA"', addressHasUSA)

  // Union: any business matching any pattern
  const corruptIds = new Set([
    ...stateUS.map(b => b.id),
    ...cityLooksLikeStateZip.map(b => b.id),
    ...zipEmpty.map(b => b.id),
    ...cityHasDigit.map(b => b.id),
    ...zipHasLetter.map(b => b.id),
    ...addressHasUSA.map(b => b.id),
  ])
  const corrupt = all.filter(b => corruptIds.has(b.id))
  const withPlaceId = corrupt.filter(b => b.googleBusiness)
  const withoutPlaceId = corrupt.filter(b => !b.googleBusiness)

  console.log(`\n  ${'UNIQUE BUSINESSES WITH ANY CORRUPTION'.padEnd(45)} ${corrupt.length.toString().padStart(4)}`)
  console.log(`  ${'  → have googleBusiness placeId (recoverable)'.padEnd(45)} ${withPlaceId.length.toString().padStart(4)}`)
  console.log(`  ${'  → no placeId (must hand-fix in admin)'.padEnd(45)} ${withoutPlaceId.length.toString().padStart(4)}`)

  // Sample: 10 examples for visual confirmation
  console.log('\nSAMPLE (first 10 by createdAt desc):')
  for (const b of corrupt.slice(0, 10)) {
    console.log(`  [${b.state || 'NULL'}] [${b.zip || 'NULL'}] city="${b.city}" | ${b.name}`)
  }

  // Just for reference: how many businesses have a placeId at all
  const totalWithPlaceId = all.filter(b => b.googleBusiness).length
  console.log(`\n  ${'TOTAL WITH googleBusiness (any state)'.padEnd(45)} ${totalWithPlaceId.toString().padStart(4)}`)
}

main()
  .catch(e => {
    console.error('AUDIT FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
