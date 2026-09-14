
// Post-migration audit script for the Deal table. The pre-migration
// version (which read Business.hasCoupon/coupon) is preserved in git
// history if needed — this version only queries the new model so it
// can run against a database that no longer has the legacy columns
// (dropped in migration 20260915000000_drop_business_coupon).

process.env.DATABASE_URL = process.env.DATABASE_URL;
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  const [dealRows, activeDeals, businessesWithDeals] = await Promise.all([
    prisma.deal.count(),
    prisma.deal.count({ where: { isActive: true } }),
    prisma.business.count({ where: { deals: { some: {} } } }),
  ]);

  const deals = await prisma.deal.findMany({
    include: {
      business: { select: { slug: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  console.log(JSON.stringify({
    dealRows,
    activeDeals,
    businessesWithDeals,
    deals: deals.map(d => ({
      slug: d.business.slug,
      name: d.business.name,
      headline: d.headline,
      isActive: d.isActive,
      hasImage: !!d.imageUrl,
      hasCode: !!d.code,
      expiresAt: d.expiresAt,
    })),
  }, null, 2));
  await prisma.$disconnect();
})();
