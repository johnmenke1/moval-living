// Backfill Review.ownerId by matching authorEmail to Owner.email.
// Idempotent — only updates reviews where ownerId is NULL.
//
// Run after scripts/apply-review-owner-id.cjs once the column exists.

const { Pool } = require('pg')
require('fs').readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((line) => {
  const m = line.match(/^DATABASE_URL=(.+)$/)
  if (m && !process.env.DATABASE_URL) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '')
})

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

;(async () => {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')

    // Match owner to each review by normalized email. Lowercase both
    // sides so a review with "Sarah@Example.com" matches an Owner
    // with "sarah@example.com". LEFT JOIN semantics: we only update
    // reviews where an Owner row matches, leaving everything else
    // (anonymous reviews with no email, or emails with no Owner)
    // alone.
    const result = await c.query(`
      UPDATE "Review" r
      SET "ownerId" = o.id
      FROM "Owner" o
      WHERE r."ownerId" IS NULL
        AND r."authorEmail" IS NOT NULL
        AND lower(trim(r."authorEmail")) = lower(o.email)
      RETURNING r.id, r."authorEmail", o.id AS owner_id
    `)
    console.log(`✅ Backfilled ${result.rowCount} reviews with matching Owner`)

    // Diagnostic counts
    const counts = await c.query(`
      SELECT
        COUNT(*) AS total_reviews,
        COUNT("ownerId") AS reviews_with_owner,
        COUNT(*) - COUNT("ownerId") AS reviews_without_owner
      FROM "Review"
    `)
    console.log('📊 Review owner linkage:', counts.rows[0])

    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    console.error('❌ Backfill failed:', e.message)
    process.exit(1)
  } finally {
    c.release()
    await pool.end()
  }
})()
