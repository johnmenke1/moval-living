
// Direct PG + Prisma (matches src/lib/prisma.ts adapter setup)
process.env.DATABASE_URL = process.env.DATABASE_URL;
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  const legacyHasCoupon = await prisma.business.count({ where: { hasCoupon: true } });
  const legacyCouponSet = await prisma.business.count({ where: { coupon: { not: null } } });
  const dealRows = await prisma.deal.count();
  const activeDeals = await prisma.deal.count({ where: { isActive: true } });
  const legacyOrphans = await prisma.business.findMany({
    where: { OR: [{ hasCoupon: true }, { coupon: { not: null } }] },
    include: { deals: { select: { id: true, headline: true, isActive: true, imageUrl: true } } },
    take: 50
  });
  console.log(JSON.stringify({
    legacyHasCoupon,
    legacyCouponSet,
    dealRows,
    activeDeals,
    legacyOrphans: legacyOrphans.map(b => ({
      slug: b.slug,
      name: b.name,
      hasCoupon: b.hasCoupon,
      couponHeadline: b.coupon?.headline || null,
      couponImageUrl: b.coupon?.imageUrl || null,
      dealCount: b.deals.length,
      activeDealCount: b.deals.filter(d => d.isActive).length,
      dealHeadlines: b.deals.map(d => d.headline),
      dealImages: b.deals.map(d => !!d.imageUrl)
    }))
  }, null, 2));
  await prisma.$disconnect();
})();
