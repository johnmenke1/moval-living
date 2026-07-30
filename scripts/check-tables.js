const { Pool } = require('pg');
const fs = require('fs');
const envPath = 'C:/Users/john/projects/websites/moval-living/.env.live';
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const get = k => lines.find(l => l.startsWith(k + '='))?.split('=').slice(1).join('=').replace(/"/g, '').trim() ?? '';
const pool = new Pool({ connectionString: get('DATABASE_URL'), ssl: { rejectUnauthorized: false } });

async function check() {
  for (const table of ['BestOfCategory', 'BestOfEntry', 'BestOfScore']) {
    const r = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', [table]);
    console.log(table + ':', r.rows.map(r => r.column_name).join(', '));
  }
  await pool.end();
}

check().catch(e => { console.error(e.message); process.exit(1); });
