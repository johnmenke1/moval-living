import { getPrisma } from '../src/lib/prisma.ts';
const prisma = getPrisma();
try {
  const subCount = await prisma.submission.count();
  const subByStatus = await prisma.submission.groupBy({ by: ['status'], _count: { status: true } });
  const eventCount = await prisma.event.count();
  const eventByTier = await prisma.event.groupBy({ by: ['tier'], _count: { tier: true } });
  const eventByVenueTag = await prisma.event.groupBy({ by: ['venueTag'], _count: { venueTag: true } });
  const eventsWithHero = await prisma.event.count({ where: { heroImageUrl: { not: null } } });
  const earliestEvent = await prisma.event.findFirst({ orderBy: { startsAt: 'asc' }, select: { title: true, startsAt: true, venueName: true, venueTag: true, tier: true } });
  const latestEvent = await prisma.event.findFirst({ orderBy: { startsAt: 'desc' }, select: { title: true, startsAt: true, venueName: true, venueTag: true, tier: true } });

  console.log(`Submissions total: ${subCount}`);
  console.log(`  by status:`, subByStatus.map(s => `${s.status}=${s._count.status}`).join(', '));
  console.log(`Events total: ${eventCount}`);
  console.log(`  by tier:`, eventByTier.map(t => `${t.tier}=${t._count.tier}`).join(', '));
  console.log(`  by venue tag:`, eventByVenueTag.map(v => `${v.venueTag ?? '(null)'}=${v._count.venueTag}`).join(', '));
  console.log(`  with hero image: ${eventsWithHero} of ${eventCount}`);
  console.log(`\nEarliest event: ${earliestEvent?.title} (${earliestEvent?.startsAt?.toISOString()}) at ${earliestEvent?.venueName} [${earliestEvent?.venueTag}/${earliestEvent?.tier}]`);
  console.log(`Latest event:   ${latestEvent?.title} (${latestEvent?.startsAt?.toISOString()}) at ${latestEvent?.venueName} [${latestEvent?.venueTag}/${latestEvent?.tier}]`);
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await prisma.$disconnect();
}