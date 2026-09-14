import { config } from 'dotenv'
config()
config({ path: '.env.local', override: true })

import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
console.log('connecting...')
const legacy = await pool.query(`
  SELECT count(*)::int AS n
  FROM "Business"
  WHERE "coupon" IS NOT NULL
    AND "coupon"::text <> '{}'
    AND "status" = 'APPROVED'
`)
const hasCoupon = await pool.query(`
  SELECT count(*)::int AS n
  FROM "Business"
  WHERE "hasCoupon" = true AND "status" = 'APPROVED'
`)
const dealsNow = await pool.query(`SELECT count(*)::int AS n FROM "Deal"`).catch((e: unknown) => ({ rows: [{ n: `MISSING: ${e instanceof Error ? e.message : String(e)}` }] }))
const businessTotal = await pool.query(`SELECT count(*)::int AS n FROM "Business"`)
console.log(JSON.stringify({
  legacy_coupons_to_migrate: legacy.rows[0].n,
  hasCoupon_flag_count: hasCoupon.rows[0].n,
  deal_rows_already_present: dealsNow.rows[0].n,
  total_businesses: businessTotal.rows[0].n,
}, null, 2))
await pool.end()
