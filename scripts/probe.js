const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const biz = await p.business.count();
    const rev = await p.review.count();
    const withGbp = await p.business.count({ where: { googleBusiness: { not: null } } });
    const withLat = await p.business.count({ where: { latitude: { not: null } } });
    const sample = await p.business.findMany({
      take: 5,
      select: { name: true, googleBusiness: true, latitude: true, longitude: true, address: true, slug: true },
    });
    console.log("biz=" + biz + " reviews=" + rev + " withGbp=" + withGbp + " withLat=" + withLat);
    console.log("sample:", JSON.stringify(sample, null, 2));
  } catch (e) {
    console.error("ERR:", e.message);
  } finally {
    await p.$disconnect();
  }
})();