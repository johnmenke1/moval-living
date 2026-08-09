/**
 * chamber-import.mts
 *
 * Imports the businesses from reports/chamber-missing.csv (Moreno Valley
 * Chamber members we don't have on file yet) into the moval.living DB.
 *
 * Creates one row per CSV entry with:
 *   - chamberMember = true   (so the Chamber badge renders)
 *   - status       = APPROVED (so they're searchable + filterable on the
 *                              public search page right away)
 *   - tier         = FREE     (no promotion; Johnny can upgrade manually)
 *   - category     = best guess from a keyword→slug map; falls back to
 *                    'other' if no signal
 *   - slug         = name-derived + nanoid(6) suffix (matches the existing
 *                    /api/businesses POST pattern)
 *   - description  = placeholder explaining this is a chamber import, with
 *                    the source URL. Owner can rewrite it when they claim.
 *
 * Idempotency: skips any name (normalized) that already exists in the DB,
 * so re-running is safe even after the CSV is regenerated.
 *
 * Usage:
 *   npx tsx scripts/chamber-import.mts --dry-run                # report only
 *   npx tsx scripts/chamber-import.mts                           # live import
 *   npx tsx scripts/chamber-import.mts --csv=reports/foo.csv     # alternate CSV
 */

import { readFileSync } from 'node:fs';
import { nanoid } from 'nanoid';
import { getPrisma } from '../src/lib/prisma';

const DEFAULT_CSV = 'reports/chamber-missing.csv';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvArg = args.find((a) => a.startsWith('--csv='));
const csvPath = csvArg ? csvArg.split('=')[1] : DEFAULT_CSV;

interface CsvRow {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  description: string;
  detail_url: string;
  source: string;
}

/** Minimal CSV parser — handles quoted fields with embedded commas and
 *  escaped double-quotes. We control the input format (it's our own
 *  chamber-missing-csv output), so this is fine. */
