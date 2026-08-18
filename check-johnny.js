
const url = "postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = require('pg');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
(async () => {
  // Find Johnny's business via owner relation
  const me = await pool.query(`
    SELECT o.email, o.name, b.id AS business_id, b.slug, b.name AS business_name,
           b."googleBusiness", b."googleRating", b."googleReviewCount"
    FROM "Owner" o LEFT JOIN "Business" b ON b."ownerId" = o.id
    WHERE o.email = 'john@menke.re'
  `);
  console.log('JOHNNY:', JSON.stringify(me.rows, null, 2));

  // Also show any business whose googleBusiness is null but isn't tagged yet — candidates
  const noGid = await pool.query(`
    SELECT id, slug, name, "googleBusiness", "googleRating", "googleReviewCount"
    FROM "Business"
    WHERE "googleBusiness" IS NULL
    ORDER BY "createdAt" DESC
  `);
  console.log('---');
  console.log('Businesses without googleBusiness:', noGid.rows.length);
  console.log(JSON.stringify(noGid.rows, null, 2));

  await pool.end();
})();
