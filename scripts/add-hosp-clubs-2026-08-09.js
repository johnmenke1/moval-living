// One-shot migration: add Hospitality + Service Clubs top-level categories
// and reassign the obvious hotel + service-club businesses.
//
// Idempotent. Run from the worktree with .env.local sourced.
//
// Verified to match: live DB scan on 2026-08-09 (script: live-business-audit-2026-08-09.js)
const { Client } = require('pg')

const HOTEL_NAMES = [
  'Fairfield Inn & Suites',
  'Hampton Inn & Suites Moreno Valley',
  'La Quinta Inn & Suites',
  'MainStay Suites',
  'WoodSpring Suites',
  'Ayres Hotel & Spa Moreno Valley',
]

const CLUB_NAMES = [
  'Rotary Club of Moreno Valley',
  'Moreno Valley Elks Lodge #2697',
  'Morning Optimist of MV',
  'Soroptimist International of MV',
  'Dawn Busters Toastmasters Club 2169',
]

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  await c.query('BEGIN')
  try {
    const hosp = await c.query(`
      INSERT INTO "Category"(id, slug, name, description, icon)
      VALUES (gen_random_uuid()::text, 'hospitality', 'Hospitality',
              'Hotels, motels, inns, and extended-stay lodging', 'Hotel')
      ON CONFLICT (slug) DO UPDATE
        SET name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon
      RETURNING id, slug
    `)
    const clubs = await c.query(`
      INSERT INTO "Category"(id, slug, name, description, icon)
      VALUES (gen_random_uuid()::text, 'service-clubs', 'Service Clubs',
              'Rotary, Lions, Kiwanis, Optimist, Elks, and similar community service clubs', 'Handshake')
      ON CONFLICT (slug) DO UPDATE
        SET name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon
      RETURNING id, slug
    `)
    console.log('  hospitality ->', hosp.rows[0])
    console.log('  service-clubs ->', clubs.rows[0])

    const hUpd = await c.query(
      `UPDATE "Business" SET "categoryId"=$1
       WHERE name = ANY($2::text[])
       RETURNING id, name`,
      [hosp.rows[0].id, HOTEL_NAMES],
    )
    console.log(`  hotels moved: ${hUpd.rowCount}`)
    for (const r of hUpd.rows) console.log('    -', r.name)

    const sUpd = await c.query(
      `UPDATE "Business" SET "categoryId"=$1
       WHERE name = ANY($2::text[])
       RETURNING id, name`,
      [clubs.rows[0].id, CLUB_NAMES],
    )
    console.log(`  service clubs moved: ${sUpd.rowCount}`)
    for (const r of sUpd.rows) console.log('    -', r.name)

    await c.query('COMMIT')

    const verify = await c.query(`
      SELECT c.slug, c.name, COUNT(b.id)::int AS n
      FROM "Category" c LEFT JOIN "Business" b ON b."categoryId"=c.id
      WHERE c.slug IN ('hospitality','service-clubs','insurance','dispensaries')
      GROUP BY c.id ORDER BY c.name
    `)
    console.log('  ---')
    console.log('  VERIFY:')
    for (const r of verify.rows) console.log(`    [${r.slug}] ${r.name}: ${r.n} business(es)`)
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