function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const out: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    out.push({
      name: row.name || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.zip || '',
      phone: row.phone || '',
      description: row.description || '',
      detail_url: row.detail_url || '',
      source: row.source || '',
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ',') {
        out.push(cur);
        cur = '';
      } else if (c === '"' && cur === '') {
        inQuotes = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
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

/** Best-effort keyword match for a category slug. Ordered most-specific
 *  first; the first match wins. Categories use slugs as primary keys
 *  (see src/data/categories.ts). */
function guessCategorySlug(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  // Most specific first
  const rules: Array<[RegExp, string]> = [
    // Restaurants / food
    [/\b(restaurant|cafe|coffee|diner|bistro|grill|burger|kitchen|tacos?|pizza|sushi|bar & grill|brewery|cantina|taqueria|deli|food truck|cater|cupcake|bakery|donut)\b/, 'restaurants'],

    // Healthcare — split dental vs general so the icon matches
    [/\b(dentist|dental|orthodont)\b/, 'healthcare'],
    [/\b(doctor|clinic|medical|hospital|health care|chiropract|optometr|optical|therap|pharmacy|urgent care)\b/, 'healthcare'],
    [/\b(veterinar|animal hospital|pet|dog|cat|kennel|groom)\b/, 'pets'],

    // Finance
    [/\b(insurance)\b/, 'finance'],
    [/\b(bank|credit union|financial|wealth|mortgage|lending|accounting|tax |cpa |bookkeep)\b/, 'finance'],

    // Professional services
    [/\b(attorney|law firm|legal|esq|notary)\b/, 'professional'],
    [/\b(consultant|marketing|advertising|pr firm|public relations|staffing|recruit|employment)\b/, 'professional'],
    [/\b(media|printing|signs?|graphics?|design studio|studio)\b/, 'professional'],
    [/\b(technology|software|computer|it |web design)\b/, 'professional'],
    [/\b(engineer|engineering|architect|survey)\b/, 'professional'],
    [/\b(security|safety training|investigation)\b/, 'professional'],

    // Real estate
    [/\b(real estate|realtor|property management|apartment|realty|title company)\b/, 'real-estate'],

    // Automotive
    [/\b(automotive|auto repair|car wash|tire|automobile|towing|dealer|auto body|paint(?!ing))\b/, 'automotive'],
    [/\b(transport|trucking|logistic|fleet)\b/, 'automotive'],

    // Contractors / home services
    [/\b(plumb|electric|hvac|roofing|painting|landscap|cleaning|janitor|handyman|home inspect|contractor|construction|remodel|general contractor|flooring|fence|solar|glass|window)\b/, 'contractors'],
    [/\b(repair|service|maintenance|install)\b/, 'contractors'],

    // Retail
    [/\b(florist|gift|retail|boutique|grocery|market|furniture|thrift|antique|book|store|shop|warehouse|amazon)\b/, 'retail'],

    // Beauty
    [/\b(salon|barber|spa|beauty|nail|massage|esthetic|hair)\b/, 'beauty'],

    // Education
    [/\b(school|education|tutor|academy|child care|daycare|preschool|university|college)\b/, 'education'],

    // Community / civic — fall into "education" as closest generic
    [/\b(city of|government|chamber|county|school district|nonprofit|non-profit|association|foundation|council|legion|veteran|museum|library)\b/, 'education'],

    // Green / environmental
    [/\b(green|alternative|energy|recycl|sustain)\b/, 'contractors'],
  ];
  for (const [pat, slug] of rules) {
    if (pat.test(text)) return slug;
  }
  return 'other';
}

async function main() {
  console.log(`\n=== Chamber CSV Import ===`);
  console.log(`Mode:  ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE (will create businesses)'}`);
  console.log(`CSV:   ${csvPath}`);
  console.log('');

  let csvText: string;
  try {
    csvText = readFileSync(csvPath, 'utf8');
  } catch (e) {
    console.error(`Could not read ${csvPath}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  const rows = parseCsv(csvText);
  console.log(`Parsed ${rows.length} rows from CSV.\n`);

  // Build dedup set against current DB (normalize on the fly — no
  // normalizedName column exists).
  const prisma = getPrisma();
  const existingNames = new Set<string>();
  const existingBusinesses = await prisma.business.findMany({ select: { name: true } });
  for (const b of existingBusinesses) existingNames.add(normalizeName(b.name));
  console.log(`Loaded ${existingBusinesses.length} existing moval.living businesses for dedup.\n`);

  // Load categories once
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
  });
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));
  console.log(`Loaded ${categories.length} categories.\n`);

  // Track which categories we guessed for each import — useful in the
  // final report so Johnny can spot-check.
  type Plan = {
    row: CsvRow;
    categorySlug: string;
    categoryId: string;
    slug: string;
    description: string;
    reason: 'duplicate' | 'no-name' | 'ready';
  };

  const plans: Plan[] = [];
  let duplicateCount = 0;
  let noNameCount = 0;

  for (const row of rows) {
    if (!row.name) {
      noNameCount++;
      continue;
    }
    if (existingNames.has(normalizeName(row.name))) {
      duplicateCount++;
      plans.push({ row, categorySlug: '', categoryId: '', slug: '', description: '', reason: 'duplicate' });
      continue;
    }
    const catSlug = guessCategorySlug(row.name, row.description);
    const cat = catBySlug.get(catSlug);
    if (!cat) {
      // 'other' may not exist in DB yet — auto-create it like the existing
      // /api/businesses POST does.
      console.warn(`No category "${catSlug}" in DB — will auto-create during insert.`);
    }
    const baseSlug = row.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60);
    const slug = `${baseSlug || 'business'}-${nanoid(6)}`;
    const desc =
      row.description ||
      `${row.name} is a member of the Moreno Valley Chamber of Commerce. ` +
      `Listing details are pending owner verification. Source: ${row.detail_url}`;
    plans.push({
      row,
      categorySlug: catSlug,
      categoryId: cat?.id ?? catSlug, // fallback id = slug for auto-create path
      slug,
      description: desc,
      reason: 'ready',
    });
  }

  // Summary by category guess
  const byCat = new Map<string, number>();
  for (const p of plans) {
    if (p.reason !== 'ready') continue;
    byCat.set(p.categorySlug, (byCat.get(p.categorySlug) ?? 0) + 1);
  }
  console.log(`\n=== PLAN ===`);
  console.log(`  To import:    ${plans.length - duplicateCount - noNameCount}`);
  console.log(`  Duplicates (already in DB): ${duplicateCount}`);
  console.log(`  Missing name (skipped):     ${noNameCount}`);
  console.log('');
  console.log(`  Category guesses:`);
  const sortedCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  for (const [slug, count] of sortedCats) {
    const catName = categories.find((c) => c.slug === slug)?.name || `${slug} (will auto-create)`;
    console.log(`    ${slug.padEnd(20)} ${count.toString().padStart(4)}  ${catName}`);
  }
  console.log('');

  if (dryRun) {
    console.log(`DRY RUN — no DB writes. Sample of first 5 imports:`);
    for (const p of plans.filter((x) => x.reason === 'ready').slice(0, 5)) {
      console.log(`  ${p.row.name.padEnd(45)} → ${p.slug.padEnd(40)} [${p.categorySlug}]`);
    }
    console.log(`\nRe-run without --dry-run to apply.`);
    return;
  }

  // Apply: create businesses one at a time so a single bad row doesn't
  // kill the whole batch. Each insert gets its own auto-create-of-category
  // fallback if needed.
  let created = 0;
  let skippedDup = 0;
  let skippedNoName = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const plan of plans) {
    if (plan.reason === 'duplicate') {
      skippedDup++;
      continue;
    }
    if (plan.reason === 'no-name') {
      skippedNoName++;
      continue;
    }
    try {
      // Ensure category exists (auto-create if missing, matching
      // /api/businesses POST behavior).
      let categoryId = plan.categoryId;
      if (!catBySlug.has(plan.categorySlug)) {
        const created_cat = await prisma.category.create({
          data: {
            id: plan.categorySlug,
            name: plan.categorySlug
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' '),
            slug: plan.categorySlug,
            icon: 'Star',
            description: '',
          },
          select: { id: true },
        });
        categoryId = created_cat.id;
        catBySlug.set(plan.categorySlug, { id: created_cat.id, slug: plan.categorySlug, name: plan.categorySlug } as any);
      }

      await prisma.business.create({
        data: {
          slug: plan.slug,
          name: plan.row.name,
          description: plan.description,
          categoryId,
          address: plan.row.address || 'Address pending verification',
          city: plan.row.city || 'Moreno Valley',
          state: plan.row.state || 'CA',
          zip: plan.row.zip || '92553',
          phone: plan.row.phone || null,
          status: 'APPROVED',
          tier: 'FREE',
          chamberMember: true,
          photos: [],
        },
      });
      // Mark as existing so we dedupe within this same run
      existingNames.add(normalizeName(plan.row.name));
      created++;
    } catch (err) {
      errors++;
      errorDetails.push(`${plan.row.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`  Created:                ${created}`);
  console.log(`  Skipped (duplicate):    ${skippedDup}`);
  console.log(`  Skipped (no name):      ${skippedNoName}`);
  console.log(`  Errors:                 ${errors}`);
  if (errors) {
    console.log(`\n  Error details:`);
    for (const e of errorDetails.slice(0, 10)) console.log(`    - ${e}`);
    if (errorDetails.length > 10) console.log(`    ... and ${errorDetails.length - 10} more`);
  }
  console.log('');
  console.log(`Done. Re-run --dry-run anytime to verify.`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});