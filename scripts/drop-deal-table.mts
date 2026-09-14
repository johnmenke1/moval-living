import { config } from 'dotenv'
config()
config({ path: '.env.local', override: true })

import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// Drop the partially-created Deal table so the migration can run from
// scratch. Safe because Deal has 0 rows.
console.log('Dropping Deal table...')
await pool.query(`DROP TABLE IF EXISTS "Deal" CASCADE`)
const verify = await pool.query<{ n: number }>(
  `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND tablename='Deal'`
)
console.log('Deal tables remaining:', verify.rows[0]?.n ?? 0)
await pool.end()
