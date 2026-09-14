import { config } from 'dotenv'
config()
config({ path: '.env.local', override: true })

import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const deals = await pool.query<{
  id: string
  businessId: string
  headline: string
  description: string | null
  code: string | null
  imageUrl: string | null
  expiresAt: Date | null
  displayOrder: number
  isActive: boolean
  businessName: string
  businessSlug: string
  businessStatus: string
}>(`
  SELECT d."id", d."businessId", d."headline", d."description", d."code",
         d."imageUrl", d."expiresAt", d."displayOrder", d."isActive",
         b."name" AS "businessName", b."slug" AS "businessSlug",
         b."status" AS "businessStatus"
  FROM "Deal" d
  JOIN "Business" b ON b."id" = d."businessId"
`)
console.log(`Backfilled deals: ${deals.rows.length}`)
for (const d of deals.rows) {
  console.log(JSON.stringify(d, null, 2))
}
await pool.end()
