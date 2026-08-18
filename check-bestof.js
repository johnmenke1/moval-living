
const url = "postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = require('pg');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
(async () => {
  // Total businesses
  const total = await pool.query('SELECT COUNT(*)::int AS n FROM "Business"');
  // How many have bestOfCategoryId set
  const tagged = await pool.query('SELECT COUNT(*)::int AS n FROM "Business" WHERE "bestOfCategoryId" IS NOT NULL');
  const eligible = await pool.query('SELECT COUNT(*)::int AS n FROM "Business" WHERE "bestOfEligible" = true');
  const bestOfCats = await pool.query('SELECT slug, name, (SELECT COUNT(*)::int FROM "Business" b WHERE b."bestOfCategoryId" = c.id) AS business_count FROM "BestOfCategory" c WHERE "isActive" = true ORDER BY "sortOrder"');

  console.log('TOTAL businesses:', total.rows[0].n);
  console.log('Tagged with a BestOfCategory:', tagged.rows[0].n);
  console.log('Marked bestOfEligible=true:', eligible.rows[0].n);
  console.log('---');
  console.log('BestOfCategory rows:');
  console.log(JSON.stringify(bestOfCats.rows, null, 2));

  // Sample a few tagged businesses
  const sample = await pool.query('SELECT name, slug, "bestOfCategoryId", "bestOfEligible", categoryid FROM "Business" WHERE "bestOfCategoryId" IS NOT NULL LIMIT 5');
  console.log('---');
  console.log('Sample tagged businesses:');
  console.log(JSON.stringify(sample.rows, null, 2));

  await pool.end();
})();
