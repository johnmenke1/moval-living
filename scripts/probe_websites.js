const { Client } = require('pg');
const DB_URL = process.env.DB_URL || process.argv[2];
(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const r1 = await c.query('SELECT count(*)::int as total, count(website)::int as with_website, count(email)::int as with_email FROM "Business"');
  console.log('totals:', r1.rows[0]);
  const r2 = await c.query("SELECT count(*) FILTER (WHERE website IS NOT NULL AND website <> '')::int as non_empty, count(*) FILTER (WHERE website IS NULL OR website = '')::int as empty FROM \"Business\"");
  console.log('website split:', r2.rows[0]);
  const r3 = await c.query("SELECT name, website, email FROM \"Business\" WHERE website IS NOT NULL AND website <> '' LIMIT 5");
  console.log('sample with website:');
  r3.rows.forEach(r => console.log(' -', r));
  const r4 = await c.query("SELECT name, email, website FROM \"Business\" WHERE email IS NOT NULL AND email <> '' LIMIT 5");
  console.log('sample with email:');
  r4.rows.forEach(r => console.log(' -', r));
  await c.end();
})();
