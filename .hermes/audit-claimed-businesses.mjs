// One-shot audit of which businesses are claimed (ownerId IS NOT NULL).
// READ-ONLY. No writes. No secrets echoed.
//
// Run: node .hermes/audit-claimed-businesses.mjs
//
// Requires: DATABASE_URL in .env.live-audit (pulled via
//   `vercel env pull .env.live-audit --environment production --yes`)
//
// Cleans up after itself: deletes .env.live-audit on exit.

import { existsSync, unlinkSync } from 'fs'
import { config } from 'dotenv'
config({ path: '.env.live-audit' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set — run: vercel env pull .env.live-audit --environment production --yes')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const total = await prisma.business.count()

  const claimed = await prisma.business.findMany({
    where: { ownerId: { not: null } },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      updatedAt: true,
      owner: { select: { email: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  console.log(`\n=== TOTAL BUSINESSES: ${total} ===`)
  console.log(`=== CLAIMED (ownerId IS NOT NULL): ${claimed.length} ===\n`)

  // Group by ownerId to see if one owner owns many businesses
  const byOwner = new Map<string, number>()
  for (const b of claimed) {
    if (b.ownerId) {
      byOwner.set(b.ownerId, (byOwner.get(b.ownerId) ?? 0) + 1)
    }
  }

  console.log('OWNERS (counting businesses per ownerId):')
  const sortedOwners = [...byOwner.entries()].sort((a, b) => b[1] - a[1])
  for (const [ownerId, count] of sortedOwners.slice(0, 10)) {
    const sample = claimed.find(b => b.ownerId === ownerId)
    const email = sample?.owner?.email || '(no email)'
    const name = sample?.owner?.name || '(no name)'
    console.log(`  ${count.toString().padStart(4)} businesses | ownerId=${ownerId} | ${email} | ${name}`)
  }
  if (sortedOwners.length > 10) {
    console.log(`  ... and ${sortedOwners.length - 10} more owners`)
  }

  console.log('\nSAMPLE OF CLAIMED BUSINESSES (most recent 15 by updatedAt):')
  for (const b of claimed.slice(0, 15)) {
    const date = b.updatedAt.toISOString().slice(0, 10)
    console.log(`  ${date} | ${b.name.padEnd(35)} | owner=${b.owner?.email || '(null)'}`)
  }

  // Cleanup
  if (existsSync('.env.live-audit')) {
    unlinkSync('.env.live-audit')
    console.log('\n[cleaned up .env.live-audit]')
  }
}

main()
  .catch((e) => { console.error('AUDIT FAILED:', e); process.exit(1) })
  .finally(async () => {
    await prisma.$disconnect()
    if (existsSync('.env.live-audit')) {
      try { unlinkSync('.env.live-audit'); console.log('[cleaned up .env.live-audit]') } catch {}
    }
  })
