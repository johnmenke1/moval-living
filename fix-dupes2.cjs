// fix-dupes2.cjs - Delete duplicate BestOfScore records using hardcoded connection string
const { Pool } = require('pg')

// Direct connection string (not from env)
const connStr = 'postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require'
const pool = new Pool({ connectionString: connStr })

async function main() {
  console.log('Connected')
  
  // First check total
  const before = await pool.query(`SELECT count(*) as cnt FROM "BestOfScore"`)
  console.log('Before: total BestOfScore records =', before.rows[0].cnt)
  
  // Run the duplicate deletion
  const result = await pool.query(`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY "entryId", factor ORDER BY id) as rn
      FROM "BestOfScore"
    )
    DELETE FROM "BestOfScore" WHERE id IN (
      SELECT id FROM ranked WHERE rn > 1
    )
  `)
  console.log('Deleted:', result.rowCount, 'rows')
  
  // Check total after
  const after = await pool.query(`SELECT count(*) as cnt FROM "BestOfScore"`)
  console.log('After: total BestOfScore records =', after.rows[0].cnt)
  
  // Verify Loco Burrito
  const loco = await pool.query(`
    SELECT bs.factor, bs."rawValue"
    FROM "BestOfScore" bs
    JOIN "BestOfEntry" be ON be.id = bs."entryId"
    JOIN "Business" b ON b.id = be."businessId"
    WHERE b.name = 'Loco Burrito'
    ORDER BY bs.factor
  `)
  console.log('\nLoco Burrito BestOfScore:')
  loco.rows.forEach(r => console.log(' ', r.factor, ':', r.rawValue))
  
  await pool.end()
  console.log('\nDone!')
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e.message); process.exit(1) })
