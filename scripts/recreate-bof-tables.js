const { Pool } = require('pg');
const fs = require('fs');
const envPath = 'C:/Users/john/projects/websites/moval-living/.env.live';
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const get = k => lines.find(l => l.startsWith(k + '='))?.split('=').slice(1).join('=').replace(/"/g, '').trim() ?? '';
const pool = new Pool({ connectionString: get('DATABASE_URL'), ssl: { rejectUnauthorized: false } });

async function run() {
  const stmts = [
    // Fix BestOfCategory — add query column (id, slug, name, description, icon already exist)
    'ALTER TABLE "BestOfCategory" ADD COLUMN IF NOT EXISTS "query" TEXT',
    'ALTER TABLE "BestOfCategory" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0',
    'ALTER TABLE "BestOfCategory" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true',
    // BestOfEntry — ensure compositeScore and yearsActive columns exist (may already exist)
    'ALTER TABLE "BestOfEntry" ADD COLUMN IF NOT EXISTS "compositeScore" DOUBLE PRECISION',
    'ALTER TABLE "BestOfEntry" ADD COLUMN IF NOT EXISTS "yearsActive" DOUBLE PRECISION',
    // Add unique constraint on BestOfEntry if not exists
    'DO $$ BEGIN ALTER TABLE "BestOfEntry" ADD CONSTRAINT "BestOfEntry_categoryId_businessId_key" UNIQUE ("categoryId", "businessId"); EXCEPTION WHEN duplicate_object THEN NULL; END $$',
  ];
  for (const stmt of stmts) {
    try {
      await pool.query(stmt);
      console.log('OK:', stmt.slice(0, 70));
    } catch (e) {
      console.error('FAIL:', e.message.slice(0, 100));
    }
  }
  await pool.end();
  console.log('Done.');
}

run().catch(e => { console.error(e.message); process.exit(1); });
