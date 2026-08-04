#!/bin/bash
# Delete ONE of each pair of duplicate BestOfScore records
# Strategy: Keep the record with the larger (newer) id, delete the rest
# Run via: node --env-file=.env.live fix-dupes.cjs

import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  // Get distinct entryIds that have duplicates
  const dupes = await pool.query(`
    SELECT "entryId", factor, array_agg(id ORDER BY id) as ids, count(*) as cnt
    FROM "BestOfScore"
    GROUP BY "entryId", factor
    HAVING COUNT(*) > 1
  `)
  
  console.log('Duplicate groups:', dupes.rowCount)
  
  let totalDeleted = 0
  for (const row of dupes.rows) {
    // Keep the last (newest by sort order), delete the rest
    const toDelete = row.ids.slice(0, -1)
    const del = await pool.query(`DELETE FROM "BestOfScore" WHERE id = ANY($1)`, [toDelete])
    totalDeleted += del.rowCount
    if (totalDeleted % 100 === 0) console.log('Deleted', totalDeleted, 'so far...')
  }
  
  console.log('Total deleted:', totalDeleted)
  
  // Verify
  const remaining = await pool.query(`SELECT count(*) as cnt FROM "BestOfScore"`)
  console.log('Remaining BestOfScore records:', remaining.rows[0].cnt)
  
  const sample = await pool.query(`
    SELECT bs.factor, bs."rawValue"
    FROM "BestOfScore" bs
    JOIN "BestOfEntry" be ON be.id = bs."entryId"
    JOIN "Business" b ON b.id = be."businessId"
    WHERE b.name = 'Loco Burrito'
    ORDER BY bs.factor
  `)
  console.log('\nLoco Burrito after cleanup:')
  sample.rows.forEach(r => console.log(' ', r.factor, ':', r.rawValue))
  
  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
