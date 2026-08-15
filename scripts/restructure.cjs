
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

(async () => {
  const entertainment = await prisma.category.upsert({
    where: { slug: 'entertainment' },
    update: {},
    create: {
      name: 'Entertainment',
      slug: 'entertainment',
      description: 'Movie theaters, bowling alleys, trampoline parks, escape rooms, immersive experiences, event venues, and live entertainment',
      icon: 'Drama',
    },
  });
  console.log('Entertainment id:', entertainment.id);

  // 4 entertainment candidates from Other
  const patterns = [
    'Sky Zone',
    'Breakout Escape Rooms',
    'Lighthouse Immersive Studios',
    'Marinaj Banquets',
  ];

  let moves = 0;
  for (const pat of patterns) {
    const r = await prisma.business.updateMany({
      where: { name: { contains: pat, mode: 'insensitive' }, category: { slug: 'other' } },
      data: { categoryId: entertainment.id },
    });
    console.log(`  ${pat}: moved ${r.count}`);
    if (r.count) moves += r.count;
  }
  console.log('Total moves:', moves);

  // Verify
  const biz = await prisma.business.findMany({ where: { categoryId: entertainment.id }, select: { name: true }, orderBy: { name: 'asc' } });
  console.log('\nEntertainment (' + biz.length + '):');
  biz.forEach(b => console.log(' -', b.name));

  const otherCount = await prisma.business.count({ where: { category: { slug: 'other' } } });
  console.log('\nRemaining in Other:', otherCount);

  await prisma.$disconnect();
  await pool.end();
})();
