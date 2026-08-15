
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  // Get business descriptions for the entertainment candidates
  const suspects = ['Sky Zone', 'Breakout', 'Lighthouse Immersive', 'Marinaj', 'LCBBQ', 'Harkins', 'Edwards', 'Regal', 'AMC', 'Cinemark', 'Movies', 'Skating', 'Fun', 'Boomers', 'Round1', 'Lucky Strike', 'Lane', 'Bowl'];
  for (const s of suspects) {
    const r = await prisma.business.findFirst({ where: { name: { contains: s, mode: 'insensitive' } }, include: { category: { select: { slug: true, name: true } } } });
    if (r) console.log(`  ${r.name} (${r.category?.slug || 'NO CAT'}):`, (r.description || '').slice(0, 120));
  }

  // Steer N Stein — known bowling alley + restaurant
  const steer = await prisma.business.findFirst({ where: { name: { contains: 'Steer', mode: 'insensitive' } }, include: { category: { select: { slug: true, name: true } } } });
  if (steer) console.log('\nSteer N Stein:', steer.name, '→', steer.category?.slug);

  // SR Cinemas / Galaxy / Starlight / other theater names
  const theaterSearch = await prisma.business.findMany({
    where: {
      OR: [
        { name: { contains: 'cinema', mode: 'insensitive' } },
        { name: { contains: 'sr ', mode: 'insensitive' } },
        { name: { contains: 'starlight', mode: 'insensitive' } },
        { name: { contains: 'galaxy', mode: 'insensitive' } },
        { name: { contains: 'movie', mode: 'insensitive' } },
        { name: { contains: 'theater', mode: 'insensitive' } },
        { name: { contains: 'theatre', mode: 'insensitive' } },
      ],
    },
    include: { category: { select: { slug: true, name: true } } },
  });
  console.log('\nTheater/movie search found:', theaterSearch.length);
  theaterSearch.forEach(b => console.log(`  ${b.name} → ${b.category?.slug || 'NO CAT'}`));

  await prisma.$disconnect();
  await pool.end();
})();
