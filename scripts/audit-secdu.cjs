
process.env.DATABASE_URL = process.env.DATABASE_URL;
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(
    'SELECT slug, name, coupon FROM "Business" WHERE slug LIKE $1',
    ['%secdu%']
  );
  console.log(JSON.stringify(r.rows.map(b => ({
    slug: b.slug,
    name: b.name,
    coupon: b.coupon
  })), null, 2));
  await c.end();
})();
