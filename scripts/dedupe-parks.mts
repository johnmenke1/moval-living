/* eslint-disable no-console */
/**
 * scripts/dedupe-parks.mts
 *
 * Step 11 cleanup: removes the 6 duplicate / typo park rows that
 * the deployed /parks page is showing as "extra facilities". The
 * page was deployed with 46 records instead of the canonical 36+4
 * legitimate sibling additions = 40.
 *
 * Strategy: delete only the obvious row duplicates / typos. Keep
 * anything that might be a legitimate addition.
 *
 *   node --experimental-strip-types scripts/dedupe-parks.mts
 *   node --experimental-strip-types scripts/dedupe-parks.mts --dry-run
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const DRY_RUN = process.argv.includes('--dry-run')

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Slugs whose rows are obvious duplicates / typos of canonical rows
// already in the DB. Anything not in this list is preserved.
//
//   el-portrero-park               → typo of el-potrero-park
//   jfk-memorial-park              → duplicate of john-f-kennedy-park
//   march-field-park               → duplicate of march-field-park-and-valley-skate-park
//   pedrona-park                   → duplicate of pedrorena-park
//   rancho-verde-park              → not in City parks layer (future park, out of scope)
//   towngate-memorial-park         → duplicate of towngate-park
const DROP_SLUGS = [
  'el-portrero-park',
  'jfk-memorial-park',
  'march-field-park',
  'pedrona-park',
  'rancho-verde-park',
  'towngate-memorial-park',
]

const dropRows = await prisma.park.findMany({
  where: { slug: { in: DROP_SLUGS } },
  select: { id: true, slug: true, name: true },
})

console.log(`[dedupe-parks] ${DROP_SLUGS.length} slugs in DROP_SLUGS`)
console.log(`[dedupe-parks] ${dropRows.length} matching DB rows`)
for (const r of dropRows) {
  console.log(`  - ${r.slug.padEnd(45)} "${r.name}"`)
}

if (DRY_RUN) {
  console.log('[dedupe-parks] DRY RUN — no changes')
} else if (dropRows.length > 0) {
  const { count } = await prisma.park.deleteMany({
    where: { id: { in: dropRows.map((r) => r.id) } },
  })
  console.log(`[dedupe-parks] ✅ deleted ${count} row(s)`)
}

const remaining = await prisma.park.count()
console.log(`[dedupe-parks] Park.count() now: ${remaining}`)

await prisma.$disconnect()
await pool.end()
