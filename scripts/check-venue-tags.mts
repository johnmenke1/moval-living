import { getPrisma } from '../src/lib/prisma.ts';
const p = getPrisma();
const venues: any = await p.$queryRawUnsafe(
  `SELECT "venueTag", COUNT(*)::int as count FROM "Event" GROUP BY "venueTag" ORDER BY count DESC`
);
console.log('Venue tags in database:');
for (const r of venues) console.log('  ' + (r.venueTag ?? 'NULL') + ': ' + r.count);
await p.$disconnect();