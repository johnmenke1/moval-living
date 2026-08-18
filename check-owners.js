
const url = "postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const { Pool } = require('pg');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
(async () => {
  try {
    const owners = await pool.query('SELECT id, email, name, role, "createdAt" FROM "Owner" ORDER BY "createdAt" DESC LIMIT 15');
    console.log('OWNERS:');
    console.log(JSON.stringify(owners.rows, null, 2));
    const counts = await pool.query('SELECT status, COUNT(*)::int AS n FROM "Business" GROUP BY status');
    console.log('STATUS COUNTS:', JSON.stringify(counts.rows));
    const g = await pool.query('SELECT COUNT(*)::int AS with_id FROM "Business" WHERE "googleBusiness" IS NOT NULL');
    const ng = await pool.query('SELECT COUNT(*)::int AS without_id FROM "Business" WHERE "googleBusiness" IS NULL');
    console.log('GOOGLE ID set:', g.rows[0]);
    console.log('GOOGLE ID missing:', ng.rows[0]);
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
})();
