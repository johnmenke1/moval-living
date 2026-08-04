import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Check total BestOfScore records
  const total = await pool.query(`SELECT count(*) as cnt FROM "BestOfScore"`)
  console.log('Total BestOfScore records:', total.rows[0].cnt)
  
  // Check negative yearsActive records
  const neg = await pool.query(`
    SELECT bs.factor, bs."rawValue", b.name
    FROM "BestOfScore" bs
    JOIN "BestOfEntry" be ON be.id = bs."entryId"
    JOIN "Business" b ON b.id = be."businessId"
    WHERE bs."rawValue" < 0 AND bs.factor = 'yearsActive'
    LIMIT 5
  `)
  console.log('Negative yearsActive BestOfScore records:', neg.rows.length)
  neg.rows.forEach(r => console.log(' ', r.name, r.rawValue))
  
  await pool.end()
}
main().catch(e => { console.error(e.message); process.exit(1) })
