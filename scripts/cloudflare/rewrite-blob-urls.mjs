#!/usr/bin/env node
/**
 * Rewrite Vercel Blob URLs to the R2 public host across every text, text[],
 * json and jsonb column in the public schema.
 *
 *   DATABASE_URL=... node scripts/cloudflare/rewrite-blob-urls.mjs           # dry run (counts only)
 *   DATABASE_URL=... node scripts/cloudflare/rewrite-blob-urls.mjs --apply   # perform the rewrite
 *
 * Idempotent: rows already pointing at the new host are untouched. Run the
 * files copy (Vercel Blob -> R2 moval-media, same keys) first.
 */
import pg from 'pg'

const apply = process.argv.includes('--apply')
const NEW_HOST = process.env.R2_PUBLIC_URL || 'https://media.moval.living'
const OLD_RE = String.raw`https://[a-z0-9]+\.public\.blob\.vercel-storage\.com`
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const { rows: cols } = await client.query(`
  select table_name t, column_name c, data_type d, udt_name u
  from information_schema.columns
  where table_schema = 'public' and (data_type in ('text','character varying','json','jsonb')
        or (data_type = 'ARRAY' and udt_name in ('_text','_varchar')))`)

let total = 0
for (const { t, c, d } of cols) {
  const q = `"${t.replace(/"/g, '""')}"`, col = `"${c.replace(/"/g, '""')}"`
  const isArr = d === 'ARRAY', isJson = d === 'json' || d === 'jsonb'
  const probe = isArr ? `array_to_string(${col}, ' ')` : `${col}::text`
  const { rows } = await client.query(`select count(*)::int n from ${q} where ${probe} ~ $1`, [OLD_RE])
  const n = rows[0].n
  if (!n) continue
  total += n
  console.log(`${apply ? 'rewriting' : 'would rewrite'} ${n} rows: ${t}.${c}`)
  if (!apply) continue
  if (isArr) {
    await client.query(
      `update ${q} set ${col} = array(select regexp_replace(x, $1, $2, 'g') from unnest(${col}) x) where ${probe} ~ $1`,
      [OLD_RE, NEW_HOST])
  } else if (isJson) {
    await client.query(
      `update ${q} set ${col} = regexp_replace(${col}::text, $1, $2, 'g')::${d} where ${probe} ~ $1`,
      [OLD_RE, NEW_HOST])
  } else {
    await client.query(`update ${q} set ${col} = regexp_replace(${col}, $1, $2, 'g') where ${probe} ~ $1`, [OLD_RE, NEW_HOST])
  }
}
console.log(`${apply ? 'rewrote' : 'dry run:'} ${total} column-rows`)
await client.end()
