/**
 * seed-best-of.js
 * Seeds BestOfCategory award categories and BestOfEntry records for approved businesses.
 * Run: node scripts/seed-best-of.js
 *
 * BestOfCategory rows are the "award" categories (e.g. "Best Tacos", "Best Coffee").
 * BestOfEntry rows link an approved Business to a BestOfCategory with editorial scores.
 * Composite scoring and per-factor BestOfScore rows are computed server-side by
 * src/lib/best-of-score.ts — this script pre-populates editorial fields so
 * scoring can run deterministically.
 */

const { Pool } = require('pg')
const fs = require('fs')

// ── Env ────────────────────────────────────────────────────────────────────────

const lines = fs.readFileSync('./.env.live', 'utf8').split('\n')
const get = k => lines.find(l => l.startsWith(k + '='))?.split('=').slice(1).join('=').replace(/"/g, '').trim() ?? ''
const DATABASE_URL = get('DATABASE_URL')
const GOOGLE_PLACES_API_KEY = get('GOOGLE_PLACES_API_KEY') || get('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY') || ''

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Tiny cuid-like generator compatible with Prisma's cuid format */
let _counter = 0
function cuid() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  const counter = (_counter++).toString(36)
  return 'c' + timestamp + random + counter
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// ── Award categories to seed ────────────────────────────────────────────────────

const BEST_OF_CATEGORIES = [
  {
    name: 'Best Tacos',
    slug: 'best-tacos',
    description: 'Moreno Valley\'s top taco spots — from authentic street tacos to creative fusion.',
    icon: 'Taco',
    query: 'tacos in Moreno Valley CA',
  },
  {
    name: 'Best Coffee',
    slug: 'best-coffee',
    description: 'Local coffee shops and cafes serving the best brews in Moreno Valley.',
    icon: 'Coffee',
    query: 'coffee shops in Moreno Valley CA',
  },
  {
    name: 'Best Burgers',
    slug: 'best-burgers',
    description: 'Juicy, flavorful burgers that keep locals coming back.',
    icon: 'Beef',
    query: 'burgers in Moreno Valley CA',
  },
  {
    name: 'Best Pizza',
    slug: 'best-pizza',
    description: 'From New York fold to Chicago deep-dish — Moreno Valley\'s best pizza.',
    icon: 'Pizza',
    query: 'pizza in Moreno Valley CA',
  },
  {
    name: 'Best Mexican Food',
    slug: 'best-mexican-food',
    description: 'Authentic Mexican cuisine: burritos, tamales, enmoladas, and more.',
    icon: 'UtensilsCrossed',
    query: 'Mexican restaurants in Moreno Valley CA',
  },
  {
    name: 'Best Auto Repair',
    slug: 'best-auto-repair',
    description: 'Trustworthy mechanics and repair shops keeping Moreno Valley moving.',
    icon: 'Wrench',
    query: 'auto repair in Moreno Valley CA',
  },
  {
    name: 'Best Salon & Barbershop',
    slug: 'best-salon-barbershop',
    description: 'Top-rated hair salons and barbershops in Moreno Valley.',
    icon: 'Scissors',
    query: 'hair salon in Moreno Valley CA',
  },
  {
    name: 'Best Plumbing',
    slug: 'best-plumbing',
    description: 'Reliable plumbers Moreno Valley residents count on.',
    icon: 'Droplets',
    query: 'plumber in Moreno Valley CA',
  },
  {
    name: 'Best Landscaping',
    slug: 'best-landscaping',
    description: 'Outdoor space transformation by Moreno Valley\'s best landscapers.',
    icon: 'Trees',
    query: 'landscaping in Moreno Valley CA',
  },
  {
    name: 'Best Real Estate',
    slug: 'best-real-estate',
    description: 'Top-producing realtors and mortgage pros in Moreno Valley.',
    icon: 'Building',
    query: 'real estate agent in Moreno Valley CA',
  },
  {
    name: 'Best Veterinary Care',
    slug: 'best-veterinary',
    description: 'Compassionate, skilled vet care for Moreno Valley pets.',
    icon: 'PawPrint',
    query: 'veterinarian in Moreno Valley CA',
  },
  {
    name: 'Best Physical Therapy',
    slug: 'best-physical-therapy',
    description: 'Recovery and rehabilitation experts in Moreno Valley.',
    icon: 'Activity',
    query: 'physical therapy in Moreno Valley CA',
  },
]

// ── Editorial score overrides (businessName -> scores) ─────────────────────────
// Keys must match the business name in the database exactly.
// Scores are 0–10 each: localOwnership, uniqueness, communityInvolvement, personalVisitReview.
// If a business is not in this map, it receives default scores of 3 for each factor.
const EDITORIAL_SCORES = {
  // Example:
  // 'El Cerrito Mexican Food': { localOwnership: 10, uniqueness: 8, communityInvolvement: 7, personalVisitReview: 9 },
}

const DEFAULT_EDITORIAL = { localOwnership: 3, uniqueness: 3, communityInvolvement: 3, personalVisitReview: 3 }

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to database...')
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // ── 1. Upsert BestOfCategory rows ────────────────────────────────────────
    console.log('\nSeeding BestOfCategory rows...')
    const categoryIds = {}

    for (const cat of BEST_OF_CATEGORIES) {
      const existing = await pool.query(
        'SELECT id FROM "BestOfCategory" WHERE slug = $1',
        [cat.slug],
      )

      let categoryId
      if (existing.rows.length > 0) {
        categoryId = existing.rows[0].id
        await pool.query(
          `UPDATE "BestOfCategory" SET name = $1, description = $2, icon = $3, query = $4, "updatedAt" = NOW()
           WHERE id = $5`,
          [cat.name, cat.description, cat.icon, cat.query, categoryId],
        )
        console.log('  updated: ' + cat.name)
      } else {
        categoryId = cuid()
        await pool.query(
          `INSERT INTO "BestOfCategory" (id, name, slug, description, icon, query, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [categoryId, cat.name, cat.slug, cat.description, cat.icon, cat.query],
        )
        console.log('  created: ' + cat.name)
      }
      categoryIds[cat.slug] = categoryId
    }

    // ── 2. Fetch all APPROVED businesses with Google data ────────────────────
    console.log('\nFetching approved businesses...')
    const bizResult = await pool.query(`
      SELECT b.id, b.name, b."googleRating", b."googleReviewCount",
             b."createdAt", b.address, b.city
      FROM "Business" b
      WHERE b.status = 'APPROVED'
    `)
    const businesses = bizResult.rows
    console.log('  ' + businesses.length + ' approved businesses found')

    if (businesses.length === 0) {
      console.log('No approved businesses to seed. Exiting.')
      return
    }

    // ── 3. Map businesses to BestOfCategory by keyword tag in name/address ────
    // Each BestOfCategory maps to one or more keyword tags that indicate relevance.
    const CATEGORY_KEYWORDS = {
      'best-tacos':        ['taco', 'tacos', 'mexican', 'carnitas', 'burrito', 'tortilla'],
      'best-coffee':       ['coffee', 'cafe', 'espresso', 'boba', 'tea', 'bakery', 'donut'],
      'best-burgers':      ['burger', 'burgers', 'grill', 'diner', 'American'],
      'best-pizza':        ['pizza', 'pizzeria', 'pie'],
      'best-mexican-food': ['mexican', 'taco', 'burrito', 'enchilada', 'carnitas', 'chimichanga', 'tamale', 'pozole'],
      'best-auto-repair':  ['auto', 'automotive', 'repair', 'tire', 'mechanic', 'transmission', 'brake', 'oil change'],
      'best-salon-barbershop': ['salon', 'hair', 'barber', 'beauty', 'spa', 'nail', 'wax'],
      'best-plumbing':     ['plumb', 'rooter', 'water heater', 'drain'],
      'best-landscaping':  ['landscap', 'lawn', 'garden', 'tree'],
      'best-real-estate':  ['real estate', 'realtor', 'mortgage', 'broker'],
      'best-veterinary':   ['vet', 'pet', 'animal', 'dog', 'cat'],
      'best-physical-therapy': ['physical therapy', 'rehab', 'physio', 'chiropract'],
    }

    function businessMatchesCategory(biz, categorySlug) {
      const keywords = CATEGORY_KEYWORDS[categorySlug] || []
      const haystack = ((biz.name || '') + ' ' + (biz.address || '')).toLowerCase()
      return keywords.some(kw => haystack.includes(kw))
    }

    // ── 4. Compute yearsActive for each business ────────────────────────────
    function yearsActive(createdAt) {
      if (!createdAt) return 0
      const msPerYear = 365.25 * 24 * 60 * 60 * 1000
      return (Date.now() - new Date(createdAt).getTime()) / msPerYear
    }

    // ── 5. Upsert BestOfEntry for each business × applicable category ─────────
    console.log('\nSeeding BestOfEntry rows...')

    let entriesCreated = 0
    let entriesUpdated = 0
    let entriesSkipped = 0

    for (const biz of businesses) {
      const bizCategories = BEST_OF_CATEGORIES.filter(cat =>
        businessMatchesCategory(biz, cat.slug),
      )

      if (bizCategories.length === 0) {
        // Default: assign every business to all categories it didn't match
        // (BestOfEntry has unique constraint per business+category, so this is safe)
        // Actually we skip unmatched to avoid diluting quality — only assign to relevant cats
        entriesSkipped++
        continue
      }

      for (const cat of bizCategories) {
        const categoryId = categoryIds[cat.slug]
        const editorial = EDITORIAL_SCORES[biz.name] || DEFAULT_EDITORIAL
        const yrs = yearsActive(biz.createdAt)
        const googleRating = biz.googleRating ?? 0
        const googleReviewCount = biz.googleReviewCount ?? 0

        // Compute composite score using the same formula as src/lib/best-of-score.ts
        const composite = computeComposite({
          googleRating,
          googleReviewCount,
          yearsActive: yrs,
          ...editorial,
        })

        const existing = await pool.query(
          'SELECT id FROM "BestOfEntry" WHERE "businessId" = $1 AND "categoryId" = $2',
          [biz.id, categoryId],
        )

        if (existing.rows.length > 0) {
          // Update scores only — preserve existing rank if set
          await pool.query(
            `UPDATE "BestOfEntry" SET
               "localOwnership" = $1,
               "uniqueness" = $2,
               "communityInvolvement" = $3,
               "personalVisitReview" = $4,
               "googleRating" = $5,
               "googleReviewCount" = $6,
               "yearsActive" = $7,
               "compositeScore" = $8,
               "updatedAt" = NOW()
             WHERE id = $9`,
            [
              editorial.localOwnership,
              editorial.uniqueness,
              editorial.communityInvolvement,
              editorial.personalVisitReview,
              googleRating,
              googleReviewCount,
              Math.round(yrs * 100) / 100,
              composite,
              existing.rows[0].id,
            ],
          )
          entriesUpdated++
        } else {
          const entryId = cuid()
          await pool.query(
            `INSERT INTO "BestOfEntry"
               (id, "categoryId", "businessId", "localOwnership", "uniqueness",
                "communityInvolvement", "personalVisitReview", "googleRating",
                "googleReviewCount", "yearsActive", "compositeScore", "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
            [
              entryId,
              categoryId,
              biz.id,
              editorial.localOwnership,
              editorial.uniqueness,
              editorial.communityInvolvement,
              editorial.personalVisitReview,
              googleRating,
              googleReviewCount,
              Math.round(yrs * 100) / 100,
              composite,
            ],
          )

          // Seed per-factor BestOfScore rows for this entry
          await seedBestOfScores(pool, entryId, {
            googleRating,
            googleReviewCount,
            yearsActive: yrs,
            ...editorial,
          })

          entriesCreated++
        }
      }
    }

    // ── 6. Assign ranks within each category by compositeScore desc ──────────
    console.log('\nAssigning ranks...')
    for (const cat of BEST_OF_CATEGORIES) {
      const categoryId = categoryIds[cat.slug]
      const result = await pool.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "compositeScore" DESC NULLS LAST) AS rank
          FROM "BestOfEntry"
          WHERE "categoryId" = $1
        )
        UPDATE "BestOfEntry" e SET rank = r.rank
        FROM ranked r
        WHERE e.id = r.id AND e.rank IS DISTINCT FROM r.rank
      `, [categoryId])
      if (result.rowCount > 0) {
        console.log('  ' + cat.name + ': ranked ' + result.rowCount + ' entries')
      }
    }

    console.log('\nDone.')
    console.log('  Entries created : ' + entriesCreated)
    console.log('  Entries updated : ' + entriesUpdated)
    console.log('  Businesses skipped (no matching category): ' + entriesSkipped)
  } finally {
    await pool.end()
  }
}

// ── Composite score (mirrors src/lib/best-of-score.ts) ────────────────────────

const FACTOR_WEIGHTS = {
  googleRating:          0.20,
  googleReviewCount:     0.15,
  yearsActive:           0.15,
  localOwnership:        0.10,
  uniqueness:            0.15,
  communityInvolvement:  0.10,
  personalVisitReview:   0.15,
}

function computeScores(entry, categoryMax) {
  const factors = []
  let composite = 0

  // googleRating: 0–5 → 0–20
  const gRating = entry.googleRating ?? 0
  factors.push({ factor: 'googleRating', rawValue: gRating, weight: 0.20, normalizedScore: (gRating / 5) * 20 })
  composite += (gRating / 5) * 20

  // googleReviewCount: relative → 0–15
  const reviewCount = entry.googleReviewCount ?? 0
  const maxReviews = categoryMax.maxReviews || 1
  const reviewNorm = (Math.min(reviewCount, maxReviews) / maxReviews) * 15
  factors.push({ factor: 'googleReviewCount', rawValue: reviewCount, weight: 0.15, normalizedScore: reviewNorm })
  composite += reviewNorm

  // yearsActive: relative → 0–15
  const years = entry.yearsActive ?? 0
  const maxYears = categoryMax.maxYears || 1
  const yearsNorm = (Math.min(years, maxYears) / maxYears) * 15
  factors.push({ factor: 'yearsActive', rawValue: years, weight: 0.15, normalizedScore: yearsNorm })
  composite += yearsNorm

  // Editorial scores: 0–10 → weighted
  for (const factor of ['localOwnership', 'uniqueness', 'communityInvolvement', 'personalVisitReview']) {
    const raw = entry[factor] ?? 0
    const weight = FACTOR_WEIGHTS[factor]
    const norm = (raw / 10) * (weight * 100)
    factors.push({ factor, rawValue: raw, weight, normalizedScore: norm })
    composite += norm
  }

  return { factors, composite: Math.round(composite * 100) / 100 }
}

function computeComposite(entry) {
  // Use placeholder maxes (1) since we don't compute per-category relative scores here
  const { composite } = computeScores(entry, { maxReviews: 1, maxYears: 1 })
  return composite
}

async function seedBestOfScores(pool, entryId, entry) {
  const { factors, composite } = computeScores(entry, { maxReviews: 1, maxYears: 1 })

  // Delete existing score rows and replace
  await pool.query('DELETE FROM "BestOfScore" WHERE "entryId" = $1', [entryId])

  for (const f of factors) {
    await pool.query(
      `INSERT INTO "BestOfScore" (id, "entryId", factor, "rawValue", weight, "createdAt")
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [cuid(), entryId, f.factor, f.rawValue, f.weight],
    )
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
