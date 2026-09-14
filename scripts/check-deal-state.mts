import { config } from 'dotenv'
config()
config({ path: '.env.local', override: true })

import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const tables = await pool.query<{ tablename: string }>(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('Deal','_prisma_migrations') ORDER BY tablename`
)
const dealCols = await pool.query<{ column_name: string }>(
  `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Deal' ORDER BY ordinal_position`
).catch((e: unknown) => ({ rows: [{ error: String(e) }] }))
const dealCount = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM "Deal"`).catch((e: unknown) => ({ rows: [{ n: -1, error: String(e) }] }))
const migrations = await pool.query<{ migration_name: string; finished: boolean; logs: string }>(
  `SELECT migration_name, finished_at IS NOT NULL AS finished, logs FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5`
)
console.log('tables:', JSON.stringify(tables.rows))
console.log('deal_columns:', JSON.stringify(dealCols.rows))
console.log('deal_count:', JSON.stringify(dealCount.rows))
console.log('recent_migrations:')
for (const m of migrations.rows) {
  console.log(`  ${m.migration_name} finished=${m.finished}`)
  if (m.logs) console.log(`    logs: ${m.logs.slice(0, 200)}`)
}
await pool.end()
