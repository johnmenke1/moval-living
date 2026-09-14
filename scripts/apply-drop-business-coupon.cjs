// Hand-applies the 20260915000000_drop_business_coupon Prisma migration
// to the production database. Necessary because Prisma 7's shadow-DB
// migration flow has been flaky on Neon (flagged in memory and in the
// multi-clone skill's §20) — instead, we run the SQL inside a
// transaction and insert the `_prisma_migrations` row by hand using
// the shared helpers in scripts/apply-helpers.cjs.
//
// Idempotent: re-running this script after a successful apply is a
// no-op because:
//   1. ALTER TABLE ... DROP COLUMN IF EXISTS ... tolerates missing
//      columns.
//   2. The _prisma_migrations insert uses ON CONFLICT DO NOTHING via
//      the unique migration_name index.

const { Pool } = require('pg')
const {
  loadDatabaseUrl,
  buildMigrationId,
  checksumMigrationFile,
} = require('./apply-helpers.cjs')

loadDatabaseUrl()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const migrationName = '20260915000000_drop_business_coupon'
const checksum = checksumMigrationFile(migrationName)
const id = buildMigrationId(migrationName)

const dropSql = `
ALTER TABLE "Business" DROP COLUMN IF EXISTS "hasCoupon";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "coupon";
`

const insertMigrationRow = `
INSERT INTO "_prisma_migrations" (
  id, checksum, finished_at, migration_name, logs,
  rolled_back_at, started_at, applied_steps_count
)
VALUES (
  $1, $2, NOW(), $3, NULL, NULL, NOW(), 1
)
ON CONFLICT ("migration_name") DO NOTHING
`

;(async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Pre-flight: confirm the legacy columns still exist before we drop
    // them. After a successful run, this will report an empty array —
    // proof that the migration has already applied.
    const before = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Business'
        AND column_name IN ('hasCoupon', 'coupon')
      ORDER BY column_name
    `)
    console.log(`Pre-flight: legacy columns present = [${before.rows.map(r => r.column_name).join(', ')}]`)

    // Run the migration SQL — idempotent, safe to re-run.
    console.log('\nApplying migration SQL...')
    await client.query(dropSql)
    console.log('  ✓ DROP COLUMN statements executed')

    // Insert the _prisma_migrations row. Idempotency is provided by the
    // pre-flight check above — we only insert if no row for this
    // migration_name exists. (Unlike ON CONFLICT, this works because
    // `_prisma_migrations` has no unique constraint on migration_name, only
    // on id.)
    const existing = await client.query(
      `SELECT id, finished_at FROM "_prisma_migrations" WHERE migration_name = $1`,
      [migrationName],
    )
    if (existing.rows.length === 0) {
      await client.query(insertMigrationRow, [id, checksum, migrationName])
      console.log(`  ✓ _prisma_migrations row inserted (id=${id})`)
    } else {
      console.log(`  ✓ _prisma_migrations row already present (id=${existing.rows[0].id}, finished_at=${existing.rows[0].finished_at.toISOString()})`)
    }

    await client.query('COMMIT')
    console.log('\n✅ Migration applied successfully.')

    // Post-flight verification.
    const after = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Business'
        AND column_name IN ('hasCoupon', 'coupon')
      ORDER BY column_name
    `)
    if (after.rows.length > 0) {
      console.log(`⚠️  Columns still present after migration: [${after.rows.map(r => r.column_name).join(', ')}]`)
    } else {
      console.log('✓ Both legacy columns dropped from Business table.')
    }

    const mig = await client.query(
      `SELECT migration_name, finished_at, applied_steps_count
       FROM "_prisma_migrations"
       WHERE migration_name = $1`,
      [migrationName],
    )
    console.log(`✓ _prisma_migrations row: ${JSON.stringify(mig.rows[0])}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
})()
