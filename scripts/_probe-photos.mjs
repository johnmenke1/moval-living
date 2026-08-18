// Probe: what photos does Google Places actually return, and what flags tell us
// "this one is the logo" vs "this one is a generic business photo"?
// Hits the real Places Details endpoint for 3 known place_ids from your DB.
import { readFileSync } from 'node:fs'

const lines = readFileSync('C:/Projects/websites/moval-living/.env.local', 'utf8').split('\n')
const get = k => { const l = lines.find(x => x.startsWith(k+'=')); if (!l) return ''; let v = l.split('=').slice(1).join('=').trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1); return v; }
const KEY = get('GOOGLE_PLACES_API_KEY')

// Pick 3 place_ids we already have, with known variety:
//   1) a row that already has a logo URL in DB (ASI Insurance)
//   2) a row with no logo (Rate Trac Mortgage)
//   3) a popular category — restaurant (M.V. has many)
const poolModule = await import('pg')
const pool = new poolModule.default.Pool({ connectionString: get('DATABASE_URL'), ssl: { rejectUnauthorized: false } })
const sample = await pool.query(
  `SELECT name, "googleBusiness" FROM "Business"
   WHERE "googleBusiness" IS NOT NULL
   ORDER BY RANDOM() LIMIT 3`
)
await pool.end()
console.log('Probing 3 real businesses:')
for (const r of sample.rows) console.log('  -', r.name, '|', r.googleBusiness)

for (const r of sample.rows) {
  const placeId = r.googleBusiness
  const url = `https://places.googleapis.com/v1/places/${placeId}`
  const mask = 'id,displayName,photos'
  const res = await fetch(url, { headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': mask } })
  if (!res.ok) {
    console.log(`\n${r.name} → HTTP ${res.status}: ${(await res.text()).slice(0,200)}`)
    continue
  }
  const data = await res.json()
  console.log(`\n=== ${r.name} (${placeId}) ===`)
  const photos = data.photos || []
  console.log(`  ${photos.length} photos returned`)
  for (let i = 0; i < Math.min(photos.length, 5); i++) {
    const p = photos[i]
    console.log(`  photo[${i}]:`)
    console.log('    name:', p.name)
    console.log('    widthPx:', p.widthPx, ' heightPx:', p.heightPx)
    console.log('    flagContentUri present?', !!p.flagContentUri)
    console.log('    googleMapsUri:', p.googleMapsUri)
    console.log('    authorAttributions:', JSON.stringify(p.authorAttributions)?.slice(0, 120))
  }
  if (photos.length === 0) console.log('  (zero photos returned for this business)')
  await new Promise(r => setTimeout(r, 400))
}