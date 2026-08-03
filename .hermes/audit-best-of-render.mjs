// One-shot audit — confirms whether the bestOfRank column is populated
// and which businesses have it set. Cleans up .env.live-audit on exit.

import { existsSync, unlinkSync } from 'fs'
import { config } from 'dotenv'
config({ path: '.env.live-audit' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const total = await prisma.business.count()
  const withRank = await prisma.business.findMany({
    where: { bestOfRank: { not: null } },
    select: { id: true, name: true, bestOfRank: true, updatedAt: true },
    orderBy: { name: 'asc' },
  })

  console.log(`\n=== TOTAL BUSINESSES: ${total} ===`)
  console.log(`=== WITH bestOfRank NOT NULL: ${withRank.length} ===\n`)

  if (withRank.length > 0) {
    console.log('Businesses with bestOfRank set:')
    for (const b of withRank) {
      console.log(`  rank=${b.bestOfRank} | ${b.name}`)
    }
  }

  // Also check BestOfEntry
  const entryCount = await prisma.bestOfEntry.count()
  const rankOneCount = await prisma.bestOfEntry.count({ where: { rank: 1 } })
  console.log(`\n=== BestOfEntry rows: ${entryCount} ===`)
  console.log(`=== Rows with rank=1: ${rankOneCount} ===`)

  if (existsSync('.env.live-audit')) {
    unlinkSync('.env.live-audit')
    console.log('\n[cleaned up .env.live-audit]')
  }
}

main()
  .catch(e => { console.error('AUDIT FAILED:', e); process.exit(1) })
  .finally(async () => {
    await prisma.$disconnect()
    if (existsSync('.env.live-audit')) {
      try { unlinkSync('.env.live-audit'); console.log('[cleaned up .env.live-audit]') } catch {}
    }
  })
