import { config } from 'dotenv'
config()
config({ path: '.env.local', override: true })

import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// Mirror the exact INSERT the migration will run, but as a SELECT —
// so we count rows without writing any.
const result = await pool.query<{ n: number }>(`
  SELECT count(*)::int AS n
  FROM "Business" b
  WHERE b."coupon" IS NOT NULL
    AND jsonb_typeof(b."coupon"::jsonb) = 'object'
    AND b."coupon"::text <> '{}'
    AND b."status" = 'APPROVED'
`)
console.log('expected_backfill_rows:', result.rows[0]?.n ?? 0)

const sample = await pool.query<{ id: string; name: string; coupon: unknown }>(`
  SELECT b."id", b."name", b."coupon"
  FROM "Business" b
  WHERE b."coupon" IS NOT NULL
    AND jsonb_typeof(b."coupon"::jsonb) = 'object'
    AND b."coupon"::text <> '{}'
    AND b."status" = 'APPROVED'
  LIMIT 3
`)
console.log('sample rows:')
for (const row of sample.rows) {
  console.log(`  ${row.id.slice(0, 12)}… ${row.name}: ${JSON.stringify(row.coupon).slice(0, 120)}`)
}
await pool.end()
