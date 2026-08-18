import { getPrisma } from '../src/lib/prisma.ts';
const p = getPrisma();
// Try a query that uses the enum — this proves the column is now an enum
const music = await p.event.count({ where: { category: 'MUSIC' } });
const sports = await p.event.count({ where: { category: 'SPORTS' } });
const edu = await p.event.count({ where: { category: 'EDUCATIONAL' } });
const nullCat = await p.event.count({ where: { category: null } });
console.log(`MUSIC: ${music}, SPORTS: ${sports}, EDUCATIONAL: ${edu}, NULL: ${nullCat}`);
console.log(`Total: ${music + sports + edu + nullCat}`);
await p.$disconnect();