/**
 * import-website-backfill.mjs
 *
 * One-shot import of Claude's website lookups from
 * scratch/moval-website-search-results.csv into Business.website.
 *
 * Joins on Business.name (smart-quote normalized + case-insensitive).
 * Joins can include duplicates (Cafe Gossip has 2 Moreno Valley
 * locations; Claude gave one website URL — both rows get it, since
 * Claude didn't disambiguate by address).
 *
 * Confidence policy:
 *   - high       → write
 *   - medium     → write, log to review file
 *   - low        → SKIP, log to review file (the 1 "low" entry is
 *                  99 Cents Only, which Claude flagged as a chain
 *                  that went bankrupt and closed all US locations in
 *                  2024 — putting a website on it would be wrong)
 *   - none / blank URL → SKIP (no-action)
 *
 * The script does NOT verify URLs via HEAD/GET — that approach is
 * unreliable (some servers ban non-browser traffic, some ban HEAD,
 * some return 200 for invalid URLs as long as you GET the homepage).
 * We trust Claude's confidence rating.
 *
 * Usage:
 *   node scripts/import-website-backfill.mjs --dry-run   # show plan, write nothing
 *   node scripts/import-website-backfill.mjs             # apply
 *
 * Always run --dry-run first.
 */

import { Pool } from 'pg'
import { readFileSync, writeFileSync } from 'node:fs'

const lines = readFileSync('./.env.local', 'utf8').split('\n')
const get = k => {
  const l = lines.find(x => x.startsWith(k + '='))
  if (!l) return ''
  let v = l.split('=').slice(1).join('=').trim()
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
  return v
}

const DRY_RUN = process.argv.includes('--dry-run')

const pool = new Pool({
  connectionString: get('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
})

// Smart-quote + NFC normalization for matching. Mirrors the Python
// logic we used to fix Claude's CSV (right-single-quote U+2019 → ASCII,
// NFC normalize, casefold).
function normalizeName(s) {
  if (!s) return ''
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .normalize('NFC')
    .toLowerCase()
    .trim()
}

// Load Claude's results. Try to auto-detect & fix the UTF-8/Latin-1
// mojibake that some AI-saved CSVs produce (the file we received had
// `Ã±` for `ñ`, etc. — fixed in place once already; this loader is
// resilient to one more layer being present).
function loadClaudeCsv(path) {
  let text = readFileSync(path, 'utf8')
  // Peel one layer if mojibake markers are present
  if (/[ÃÂ]/.test(text)) {
    try {
      const fixed = Buffer.from(text, 'utf8').toString('latin1')
      const fixed2 = Buffer.from(fixed, 'latin1').toString('utf8')
      if (!/[ÃÂ]/.test(fixed2)) text = fixed2
    } catch {}
  }
  // Manual CSV parse — Claude's notes field can contain commas, so we
  // need to handle quoted fields with embedded commas/newlines.
  const rows = []
  let cur = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { field += c }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else { field += c }
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  const headers = rows.shift()
  return rows.filter(r => r.length === headers.length).map(r => {
    const o = {}
    headers.forEach((h, i) => { o[h] = r[i] })
    return o
  })
}

const claudeRows = loadClaudeCsv('./scratch/moval-website-search-results.csv')
console.log(`Loaded ${claudeRows.length} rows from Claude's results.\n`)

// Build name-keyed lookup (a single business name can map to multiple
// Moreno Valley locations, e.g. Cafe Gossip).
const byNorm = new Map()
for (const r of claudeRows) {
  const key = normalizeName(r.name)
  if (!byNorm.has(key)) byNorm.set(key, [])
  byNorm.get(key).push(r)
}

// Pull all APPROVED businesses that currently have no website.
const dbRows = (await pool.query(`
  SELECT id, name, website
  FROM "Business"
  WHERE status = 'APPROVED'
    AND (website IS NULL OR website = '')
  ORDER BY name
`)).rows

console.log(`Loaded ${dbRows.length} APPROVED businesses with no website.\n`)

// Plan the writes
const plan = []
const review = []  // anything we DIDN'T apply but want to surface
let alreadyHasWebsite = 0

for (const biz of dbRows) {
  const key = normalizeName(biz.name)
  const candidates = byNorm.get(key)
  if (!candidates || candidates.length === 0) {
    review.push({ name: biz.name, id: biz.id, action: 'no-match', detail: 'name did not match Claude results (case/quote normalized)' })
    continue
  }
  // If multiple candidates, take the first with a URL; otherwise first.
  const candidate = candidates.find(c => c.website_found?.trim()) || candidates[0]
  const url = (candidate.website_found || '').trim()
  const conf = (candidate.confidence || '').trim().toLowerCase()
  const notes = candidate.notes || ''

  if (!url) {
    review.push({ name: biz.name, id: biz.id, action: 'no-url', confidence: conf, detail: notes })
    continue
  }

  if (conf === 'high') {
    plan.push({ id: biz.id, name: biz.name, url, confidence: conf, action: 'write' })
  } else if (conf === 'medium') {
    plan.push({ id: biz.id, name: biz.name, url, confidence: conf, action: 'write-and-flag', review: notes })
    review.push({ name: biz.name, id: biz.id, action: 'medium-confidence', url, detail: notes })
  } else if (conf === 'low') {
    review.push({ name: biz.name, id: biz.name ? '' : '', id: biz.id, action: 'low-confidence-skipped', url, detail: notes })
  } else {
    review.push({ name: biz.name, id: biz.id, action: 'unknown-confidence', confidence: conf, url, detail: notes })
  }
}

console.log('=== PLAN SUMMARY ===')
const counts = plan.reduce((acc, p) => { acc[p.confidence] = (acc[p.confidence] || 0) + 1; return acc }, {})
for (const [c, n] of Object.entries(counts)) console.log(`  ${c}: ${n}`)
console.log(`  review-only (skipped): ${review.length}`)
console.log(`  total writes planned:   ${plan.length}\n`)

if (DRY_RUN) {
  console.log('[DRY RUN] Sample of planned writes (first 15):')
  for (const p of plan.slice(0, 15)) {
    console.log(`  [${p.confidence.padEnd(7)}] ${p.name.padEnd(45)} -> ${p.url}`)
  }
  if (plan.length > 15) console.log(`  ... and ${plan.length - 15} more`)

  console.log('\n[DRY RUN] Review list:')
  for (const r of review.slice(0, 20)) {
    console.log(`  [${r.action.padEnd(28)}] ${r.name}: ${r.detail?.slice(0, 80) || ''}`)
  }
  if (review.length > 20) console.log(`  ... and ${review.length - 20} more`)
  console.log('\n[DRY RUN] No DB writes. Re-run without --dry-run to apply.')
  await pool.end()
  process.exit(0)
}

// APPLY: write the plan
let writes = 0
for (const p of plan) {
  await pool.query(
    'UPDATE "Business" SET website = $1, "updatedAt" = NOW() WHERE id = $2',
    [p.url, p.id]
  )
  writes++
}
console.log(`Applied ${writes} writes.`)

// Write the review file
const reviewPath = './scripts/_website-backfill-review.md'
let reviewMd = `# Website backfill — review list\n\nGenerated ${new Date().toISOString().slice(0,10)} by \`scripts/import-website-backfill.mjs\`.\n\n## Medium-confidence writes (already applied — flag for your review)\n\nThese were written to the DB because Claude marked them as \`medium\` confidence. None are wrong per se, but please spot-check the ones you care about.\n\n`
const mediumItems = review.filter(r => r.action === 'medium-confidence')
if (mediumItems.length === 0) {
  reviewMd += '_None._\n\n'
} else {
  for (const r of mediumItems) {
    reviewMd += `- **${r.name}** (\`${r.id}\`) → \`${r.url}\`\n  - _notes:_ ${r.detail}\n`
  }
}

reviewMd += `\n## Skipped (need your call)\n\n`

const skipped = review.filter(r => r.action !== 'medium-confidence')
if (skipped.length === 0) {
  reviewMd += '_None._\n'
} else {
  for (const r of skipped) {
    reviewMd += `- **${r.name}** (\`${r.id}\`) — \`${r.action}\`${r.url ? ` — suggested URL: \`${r.url}\`` : ''}\n  - _detail:_ ${r.detail || '(none)'}\n`
  }
}

writeFileSync(reviewPath, reviewMd)
console.log(`Wrote review list to ${reviewPath}`)
console.log(`  ${mediumItems.length} medium-confidence rows written (flag for review)`)
console.log(`  ${skipped.length} rows skipped (need your call)`)

await pool.end()
