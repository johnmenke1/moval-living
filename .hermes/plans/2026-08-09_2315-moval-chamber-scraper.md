# MoVal Chamber Scraper + DB Match — Implementation Plan

> **Scope:** Moreno Valley Chamber of Commerce (movalchamber.org) ONLY. Hispanic Chamber is a follow-up probe.
>
> **Behavior:** Scrape the public directory, match against our `Business` DB, mark matched businesses as `chamberMember = true`. **Produce a CSV of Chamber members not on our site — do NOT auto-create.** Johnny reviews the CSV, then decides.
>
> **Default mode is dry-run.** All scripts ship with a `--apply` flag that actually writes to the DB. Without `--apply`, scripts only produce output files.

**Goal:** Identify MoVal Chamber members currently on our site → mark them. Identify MoVal Chamber members not on our site → produce a CSV for Johnny to review. No ghost data, no auto-creates, dry-run by default.

**Architecture:** Three small Node.js scripts in `scripts/`, each with a single responsibility. Output files go to `scripts/output/` (gitignored). All scripts are re-runnable and idempotent. Any one of them can be run with `--apply` to commit changes to the DB; without it, scripts only produce output.

**Tech Stack:** Node.js ESM · `playwright` or `cheerio` for HTML parsing · `pg` from the existing project (no Prisma needed — these are batch scripts, not app code) · `set -a && source .env.local` for the DB URL.

---

## Critical Pre-Flight

- **The Chamber is regional, not city-bounded.** ~30% of the directory is outside Moreno Valley (Riverside, Mission Viejo, Henderson NV, etc.). Filter to city = "Moreno Valley" OR zip matches `9255\d` at scrape time.
- **GrowthZone CMS structure is consistent.** Single template, no JS rendering, public. Verified via probe on 2026-08-09 at `https://www.movalchamber.org/members/searchalpha/c` — 24 results, all in `<h5>` + nested `<a>` + address + phone + tel: link pattern.
- **Politeness:** 2s delay between requests, descriptive User-Agent. Default 27 requests = ~54 seconds scrape time. Don't pound.
- **Scraper fragility:** GrowthZone template could change. All scripts write to JSON first, then read from JSON. Re-running the scraper is cheap; re-running the matcher is free.
- **Auto-create is OUT.** The original task said "maybe also create listings" — default is CSV for review. Confirmed by Johnny on 2026-08-09.

---

## Files Likely to Change

| File | Change |
|---|---|
| `scripts/scrape-moval-chamber-2026-08-09.mjs` | NEW — pure HTML scraper, no DB |
| `scripts/match-chamber-to-db-2026-08-09.mjs` | NEW — reads JSON, matches DB, marks `chamberMember` if `--apply` |
| `scripts/missing-chamber-listings-2026-08-09.mjs` | NEW — reads matched/missing result, produces CSV |
| `scripts/lib/parse-chamber-address.mjs` | NEW — shared address parser (city / state / zip / phone / street) |
| `scripts/output/` | NEW — directory, .gitignored |
| `.gitignore` | Add `scripts/output/` |

No application code changes. No DB schema changes. No migration.

---

## Step-by-Step Plan

### Task 1: Shared address parser

**Objective:** Build a single, well-tested helper that takes a scraped String like `"14941 Riverside Drive\nMarch ARB CA 92518"` and returns `{ street, city, state, zip }`. Both scripts 2 and 3 will use this.

**Files:**
- Create: `scripts/lib/parse-chamber-address.mjs`

**Step 1.1 — Implementation:**

