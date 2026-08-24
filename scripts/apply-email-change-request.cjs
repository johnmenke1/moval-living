// Apply the EmailChangeRequest migration directly to Neon, then
// insert the corresponding _prisma_migrations row so Prisma CLI
// recognizes it as applied. Mirrors the workflow we used for
// scripts/apply-review-owner-id.cjs and apply-nomination-owner-id.cjs.

const { Pool } = require('pg')

// Load DATABASE_URL from .env.local (gitignored) since this is run
// outside the Next.js runtime that auto-loads env vars. pg + Node
// don't read .env files by default. See scripts/apply-helpers.cjs
// for the shared loader + checksum strategy (uses the FILE
// post-CRLF-normalization to match what Prisma CLI reads on
// subsequent migrate status calls).
const { loadDatabaseUrl, buildMigrationId, checksumMigrationFile } = require('./apply-helpers.cjs')
loadDatabaseUrl()
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const tableSql = `
CREATE TABLE IF NOT EXISTS "EmailChangeRequest" (
  "id"        TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  "newEmail"  TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`

const indexSql = `
CREATE UNIQUE INDEX IF NOT EXISTS "EmailChangeRequest_token_key"
  ON "EmailChangeRequest"("token");
CREATE INDEX IF NOT EXISTS "EmailChangeRequest_ownerId_idx"
  ON "EmailChangeRequest"("ownerId");
CREATE INDEX IF NOT EXISTS "EmailChangeRequest_expiresAt_idx"
  ON "EmailChangeRequest"("expiresAt");
`

const fkSql = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailChangeRequest_ownerId_fk'
  ) THEN
    ALTER TABLE "EmailChangeRequest"
      ADD CONSTRAINT "EmailChangeRequest_ownerId_fk"
      FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
`

const migrationName = '20260824040000_add_email_change_request'
const checksum = checksumMigrationFile(migrationName)

;(async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(tableSql)
    await client.query(fkSql)
    await client.query(indexSql)
    await client.query(
      `INSERT INTO "_prisma_migrations" (
         id, checksum, finished_at, migration_name, logs,
         rolled_back_at, started_at, applied_steps_count
       ) VALUES (
         $1, $2, NOW(), $3, NULL, NULL, NOW(), 3
       )`,
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