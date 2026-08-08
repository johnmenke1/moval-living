/**
 * Backfill missing websites from Google Places API (v1).
 *
 * Why this exists: the original import script used `places:searchText`
 * (Text Search) which doesn't reliably return the `website` field even
 * with `FieldMask: '*'`. Place Details does. So we iterate over every
 * business that has a googleBusiness ID but no website, hit Place
 * Details, and store whatever Google returns.
 *
 * Run: GOOGLE_PLACES_API_KEY=<key> npx tsx scripts/backfill-websites.mts
 *      [--limit=10] [--dry-run]
 */

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY not set');
  process.exit(1);
}

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const DRY_RUN = args.includes('--dry-run');

import { getPrisma } from '../src/lib/prisma';

// Raw SQL escape helper — avoids "value contains invalid characters" errors
function sqlEscape(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

// Use raw SQL instead of p.business.update() because Prisma's generated
// types include columns (e.g. foundingPartnerRate) that don't exist in
// the live DB due to schema drift. Raw SQL avoids that mismatch.
async function updateWebsite(
  businessId: string,
  website: string
): Promise<void> {
  const { Client } = await import('pg');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(
      `UPDATE "Business" SET website = ${sqlEscape(website)}, "updatedAt" = NOW() WHERE id = ${sqlEscape(businessId)}`
    );
  } finally {
    await client.end();
  }
}

async function fetchPlaceDetails(placeId: string): Promise<{
  website: string | null;
  formattedPhone: string | null;
  formattedAddress: string | null;
} | null> {
  try {
    // Note: field is `websiteUri` in v1 (not `website`). This is an
    // Enterprise-tier field (~$35 per 1000 calls vs Basic at $3) — see
    // https://developers.google.com/maps/documentation/places/web-service/data-fields
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': API_KEY!,
          'X-Goog-FieldMask':
            'websiteUri,formattedAddress,nationalPhoneNumber',
        },
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`  ⚠️  ${placeId}: ${res.status} ${txt.slice(0, 100)}`);
      return null;
    }
    const data = await res.json();
    return {
      website: data.websiteUri || null,
      formattedPhone: data.nationalPhoneNumber || null,
      formattedAddress: data.formattedAddress || null,
    };
  } catch (e: any) {
    console.warn(`  ⚠️  ${placeId}: ${e.message?.slice(0, 80)}`);
    return null;
  }
}

async function main() {
  const p = getPrisma();

  // Get all businesses with googleBusiness ID but no website
  const candidates = await p.business.findMany({
    where: {
      website: null,
      NOT: { googleBusiness: null },
    },
    select: {
      id: true,
      name: true,
      googleBusiness: true,
      phone: true,
      address: true,
    },
    orderBy: { createdAt: 'asc' },
    take: LIMIT ?? undefined,
  });

  console.log(`\n🔍 Backfilling websites for ${candidates.length} businesses`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  let found = 0;
  let missing = 0;
  let errors = 0;
  const examples: { name: string; website: string }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.googleBusiness) continue;

    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name.padEnd(35)} ... `);

    const details = await fetchPlaceDetails(c.googleBusiness);
    if (!details) {
      errors++;
      console.log('ERROR');
      continue;
    }

    if (details.website) {
      found++;
      examples.push({ name: c.name, website: details.website });
      console.log(`✓ ${details.website}`);

      if (!DRY_RUN) {
        await updateWebsite(c.id, details.website);
      }
    } else {
      missing++;
      console.log('— (Google has no website)');
    }

    // Rate limit courtesy: ~600ms between calls = ~100/min, well under 1000 QPM
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n─── Summary ───`);
  console.log(`Total:     ${candidates.length}`);
  console.log(`Found:     ${found} (${Math.round((found / candidates.length) * 100)}%)`);
  console.log(`Missing:   ${missing}`);
  console.log(`Errors:    ${errors}`);
  if (examples.length > 0) {
    console.log(`\nExamples of found websites:`);
    examples.slice(0, 10).forEach((e) =>
      console.log(`  ${e.name.padEnd(40)} ${e.website}`)
    );
  }

  if (DRY_RUN) {
    console.log('\n(Dry run — no DB changes made)');
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});