```js
// scripts/lib/parse-chamber-address.mjs
// Parse a multi-line Chamber address into structured fields.
// Handles: "14941 Riverside Drive\nMarch ARB CA 92518",
//          "PO Box 10130\nMoreno Valley CA 92552",
//          "12980Day St., Suite 101\nMoreno Valley CA 92553-5253",
//          "Suite 10-A\nRiverside CA 92508" (no leading street before newline in some cases)

const ZIP_RE = /\b(\d{5})(?:-\d{4})?$/

export function parseChamberAddress(raw) {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  // State is always 2 uppercase letters. Find the last CA / NV / AZ / etc.
  const stateMatch = cleaned.match(/ ([A-Z]{2}) (\d{5}(?:-\d{4})?)$/)
  if (!stateMatch) return null
  const state = stateMatch[1]
  const zip = stateMatch[2]
  const before = cleaned.slice(0, stateMatch.index).trim()
  // City is the last whitespace-separated token group before the state.
  // Street is everything before city.
  const citySplit = before.match(/^(.+?)\s+([A-Z][A-Za-z .'-]+)$/)
  if (!citySplit) return null
  const street = citySplit[1].trim()
  const city = citySplit[2].trim()
  return { street, city, state, zip }
}

export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 13) return null
  // Strip leading 1 from US numbers (1-XXX-XXX-XXXX → XXX-XXX-XXXX)
  const stripped = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return stripped
}

export function isMorenoValleyAddress({ city, zip } = {}) {
  if (!city || !zip) return false
  if (city.toLowerCase() === 'moreno valley') return true
  if (/^9255\d/.test(zip)) return true
  return false
}

export function isPOBox(street) {
  if (!street) return false
  return /\bp\.?o\.?\s*box\b/i.test(street)
}
```

**Step 1.2 — Manual smoke test (no test file, just a one-shot node call):**

```js
node -e "
import('./scripts/lib/parse-chamber-address.mjs').then(({ parseChamberAddress, normalizePhone, isMorenoValleyAddress, isPOBox }) => {
  const cases = [
    ['14941 Riverside Drive\nMarch ARB CA 92518', 'Moreno Valley street'],
    ['PO Box 10130\nMoreno Valley CA 92552', true],
    ['12980Day St., Suite 101\nMoreno Valley CA 92553-5253', true],
    ['141 E. Alessandro Bd., Suite 10-A\nRiverside CA 92508', false],
    ['Suite 10-A\nRiverside CA 92508', false],
  ]
  for (const [input, expected] of cases) {
    console.log(JSON.stringify(parseChamberAddress(input), null, 2))
  }
  console.log('phone normalize:', normalizePhone('(951) 656-6503'), normalizePhone('1-844-213-9549'))
  console.log('isMorenoValleyAddress:', isMorenoValleyAddress({ city: 'Moreno Valley', zip: '92553' }))
  console.log('isMorenoValleyAddress (Riverside):', isMorenoValleyAddress({ city: 'Riverside', zip: '92507' }))
  console.log('isPOBox:', isPOBox('PO Box 10130'))
})
"
```

Expected: 5 sensible parsed objects. PO Box detection works. Phone normalization consistent.

**Step 1.3 — Commit:**

```bash
git add scripts/lib/parse-chamber-address.mjs
git commit -m "feat: chamber address parser shared lib"
```

---

### Task 2: MoVal Chamber scraper

**Objective:** Hit 27 A-Z pages, parse each, filter to Moreno Valley only, output JSON + CSV.

**Files:**
- Create: `scripts/scrape-moval-chamber-2026-08-09.mjs`
- Modify: `.gitignore` (add `scripts/output/`)

**Step 2.1 — Implementation:**

