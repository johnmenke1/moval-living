/**
 * seed-businesses-from-google.js
 * Bulk-imports businesses from Google Places into the moval.living database.
 * Run: node scripts/seed-businesses-from-google.js
 */

const { Pool } = require('pg')
const { nanoid } = require('nanoid')
const fs = require('fs')

// Load DATABASE_URL and GOOGLE_PLACES_API_KEY from .env.local
const lines = fs.readFileSync('./.env.local', 'utf8').split('\n')
const get = k => lines.find(l => l.startsWith(k + '='))?.split('=').slice(1).join('=').trim() ?? ''
const DATABASE_URL = get('DATABASE_URL')
const GOOGLE_PLACES_API_KEY = get('GOOGLE_PLACES_API_KEY') || process.env.GOOGLE_PLACES_API_KEY

if (!DATABASE_URL) { console.error('DATABASE_URL not found in .env.local'); process.exit(1) }
if (!GOOGLE_PLACES_API_KEY) { console.error('GOOGLE_PLACES_API_KEY not set in .env.local'); process.exit(1) }

const CATEGORY_QUERIES = [
  { slug: 'restaurants', queries: ['restaurants in Moreno Valley CA', 'restaurants near Moreno Valley CA'] },
  { slug: 'retail', queries: ['retail stores in Moreno Valley CA', 'shopping in Moreno Valley CA'] },
  { slug: 'automotive', queries: ['auto repair in Moreno Valley CA', 'car dealers in Moreno Valley CA'] },
  { slug: 'healthcare', queries: ['doctors in Moreno Valley CA', 'medical clinics in Moreno Valley CA'] },
  { slug: 'beauty', queries: ['salons in Moreno Valley CA', 'spas in Moreno Valley CA'] },
  { slug: 'home-services', queries: ['home services in Moreno Valley CA', 'plumbers electricians Moreno Valley CA'] },
  { slug: 'contractors', queries: ['general contractors in Moreno Valley CA', 'construction companies Moreno Valley CA'] },
  { slug: 'professional', queries: ['lawyers in Moreno Valley CA', 'accountants in Moreno Valley CA'] },
  { slug: 'finance', queries: ['banks in Moreno Valley CA', 'financial services Moreno Valley CA'] },
  { slug: 'education', queries: ['tutoring in Moreno Valley CA', 'schools in Moreno Valley CA'] },
  { slug: 'pets', queries: ['veterinarians in Moreno Valley CA', 'pet stores Moreno Valley CA'] },
  { slug: 'real-estate', queries: ['realtors in Moreno Valley CA', 'real estate agents Moreno Valley CA'] },
]

function parseAddress(address) {
  const parts = address.split(',').map(p => p.trim())
  let city = 'Moreno Valley', state = 'CA', zip = '', street = address
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    const zm = last.match(/\d{5}/); if (zm) zip = zm[0]
    const sm = last.match(/[A-Z]{2}/); if (sm) state = sm[0]
    if (parts.length >= 3) city = parts[parts.length - 2].replace(/, USA$/, '').trim()
    street = parts[0]
  }
  return { street, city, state, zip }
}

function formatTime(time) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return hour + ':' + String(m).padStart(2, '0') + ' ' + ampm
}

function parseOpeningHours(roh) {
  if (!roh || !roh.periods || !roh.periods.length) return null
  const dm = { MONDAY:'mon', TUESDAY:'tue', WEDNESDAY:'wed', THURSDAY:'thu', FRIDAY:'fri', SATURDAY:'sat', SUNDAY:'sun' }
  const r = {}
  for (const p of roh.periods) {
    const d = p.openDay ? dm[p.openDay] : null
    if (!d) continue
    r[d] = {
      open: p.openTime ? formatTime(p.openTime) : '9:00 AM',
      close: p.closeTime ? formatTime(p.closeTime) : '5:00 PM',
      closed: false,
    }
  }
  return Object.keys(r).length > 0 ? r : null
}

async function searchPlaces(query) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': '*' },
    body: JSON.stringify({
      textQuery: query,
      locationBias: { circle: { center: { latitude: 33.9425, longitude: -117.2280 }, radius: 20000 } },
      pageSize: 20,
    }),
  })
  if (!res.ok) { console.warn('  WARN: Places API ' + res.status); return [] }
  const data = await res.json()
  return (data.places || []).map(p => ({
    placeId: p.id,
    name: p.displayName ? p.displayName.text : '',
    address: p.formattedAddress || '',
    phone: p.nationalPhoneNumber || '',
    website: p.website || '',
    hours: parseOpeningHours(p.regularOpeningHours),
    location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
  }))
}

async function main() {
  console.log('Connecting to database...')
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

  const catResult = await pool.query('SELECT id, slug FROM "Category"')
  const catBySlug = Object.fromEntries(catResult.rows.map(r => [r.slug, r.id]))

  const existing = await pool.query('SELECT "googleBusiness" FROM "Business" WHERE "googleBusiness" IS NOT NULL')
  const imported = new Set(existing.rows.map(r => r.googleBusiness))
  console.log(imported.size + ' businesses already imported, will skip those\n')

  let totalAdded = 0, totalSkipped = 0, totalErrors = 0

  for (const { slug, queries } of CATEGORY_QUERIES) {
    const categoryId = catBySlug[slug]
    if (!categoryId) { console.warn('No DB category for "' + slug + '", skipping'); continue }
    console.log('[' + slug + ']')
    const seen = new Set()

    for (const query of queries) {
      process.stdout.write('  searching "' + query + '"... ')
      const places = await searchPlaces(query)
      console.log(places.length + ' results')
      let added = 0, skipped = 0

      for (const place of places) {
        if (!place.name || !place.address) continue
        if (seen.has(place.placeId) || imported.has(place.placeId)) { skipped++; totalSkipped++; continue }
        seen.add(place.placeId)
        const parsed = parseAddress(place.address)
        const base = place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const finalSlug = base + '-' + nanoid(6)
        try {
          await pool.query(
            'INSERT INTO "Business" (slug, name, "categoryId", address, city, state, zip, phone, website, description, "googleBusiness", latitude, longitude, hours, photos, status, tier) ' +
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'APPROVED','FREE')",
            [
              finalSlug, place.name, categoryId, parsed.street, parsed.city, parsed.state, parsed.zip,
              place.phone || null, place.website || null,
              'Business information for ' + place.name + ' in ' + parsed.city + ', ' + parsed.state + '.',
              place.placeId, place.location ? place.location.lat : null, place.location ? place.location.lng : null,
              place.hours ? JSON.stringify(place.hours) : null, [],
            ]
          )
          added++; totalAdded++
        } catch (err) {
          if (err.code === '23505') { skipped++; totalSkipped++ }
          else { console.warn('\n    ERROR "' + place.name + '": ' + err.message); totalErrors++ }
        }
      }
      if (added || skipped) console.log('    +' + added + ' added, ' + skipped + ' skipped')
      await new Promise(r => setTimeout(r, 300))
    }
  }

  console.log('\nDone: +' + totalAdded + ' added, ' + totalSkipped + ' skipped (dupes), ' + totalErrors + ' errors')
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
