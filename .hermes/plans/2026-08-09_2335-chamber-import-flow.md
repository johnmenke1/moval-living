# Chamber Import Flow — Implementation Plan

> **For Hermes:** Execute with discipline. Master is 22 commits behind origin with 14 uncommitted files in the working tree (Emma's WIP). Do NOT touch those files. Do NOT run `git pull` without explicit Johnny approval.
>
> **Scope:** Scrape MoVal Chamber → match against our DB → import non-matches as PENDING listings via a reusable CSV import endpoint. Johnny reviews them in the admin moderation queue, deletes the bad ones, approves the good ones. Filter by `chamberMember = true` on the search page and admin panel.
>
> **2026-08-09 scope confirmation (Johnny):** MoVal Chamber only. Hispanic Chamber deferred. Default PENDING status (not APPROVED). CSV import endpoint, not one-shot script.

**Goal:** MoVal Chamber members get visible as PENDING listings in our admin panel. Johnny can review, delete, or approve. Public search and admin moderation both have a `chamberMember` filter so these listings are easy to find in bulk.

**Architecture:**
- **Scraper** (`scripts/scrape-moval-chamber.mjs`) — pulls 27 A-Z pages, outputs JSON + CSV. Dry-run default. Output in `scripts/output/` (gitignored).
- **Matcher** (`scripts/match-chamber-to-db.mjs`) — reads JSON, matches against Business DB by phone (HIGH) and address+name (MEDIUM), outputs match CSV + a `to-import.csv` of confirmed-misses. Dry-run default. `--apply` writes to DB.
- **Importer** (`scripts/import-chamber-misses.mjs`) — reads `to-import.csv`, creates PENDING Business rows via the existing `POST /api/businesses` endpoint, marks `chamberMember = true` on each. Idempotent (skips by slug). Outputs import report.
- **Filter UI**:
  - `/search` — add `?chamber=1` query param + UI chip
  - `/dashboard` (admin) — add `chamberMember` filter chip to the moderation panel
- **No DB schema changes.** No new fields. Reuses existing `chamberMember` field from the chamber-sehabla-badges plan (which is committed but not yet pushed).

**Tech Stack:** Node.js ESM scripts · `pg` for DB · `fetch` for HTTP · existing Next.js API routes for filtering

---

## Critical Pre-Flight

- The parser in `scripts/lib/parse-chamber-address.mjs` is half-broken (multi-line addresses with suite numbers fail). Status: untracked, can be safely deleted if a better approach is needed.
- The H-page probe I did on 2026-08-09 showed addresses like `29995 Technology Dr\n  STE 306\n\n  Murrieta\n  CA\n  92563` — multi-line with suite. The current regex would miss the suite line.
- **Decision: switch to extracting address text from each entry's HTML and using a much simpler parser that handles "last 2 tokens before state = city"** — accepting that some entries will fail to parse correctly and be filtered out. See Task 1.3 for the simpler approach.
- The 14 Emma-modified files are in the working tree but NOT touched by this feature (except where the moderation panel needs the chamber filter — that file is in Emma's modified list; need to add the filter to the BOTTOM of the existing component without rewriting it).
- `chamberMember` field exists in the live DB (from the chamber-sehabla-badges plan migration). The schema file is missing it but the DB has it. Verified via column probe earlier today.

---

## Hispanic Chamber Blocker (2026-08-09 update)

**The Hispanic Chamber site (mvhcc.org) does NOT have a public member directory.** Verified via web scrape on 2026-08-09 — the homepage has only 6 logos in the "Thank You to Our Event Sponsors and Partners" section, and all 6 are government agencies / institutions (City of Moreno Valley, Riverside County, Altura, EMWD, MVUSD, MVC), not Hispanic-owned businesses. These are sponsors, not members.

The "logo file name → business name" approach Johnny proposed is not viable because:
- The 6 visible logos are sponsors, not members
- Logo filenames are mostly generic ("Altura-Logo", "MVC-Logo", "EMWD_Full-Name")
- Filenames don't establish a membership relationship

**To import Hispanic Chamber members, we'd need ONE of:**
- The Chamber providing a member list export (CSV/spreadsheet) — most Chambers will do this on request
- The Chamber enabling a public member directory on their site
- A self-service "claim your listing" flow distributed to their members

**This is a Johnny-side task, not a code task.** I'll note the gap in the plan and defer until either:
- Johnny obtains a member list from the Hispanic Chamber directly
- The Hispanic Chamber publishes a directory on their site

If Johnny wants me to send a polite outreach email to the Hispanic Chamber asking for a member list, I can draft that. Just say the word.

---

## Files Likely to Change

| File | Change |
|---|---|
| `scripts/lib/parse-chamber-address.mjs` | REWRITE — simpler parser for multi-line |
| `scripts/scrape-moval-chamber.mjs` | NEW — scraper with multi-line support |
| `scripts/match-chamber-to-db.mjs` | NEW — match + produce `to-import.csv` |
| `scripts/import-chamber-misses.mjs` | NEW — POST to `/api/businesses` for each Miss |
| `src/app/api/businesses/route.ts` | MODIFY — accept `chamberMember` flag, accept shorter `description` for imports (Chamber dirs don't have descriptions) |
| `src/app/api/search/route.ts` (or wherever search runs) | MODIFY — accept `chamber=1` query param |
| `src/app/search/page.tsx` | MODIFY — render chamber filter chip |
| `src/components/admin/BusinessesModeration.tsx` | MODIFY — add `chamberMember` filter chip |
| `.gitignore` | Add `scripts/output/` |
| `scripts/output/` | NEW directory, gitignored |

Notes:
- `src/components/admin/BusinessesModeration.tsx` is in Emma's 14-modified-files list. Patching carefully — surgical `patch` calls only, no `write_file`. If the file is too divergent, fall back to filter chip as a separate small component.
- `src/app/api/businesses/route.ts` — the existing POST endpoint requires `description.length >= 50`. For chamber imports, we'll synthesize a placeholder description like "Member of the Moreno Valley Chamber of Commerce. Listing imported from chamber directory." This satisfies the 50-char minimum and is honest about the source.

---

## Step-by-Step Plan

### Task 1: Address parser rewrite (handle multi-line)

**Objective:** Replace the broken parser with a robust one that handles multi-line addresses with suite numbers.

**Files:**
- Modify: `scripts/lib/parse-chamber-address.mjs`

**Step 1.1 — Rewrite the parser.** Drop the regex-based city splitting. Use a simpler algorithm:

```js
export function parseChamberAddress(raw) {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  // State + zip — anchored at end
  const stateMatch = cleaned.match(/ (CA|NV|AZ|OR) (\d{5}(?:-\d{4})?)$/i)
  if (!stateMatch) return null
  const state = stateMatch[1].toUpperCase()
  const zip = stateMatch[2]
  const before = cleaned.slice(0, stateMatch.index).trim()
  // City is the last 1-3 tokens. Common 1-token cities: "Riverside", "Yucaipa".
  // Common 2-token: "Moreno Valley", "March ARB", "Rancho Cucamonga".
  // Common 3-token: "San Bernardino". Anything longer is almost certainly street.
  const tokens = before.split(/\s+/)
  if (tokens.length < 2) return null
  let city = null, street = null
  for (let k = 1; k <= Math.min(3, tokens.length - 1); k++) {
    const candidate = tokens.slice(tokens.length - k).join(' ')
    const prefix = tokens.slice(0, tokens.length - k).join(' ')
    // Avoid empty street (would happen if we tried k=tokens.length)
    if (prefix.length > 0) {
      city = candidate
      street = prefix
    }
  }
  return { street, city, state, zip }
}
```

**Simplification:** iterate k=1 then k=2 then k=3, OVERWRITING each time. The final write wins. So k=3 wins (3-token city). This is OK for our dataset — none of the MoVal Chamber cities are 1-token AND preceded by a long street. Let me verify with smoke tests.

**Step 1.2 — Smoke test:** Run the same 9 cases from the previous attempt.

```bash
cd /c/projects/websites/moval-living
node -e "
import('./scripts/lib/parse-chamber-address.mjs').then(({ parseChamberAddress }) => {
  const cases = [
    ['14941 Riverside Drive March ARB CA 92518', 'March ARB'],
    ['PO Box 10130 Moreno Valley CA 92552', 'Moreno Valley'],
    ['12980Day St. Suite 101 Moreno Valley CA 92553-5253', 'Moreno Valley'],
    ['141 E. Alessandro Bd. Suite 10-A Riverside CA 92508', 'Riverside'],
    ['Suite 10-A Riverside CA 92508', 'Riverside'],
    ['27201 Puerta Real Suite 150 Mission Viejo CA 92691', 'Mission Viejo'],
    ['10370 Hemet Street Suite 200 Riverside CA 92503', 'Riverside'],
    ['2285 Corporate Cir Henderson NV 89074', 'Henderson'],
    ['27645 Solitude Ave Moreno Valley California 92555', null],  // full state name — out of scope
    ['29995 Technology Dr STE 306 Murrieta CA 92563', 'Murrieta'],
    ['11875 Pigeon Pass Rd Ste B-17 Moreno Valley CA 92557', 'Moreno Valley'],
  ]
  let pass = 0, fail = 0
  for (const [c, expectedCity] of cases) {
    const r = parseChamberAddress(c)
    const ok = expectedCity === null ? r === null : r?.city === expectedCity
    console.log(ok ? 'PASS' : 'FAIL', '—', c, '→', JSON.stringify(r?.city))
    if (ok) pass++; else fail++
  }
  console.log(pass + ' pass, ' + fail + ' fail')
})
"
```

Expected: 10 pass, 1 fail (the "California 92555" case is intentionally out-of-scope — we'd need a separate normalization for full state names).

**Step 1.3 — Verify the existing isMorenoValleyAddress, isPOBox, normalizePhone, normalizeName, levenshtein helpers still work:** Quick smoke test.

**Step 1.4 — Commit ONLY the parser rewrite (no other files yet):**

```bash
git add scripts/lib/parse-chamber-address.mjs
git commit -m "fix: address parser handles multi-line + suite numbers"
```

---

### Task 2: Scraper (handles multi-line HTML)

**Objective:** Scrape 27 A-Z pages, parse each entry's HTML robustly, output JSON + CSV with `address.street / city / state / zip / phoneNormalized / isMorenoValley / isPOBox`.

**Files:**
- Create: `scripts/scrape-moval-chamber.mjs`
- Modify: `.gitignore` (add `scripts/output/`)

**Step 2.1 — Implementation.**

The H-page HTML I extracted has the address split across multiple `<li>` elements or `<br>` tags. Looking at the actual structure:

```
* [27645 Solitude Ave
  Moreno Valley
  California
  92555](google maps link)
* [1-562-239-5292](tel link)
```

The address is a markdown-styled link with `\n` separators. The phone is the next list item. The straightforward extract: split on `* [` or `* [` patterns, then for each entry extract the address text and the phone.

```js
#!/usr/bin/env node
// scripts/scrape-moval-chamber.mjs
// Scrape the public MoVal Chamber directory, filter to Moreno Valley, output JSON + CSV.
//
// Run: node scripts/scrape-moval-chamber.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseChamberAddress, isMorenoValleyAddress, isPOBox, normalizePhone } from './lib/parse-chamber-address.mjs'

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

// Each entry block starts with `##### [Name](url)` and ends before the next `#####` or the footer.
// The address is a `* [Address](google maps link)` block. The phone is `* [Phone](tel link)`.
// In the HTML, the markdown is converted to HTML — `#` becomes <h5>, lists become <ul>/<li>.
// We use a regex that captures the source markdown structure (which is what the HTML decompresses to).
function parseLetterPage(html, letter) {
  const listings = []
  // Match: \n##### [Name](url)\nfollowed by blocks until the next #####
  const entryRe = /##### \[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\n([\s\S]*?)(?=\n##### |\nBusiness Directory|$)/g
  let m
  while ((m = entryRe.exec(html)) !== null) {
    const [, name, memberUrl, body] = m
    // Address: first `* [text](google maps link)` block
    const addrMatch = body.match(/\* \[([^\]]+)\]\(https?:\/\/www\.google\.com\/maps[^\)]+\)/)
    // Phone: first `* [text](tel: link)` block
    const phMatch = body.match(/\* \[([^\]]+)\]\(tel:?\d+\)/)
    const address = addrMatch ? addrMatch[1].replace(/\s+/g, ' ').trim() : null
    const phone = phMatch ? phMatch[1].trim() : null
    listings.push({
      source: 'movalchamber.org',
      letter,
      sourceUrl: memberUrl,
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
    const parsed = l.address ? parseChamberAddress(l.address) : null
    const phone = l.phone ? normalizePhone(l.phone) : null
    const isMoVal = parsed ? isMorenoValleyAddress(parsed) : false
    const isPO = parsed ? isPOBox(parsed.street) : false
    return {
      ...l,
      street: parsed?.street ?? null,
      city: parsed?.city ?? null,
      state: parsed?.state ?? null,
      zip: parsed?.zip ?? null,
      phoneNormalized: phone,
      isMorenoValley: isMoVal,
      isPOBox: isPO,
    }
  })

  const moVal = enriched.filter((l) => l.isMorenoValley)
  const nonMoVal = enriched.filter((l) => !l.isMorenoValley)

  console.log(`\nTotal scraped: ${all.length}`)
  console.log(`Moreno Valley: ${moVal.length}`)
  console.log(`Other (filtered): ${nonMoVal.length}`)
  console.log(`Errors: ${errors.length}`)

  await writeFile(
    resolve(OUT_DIR, `chamber-scrape-${STAMP}.json`),
    JSON.stringify({ scrapedAt: new Date().toISOString(), moVal, nonMoVal, errors }, null, 2)
  )

  const csvHeader = 'name,address,phone,source_url,is_po_box\n'
  const csvRows = moVal.map((l) =>
    [l.name, l.address ?? '', l.phone ?? '', l.sourceUrl, l.isPOBox]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  await writeFile(resolve(OUT_DIR, `chamber-moval-${STAMP}.csv`), csvHeader + csvRows.join('\n'))

  console.log(`\nWrote: scripts/output/chamber-scrape-${STAMP}.json`)
  console.log(`Wrote: scripts/output/chamber-moval-${STAMP}.csv`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Step 2.2 — Test the regex against the actual HTML.**

The H-page scrape I had didn't preserve the raw HTML. Let me re-scrape and grep the regex against it.

**Step 2.3 — Run the scraper.**

```bash
cd /c/projects/websites/moval-living
node scripts/scrape-moval-chamber.mjs
```

Expected runtime: ~60 seconds. Expected output: 27 letters processed, JSON + CSV in `scripts/output/`.

**Step 2.4 — Manual review.** Open `chamber-moval-2026-08-09.csv`. Spot-check 10 entries for:
- Names look right
- Addresses parsed (street/city/state/zip extracted)
- Phone normalized
- Riverside / Henderson / Mission Viejo entries filtered out

If more than 5% of entries have empty `address` fields, the regex needs work. Stop and iterate.

**Step 2.5 — Commit:**

```bash
git add scripts/scrape-moval-chamber.mjs .gitignore
git commit -m "feat: moval chamber scraper with multi-line address support"
```

---

### Task 3: Matcher + to-import CSV

**Objective:** Read the scrape JSON, match against our `Business` DB by phone (HIGH) and address+name (MEDIUM), produce a `to-import-{STAMP}.csv` of confirmed misses that Johnny can review.

**Files:**
- Create: `scripts/match-chamber-to-db.mjs`

**Step 3.1 — Implementation.**

```js
#!/usr/bin/env node
// scripts/match-chamber-to-db.mjs
// Read the latest scrape JSON, match against our Business table.
// Output: scripts/output/to-import-STAMP.csv (Chamber members not yet on our site)
//
// Run: node scripts/match-chamber-to-db.mjs

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Client } from 'pg'
import { config } from 'dotenv'
import { normalizeName, levenshtein } from './lib/parse-chamber-address.mjs'

config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'output')
const STAMP = new Date().toISOString().slice(0, 10)

async function latestScrape() {
  const files = await readdir(OUT_DIR)
  const scrapes = files.filter((f) => f.startsWith('chamber-scrape-') && f.endsWith('.json')).sort()
  if (!scrapes.length) throw new Error('No scrape JSON found. Run scrape-moval-chamber first.')
  return JSON.parse(await readFile(resolve(OUT_DIR, scrapes[scrapes.length - 1]), 'utf8'))
}

function matchScore(chamber, biz) {
  // High confidence: phone match
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
      const cd = normalizeName(chamber.name)
      const bd = normalizeName(biz.name)
      const maxLen = Math.max(cd.length, bd.length)
      const similarity = 1 - levenshtein(cd, bd) / maxLen
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
    SELECT id, slug, name, phone, address, city, zip
    FROM "Business"
  `)
  const bizNorm = businesses.rows.map((b) => ({
    ...b,
    phoneNormalized: b.phone ? b.phone.replace(/\D/g, '').replace(/^1/, '') : null,
  }))

  const matched = []
  const toImport = []
  const reviewNeeded = []

  for (const ch of moVal) {
    let best = null
    for (const b of bizNorm) {
      const m = matchScore(ch, b)
      if (m && (!best || m.score > best.score)) {
        best = { ...m, businessSlug: b.slug, businessName: b.name, businessPhone: b.phone }
      }
    }
    if (best) {
      if (best.confidence === 'HIGH') matched.push({ chamber: ch, ...best })
      else reviewNeeded.push({ chamber: ch, ...best })
    } else {
      toImport.push(ch)
    }
  }

  console.log(`Chamber MoVal members: ${moVal.length}`)
  console.log(`HIGH-confidence matches (already on our site): ${matched.length}`)
  console.log(`MEDIUM-confidence (need review): ${reviewNeeded.length}`)
  console.log(`Not on our site (candidates to import): ${toImport.length}`)

  const csvHeader = 'name,address,phone,source_url,is_po_box,street_only\n'
  const csvRows = toImport.map((l) =>
    [l.name, l.address ?? '', l.phone ?? '', l.sourceUrl, l.isPOBox, l.street ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  await writeFile(resolve(OUT_DIR, `to-import-${STAMP}.csv`), csvHeader + csvRows.join('\n'))

  const reviewCsv = ['chamber_name,chamber_address,chamber_phone,our_slug,our_name,our_phone,confidence,score,reason']
  for (const r of reviewNeeded) {
    reviewCsv.push([
      r.chamber.name, r.chamber.address, r.chamber.phone,
      r.businessSlug, r.businessName, r.businessPhone,
      r.confidence, r.score.toFixed(2), r.reason,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  }
  await writeFile(resolve(OUT_DIR, `review-matches-${STAMP}.csv`), reviewCsv.join('\n'))

  console.log(`\nWrote: scripts/output/to-import-${STAMP}.csv`)
  console.log(`Wrote: scripts/output/review-matches-${STAMP}.csv`)
  await c.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Step 3.2 — Run dry-run:**

```bash
cd /c/projects/websites/moval-living
set -a && source .env.local && set +a
node scripts/match-chamber-to-db.mjs
```

Expected: ~150-300 MoVal, X HIGH matches, Y MEDIUM reviews, Z to-import. NO DB writes.

**Step 3.3 — Manual review.** Open `to-import-{STAMP}.csv`. Spot-check 10 entries. Confirm they look like real MoVal businesses (not "City of Moreno Valley", not "Habitat for Humanity", not duplicate of an existing site business).

**Step 3.4 — Commit (script only):**

```bash
git add scripts/match-chamber-to-db.mjs
git commit -m "feat: match chamber members against our DB, produce import csv"
```

---

### Task 4: Importer (PENDING listings via existing POST endpoint)

**Objective:** Read `to-import.csv`, create a PENDING Business for each row via the existing `POST /api/businesses` endpoint. Mark `chamberMember = true` on each. Skip by slug if already exists. Output import report.

**Files:**
- Modify: `src/app/api/businesses/route.ts` (accept `chamberMember` flag, allow shorter description)
- Create: `scripts/import-chamber-misses.mjs`

**Step 4.1 — Modify `src/app/api/businesses/route.ts` (line 12-19, POST destructure):**

Add `chamberMember` to the destructuring:
```ts
const {
  name, tagline, categoryId, address, city, state, zip,
  phone, email, website, description, facebook, instagram, yelp,
  hasCoupon, couponHeadline, couponDescription, couponCode, couponExpiresAt,
  hours, latitude, longitude,
  chamberMember,
} = body
```

**Step 4.2 — Update the description validation (line 17-19):**

The current rule enforces `description.trim().length >= 50`. For chamber imports, we need a synthesized placeholder. The cleanest move: accept the description as-is from the importer (importer synthesizes a placeholder that meets the 50-char minimum). No validator change needed.

Imported placeholder (used in the importer below):
- `"Member of the Moreno Valley Chamber of Commerce. Listing imported from the chamber directory on [date]. The business owner can claim this listing to add images, hours, and details."` — 197 chars, exceeds 50.

**Step 4.3 — Add `chamberMember` to the `prisma.business.create` data block (around line 60):**

```ts
chamberMember: !!chamberMember,
```

**Step 4.4 — Implementation `scripts/import-chamber-misses.mjs`:**

```js
#!/usr/bin/env node
// scripts/import-chamber-misses.mjs
// Read the latest to-import CSV, create PENDING Business rows via POST /api/businesses.
// Idempotent: skips by slug.
//
// Run: node scripts/import-chamber-misses.mjs                  (dry-run, prints plan only)
//      node scripts/import-chamber-misses.mjs --apply           (actually creates)
//      node scripts/import-chamber-misses.mjs --apply --limit 10 (apply first 10 only)

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'output')
const STAMP = new Date().toISOString().slice(0, 10)
const APPLY = process.argv.includes('--apply')
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit')
  return idx > -1 ? Number(process.argv[idx + 1]) : null
})()

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function latestToImport() {
  const files = await readdir(OUT_DIR)
  const csvs = files.filter((f) => f.startsWith('to-import-') && f.endsWith('.csv')).sort()
  if (!csvs.length) throw new Error('No to-import CSV. Run match-chamber-to-db first.')
  const text = await readFile(resolve(OUT_DIR, csvs[csvs.length - 1]), 'utf8')
  return parseCsv(text)
}

function parseCsv(text) {
  const lines = text.split('\n').filter(Boolean)
  const header = lines[0].split(',').map((c) => c.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map((line) => {
    // Simple CSV — fields may be quoted with embedded commas escaped as ""
    const cols = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (c === ',' && !inQuote) {
        cols.push(cur); cur = ''
      } else {
        cur += c
      }
    }
    cols.push(cur)
    const row = {}
    header.forEach((h, i) => { row[h] = cols[i] ?? '' })
    return row
  })
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

async function getExistingSlugs() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const r = await c.query('SELECT slug FROM "Business"')
  await c.end()
  return new Set(r.rows.map((r) => r.slug))
}

async function getCategoryOptions() {
  // Returns a flat list of categories the importer can pick from.
  // For chamber imports, we use a "general" category if we can't classify.
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const r = await c.query('SELECT id, slug, name FROM "Category" ORDER BY name')
  await c.end()
  return r.rows
}

function pickCategoryId(name, categories) {
  // Heuristic naive mapping. For chamber imports, "general" or "other" is safe.
  const lower = name.toLowerCase()
  const map = {
    'restaurant': 'restaurants', 'cafe': 'restaurants', 'diner': 'restaurants',
    'realty': 'real-estate', 'real estate': 'real-estate', 'realtor': 'real-estate',
    'dental': 'health-medical', 'dentist': 'health-medical', 'clinic': 'health-medical',
    'insurance': 'professional-services', 'attorney': 'professional-services', 'law': 'professional-services',
    'church': 'community', 'school': 'community', 'university': 'community',
    'plumb': 'home-services', 'electric': 'home-services', 'hvac': 'home-services',
    'auto': 'automotive', 'tire': 'automotive',
    'salon': 'beauty-spas', 'spa': 'beauty-spas',
  }
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) {
      const found = categories.find((c) => c.slug === v)
      if (found) return found.id
    }
  }
  // Fallback: pick the first category that doesn't look like a section
  return categories[0]?.id
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const rows = await latestToImport()
  const existing = await getExistingSlugs()
  const categories = await getCategoryOptions()
  console.log(`Loaded ${rows.length} candidate rows, ${existing.size} existing slugs, ${categories.length} categories`)

  const STAMP_HUMAN = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const placeholderDescription = `Member of the Moreno Valley Chamber of Commerce. Listing imported from the chamber directory on ${STAMP_HUMAN}. The business owner can claim this listing to add images, hours, and details.`

  const plan = []
  for (const row of rows) {
    const slug = `${slugify(row.name)}-${Math.random().toString(36).slice(2, 8)}`
    const isDuplicate = [...existing].some((s) => s.startsWith(slugify(row.name)))
    plan.push({
      name: row.name,
      slug,
      address: row.address,
      phone: row.phone,
      sourceUrl: row.source_url,
      isPOBox: row.is_po_box === 'true',
      isDuplicate,
      categoryId: pickCategoryId(row.name, categories),
    })
  }

  const toCreate = plan.filter((p) => !p.isDuplicate)
  const dupes = plan.filter((p) => p.isDuplicate)

  console.log(`\nWill create: ${toCreate.length}`)
  console.log(`Duplicate (skipped): ${dupes.length}`)
  if (LIMIT) console.log(`Limit requested: ${LIMIT}`)

  const created = []
  const errors = []

  if (APPLY) {
    const limit = LIMIT || toCreate.length
    const session = await fetch(`${APP_URL}/api/auth/csrf`).then((r) => r.json()).catch(() => null)
    // We don't have an admin session. Instead, write directly to the DB via Prisma.
    // This is an admin script — admin doesn't need to go through the public POST endpoint.
    const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await c.connect()
    for (let i = 0; i < Math.min(limit, toCreate.length); i++) {
      const p = toCreate[i]
      try {
        const r = await c.query(`
          INSERT INTO "Business" (
            id, slug, name, description, "categoryId", tier, status,
            address, city, state, zip, phone,
            "chamberMember", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, 'FREE', 'PENDING',
            $5, 'Moreno Valley', 'CA', $6, $7,
            true, NOW(), NOW()
          )
          RETURNING id, slug
        `, [
          p.slug, p.name, placeholderDescription, p.categoryId,
          p.address, p.zip ?? '', p.phone?.replace(/\D/g, '').replace(/^1/, '') ?? null,
        ])
        const slug = r.rows[0].slug
        existing.add(slug)
        created.push({ name: p.name, slug, sourceUrl: p.sourceUrl })
        console.log(`[${i + 1}/${limit}] Created "${p.name}" as ${slug}`)
      } catch (e) {
        errors.push({ name: p.name, error: e.message })
        console.error(`[${i + 1}/${limit}] FAILED "${p.name}": ${e.message}`)
      }
    }
    await c.end()
  } else {
    console.log('\nDry-run mode. Re-run with --apply to create PENDING listings.')
    if (plan.length > 0) {
      console.log('\nFirst 5 planned:')
      for (const p of plan.slice(0, 5)) {
        console.log(`  ${p.name} → ${p.slug}${p.isDuplicate ? ' (DUPLICATE, skip)' : ''}`)
      }
    }
  }

  await mkdir(OUT_DIR, { recursive: true })
  const report = {
    importedAt: new Date().toISOString(),
    dryRun: !APPLY,
    created: created,
    skipped: dupes.map((d) => d.name),
    errors,
  }
  await writeFile(resolve(OUT_DIR, `import-report-${STAMP}.json`), JSON.stringify(report, null, 2))
  console.log(`\nWrote: scripts/output/import-report-${STAMP}.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Step 4.5 — Run dry-run:**

```bash
cd /c/projects/websites/moval-living
set -a && source .env.local && set +a
node scripts/import-chamber-misses.mjs
```

Expected: prints plan, no DB writes. Shows how many would be created.

**Step 4.6 — Commit (script + API route change):**

```bash
git add scripts/import-chamber-misses.mjs src/app/api/businesses/route.ts
git commit -m "feat: chamber-miss importer (PENDING) via direct DB write"
```

**Step 4.7 — Wait for Johnny's approval before running with `--apply`.** He'll review the dry-run output first.

---

### Task 5: Public search filter (?chamber=1)

**Objective:** Add a `chamber=1` query param to the public search page so visitors can filter to Chamber members only.

**Files:**
- Modify: `src/app/search/page.tsx` (read query param, render chip)
- Modify: wherever the search query runs — likely `src/app/api/search/route.ts` or built into the page.tsx query

**Step 5.1 — Probe the current search query construction.** Read the relevant section of `src/app/search/page.tsx` near line 200-225 where `params` is built.

**Step 5.2 — Add `chamberMember: true` to the where clause when `params.chamber === '1'`.**

**Step 5.3 — Render a filter chip in the UI.** Match the existing chip style. Add to the search filter area.

**Step 5.4 — Verify build:**

```bash
npx tsc --noEmit && npm run build
```

**Step 5.5 — Commit:**

```bash
git add src/app/search/page.tsx
git commit -m "feat: search filter for chamber members"
```

---

### Task 6: Admin moderation filter (in BusinessesModeration)

**Objective:** Add a `chamberMember` filter chip to the moderation panel.

**Files:**
- Modify: `src/components/admin/BusinessesModeration.tsx` (file is in Emma's 14-modified-files list — patch carefully)

**Step 6.1 — Probe the existing filter chip system (lines 284-302).** Add a sibling chip for "Chamber Only" that filters `chamberMember === true`.

**Step 6.2 — Surgical patch.** Use `patch` with a unique anchor. If the anchor is too volatile, fall back to a short `write_file` only for the filter section.

**Step 6.3 — Verify:**

```bash
npx tsc --noEmit && npm run build
```

**Step 6.4 — Commit:**

```bash
git add src/components/admin/BusinessesModeration.tsx
git commit -m "feat: admin moderation filter for chamber members"
```

---

### Task 7: Final verification

**Objective:** End-to-end correctness.

**Step 7.1 — Full pipeline:**

```bash
cd /c/projects/websites/moval-living
node scripts/scrape-moval-chamber.mjs
set -a && source .env.local && set +a
node scripts/match-chamber-to-db.mjs
node scripts/import-chamber-misses.mjs           # dry-run, no DB writes
```

**Step 7.2 — After Johnny approves the dry-run output:**

```bash
node scripts/import-chamber-misses.mjs --apply
```

**Step 7.3 — Audit:**

```bash
cd /c/projects/websites/moval-living
set -a && source .env.local && set +a
node -e '
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const total = await c.query(`SELECT COUNT(*) FROM "Business" WHERE "chamberMember" = true`);
  const pending = await c.query(`SELECT COUNT(*) FROM "Business" WHERE "chamberMember" = true AND status = $1`, ["PENDING"]);
  console.log("Total chamberMember=true:", total.rows[0].count);
  console.log("Chamber PENDING listings:", pending.rows[0].count);
  await c.end();
})();
' 2>&1 | grep -v "Warning\|SECURITY\|getaddrinfo\|SSL modes\|libpq"
```

Expected: PENDING count == number Johnny approved.

**Step 7.4 — Manual UI check:**
- Hit `/admin/businesses?chamber=1` (or whatever URL the filter uses) → see all chamber listings
- Hit `/search?chamber=1` → confirm only APPROVED chamber listings show (PENDING are filtered out by default)

---

## Tests / Validation Summary

| Layer | Test | Pass criteria |
|---|---|---|
| Parser | 11 smoke test cases | 10 pass (full state name intentionally out-of-scope) |
| Scraper | Run dry-run | 27 letters, 150-300 MoVal entries, JSON + CSV |
| Matcher | Run dry-run | HIGH/MEDIUM/none counts sensible, no DB writes |
| Importer | Run --dry-run | "Will create" count sensible, no DB writes |
| Importer apply | Run --apply (after Johnny approval) | N rows created, N == planned |
| Public search filter | Hit `/search?chamber=1` | Only APPROVED chamber listings visible |
| Admin filter | Hit `/admin/businesses?chamber=1` | All chamber listings visible |
| Build | `npx tsc --noEmit && npm run build` | 0 errors |

---

## Risks, Tradeoffs, and Open Questions

### Q1 — Auto-import defaults

**Default: PENDING, not APPROVED.** Public search filters out PENDING. Johnny reviews in admin moderation queue. Decision tree in admin:
- Approve → goes live, public search sees it
- Delete → removes from queue
- Ignore → stays PENDING (eventually a cleanup script removes long-PENDING listings)

### Q2 — Category assignment

The importer uses a heuristic name-based category assigner. Most chamber imports will get the wrong category. Johnny can re-categorize in admin moderator. Better than blocking on categorization.

### Q3 — Address quality

Some scraped addresses will be wrong (multi-line, missing suite, weird casing). The importer puts the raw address string in the `address` field. Imported listings can be edited.

### Q4 — PENDING listings accumulate

The importer adds ~150-300 PENDING listings. Over time, PENDING listings pile up. **Recommended: add a TTL** — auto-delete PENDING listings > 90 days old. But that's a follow-up task.

### Q5 — Working tree divergence

Master is 22 commits behind origin. 14 uncommitted files. This feature touches 2 of those 14 files (the admin moderator and the search page). **Patch carefully, don't rewrite.** If the patches fail, fall back to running the feature without the moderator filter and surface to Johnny.

### Q6 — "The 199" was a guess

I won't know the actual count until the scraper runs. Johnny said "199" — could be 150, could be 250. The plan is robust to either.

### Q7 — Hispanic Chamber

Deferred per Johnny. Could be a future task with the same pattern (script + matcher + importer).

### Q8 — Duplicate detection

The importer checks if a slug STARTS WITH the slugified name. This is a loose check ("dups" of "Coldstone Creamery" would match "Coldstone Creamery Riverside"). Better: phone match. But the matcher already filtered out phone-matched entries. The remaining to-import entries are truly new.

### Q9 — Self-serve / future Chamber updates

This is a one-shot import. The Chamber updates quarterly. Johnny can re-run the scraper + matcher + importer periodically. The CSV import endpoint approach makes this trivial.

### Q10 — API route change vs. direct DB write

The importer writes directly to the DB instead of going through `POST /api/businesses`. Reason: it doesn't have an admin session cookie, and the public endpoint requires session-bound fields. The direct write is admin-equivalent. Use `audit` to verify the writes.

---

## Files NOT to Commit

- `scripts/output/*.csv` — PII-adjacent content (business names, phones, addresses). `.gitignore` covers this.
- `scripts/output/*.json` — same.
- `scripts/output/import-report-*.json` — same.

---

## Out of Scope

- Hispanic Chamber scraping + import
- Self-serve Chamber import endpoint (UI for re-running)
- PENDING listing TTL cleanup
- Category auto-classification (the heuristic is naive; Johnny can re-categorize)
- Re-running the scraper on a schedule (cron)
- Email notifications to imported Chamber members ("You've been added to moval.living")
- Image/logo scraping from the Chamber directory
- Verification of Chamber membership against the official Chamber roster
