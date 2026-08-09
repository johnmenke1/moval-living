// Follow-up migration: extra business reassignments made by Molly on
// 2026-08-09 AFTER Emma's commit "ade7828 Add Churches and Property
// Management; split Auto into Repair + Dealers". Emma's commit moved
// 8 strip-mall/PM firms (all from "Other") and 14 obvious dealers;
// this script captured the rest of the moves that landed in the live
// DB during the same session.
//
// Idempotent. The DB is already in the target state this script aims
// for — running it again is a no-op. The script is preserved here as
// a paper trail of the moves.
//
// Verified against: live DB scan 2026-08-09.
const { Client } = require('pg')

// --- Additional Auto Dealer reclassifications (7) ----------------------------
// Brand-name businesses that Emma's commit left in 'automotive' because the
// name doesn't say "dealership" or "sales" but it names a brand.
const AUTO_DEALERS_EXTRA = [
  'Fusion Motors Inc',
  'Highgrove Autos',
  'Katana Motors',
  'King City Auto Traders',
  'Kml Motors Inc.',
  'Redz Auto House',
  'Riverside Auto Market',
]

// --- Additional Property Management moves (9) --------------------------------
// Emma's commit only moved the 8 PM firms from 'other'. These 9 were
// scattered in 'retail' (6 strip-mall listings) and 'real-estate'
// (2 apartment complexes + 1 PM firm).
const PROPERTY_MGMT_EXTRA = [
  // 6 strip-mall/shopping-center listings in 'retail'
  'Lakeside Plaza',
  'Moreno Beach Plaza',
  'Moreno Valley Plaza',
  'Mountain Grove Shopping Center',
  'Sunnymead Plaza Shopping Center',
  'Westgate Shopping Center',
  // 2 apartment complexes in 'real-estate'
  'Perris Isle Senior Apartment',
  'Via Del Lago Apartment Homes',
  // 1 real-estate firm that explicitly does property management
  'Amanica Real Estate & Property Management',
]

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  await c.query('BEGIN')
  try {
    // Look up the category IDs (assumes Emma's commit + the first-round
    // migration already inserted them).
    const cats = await c.query(
      `SELECT id, slug FROM "Category" WHERE slug IN ('auto-dealers','property-management')`,
    )
    const bySlug = Object.fromEntries(cats.rows.map((r) => [r.slug, r.id]))
    if (!bySlug['auto-dealers'] || !bySlug['property-management']) {
      throw new Error('Expected categories not found — run Emma\'s seed first')
    }

    async function move(slug, names) {
      const r = await c.query(
        `UPDATE "Business" SET "categoryId"=$1
         WHERE name = ANY($2::text[])
         RETURNING name`,
        [bySlug[slug], names],
      )
      console.log(`  ${slug}: ${r.rowCount} moved`)
      for (const row of r.rows) console.log(`    - ${row.name}`)
      return r.rowCount
    }
    await move('auto-dealers', AUTO_DEALERS_EXTRA)
    await move('property-management', PROPERTY_MGMT_EXTRA)

    await c.query('COMMIT')
    console.log('  done (idempotent: re-running yields 0 moves)')
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
 *     SELECT id FROM "Category" WHERE slug='automotive'
 *   ) WHERE name = ANY(ARRAY[
 *     'Fusion Motors Inc','Highgrove Autos','Katana Motors',
 *     'King City Auto Traders','Kml Motors Inc.','Redz Auto House',
 *     'Riverside Auto Market'
 *   ]);
 *
 *   UPDATE "Business" SET "categoryId"=COALESCE(
 *     (SELECT id FROM "Category" WHERE slug='retail'),
 *     (SELECT id FROM "Category" WHERE slug='real-estate'),
 *     (SELECT id FROM "Category" WHERE slug='other')
 *   )
 *   WHERE name = ANY(ARRAY[
 *     'Lakeside Plaza','Moreno Beach Plaza','Moreno Valley Plaza',
 *     'Mountain Grove Shopping Center','Sunnymead Plaza Shopping Center',
 *     'Westgate Shopping Center','Perris Isle Senior Apartment',
 *     'Via Del Lago Apartment Homes','Amanica Real Estate & Property Management'
 *   ]);
 */
