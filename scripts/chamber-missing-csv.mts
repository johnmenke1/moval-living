/**
 * chamber-missing-csv.mts
 *
 * Companion to chamber-matcher.mts. Scrapes the Moreno Valley Chamber
 * directory and writes a CSV of every Moreno Valley–based chamber member
 * that isn't currently in our DB. Use this to seed the "missing businesses"
 * backlog — review the CSV, manually add the ones worth having.
 *
 * Usage:
 *   npx tsx scripts/chamber-missing-csv.mts                     # default path
 *   npx tsx scripts/chamber-missing-csv.mts --out=reports/missing.csv
 */

import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getPrisma } from '../src/lib/prisma';

const BASE_URL = 'https://business.movalchamber.org';
const LIST_URL = (bucket: string) => `${BASE_URL}/list/searchalpha/${bucket}`;

const ALL_BUCKETS = [
  '0-9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
];

const MV_ZIP_PREFIXES = ['92553', '92554', '92555', '92556', '92557', '92551'];

const PAGE_DELAY_MS = 500;

const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith('--out='));
const outPath = outArg ? outArg.split('=')[1] : 'reports/chamber-missing.csv';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|the)\b\.?/g, '')
    .replace(/\b(moreno valley|mv|inland empire|ie)\b/g, '')
    .replace(/[.,'"!?&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MovalLivingChamberMatcher/1.0)' },
  });
  if (!res.ok) throw new Error(`Bucket ${bucket}: HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const members: ChamberMember[] = [];
  $('.gz-list-card-wrapper').each((_, card) => {
    const $card = $(card);
    const $nameLink = $card.find('.gz-card-title a').first();
    const href = $nameLink.attr('href');
    const name = $nameLink.text().trim();
    if (!href || !name) return;

    const city = $card.find('.gz-address-city').first().text().trim();
    const state = $card.find('.gz-card-address').text().match(/\bCA\b/) ? 'CA' : '';
    const addrText = $card.find('.gz-card-address').text();
    const allZips = addrText.match(/\b\d{5}(?:-\d{4})?\b/g);
    const zip = allZips && allZips.length ? allZips[allZips.length - 1].slice(0, 5) : '';

    const telHref = $card.find('a[href^="tel:"]').first().attr('href');
    const phone = telHref ? telHref.replace(/^tel:/, '') : null;

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
  console.log(`\n=== Chamber Missing CSV ===`);
  console.log(`Output: ${outPath}`);
  console.log('');

  // Scrape
  const allMembers: ChamberMember[] = [];
  for (const bucket of ALL_BUCKETS) {
    process.stdout.write(`  Scraping bucket ${bucket}… `);
    try {
      const m = await fetchBucket(bucket);
      allMembers.push(...m);
      console.log(`${m.length} members`);
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(PAGE_DELAY_MS);
  }
  console.log(`\nScraped ${allMembers.length} total members.`);

  // Load our DB
  const prisma = getPrisma();
  const ourBusinesses = await prisma.business.findMany({
    select: { name: true },
  });
  // Build a Set of normalized names for fast lookup. We normalize on the
  // fly — there's no normalizedName column in the schema.
  const ourNormNames = new Set(ourBusinesses.map((b) => normalizeName(b.name)));
  console.log(`Loaded ${ourBusinesses.length} moval.living businesses.\n`);

  // Filter to MV-based members NOT in our DB
  const missing: ChamberMember[] = [];
  const alreadyHave: ChamberMember[] = [];
  for (const m of allMembers) {
    const isMV = m.city === 'Moreno Valley' || MV_ZIP_PREFIXES.includes(m.zip);
    if (!isMV) continue;
    if (ourNormNames.has(normalizeName(m.name))) {
      alreadyHave.push(m);
    } else {
      missing.push(m);
    }
  }

  console.log(`Moreno Valley chamber members we already have: ${alreadyHave.length}`);
  console.log(`Moreno Valley chamber members NOT on file:     ${missing.length}`);
  console.log('');

  // Sort by name for review-friendly output
  missing.sort((a, b) => a.name.localeCompare(b.name));

  // CSV escape
  const esc = (s: string | null) => {
    if (!s) return '';
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  // Build CSV
  const headers = [
    'name',
    'city',
    'state',
    'zip',
    'phone',
    'description',
    'detail_url',
    'source',
  ];
  const rows = [headers.join(',')];
  for (const m of missing) {
    rows.push(
      [
        esc(m.name),
        esc(m.city),
        esc(m.state),
        esc(m.zip),
        esc(m.phone),
        esc(m.description),
        esc(m.detailUrl),
        'movalchamber.org',
      ].join(',')
    );
  }

  // Ensure parent dir exists
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, rows.join('\n') + '\n', 'utf8');

  console.log(`Wrote ${missing.length} missing members → ${outPath}`);
  console.log('');
  console.log('Done.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});