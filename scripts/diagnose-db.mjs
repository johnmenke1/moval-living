#!/usr/bin/env node
/**
 * Diagnose the actual state of the GuestPost table on the live database.
 * Run with: node scripts/diagnose-db.mjs
 *
 * Prints:
 *   - Whether the table exists
 *   - Column names + their nullability
 *   - Whether the PostType check constraint exists
 *   - Whether the postType column has a default
 *   - Current row count
 *   - Sample row (if any)
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    // 1. Get column info
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'GuestPost'
      ORDER BY ordinal_position
    `)
    console.log('=== GuestPost columns ===')
    console.table(cols)

    // 2. Get check constraints
    const checks = await prisma.$queryRawUnsafe(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = '"GuestPost"'::regclass AND contype = 'c'
    `)
    console.log('\n=== Check constraints ===')
    console.log(checks)

    // 3. Get indexes
    const idx = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'GuestPost'
    `)
    console.log('\n=== Indexes ===')
    console.table(idx)

    // 4. Get row count + a sample row
    const count = await prisma.guestPost.count()
    console.log('\n=== Row count ===', count)
    if (count > 0) {
      const sample = await prisma.guestPost.findFirst({ orderBy: { createdAt: 'desc' } })
      console.log('\n=== Sample row (newest) ===')
      console.log(JSON.stringify(sample, null, 2))
    }

    // 5. Try the failing insert
    console.log('\n=== Attempting Life post insert ===')
    try {
      const testSlug = `__diag_${Date.now()}`
      const created = await prisma.guestPost.create({
        data: {
          slug: testSlug,
          postType: 'LIFE',
          title: 'Diagnostic test post',
          excerpt: 'Test',
          body: 'Test',
          heroImageUrl: null,
          metaTitle: null,
          metaDescription: null,
          spotifyTrack1: null,
          spotifyTrack2: null,
        },
      })
      console.log('✓ Insert succeeded:', created.id)
      // Clean up
      await prisma.guestPost.delete({ where: { id: created.id } })
      console.log('  (cleanup: deleted)')
    } catch (e) {
      console.log('✗ Insert failed:')
      console.log('  code:', e.code)
      console.log('  message:', e.message)
      if (e.meta) console.log('  meta:', JSON.stringify(e.meta, null, 2))
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('Diagnostic script error:', e)
  process.exit(1)
})