/**
 * Sync moval.living businesses → GHL Companies endpoint.
 *
 * Thin CLI wrapper around the shared syncBusinessesToGhl() function in
 * src/lib/ghl-sync.ts. The same function is used by the Vercel Cron
 * route at src/app/api/cron/sync-ghl/route.ts.
 *
 * Idempotency: if the business already has a ghlCompanyId, the script
 * updates the existing record (PUT) instead of creating a new one.
 *
 * Filter: status=APPROVED AND (phone IS NOT NULL OR email IS NOT NULL
 *         OR website IS NOT NULL OR address != '')
 *
 * Usage:
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... npx tsx scripts/sync-ghl.mts
 *   [--limit=10]         # smoke test
 *   [--dry-run]          # show what would be created, no API calls
 *   [--only-missing]     # skip businesses that already have ghlCompanyId
 *   [--only-with-email]  # sync only businesses that have an email set
 *                        # (useful for pushing newly-discovered emails)
 *
 * Rate limit: GHL allows ~100 req/min on Companies. We sleep 700ms
 * between calls so a 100-business run takes ~70s. Safe under the limit.
 */

const GHL_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOC = process.env.GHL_LOCATION_ID;
if (!GHL_TOKEN) { console.error('GHL_API_TOKEN not set'); process.exit(1); }
if (!GHL_LOC) { console.error('GHL_LOCATION_ID not set'); process.exit(1); }

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const DRY_RUN = args.includes('--dry-run');
const ONLY_MISSING = args.includes('--only-missing');
const ONLY_WITH_EMAIL = args.includes('--only-with-email');

import { syncBusinessesToGhl } from '../src/lib/ghl-sync';

async function main() {
  const mode = DRY_RUN ? 'DRY RUN' : ONLY_MISSING ? 'missing only' : ONLY_WITH_EMAIL ? 'with-email only' : 'all';
  console.log(`\n📤 GHL sync — mode: ${mode}, limit: ${LIMIT ?? 'none'}`);
  console.log(`   (Use --only-missing / --only-with-email / --limit=N to filter)\n`);

  if (DRY_RUN) {
    // Quick local preview: list candidates without touching GHL
    const { getPrisma } = await import('../src/lib/prisma');
    const p = getPrisma();
    const where: any = {
      status: 'APPROVED',
      OR: [
        { phone: { not: null } },
        { email: { not: null } },
        { website: { not: null } },
        { address: { not: '' } },
      ],
    };
    if (ONLY_MISSING) where.ghlCompanyId = null;
    if (ONLY_WITH_EMAIL) {
      where.email = { not: null };
      where.ghlCompanyId = { not: null };
    }
    const candidates = await p.business.findMany({
      where,
      select: { name: true, phone: true, email: true, website: true, ghlCompanyId: true },
      orderBy: { name: 'asc' },
      take: LIMIT ?? undefined,
    });
    console.log(`Would sync ${candidates.length} businesses:`);
    for (const c of candidates) {
      const flags = [
        c.phone ? '📞' : '',
        c.email ? '✉️' : '',
        c.website ? '🌐' : '',
      ].filter(Boolean).join('');
      console.log(`  ${c.name.padEnd(40)} ${flags} (ghlId=${c.ghlCompanyId ?? 'NEW'})`);
    }
    await p.$disconnect();
    return;
  }

  const result = await syncBusinessesToGhl({
    onlyMissing: ONLY_MISSING,
    onlyWithEmail: ONLY_WITH_EMAIL,
    limit: LIMIT,
  });

  console.log(`\n─── Summary ───`);
  console.log(`Total:        ${result.total}`);
  console.log(`Created:      ${result.created}`);
  console.log(`Updated:      ${result.updated}`);
  console.log(`Failed:       ${result.failed}`);

  if (result.failures.length > 0) {
    console.log(`\n⚠️  Failures:`);
    result.failures.slice(0, 20).forEach((f) =>
      console.log(`   ${f.name.padEnd(40)} ${f.error}`)
    );
    if (result.failures.length > 20) {
      console.log(`   ... and ${result.failures.length - 20} more`);
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
