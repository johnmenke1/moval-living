/**
 * scripts/fix-addresses.js
 * Fixes city/state/zip for seeded businesses with bad address parsing.
 * Run: node scripts/fix-addresses.js
 */

const { Pool } = require('pg')
const fs = require('fs')

const lines = fs.readFileSync('./.env.local', 'utf8').split('\n')
const get = k =>
  lines
    .find(l => l.startsWith(k + '='))
    ?.split('=')
    .slice(1)
    .join('=')
    .replace(/"/g, '')
    .trim() ?? ''

const DATABASE_URL = get('DATABASE_URL')
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  const result = await pool.query(`
    SELECT id, name, address, city, state, zip
    FROM "Business"
    ORDER BY id
  `)

  const businesses = result.rows
  console.log(`Found ${businesses.length} businesses\n`)

  const updates = []

  for (const biz of businesses) {
    const addr = biz.address || ''
    const zipMatch = addr.match(/\b(\d{5}(?:-\d{4})?)\b/)
    const cityWrong = biz.city !== 'Moreno Valley'
    const stateWrong = biz.state !== 'CA'

    if (!cityWrong && !stateWrong) continue

    updates.push({
      id: biz.id,
      name: biz.name,
      oldCity: biz.city,
      oldState: biz.state,
      oldZip: biz.zip,
      newZip: zipMatch ? zipMatch[1] : biz.zip,
    })
  }

  console.log(`${updates.length} businesses need fixing:\n`)
  for (const u of updates) {
    console.log(`  ${u.name}`)
    console.log(`    city:  '${u.oldCity}' -> 'Moreno Valley'`)
    console.log(`    state: '${u.oldState}' -> 'CA'`)
    console.log(`    zip:   '${u.oldZip}' -> '${u.newZip}'`)
  }

  if (updates.length === 0) {
    console.log('\nNothing to fix. Exiting.')
    await pool.end()
    return
  }

  let fixed = 0
  let errors = 0
  for (const u of updates) {
    try {
      await pool.query(
        `UPDATE "Business" SET city = 'Moreno Valley', state = 'CA', zip = $1 WHERE id = $2`,
        [u.newZip || '', u.id]
      )
      console.log(`OK  ${u.name}`)
      fixed++
    } catch (err) {
      console.error(`ERR ${u.name}: ${err.message}`)
      errors++
    }
  }

  console.log(`\nDone. ${fixed} fixed, ${errors} errors.`)
  await pool.end()
}

main().catch(async err => {
  console.error('Fatal:', err)
  await pool.end()
  process.exit(1)
})
