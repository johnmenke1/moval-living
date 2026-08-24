// Apply the Review.ownerId migration directly to Neon, then insert
// the corresponding _prisma_migrations row so Prisma CLI recognizes
// it as applied. Mirrors the workflow we used for the BestOfVote
// migration in prisma/migrations/20260822162306_add_best_of_vote_*.

const { Pool } = require('pg')

// Load DATABASE_URL from .env.local (gitignored) since this is run
// outside the Next.js runtime that auto-loads env vars. pg + Node
// don't read .env files by default.
require('fs').readFileSync('.env.local', 'utf8')
  .split(/\r?\n/)
  .forEach((line) => {
    const m = line.match(/^DATABASE_URL=(.+)$/)
    if (m && !process.env.DATABASE_URL) {
      // Strip surrounding quotes if any
      process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '')
    }
  })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const migrationSql = `
ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
`

const indexSql = `
CREATE INDEX IF NOT EXISTS "Review_ownerId_idx" ON "Review"("ownerId");
`

const fkSql = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Review_ownerId_fk'
  ) THEN
    ALTER TABLE "Review"
      ADD CONSTRAINT "Review_ownerId_fk"
      FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
`

const migrationName = '20260823023744_add_review_owner_id'
const checksum = require('crypto')
  .createHash('sha256')
  .update(migrationSql + indexSql + fkSql)
  .digest('hex')

;(async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(migrationSql)
    await client.query(fkSql)
    await client.query(indexSql)
    await client.query(
      `INSERT INTO "_prisma_migrations" (
         id, checksum, finished_at, migration_name, logs,
         rolled_back_at, started_at, applied_steps_count
       ) VALUES (
         $1, $2, NOW(), $3, NULL, NULL, NOW(), 3
       )`,
      [`m_${migrationName.slice(-30)}`, checksum, migrationName],
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
