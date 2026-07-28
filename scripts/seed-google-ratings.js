/**
 * seed-google-ratings.js
 * One-time script to fetch and cache googleRating + googleReviewCount
 * for all businesses that have a googleBusiness (Place ID).
 * Run: node scripts/seed-google-ratings.js
 */

const { Pool } = require('pg')
const fs = require('fs')

const lines = fs.readFileSync('./.env.local', 'utf8').split('\n')
const get = k => lines.find(l => l.startsWith(k + '='))?.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '') ?? ''
const GOOGLE_PLACES_API_KEY = get('GOOGLE_PLACES_API_KEY') || get('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')

if (!GOOGLE_PLACES_API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY not set in .env.local')
  process.exit(1)
}

const pool = new Pool({
  connectionString: get('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
})

async function fetchGoogleRating(placeId) {
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount',
        },
      }
    )
    if (!res.ok) {
      console.error(`  HTTP ${res.status} for ${placeId}`)
      return null
    }
    const data = await res.json()
    return {
      rating: data.rating ?? null,
      reviewCount: data.userRatingCount ?? null,
    }
  } catch (err) {
    console.error(`  Error for ${placeId}:`, err.message)
    return null
  }
}

async function main() {
  // Get all businesses with a googleBusiness ID
  const businesses = await pool.query(
    'SELECT id, slug, name, "googleBusiness", "googleRating", "googleReviewCount" FROM "Business" WHERE "googleBusiness" IS NOT NULL'
  )

  console.log(`Found ${businesses.rows.length} businesses with Google Place IDs`)
  console.log(`Already cached: ${businesses.rows.filter(b => b.googleRating !== null).length}`)

  let updated = 0
  let skipped = 0

  for (const biz of businesses.rows) {
    // Skip if already cached
    if (biz.googleRating !== null && biz.googleReviewCount !== null) {
      skipped++
      continue
    }

    process.stdout.write(`Fetching ${biz.name} (${biz.googleBusiness})... `)
    const result = await fetchGoogleRating(biz.googleBusiness)

    if (result) {
      await pool.query(
        'UPDATE "Business" SET "googleRating" = $1, "googleReviewCount" = $2 WHERE id = $3',
        [result.rating, result.reviewCount, biz.id]
      )
      console.log(`★ ${result.rating ?? '?'} (${result.reviewCount ?? '?'} reviews)`)
      updated++
    } else {
      console.log('FAILED')
    }

    // Be polite to the API
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped (already cached)`)
  await pool.end()
}

main().catch(err => {
  console.error(err)
  pool.end()
  process.exit(1)
})
