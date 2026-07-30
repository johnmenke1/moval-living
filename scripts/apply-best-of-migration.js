const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.live');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const get = k => lines.find(l => l.startsWith(k + '='))?.split('=').slice(1).join('=').replace(/"/g, '').trim() ?? '';
const dbUrl = get('DATABASE_URL');

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.live');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, '..', 'prisma/migrations/20260729000000_add_best_of/migration.sql'), 'utf8');

// Split on ';' but preserve the statement
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  for (const stmt of statements) {
    if (!stmt.trim()) continue;
    try {
      await pool.query(stmt + ';');
      console.log('OK:', stmt.slice(0, 60).replace(/\s+/g, ' '));
    } catch (e) {
      console.error('FAIL:', e.message.slice(0, 120));
      console.error('  SQL:', stmt.slice(0, 100).replace(/\s+/g, ' '));
    }
  }
  await pool.end();
  console.log('\nDone.');
}

run();
