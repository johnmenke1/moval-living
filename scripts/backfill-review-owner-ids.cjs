/**
 * Backfill Review.ownerId by matching Review.authorEmail to Owner.email.
 *
 * Background:
 *   The Review.ownerId column was added in migration
 *   20260823023744_add_review_owner_id. Existing reviews were left with
 *   ownerId = NULL — they were left as anonymous free-text submissions.
 *   This script links them to their original reviewer by email match.
 *
 * Usage:
 *   node scripts/backfill-review-owner-ids.cjs            # dry run (default)
 *   node scripts/backfill-review-owner-ids.cjs --apply   # actually write
 *   node scripts/backfill-review-owner-ids.cjs --apply --limit=100
 *
 * Safety:
 *   - Dry-run is the default; writes need --apply.
 *   - Idempotent: re-running after a successful backfill is a no-op.
 *   - Only updates rows where ownerId IS NULL — never overwrites a value
 *     that was set by the route handler for a logged-in review.
 *   - Email matching is case-insensitive, and skips rows with NULL/empty
 *     authorEmail.
 *
 * Output:
 *   Reports: total reviews scanned, candidate reviews (have email),
 *   matched to existing Owners, unmatched (no Owner for that email).
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
  if (LIMIT) console.log(`Limit: first ${LIMIT} candidate reviews`);

  // Pull reviews that need backfilling: ownerId null + authorEmail non-empty.
  const candidates = await prisma.review.findMany({
    where: { ownerId: null, authorEmail: { not: null } },
    select: { id: true, authorEmail: true, authorName: true, businessId: true },
    orderBy: { createdAt: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  console.log(`Found ${candidates.length} candidate review(s) to backfill.`);

  const totalUnowned = await prisma.review.count({ where: { ownerId: null } });
  const totalUnownedNoEmail = await prisma.review.count({
    where: { ownerId: null, OR: [{ authorEmail: null }, { authorEmail: '' }] },
  });
  console.log(`Total unowned reviews: ${totalUnowned} (${totalUnownedNoEmail} have no email — cannot backfill).`);

  let matched = 0;
  let unmatched = 0;
  const updates = [];

  for (const review of candidates) {
    const ownerId = await matchOwnerByEmail(review.authorEmail);
    if (ownerId) {
      updates.push({ reviewId: review.id, ownerId });
      matched++;
    } else {
      unmatched++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Matched:   ${matched} review(s) → Owner found by email`);
  console.log(`  Unmatched: ${unmatched} review(s) → no Owner for that email`);

  if (!APPLY) {
    console.log(`\nDRY RUN — no writes performed. Re-run with --apply to commit.`);
    if (updates.length > 0) {
      console.log(`\nFirst 5 planned updates:`);
      for (const u of updates.slice(0, 5)) {
        console.log(`  Review ${u.reviewId} → Owner ${u.ownerId}`);
      }
    }
    return;
  }

  // Apply mode: do the writes in a transaction with defensive guards.
  console.log(`\nApplying ${updates.length} update(s) in transaction...`);
  const result = await prisma.$transaction(async (tx) => {
    let updated = 0;
    let skippedAlreadyOwned = 0;
    for (const { reviewId, ownerId } of updates) {
      // Guard: only update if still NULL (defensive against concurrent writers).
      const upd = await tx.review.updateMany({
        where: { id: reviewId, ownerId: null },
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