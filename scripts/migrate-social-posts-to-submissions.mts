/**
 * migrate-social-posts-to-submissions.mts
 *
 * One-shot migration that converts existing SocialPost entries into the new
 * Submission table introduced in 20260816000000_add_event_submission.
 *
 * What gets migrated:
 *   - SocialPost with status = APPROVED and eventDate != null
 *   - Each becomes a PENDING Submission in the new queue
 *   - Caption becomes the title (admin can edit on review)
 *   - The IG post URL becomes sourceUrl
 *   - submitterNote records the original SocialPost id for traceability
 *
 * What doesn't get migrated:
 *   - REJECTED posts (the old system already said no, no need to re-review)
 *   - Posts without eventDate (no event to review)
 *
 * Idempotent: skipped if a Submission already exists for the same sourceUrl.
 *
 * Usage:
 *   npx tsx scripts/migrate-social-posts-to-submissions.mts --dry-run
 *   npx tsx scripts/migrate-social-posts-to-submissions.mts
 */

import { getPrisma } from '../src/lib/prisma';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function main() {
  const prisma = getPrisma();

  // Source: APPROVED posts with a real eventDate. The rest are skipped.
  const sourcePosts = await prisma.socialPost.findMany({
    where: {
      status: 'APPROVED',
      eventDate: { not: null },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${sourcePosts.length} APPROVED SocialPost entries with eventDate.`);

  // Slug generator — same pattern as the future /submit/event form.
  // For this migration we anchor on the SocialPost createdAt date so the
  // generated slugs reflect when the original post was curated, not today.
  function pad2(n: number): string {
    return String(n).padStart(2, '0');
  }

  function dateSlug(d: Date): string {
    return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}-${String(d.getUTCFullYear()).slice(-2)}`;
  }

  // Group by date so we can suffix a, b, c within the same day.
  const byDate = new Map<string, typeof sourcePosts>();
  for (const post of sourcePosts) {
    const key = dateSlug(post.createdAt);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(post);
  }

  let created = 0;
  let skipped = 0;

  for (const [dateKey, posts] of byDate) {
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const letter = String.fromCharCode(97 + i); // a, b, c...
      const slug = `${dateKey}-${letter}`;

      // Skip if a Submission with this slug already exists (idempotent).
      const existing = await prisma.submission.findUnique({ where: { slug } });
      if (existing) {
        console.log(`  skip ${slug} (already exists) — ${post.caption}`);
        skipped++;
        continue;
      }

      // Skip if a Submission with this sourceUrl already exists (idempotent).
      const dup = await prisma.submission.findFirst({
        where: { sourceUrl: post.postUrl },
      });
      if (dup) {
        console.log(`  skip ${slug} (duplicate sourceUrl) — ${post.caption}`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  would create ${slug} — ${post.caption}`);
        created++;
        continue;
      }

      await prisma.submission.create({
        data: {
          slug,
          sourceUrl: post.postUrl,
          sourcePlatform: post.platform === 'INSTAGRAM' ? 'INSTAGRAM' : 'OTHER',
          // Use the caption as the working title so the admin sees what
          // the original post said, and it flows through to the Event
          // description on approval (see /api/admin/submissions/[id]).
          title: post.caption || 'Untitled event',
          startsAt: post.eventDate!,
          endsAt: post.eventEndDate ?? null,
          venueName: null,
          // Carry the original caption as submitterNote so it survives
          // into the Event's sourcePostExcerpt on approval.
          submitterNote: [
            post.caption ? `Original caption: ${post.caption}` : null,
            `Migrated from SocialPost ${post.id} on ${new Date().toISOString().slice(0, 10)}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
          status: 'PENDING',
        },
      });
      console.log(`  created ${slug} — ${post.caption}`);
      created++;
    }
  }

  console.log('');
  console.log(`Done. ${created} created${dryRun ? ' (dry-run)' : ''}, ${skipped} skipped.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
