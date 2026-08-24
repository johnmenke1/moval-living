// Apply the BestOfNomination.accountCreated migration directly to Neon,
// then insert the corresponding _prisma_migrations row so Prisma CLI
// recognizes it as applied. Mirrors the workflow in
// scripts/apply-helpers.cjs (use that — don't reimplement).

const { Pool } = require('pg')
const { loadDatabaseUrl, buildMigrationId, checksumMigrationFile } = require('./apply-helpers.cjs')

loadDatabaseUrl()
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const migrationName = '20260824050000_add_best_of_nomination_account_created'

;(async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Add the column (idempotent — IF NOT EXISTS).
    await client.query(`
      ALTER TABLE "BestOfNomination"
        ADD COLUMN IF NOT EXISTS "accountCreated" BOOLEAN NOT NULL DEFAULT false
    `)

    // 2. Backfill: any nomination with a non-null ownerId was logged in
    //    at submit time, so accountCreated is true for those rows.
    await client.query(`
      UPDATE "BestOfNomination"
      SET "accountCreated" = true
      WHERE "ownerId" IS NOT NULL
    `)

    // 3. Add the index (idempotent — IF NOT EXISTS).
    await client.query(`
      CREATE INDEX IF NOT EXISTS "BestOfNomination_accountCreated_idx"
        ON "BestOfNomination"("accountCreated")
    `)

    // 4. Record the migration in _prisma_migrations using the FILE's
    //    checksum (matches what Prisma CLI will see on subsequent
    //    `migrate status` calls — post-CRLF normalization).
    const checksum = checksumMigrationFile(migrationName)
    await client.query(
      `INSERT INTO "_prisma_migrations" (
         id, checksum, finished_at, migration_name, logs,
         rolled_back_at, started_at, applied_steps_count
       ) VALUES (
         $1, $2, NOW(), $3, NULL, NULL, NOW(), 1
       )
       ON CONFLICT (id) DO NOTHING`,
      [buildMigrationId(migrationName), checksum, migrationName],
    )

    await client.query('COMMIT')
    console.log('✅ Applied', migrationName)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', e.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
})()