```js
#!/usr/bin/env node
// scripts/scrape-moval-chamber-2026-08-09.mjs
// Scrape the public Moreno Valley Chamber directory, filter to Moreno Valley businesses,
// output JSON + CSV. No DB writes. Always dry-run.
//
// Run: node scripts/scrape-moval-chamber-2026-08-09.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseChamberAddress, isMorenoValleyAddress, normalizePhone } from './lib/parse-chamber-address.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'output')
const STAMP = new Date().toISOString().slice(0, 10)

const BASE = 'https://www.movalchamber.org'
const ALPHAS = ['0-9', ...'abcdefghijklmnopqrstuvwxyz'.split('')]
const DELAY_MS = 2000
const UA = 'moval-living-chamber-scraper/1.0 (contact: john@moval.living)'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(letter) {
  const url = `${BASE}/members/searchalpha/${letter}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function parseLetterPage(html, letter) {
  // Each listing: <h5><a href="...">name</a></h5>, then <a class="map-link">street\ncity state zip</a>, then <a class="phone-link" href="tel:NNN">phone</a>
  // The address block is in a list with "map-link" class. The phone is the next sibling.
  // Use a regex-based extract since the page is small and the structure is consistent.
  const listings = []
  const re = /<h5><a href="([^"]+)"[^>]*>([^<]+)<\/a><\/h5>\s*<ul[^>]*>\s*<li>\s*<a class="[^"]*map-link[^"]*"[^>]*>([\s\S]*?)<\/a>\s*<\/li>\s*<li>\s*<a class="[^"]*phone-link[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const [, href, name, addressHtml, phoneHtml] = m
    const address = addressHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const phone = phoneHtml.replace(/<[^>]+>/g, ' ').trim()
    listings.push({
      source: 'movalchamber.org',
      letter,
      sourceUrl: BASE + href,
      name: name.trim(),
      address,
      phone,
    })
  }
  return listings
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const all = []
  const errors = []

  for (const letter of ALPHAS) {
    try {
      const html = await fetchPage(letter)
      const listings = parseLetterPage(html, letter)
      all.push(...listings)
      console.log(`[${letter}] ${listings.length} listings`)
      await sleep(DELAY_MS)
    } catch (e) {
      errors.push({ letter, error: e.message })
      console.error(`[${letter}] FAILED: ${e.message}`)
    }
  }

  // Enrich + filter to Moreno Valley only
  const enriched = all.map((l) => {
    const parsed = parseChamberAddress(l.address)
    const phone = normalizePhone(l.phone)
    const isMoVal = isMorenoValleyAddress(parsed)
    return {
      ...l,
      street: parsed?.street ?? null,
      city: parsed?.city ?? null,
      state: parsed?.state ?? null,
      zip: parsed?.zip ?? null,
      phoneNormalized: phone,
      isMorenoValley: isMoVal,
      isPOBox: parsed ? /\bp\.?o\.?\s*box\b/i.test(parsed.street) : false,
    }
  })

  const moVal = enriched.filter((l) => l.isMorenoValley)
  const nonMoVal = enriched.filter((l) => !l.isMorenoValley)

  console.log(`\nTotal scraped: ${all.length}`)
  console.log(`Moreno Valley: ${moVal.length}`)
  console.log(`Other (filtered): ${nonMoVal.length}`)
  console.log(`Errors: ${errors.length}`)

  // JSON — full enriched data
  await writeFile(
    resolve(OUT_DIR, `chamber-scrape-${STAMP}.json`),
    JSON.stringify({ scrapedAt: new Date().toISOString(), moVal, nonMoVal, errors }, null, 2)
  )

  // CSV — MoVal only, for spreadsheet review
  const csvHeader = 'name,address,phone,source_url\n'
  const csvRows = moVal.map((l) =>
    [l.name, l.address, l.phone, l.sourceUrl]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  await writeFile(resolve(OUT_DIR, `chamber-moval-${STAMP}.csv`), csvHeader + csvRows.join('\n'))

  console.log(`\nWrote: scripts/output/chamber-scrape-${STAMP}.json`)
  console.log(`Wrote: scripts/output/chamber-moval-${STAMP}.csv`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Step 2.2 — Update `.gitignore`:**

Add a line: `scripts/output/`

**Step 2.3 — Verify the regex against the real HTML.** Before running the full 27-page scrape, hit one URL, paste the HTML into a node REPL, and confirm the regex matches the constructed structure. If the regex misses because the HTML has subtle differences (extra attributes, whitespace), iterate.

**Step 2.4 — Run the scraper (dry-run default):**

```bash
node scripts/scrape-moval-chamber-2026-08-09.mjs
```

Expected runtime: ~60 seconds. Expected output: 27 letters, 500-700 total, 150-300 after MoVal filter. JSON + CSV files in `scripts/output/`.

**Step 2.5 — Manual review of the CSV.** Open `scripts/output/chamber-moval-2026-08-09.csv` in Excel/Sheets. Verify:
- Names look reasonable (no scraping artifacts)
- Filter actually excluded Riverside/Henderson/Mission Viejo
- Phone numbers preserved
- Theuctions captured make sense

**Step 2.6 — Commit:**

```bash
git add scripts/scrape-moval-chamber-2026-08-09.mjs .gitignore
git commit -m "feat: scrape moval chamber directory, filter to moreno valley"
```

---

### Task 3: DB matcher

**Objective:** For each scraped MoVal Chamber member, find the matching business in our `Business` table. High-confidence matches (phone) → mark `chamberMember = true`. Medium-confidence → CSV for review. No matches → no DB change.

**Files:**
- Create: `scripts/match-chamber-to-db-2026-08-09.mjs`

**Step 3.1 — Implementation:**

```js
#!/usr/bin/env node
// scripts/match-chamber-to-db-2026-08-09.mjs
// Read the latest chamber scrape JSON, match against our Business table.
// High-confidence match (phone) → action: mark-chamber (default dry-run, --apply writes).
// Medium-confidence match (city + street number + first word of name) → action: review-csv.
// No match → action: no-match (also exported to missing-listings CSV in script 3).
//
// Output: scripts/output/chamber-match-2026-08-09.csv (all matches with confidence)
//         scripts/output/chamber-apply-2026-08-09.sql (the SQL to run if --apply)
//
// Run: node scripts/match-chamber-to-db-2026-08-09.mjs           (dry-run)
//      node scripts/match-chamber-to-db-2026-08-09.mjs --apply  (writes to DB)

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Client } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'output')
const STAMP = new Date().toISOString().slice(0, 10)
const APPLY = process.argv.includes('--apply')

async function latestScrape() {
  const files = await readdir(OUT_DIR)
  const scrapes = files.filter((f) => f.startsWith('chamber-scrape-') && f.endsWith('.json')).sort()
  if (!scrapes.length) throw new Error('No scrape JSON found. Run scrape-moval-chamber first.')
  return JSON.parse(await readFile(resolve(OUT_DIR, scrapes[scrapes.length - 1]), 'utf8'))
}

function levenshtein(a, b) {
  // Tiny implementation for name similarity scoring. Not a hot path.
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i-1] === b[j-1] ? 0 : 1
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + c)
    }
  }
  return dp[m][n]
}

function normalizeName(s) {
  return s.toLowerCase()
    .replace(/\b(inc|llc|corp|co|dba|the|of|and)\b/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchScore(chamber, biz) {
  // High confidence: phone match (normalized)
  if (chamber.phoneNormalized && biz.phoneNormalized &&
      chamber.phoneNormalized === biz.phoneNormalized) {
    return { confidence: 'HIGH', score: 1.0, reason: 'phone' }
  }
  // Medium confidence: same city + same street number + similar name
  if (chamber.city && biz.city &&
      chamber.city.toLowerCase() === biz.city.toLowerCase() &&
      chamber.street && biz.street) {
    const houseNum = (s) => s.match(/^\s*(\d+)/)?.[1]
    const cn = houseNum(chamber.street)
    const bn = houseNum(biz.street)
    if (cn && bn && cn === bn) {
      const nameDist = levenshtein(
        normalizeName(chamber.name),
        normalizeName(biz.name)
      )
      const maxLen = Math.max(normalizeName(chamber.name).length, normalizeName(biz.name).length)
      const similarity = 1 - nameDist / maxLen
      if (similarity >= 0.5) {
        return { confidence: 'MEDIUM', score: similarity, reason: 'address+name' }
      }
    }
  }
  return null
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const scrape = await latestScrape()
  const moVal = scrape.moVal

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const businesses = await c.query(`
    SELECT id, slug, name, phone, address, city, zip, "chamberMember"
    FROM "Business"
    WHERE status = 'APPROVED'
  `)
  // Normalize phone for matching
  const bizNorm = businesses.rows.map((b) => ({
    ...b,
    phoneNormalized: b.phone ? b.phone.replace(/\D/g, '').replace(/^1/, '') : null,
  }))

  const matches = []
  const noMatch = []

  for (const ch of moVal) {
    let best = null
    for (const b of bizNorm) {
      const m = matchScore(ch, b)
      if (m && (!best || m.score > best.score)) {
        best = { ...m, businessId: b.id, businessSlug: b.slug, businessName: b.name, businessPhone: b.phone, currentChamberMember: b.chamberMember }
      }
    }
    if (best) {
      matches.push({
        chamberName: ch.name,
        chamberAddress: ch.address,
        chamberPhone: ch.phone,
        ourSlug: best.businessSlug,
        ourName: best.businessName,
        ourPhone: best.businessPhone,
        confidence: best.confidence,
        score: best.score.toFixed(2),
        reason: best.reason,
        currentChamberMember: best.currentChamberMember,
        action: best.confidence === 'HIGH' ? 'mark-chamber' : 'review-csv',
      })
    } else {
      noMatch.push(ch)
    }
  }

  // High-confidence matches that aren't already marked → SQL to apply
  const toApply = matches.filter((m) => m.confidence === 'HIGH' && m.currentChamberMember === false)
  const skipApply = matches.filter((m) => m.currentChamberMember === true)
  const reviewNeeded = matches.filter((m) => m.confidence === 'MEDIUM')

  console.log(`\n=== Match summary ===`)
  console.log(`Chamber members (MoVal): ${moVal.length}`)
  console.log(`High-confidence matches (action: mark-chamber): ${toApply.length}`)
  console.log(`Already marked: ${skipApply.length}`)
  console.log(`Medium-confidence (review): ${reviewNeeded.length}`)
  console.log(`No match: ${noMatch.length}`)

  // Write the full match report CSV
  const allMatchCsv = ['chamber_name,chamber_address,chamber_phone,our_slug,our_name,our_phone,confidence,score,reason,action']
  for (const m of matches) {
    allMatchCsv.push([
      m.chamberName, m.chamberAddress, m.chamberPhone,
      m.ourSlug, m.ourName, m.ourPhone,
      m.confidence, m.score, m.reason, m.action,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  }
  await writeFile(resolve(OUT_DIR, `chamber-match-${STAMP}.csv`), allMatchCsv.join('\n'))

  // Write the no-match CSV (for missing-listings review)
  const noMatchCsv = ['chamber_name,chamber_address,chamber_phone,is_po_box,source_url']
  for (const nm of noMatch) {
    noMatchCsv.push([
      nm.name, nm.address, nm.phone, nm.isPOBox, nm.sourceUrl,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  }
  await writeFile(resolve(OUT_DIR, `chamber-no-match-${STAMP}.csv`), noMatchCsv.join('\n'))

  if (APPLY && toApply.length > 0) {
    console.log(`\nApplying ${toApply.length} chamberMember = true updates...`)
    const ids = toApply.map((m) => m.ourSlug)
    // Slug → id lookup
    const idMap = new Map(bizNorm.map((b) => [b.slug, b.id]))
    const dbIds = ids.map((s) => idMap.get(s)).filter(Boolean)
    const result = await c.query(`
      UPDATE "Business"
      SET "chamberMember" = true, "updatedAt" = NOW()
      WHERE id = ANY($1::text[])
    `, [dbIds])
    console.log(`Updated ${result.rowCount} rows.`)
  } else if (APPLY) {
    console.log(`\n--apply set but no HIGH-confidence matches need updating.`)
  } else {
    console.log(`\nDry-run mode. To apply, re-run with --apply.`)
  }

  await c.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Step 3.2 — Install dependencies:** add `pg` and `dotenv` (likely already in package.json, verify):

```bash
cd /c/projects/websites/moval-living
grep -E '"pg"|"dotenv"' package.json
```

If not present: `npm install pg dotenv` — but check first; `pg` is referenced in `scripts/seed-best-of.js` already.

**Step 3.3 — Run dry-run:**

```bash
set -a && source .env.local && set +a
node scripts/match-chamber-to-db-2026-08-09.mjs
```

Expected: matches printed, `chamber-match-2026-08-09.csv` and `chamber-no-match-2026-08-09.csv` written. NO DB writes.

**Step 3.4 — Manual review.** Open `chamber-match-2026-08-09.csv`. Confirm:
- The HIGH-confidence matches look right (same phone, same business)
- The MEDIUM-confidence matches need a human eye — some will be wrong ("Coldstone Creamery" matching "Cold Stone Creamery" is correct; "City of Moreno Valley" matching "City of Moreno Valley - Parks" is correct; but "California Baptist University" matching "California Baptist University Online" is iffy)
- The no-match CSV is sensible (PO Box-only entries should be there, regional businesses that scraped through the filter should be examined)

**Step 3.5 — Wait for Johnny's approval before running with `--apply`.**

**Step 3.6 — Commit (script only — DO NOT commit the output CSVs that contain business info):**

```bash
git add scripts/match-chamber-to-db-2026-08-09.mjs
git commit -m "feat: match chamber members against our business db"
```

---

### Task 4: Missing-listings CSV (the "create new listings" part, done right)

**Objective:** Take the no-match CSV, decide which Chamber members are real MoVal physical businesses (skip PO Boxes, skip churches/associations, etc.), and produce a CSV Johnny can paste into a Create-Listing flow or hand to a VA.

**Files:**
- Create: `scripts/missing-chamber-listings-2026-08-09.mjs`

**Step 4.1 — Implementation:**

```js
#!/usr/bin/env node
// scripts/missing-chamber-listings-2026-08-09.mjs
// Read the no-match CSV, classify each entry:
//   - physical MoVal business (has street address, not PO Box, not a likely association)
//   - candidate to create a listing for
// Output: scripts/output/missing-chamber-listings-2026-08-09.csv (for Johnny to review)
//
// Run: node scripts/missing-chamber-listings-2026-08-09.mjs

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'output')
const STAMP = new Date().toISOString().slice(0, 10)

// Heuristic: names that strongly suggest non-business or association members
const NON_BUSINESS_HINTS = [
  /\bchurch\b/i,
  /\bschool\b/i,
  /\b(?:university|college)\b/i,
  /\bcity of\b/i,
  /\bcounty of\b/i,
  /\bassociation\b/i,
  /\bcenter\b/i,
  /\bfellowship\b/i,
  /\bminister(?:y|ies)\b/i,
  /\bnon[-\s]?profit\b/i,
  /\bfoundation\b/i,
  /\bmentor\b/i,
  /\bescrow\b/i,  // fig: Citrus Escrow is a real business but typically not a MoVal directory target
  /\bpllc\b/i,
  /\bpllc\b/i,
]

async function latestNoMatch() {
  const files = await readdir(OUT_DIR)
  const csvs = files.filter((f) => f.startsWith('chamber-no-match-') && f.endsWith('.csv')).sort()
  if (!csvs.length) throw new Error('Run match-chamber-to-db first.')
  const text = await readFile(resolve(OUT_DIR, csvs[csvs.length - 1]), 'utf8')
  // Crude CSV parse — assumes no commas inside quoted fields (we control the source)
  const [, ...rows] = text.split('\n').filter(Boolean)
  return rows.map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')) ?? []
    return {
      name: cols[0],
      address: cols[1],
      phone: cols[2],
      isPOBox: cols[3] === 'true',
      sourceUrl: cols[4],
    }
  })
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const entries = await latestNoMatch()

  const candidates = []
  const nonBusinesses = []
  const poBoxes = []

  for (const e of entries) {
    if (e.isPOBox) {
      poBoxes.push(e)
      continue
    }
    if (NON_BUSINESS_HINTS.some((rx) => rx.test(e.name))) {
      nonBusinesses.push(e)
      continue
    }
    candidates.push(e)
  }

  console.log(`No-match summary:`)
  console.log(`  PO Box addresses: ${poBoxes.length}`)
  console.log(`  Likely non-business (church, school, etc.): ${nonBusinesses.length}`)
  console.log(`  Candidates to add as listings: ${candidates.length}`)

  const csvHeader = 'name,address,phone,source_url,reason\n'
  const lines = []
  for (const c of candidates) {
    lines.push([c.name, c.address, c.phone, c.sourceUrl, 'candidate'].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  }
  for (const n of nonBusinesses) {
    lines.push([n.name, n.address, n.phone, n.sourceUrl, 'likely-non-business'].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  }
  for (const p of poBoxes) {
    lines.push([p.name, p.address, p.phone, p.sourceUrl, 'po-box-only'].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  }
  await writeFile(resolve(OUT_DIR, `missing-chamber-listings-${STAMP}.csv`), csvHeader + lines.join('\n'))

  console.log(`\nWrote: scripts/output/missing-chamber-listings-${STAMP}.csv`)
  console.log(`Candidates: ${candidates.length}. Review the CSV before adding any listings.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Step 4.2 — Run, review the CSV, commit (script only):**

```bash
node scripts/missing-chamber-listings-2026-08-09.mjs
git add scripts/missing-chamber-listings-2026-08-09.mjs
git commit -m "feat: classify missing chamber listings for review"
```

---

### Task 5: Final verification

**Objective:** Confirm the full pipeline works end-to-end and the apply step is safe.

**Step 5.1 — Re-run the full pipeline (after any code changes):**

```bash
cd /c/projects/websites/moval-living
node scripts/scrape-moval-chamber-2026-08-09.mjs
set -a && source .env.local && set +a
node scripts/match-chamber-to-db-2026-08-09.mjs          # dry-run
node scripts/missing-chamber-listings-2026-08-09.mjs
```

**Step 5.2 — Manual audit of the match report:**

```bash
cd /c/projects/websites/moval-living
set -a && source .env.local && set +a
node -e '
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT slug, name, "chamberMember" FROM "Business" WHERE "chamberMember" = true ORDER BY name`);
  console.log("Currently marked chamberMember=true:", r.rows.length);
  r.rows.forEach(r => console.log("  ", r.slug, "—", r.name));
  await c.end();
})();
' 2>&1 | grep -v "Warning\|SECURITY\|getaddrinfo\|SSL modes\|libpq"
```

**Should be 0** before you run with `--apply`. After `--apply`, it should equal the count of HIGH-confidence matches.

**Step 5.3 — Apply (only after Johnny's approval):**

```bash
node scripts/match-chamber-to-db-2026-08-09.mjs --apply
```

Print the row count. Re-run the audit query above. Confirm it matches.

**Step 5.4 — Confirm no regressions:**

```bash
npx tsc --noEmit
```

Expected: clean (no app code was touched, but verify).

**Step 5.5 — Commit (no source-of-truth changes — only the .gitignore):**

```bash
git status
# Expect: scripts/output/ is untracked (gitignored); nothing else.
```

---

## Tests / Validation Summary

| Layer | Test | Pass criteria |
|---|---|---|
| Address parser | `node -e "<smoke test>"` | 5 cases parse correctly, phone normalization consistent |
| Scraper | Run dry-run | 27 letters processed, JSON + CSV written, 150-300 MoVal entries |
| DB match | Run dry-run | HIGH/MEDIUM/NO-MATCH counts sensible, no DB writes |
| Apply | Run with `--apply` (after Johnny's approval) | N rows updated where N = HIGH-confidence count |
| Audit | Probe: `SELECT COUNT(*) FROM "Business" WHERE "chamberMember" = true` | Numeric match with apply output |

---

## Risks, Tradeoffs, and Open Questions

### Q1 — Auto-create listings

**Default: NO AUTO-CREATE.** The user said "maybe also create listings" — that's an option, not a default. Auto-creation is risky because:
- PENDING listings without owners have no quality control
- They could show up in `/search` if APPROVED status isn't enforced
- A VA or Johnny should review before any business gets a public listing
- A future "claim your listing" flow needs the right owning entity

**Better path:** scripts produce a CSV for Johnny to review. Once Johnny approves, a CSV import script (out of scope for this task) can create PENDING listings with `submitterEmailOpIn` flags set for the chamber to follow up.

### Q2 — Hispanic Chamber

Separate site. Out of scope for this pass. Once the MoVal Chamber pipeline is verified, revisit with the same pattern.

### Q3 — Fuzzy matching quality

Phone matching is the high-confidence anchor. Medium-confidence (address + name) is heuristic and may have false positives. The match CSV is the review surface — Johnny eyeballs before any `--apply`.

### Q4 — When the Chamber CMS changes

`parseLetterPage` regex is fragile. Mitigation: write a small test that probes one or two letters and asserts the regex matches ≥ 1 listing. If GrowthZone changes structure, the regex fails fast, scripts print no results, Johnny notices.

### Q5 — Multi-agent working tree

`master` is currently 22 commits behind origin with 14 uncommitted files in working tree (Emma's ongoing work). This script task doesn't touch any application code, so we should be safe to commit. But the destructive-prisma-push skill's "verify before push" rule applies: before any push, ensure the working tree is clean or the diff is what we expect.

### Q6 — Data quality of the scrape

Some Chamber entries have inconsistent address formatting (e.g., "Suite 10-A" alone, no street number). The address parser may fail on a few. Verify by counting `parseChamberAddress` results vs raw listings — should be 95%+ parsing success.

### Q7 — Performance

27 pages × 2s = ~54s scraper. The DB match is one query, fast. Total runtime: ~1 minute. No rate-limit concerns.

---

## Files NOT to Commit

- `scripts/output/*.csv` — contains business names, phone numbers, addresses. PII-adjacent. `.gitignore` covers this.
- `scripts/output/*.json` — same as above. `.gitignore` covers this.

The output files are Johnny's working data and shouldn't be in git. They live in `scripts/output/` and can be regenerated by re-running the scripts.

---

## Out of Scope

- Hispanic Chamber scraping (separate probe + script)
- Auto-creating listings from the CSV
- Sending outreach emails to matched Chamber members
- Scheduled re-scraping (no cron job)
- A "Chamber Member" filter on the public search page
- A "Claim your Chamber listing" email to matched-but-unowned businesses
- Auto-detection of Chamber membership when a business is claimed (could be a follow-up)
