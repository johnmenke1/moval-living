// One-shot — does the same thing as /api/admin/best-of/recalculate route:
// 1. Clear bestOfRank on all businesses
// 2. For each BestOfCategory, set bestOfRank = 1 on the top business
//    (the one with lowest rank — rank=1 is #1)
//
// Run: node .hermes/recalculate-best-of.mjs [--dry-run]
//
// Requires: DATABASE_URL in .env.live-audit
// Cleans up .env.live-audit on exit.

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

const dryRun = process.argv.includes('--dry-run')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const categories = await prisma.bestOfCategory.findMany({
    include: {
      entries: {
        where: { rank: { not: null } },
        orderBy: { rank: 'asc' },
        include: { business: { select: { id: true, name: true } } },
      },
    },
  })

  console.log(`\nFound ${categories.length} categories.`)

  // Step 1: clear stale bestOfRank on all businesses
  const cleared = await prisma.business.updateMany({
    where: { bestOfRank: { not: null } },
    data: { bestOfRank: null },
  })
  console.log(`${dryRun ? '[DRY] Would clear' : 'Cleared'} bestOfRank on ${cleared.count} businesses.`)

  // Step 2: set bestOfRank = 1 on the top business per category
  let updated = 0
  for (const cat of categories) {
    const top = cat.entries[0]
    if (!top) {
      console.log(`  ${cat.name}: no entries, skipped`)
      continue
    }
    console.log(`  ${cat.name}: #1 = ${top.business.name}`)
    if (!dryRun) {
      await prisma.business.update({
        where: { id: top.business.id },
        data: { bestOfRank: 1 },
      })
      updated++
    }
  }

  console.log(`\n${dryRun ? '[DRY] Would update' : 'Updated'} bestOfRank on ${updated} businesses.`)

  if (existsSync('.env.live-audit')) {
    unlinkSync('.env.live-audit')
    console.log('[cleaned up .env.live-audit]')
  }
}

main()
  .catch(e => { console.error('ERR:', e); process.exit(1) })
  .finally(async () => {
    await prisma.$disconnect()
    if (existsSync('.env.live-audit')) {
      try { unlinkSync('.env.live-audit') } catch {}
    }
  })
