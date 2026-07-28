const { Pool } = require('pg')
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:***@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
})

async function check() {
  try {
    const total = await pool.query('SELECT COUNT(*) FROM "Business"')
    const withPlaceId = await pool.query('SELECT COUNT(*) FROM "Business" WHERE "googleBusiness" IS NOT NULL AND LENGTH("googleBusiness") > 0')
    const withPlaceIdChars = await pool.query('SELECT COUNT(*) FROM "Business" WHERE "googleBusiness" ~ \'^[A-Za-z0-9_-]{20,}$\'')
    const sample = await pool.query('SELECT name, slug, "googleBusiness" FROM "Business" WHERE "googleBusiness" IS NOT NULL LIMIT 5')
    const sampleNoGbp = await pool.query('SELECT name, slug, address FROM "Business" WHERE "googleBusiness" IS NULL OR LENGTH("googleBusiness") = 0 LIMIT 5')
    console.log('Total:', total.rows[0].count)
    console.log('With googleBusiness non-empty:', withPlaceId.rows[0].count)
    console.log('Looking like a place_id (20+ alphanum chars, no slashes):', withPlaceIdChars.rows[0].count)
    console.log('--- Sample with googleBusiness ---')
    sample.rows.forEach(b => console.log(' -', b.name, '|', b.googleBusiness))
    console.log('--- Sample without googleBusiness ---')
    sampleNoGbp.rows.forEach(b => console.log(' -', b.name, '|', b.address))
  } catch (e) {
    console.error('ERROR:', e.message)
  } finally {
    await pool.end()
  }
}
check()