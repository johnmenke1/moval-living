/**
 * chamber-matcher.mts
 *
 * Scrape the Moreno Valley Chamber of Commerce member directory and tag
 * matching businesses in the moval.living DB with `chamberMember = true`.
 * Also reports Moreno Valley–based members that we don't have on file yet
 * (no auto-create — admin reviews those manually).
 *
 * Source: https://business.movalchamber.org/list/searchalpha/<bucket>
 * The directory is server-rendered GrowthZone HTML. Each alpha page lists
 * ~26 members with: name (linked to detail page), city, state, zip, phone,
 * short description. Detail pages add website + category but we don't need
 * them for matching — alpha pages have everything.
 *
 * Usage:
 *   npx tsx scripts/chamber-matcher.mts --dry-run   # report only, no DB writes
 *   npx tsx scripts/chamber-matcher.mts             # tag matches in DB
 *   npx tsx scripts/chamber-matcher.mts --bucket=m  # one bucket only (smoke test)
 *
 * Matching strategy (in priority order):
 *   1. Exact name match (case-insensitive, whitespace-collapsed) AND city
 *      is "Moreno Valley"  → strongest
 *   2. Exact name match with city in adjacent MV-served cities
 *      (Riverside, Perris, Redlands, San Bernardino) AND zip starts 9255x
 *      → still likely a match (chamber membership often covers nearby cities)
 *   3. Fuzzy name match (Levenshtein ≤ 2) AND MV city/zip  → review-flagged
 *
 * Conservative defaults: only auto-tag #1 by default. #2 and #3 are printed
 * with a `review:` prefix so Johnny can decide before re-running with
 * --include-review if he wants.
 */

import * as cheerio from 'cheerio';
import { getPrisma } from '../src/lib/prisma';

const BASE_URL = 'https://business.movalchamber.org';
const LIST_URL = (bucket: string) => `${BASE_URL}/list/searchalpha/${bucket}`;

// All 27 alpha buckets GrowthZone uses. "0-9" covers numeric prefixes.
const ALL_BUCKETS = [
  '0-9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
];

// Polite rate limit — GrowthZone is a third-party CMS, we don't want to
// hammer it. 500ms between page loads is enough to stay well under any
// sensible rate limit while still finishing in ~15 seconds for 27 pages.
const PAGE_DELAY_MS = 500;

// Moreno Valley zip prefixes. The chamber serves the broader region, but
// these are the unambiguous "this is a Moreno Valley address" zips.
const MV_ZIP_PREFIXES = ['92553', '92554', '92555', '92556', '92557', '92551'];

// Cities the MV chamber regularly includes members from. We only treat
// these as a strong-enough match if the zip also matches.
const ADJACENT_CITIES = ['Riverside', 'Perris', 'Moreno Valley', 'Redlands', 'San Bernardino'];

// CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bucketArg = args.find((a) => a.startsWith('--bucket='));
const onlyBucket = bucketArg ? bucketArg.split('=')[1] : null;
const includeReview = args.includes('--include-review'); // tag #2/#3 matches too

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Normalize a name for comparison: lowercase, drop common corporate
 *  suffixes (Inc, LLC, etc.) and punctuation, collapse whitespace.
 *  Also strip trailing city/location hints like "Moreno Valley" since the
 *  chamber often lists "Ayres Hotel & Spa" but our DB has
 *  "Ayres Hotel & Spa Moreno Valley" for clarity. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|the)\b\.?/g, '')
    .replace(/\b(moreno valley|mv|inland empire|ie)\b/g, '')
    .replace(/[.,'"!?&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple Levenshtein distance for fuzzy matching. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

interface ChamberMember {
  name: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  description: string;
  detailUrl: string;
}

async function fetchBucket(bucket: string): Promise<ChamberMember[]> {
  const url = LIST_URL(bucket);
  const res = await fetch(url, {
    headers: {
      // Identity as a normal browser — GrowthZone occasionally blocks
      // obviously-bot UAs. The site is fully static, so any UA works.
      'User-Agent':
        'Mozilla/5.0 (compatible; MovalLivingChamberMatcher/1.0; +https://www.moval.living)',
      Accept: 'text/html',
    },
  });
  if (!res.ok) {
    throw new Error(`Bucket ${bucket}: HTTP ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const members: ChamberMember[] = [];

  // GrowthZone wraps each member listing in a div containing an h5/h3 with
  // the business name (linked to the detail page), then address lines, then
  // phone, then a description. We grab the h-tags that link to /list/member/.
  /** GrowthZone wraps each member card in .gz-list-card-wrapper. The structure
 *  inside is:
 *    .gz-card-title  a  → business name + link
 *    .gz-card-address
 *      .gz-street-address  → street
 *      .gz-address-city    → city
 *      span[CA]            → state
 *      span[92553]         → zip
 *    .gz-card-phone  a[href^="tel:"]  → phone
 *  We anchor on the wrapper and pull each field by class — robust against
 *  formatting changes since the spans are explicit. */
const $cards = $('.gz-list-card-wrapper');

$cards.each((_, card) => {
  const $card = $(card);
  const $nameLink = $card.find('.gz-card-title a').first();
  const href = $nameLink.attr('href');
  const name = $nameLink.text().trim();
  if (!href || !name) return;

  const city = $card.find('.gz-address-city').first().text().trim();
  const state = $card.find('.gz-card-address').text().match(/\bCA\b/) ? 'CA' : '';
  // Zip is always the LAST 5-digit token in the address block — street
  // numbers come first. Taking the last match avoids grabbing "22364"
  // when the real zip is "92553". Truncate ZIP+4 to the 5-digit form.
  const addrText = $card.find('.gz-card-address').text();
  const allZips = addrText.match(/\b\d{5}(?:-\d{4})?\b/g);
  const zip = allZips && allZips.length ? allZips[allZips.length - 1].slice(0, 5) : '';

  const telHref = $card.find('a[href^="tel:"]').first().attr('href');
  const phone = telHref ? telHref.replace(/^tel:/, '') : null;

  // Description: the longest <p> or text block in the card body, if any.
  // GrowthZone shows a blurb on category-filtered pages but not on alpha
  // pages, so this is often empty here — that's fine.
  let description = '';
  $card.find('p, .gz-card-description, .card-text').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > description.length) description = t;
  });

  const detailUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;

  members.push({
    name,
    city,
    state,
    zip,
    phone,
    description: description.slice(0, 500),
    detailUrl,
  });
});
  return members;
}

async function main() {
  const buckets = onlyBucket ? [onlyBucket] : ALL_BUCKETS;
  console.log(`\n=== Chamber Matcher ===`);
  console.log(`Mode:        ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE (will tag matches)'}`);
  console.log(`Buckets:     ${buckets.join(', ')}`);
  console.log(`Include review-tier matches: ${includeReview}`);
  console.log('');

  // Load all chamber members
  const allMembers: ChamberMember[] = [];
  for (const bucket of buckets) {
    process.stdout.write(`  Scraping bucket ${bucket}… `);
    try {
      const m = await fetchBucket(bucket);
      allMembers.push(...m);
      console.log(`${m.length} members`);
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (buckets.length > 1) await sleep(PAGE_DELAY_MS);
  }

  console.log(`\nScraped ${allMembers.length} total members from ${buckets.length} bucket(s).\n`);

  // Load all our businesses into memory (only the columns we need to match).
  // With ~506 rows this is fine; if it ever grows, switch to a DB-side
  // similarity query.
  const prisma = getPrisma();
  const ourBusinesses = await prisma.business.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      chamberMember: true,
      hispanicChamberMember: true,
    },
  });

  console.log(`Loaded ${ourBusinesses.length} moval.living businesses.\n`);

  // Build normalized lookup: name → business
  const byNormalizedName = new Map<string, typeof ourBusinesses[number]>();
  for (const b of ourBusinesses) {
    const key = normalizeName(b.name);
    if (!byNormalizedName.has(key)) byNormalizedName.set(key, b);
    // Note: collisions stay with the first one inserted. Real duplicates
    // already get caught by the dupes scripts elsewhere.
  }

  // Match
  type MatchResult = {
    member: ChamberMember;
    business: typeof ourBusinesses[number];
    tier: 'exact-mv' | 'exact-adjacent' | 'fuzzy';
    confidence: number;
  };

  const matches: MatchResult[] = [];
  const mvMembersNotOnFile: ChamberMember[] = [];
  const reviewedButUnmatched: ChamberMember[] = [];

  for (const m of allMembers) {
    const norm = normalizeName(m.name);
    const candidate = byNormalizedName.get(norm);

    // Strongest: exact normalized name + city is MV
    if (candidate && (m.city === 'Moreno Valley' || MV_ZIP_PREFIXES.includes(m.zip))) {
      matches.push({ member: m, business: candidate, tier: 'exact-mv', confidence: 1 });
      continue;
    }

    // Adjacent city, but zip is MV — likely same business
    if (
      includeReview &&
      candidate &&
      ADJACENT_CITIES.includes(m.city) &&
      MV_ZIP_PREFIXES.includes(m.zip)
    ) {
      matches.push({ member: m, business: candidate, tier: 'exact-adjacent', confidence: 0.9 });
      continue;
    }

    // Fuzzy: scan all candidates, pick closest with Levenshtein ≤ 2 AND
    // MV-zip match.
    let best: { business: typeof ourBusinesses[number]; dist: number } | null = null;
    if (includeReview) {
      for (const b of ourBusinesses) {
        const d = levenshtein(norm, normalizeName(b.name));
        if (d <= 2 && (!best || d < best.dist)) best = { business: b, dist: d };
      }
    }
    if (best && (m.city === 'Moreno Valley' || MV_ZIP_PREFIXES.includes(m.zip))) {
      matches.push({
        member: m,
        business: best.business,
        tier: 'fuzzy',
        confidence: 0.7 - best.dist * 0.2,
      });
      continue;
    }

    // No match. If this member is MV-based, surface them in the
    // "missing" report so Johnny can decide whether to add them.
    if (m.city === 'Moreno Valley' || MV_ZIP_PREFIXES.includes(m.zip)) {
      mvMembersNotOnFile.push(m);
    } else if (m.city) {
      reviewedButUnmatched.push(m);
    }
  }

  // Report
  console.log(`=== MATCH RESULTS ===`);
  console.log(`  Tagged (exact + MV):           ${matches.filter((m) => m.tier === 'exact-mv').length}`);
  console.log(`  Tagged (exact + adjacent):     ${matches.filter((m) => m.tier === 'exact-adjacent').length}`);
  console.log(`  Tagged (fuzzy):                ${matches.filter((m) => m.tier === 'fuzzy').length}`);
  console.log(`  MV members NOT on file:        ${mvMembersNotOnFile.length}`);
  console.log(`  Out-of-area, not on file:      ${reviewedButUnmatched.length}`);
  console.log('');

  // Detailed match list
  console.log(`=== DETAILED MATCHES ===`);
  for (const match of matches) {
    const tag = match.tier === 'exact-mv' ? '✓' : match.tier === 'exact-adjacent' ? '~' : '?';
    const alreadyTagged = match.business.chamberMember ? ' [already tagged]' : '';
    console.log(
      `  ${tag} ${match.member.name.padEnd(40)} ${(match.member.city || '?').padEnd(20)} ` +
        `→ ${match.business.slug}${alreadyTagged}`
    );
  }
  console.log('');

  // Detailed "missing" list — these are Moreno Valley–based chamber members
  // we don't have on file. Johnny can review and decide whether to add.
  console.log(`=== MV MEMBERS NOT ON FILE (consider adding) ===`);
  for (const m of mvMembersNotOnFile) {
    console.log(
      `  + ${m.name.padEnd(40)} ${(m.city || '?').padEnd(20)} ${m.zip.padEnd(6)} ` +
        `${m.phone ? m.phone.padEnd(15) : ''} ${m.detailUrl}`
    );
  }
  console.log('');

  // Out-of-area members — informational only, useful for understanding
  // how many non-MV members the chamber has.
  if (reviewedButUnmatched.length) {
    console.log(`=== OUT-OF-AREA MEMBERS (informational) ===`);
    for (const m of reviewedButUnmatched) {
      console.log(`    ${m.name.padEnd(40)} ${(m.city || '?').padEnd(20)} ${m.zip}`);
    }
    console.log('');
  }

  // Apply tags (unless dry-run)
  if (dryRun) {
    console.log(`DRY RUN — skipping DB writes. Re-run without --dry-run to apply.`);
    return;
  }

  let tagged = 0;
  let skipped = 0;
  for (const match of matches) {
    if (match.business.chamberMember) {
      skipped++;
      continue;
    }
    await prisma.business.update({
      where: { id: match.business.id },
      data: { chamberMember: true },
    });
    tagged++;
  }

  console.log(`=== DB WRITE COMPLETE ===`);
  console.log(`  Tagged:    ${tagged}`);
  console.log(`  Skipped (already tagged): ${skipped}`);
  console.log('');
  console.log(`Done. Re-run --dry-run anytime to verify.`);
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });