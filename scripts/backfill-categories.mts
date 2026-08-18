import { getPrisma } from '../src/lib/prisma.ts';
const p = getPrisma();

// Map venue name patterns → category (case-insensitive substring match)
const MAPPING: Array<{pattern: string; category: 'SPORTS' | 'MUSIC' | 'EDUCATIONAL' | 'FUNDRAISERS' | 'COMMUNITY' | 'ARTS' | 'FAMILY'}> = [
  { pattern: 'riverside municipal auditorium', category: 'MUSIC' },
  { pattern: 'fox performing arts', category: 'MUSIC' },
  { pattern: 'redlands bowl', category: 'MUSIC' },
  { pattern: 'redlands theater festival', category: 'ARTS' },
  { pattern: 'cbu', category: 'SPORTS' },
  { pattern: 'california baptist', category: 'SPORTS' },
  { pattern: 'ucr', category: 'SPORTS' },
  { pattern: 'riverside art museum', category: 'ARTS' },
  { pattern: 'riverside metropolitan museum', category: 'ARTS' },
  { pattern: 'moreno valley high', category: 'SPORTS' },
  { pattern: 'canyon springs high', category: 'SPORTS' },
  { pattern: 'valley view high', category: 'SPORTS' },
  { pattern: 'vista del lago high', category: 'SPORTS' },
];

// Build a raw CASE WHEN using LOWER(venueName) LIKE patterns
const cases = MAPPING.map(({ pattern, category }) =>
  `WHEN LOWER("venueName") LIKE '%${pattern}%' THEN '${category}'::"EventCategory"`
).join('\n        ');

const sql = `
  UPDATE "Event"
  SET "category" = CASE
        ${cases}
        ELSE "category"
  END
  WHERE "category" IS NULL;
`;

console.log('Backfilling categories from venueName...');
const result = await p.$executeRawUnsafe(sql);
console.log(`Updated ${result} rows`);

// Verify
const after: any = await p.$queryRawUnsafe(
  `SELECT category, COUNT(*)::int as count FROM "Event" GROUP BY category ORDER BY count DESC`
);
console.log('\nAfter backfill:');
for (const r of after) console.log(`  ${r.category ?? 'NULL'}: ${r.count}`);
await p.$disconnect();