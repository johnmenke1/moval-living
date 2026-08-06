// Quick DB inspection
const { Pool } = require('pg')
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
})
async function main() {
  const enums = await pool.query("SELECT typname FROM pg_type WHERE typtype = 'e' AND typname = 'PostType'")
  console.log('PostType enum exists in DB?', enums.rows.length > 0, enums.rows)
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'GuestPost' ORDER BY ordinal_position")
  console.log('GuestPost columns:')
  cols.rows.forEach(c => console.log(' ', c.column_name, c.data_type))
}
main().catch(e => console.error(e.message)).finally(() => pool.end())
