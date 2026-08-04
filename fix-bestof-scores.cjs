// fix-bestof-scores.cjs - Delete duplicate BestOfScore records
const { createRequire } = require('module')
const require = createRequire(import.meta.url)
require('dotenv').config({ path: '.env.live' })
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  console.log('Connecting to DB...')
  
  // Delete duplicate BestOfScore records, keeping the newest (largest id) per entry+factor
  const result = await pool.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY "entryId", factor ORDER BY id) as rn
      FROM "BestOfScore"
    )
    DELETE FROM "BestOfScore" WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    )
  `)
  console.log('Deleted duplicate BestOfScore records:', result.rowCount)
  
  // Verify Loco Burrito
  const loco = await pool.query(`
    SELECT bs.factor, bs."rawValue", bs.weight
    FROM "BestOfScore" bs
    JOIN "BestOfEntry" be ON be.id = bs."entryId"
    JOIN "Business" b ON b.id = be."businessId"
    WHERE b.name = 'Loco Burrito'
    ORDER BY bs.factor
  `)
  console.log('\nLoco Burrito BestOfScore after cleanup:')
  loco.rows.forEach(r => console.log(' ', r.factor, ':', r.rawValue, '(w='+r.weight+')'))
  
  const total = await pool.query(`SELECT count(*) as cnt FROM "BestOfScore"`)
  console.log('\nTotal BestOfScore records:', total.rows[0].cnt)
  
  await pool.end()
  console.log('Done!')
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
