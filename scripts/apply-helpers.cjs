/**
 * Shared utilities for the apply-*.cjs scripts.
 *
 * The scripts read SQL from JS template literals (LF) and run it
 * against the live DB. Git's `core.autocrlf=true` (Windows default)
 * re-writes committed files to CRLF, which means the file on disk
 * no longer byte-matches what we hashed at apply-time. Prisma CLI
 * then sees a checksum mismatch.
 *
 * Fix: hash the FILE (after git normalization), not the JS literal.
 * That way the recorded checksum matches what Prisma reads on a
 * subsequent `migrate status`.
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

/**
 * Build the migration ledger ID. Prisma's `_prisma_migrations.id`
 * column is VARCHAR(36), so the input is sliced to fit.
 *
 *   id = "m_" + migrationName.slice(-30)
 *
 * Examples:
 *   '20260823023744_add_review_owner_id'           -> 'm_023744_add_review_owner_id'  (30 chars)
 *   '20260824030000_add_best_of_nomination_owner_id' -> 'm_40000_add_best_of_nomination_owner_id' (39 chars total, truncated)
 */
function buildMigrationId(migrationName) {
  return `m_${migrationName.slice(-30)}`
}

/**
 * Compute the SHA-256 checksum of the migration.sql FILE on disk
 * (post-CRLF-normalization, so it matches what Prisma sees).
 *
 * The migration directory must be named `<migrationName>/` and
 * contain a `migration.sql` file.
 */
function checksumMigrationFile(migrationName) {
  const sqlPath = path.join(
    'prisma/migrations',
    migrationName,
    'migration.sql',
  )
  const sql = fs.readFileSync(sqlPath, 'utf8')
  return crypto.createHash('sha256').update(sql).digest('hex')
}

/**
 * Load DATABASE_URL from the gitignored `.env.local`. pg + Node don't
 * read .env files by default, and Prisma CLI's `--url` flag isn't
 * supported in Prisma 7.
 */
function loadDatabaseUrl() {
  const envFile = '.env.local'
  if (!fs.existsSync(envFile)) {
    throw new Error(
      `${envFile} not found — copy from .env.live before running apply scripts`,
    )
  }
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.+)$/)
    if (m && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '')
    }
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set after reading .env.local')
  }
}

module.exports = {
  buildMigrationId,
  checksumMigrationFile,
  loadDatabaseUrl,
}