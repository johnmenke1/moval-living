// 2026-08-09 round 5: add Supply & Logistics category and move 6
// businesses from 'other' that fit the new category.
//
// Idempotent. Live DB will have the new category after the first
// run; subsequent runs move 0 businesses.
const { Client } = require('pg')

const SUPPLY_LOGISTICS = [
  'Harbor Freight Tools',        // tools/supplies retailer
  'ROSS Distribution Center',     // distribution center
  'Toolots Foreign Trade Zone',   // foreign trade zone logistics
  'NFI Industries',               // trucking & logistics
  'SuperStorage',                 // self-storage
  'United Material Handling, Inc.', // forklifts / MHE
]

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  await c.query('BEGIN')
  try {
    const cat = await c.query(`
      INSERT INTO "Category"(id, slug, name, description, icon)
      VALUES (gen_random_uuid()::text, 'supply-logistics', 'Supply & Logistics',
              'Trucking, warehousing, distribution, foreign trade zones, material handling, and wholesale supply',
              'Truck')
      ON CONFLICT (slug) DO UPDATE
        SET name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon
      RETURNING id
    `)
    console.log('  supply-logistics category upserted')

    const r = await c.query(
      `UPDATE "Business" SET "categoryId"=$1
       WHERE name = ANY($2::text[]) AND "categoryId" != $1
       RETURNING name`,
      [cat.rows[0].id, SUPPLY_LOGISTICS],
    )
    console.log(`  supply-logistics: ${r.rowCount} moved`)
    for (const row of r.rows) console.log(`    - ${row.name}`)

    await c.query('COMMIT')

    const verify = await c.query(`
      SELECT c.slug, c.name, COUNT(b.id)::int AS n
      FROM "Category" c LEFT JOIN "Business" b ON b."categoryId"=c.id
      WHERE c.slug IN ('supply-logistics','other')
      GROUP BY c.id ORDER BY c.name
    `)
    console.log('  ---')
    console.log('  VERIFY:')
    for (const v of verify.rows) console.log(`    [${v.slug}] ${v.name}: ${v.n}`)
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

/*
 * ROLLBACK (run by hand if needed):
 *
 *   UPDATE "Business" SET "categoryId"=(
 *     SELECT id FROM "Category" WHERE slug='other'
 *   ) WHERE name = ANY(ARRAY[
 *     'Harbor Freight Tools','ROSS Distribution Center',
 *     'Toolots Foreign Trade Zone','NFI Industries',
 *     'SuperStorage','United Material Handling, Inc.'
 *   ]);
 */
