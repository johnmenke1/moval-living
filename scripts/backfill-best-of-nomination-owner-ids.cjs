/**
 * Backfill BestOfNomination.ownerId by matching nominatorEmail to Owner.email.
 *
 * Background:
 *   The BestOfNomination.ownerId column was added in migration
 *   20260824030000_add_best_of_nomination_owner_id. Existing nominations
 *   are left with ownerId = NULL. This script links them to their original
 *   nominator by email match — useful after a user signs up for the first
 *   time and we want their past nominations attributed to their account.
 *
 * Usage:
 *   node scripts/backfill-best-of-nomination-owner-ids.cjs            # dry run
 *   node scripts/backfill-best-of-nomination-owner-ids.cjs --apply   # write
 *   node scripts/backfill-best-of-nomination-owner-ids.cjs --apply --limit=100
 *
 * Safety:
 *   - Dry-run is the default.
 *   - Idempotent (re-running finds nothing new).
 *   - Only updates rows where ownerId IS NULL.
 *   - Case-insensitive email match.
 *   - Multiple Owner rows for the same email → picks the OLDEST by createdAt.
 */

const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Source .env.local before running.');
  process.exit(2);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase();
}

async function matchOwnerByEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  const owner = await prisma.owner.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return owner?.id ?? null;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);
  if (LIMIT) console.log(`Limit: first ${LIMIT} candidate nominations`);

  // BestOfNomination has nominatorEmail as required (not nullable), so all
  // PENDING/APPROVED/REJECTED nominations have an email — but we still
  // filter out rows that are obviously malformed.
  const candidates = await prisma.bestOfNomination.findMany({
    where: { ownerId: null },
    select: { id: true, nominatorEmail: true, nominatorName: true, status: true },
    orderBy: { createdAt: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`Found ${candidates.length} candidate nomination(s) to backfill.`);

  const totalUnowned = await prisma.bestOfNomination.count({ where: { ownerId: null } });
  console.log(`Total unowned nominations: ${totalUnowned}`);

  let matched = 0;
  let unmatched = 0;
  const updates = [];

  for (const nom of candidates) {
    const ownerId = await matchOwnerByEmail(nom.nominatorEmail);
    if (ownerId) {
      updates.push({ nominationId: nom.id, ownerId });
      matched++;
    } else {
      unmatched++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Matched:   ${matched} nomination(s) → Owner found by email`);
  console.log(`  Unmatched: ${unmatched} nomination(s) → no Owner for that email`);

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes performed. Re-run with --apply to commit.`);
    if (updates.length > 0) {
      console.log(`\nFirst 5 planned updates:`);
      for (const u of updates.slice(0, 5)) {
        console.log(`  Nomination ${u.nominationId} → Owner ${u.ownerId}`);
      }
    }
    return;
  }

  console.log(`\nApplying ${updates.length} update(s) in transaction...`);
  const result = await prisma.$transaction(async (tx) => {
    let updated = 0;
    let skippedAlreadyOwned = 0;
    for (const { nominationId, ownerId } of updates) {
      const upd = await tx.bestOfNomination.updateMany({
        where: { id: nominationId, ownerId: null },
        data: { ownerId },
      });
      updated += upd.count;
      if (upd.count === 0) skippedAlreadyOwned++;
    }
    return { updated, skippedAlreadyOwned };
  });

  console.log(`\nDone.`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Skipped (concurrent write filled it): ${result.skippedAlreadyOwned}`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });