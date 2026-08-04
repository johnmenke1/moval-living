const { createRequire } = require('module')
const require = createRequire(import.meta.url)
require('dotenv').config({ path: '.env.live' })

import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Count BestOfScore records per entry for Loco Burrito
  const total = await pool.query(`SELECT count(*) as cnt FROM "BestOfScore"`)
  console.log('Total BestOfScore records:', total.rows[0].cnt)
  
  // Count how many entries have duplicates (more than 7 score records = duplicates)
  const dupes = await pool.query(`
    SELECT be.id, b.name, count(*) as score_count
    FROM "BestOfScore" bs
    JOIN "BestOfEntry" be ON be.id = bs."entryId"
    JOIN "Business" b ON b.id = be."businessId"
    GROUP BY be.id, b.name
    HAVING count(*) > 7
    LIMIT 5
  `)
  console.log('Entries with >7 score records (duplicates):', dupes.rows.length)
  
  await pool.end()
}
main().catch(e => { console.error(e.message); process.exit(1) })
