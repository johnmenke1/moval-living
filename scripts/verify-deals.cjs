
process.env.DATABASE_URL = process.env.DATABASE_URL;
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const verify = await c.query(`
    SELECT b.slug, b.name, d."imageUrl" IS NOT NULL as has_image, d.headline, d.code, d."expiresAt"
    FROM "Business" b
    LEFT JOIN "Deal" d ON d."businessId" = b.id
    WHERE b.coupon IS NOT NULL
    ORDER BY b.slug
  `);
  console.log(JSON.stringify(verify.rows, null, 2));
  await c.end();
})();
