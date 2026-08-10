/**
 * Push DB businesses-with-email as GHL Contacts via the shared
 * syncContactsToGhl() function in src/lib/ghl-sync.ts.
 *
 * For each business with email + ghlCompanyId but no ghlContactId:
 *   1. Search GHL by email — reuse if found
 *   2. POST to create a new Contact (firstName="Team", lastName=<business>)
 *   3. PUT to link businessId
 *   4. PUT to ensure tag 'movalliving-cold-outreach' is set
 *   5. PUT to set movalliving_listing_url custom field
 *   6. Save GHL contactId back to Business.ghlContactId
 *
 * Idempotent. Re-running does not create duplicates.
 *
 * Usage:
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... DATABASE_URL=... \
 *     npx tsx scripts/sync-ghl-contacts.mts
 *   [--limit=10]                 # smoke test
 *   [--only-missing]             # only sync businesses without ghlContactId
 *   [--backfill-listing-url]     # only update the listing URL custom field
 *                                # on contacts that already have a ghlContactId
 *
 * The same syncContactsToGhl() function is used by the Vercel Cron
 * at src/app/api/cron/sync-ghl/route.ts.
 */

const TOKEN = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID;
if (!TOKEN) { console.error('GHL_API_TOKEN not set'); process.exit(1); }
if (!LOC) { console.error('GHL_LOCATION_ID not set'); process.exit(1); }

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const ONLY_MISSING = args.includes('--only-missing');
const BACKFILL_LISTING_URL = args.includes('--backfill-listing-url');

import { getPrisma } from '../src/lib/prisma';
import { syncContactsToGhl } from '../src/lib/ghl-sync';

async function main() {
  if (BACKFILL_LISTING_URL) {
    // The listing URL is now written automatically by syncContactsToGhl() on
    // every run. This legacy flag is preserved for backwards-compat.
    console.log('ℹ️  --backfill-listing-url is now a no-op: every syncContactsToGhl() run writes the listing URL.');
  }

  console.log(`\n📤 GHL Contacts sync — flags: ${ONLY_MISSING ? '--only-missing ' : ''}${LIMIT ? `--limit=${LIMIT} ` : ''}`);

  const result = await syncContactsToGhl({
    onlyMissing: ONLY_MISSING,
    limit: LIMIT,
  });

  console.log(`\n─── Summary ───`);
  console.log(`Total:              ${result.total}`);
  console.log(`Created:            ${result.created}`);
  console.log(`Linked (existing):  ${result.linkedExisting}`);
  console.log(`Tagged (existing):  ${result.taggedExisting}`);
  console.log(`URLs written:       ${result.urlsWritten}`);
  console.log(`Failed:             ${result.failed}`);

  if (result.failures.length > 0) {
    console.log(`\n⚠️  Failures:`);
    result.failures.slice(0, 20).forEach((f) =>
      console.log(`   ${f.name.padEnd(40)} ${f.error}`)
    );
    if (result.failures.length > 20) {
      console.log(`   ... and ${result.failures.length - 20} more`);
    }
  }

  await getPrisma().$disconnect();
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
