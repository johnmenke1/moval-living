import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * TEMPORARY debug endpoint: surfaces what the Hyperdrive-connected DB
 * actually sees for HalloweenEntry. DELETE after the form is working.
 *
 * - to_regclass('public."HalloweenEntry"')
 * - column types
 * - index list
 * - Status enum values
 * - row count
 * - sample INSERT to confirm write path
 */
function serializeChain(err: unknown): unknown[] {
  const chain: { name?: string; message: string; code?: string }[] = []
  let cur: unknown = err
  let depth = 0
  while (cur && depth < 5) {
    const e = cur as { name?: string; message?: string; code?: unknown; cause?: unknown }
    chain.push({
      name: e.name,
      message: e.message ?? '(no message)',
      code: typeof e.code === 'string' ? e.code : undefined,
    })
    cur = e.cause
    depth += 1
  }
  return chain
}

async function tryQuery(label: string, fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn()
  } catch (err) {
    return { [`${label}_err`]: serializeChain(err) }
  }
}

export async function GET() {
  const out: Record<string, unknown> = {}

  out.table_exists = await tryQuery('table_exists', async () => {
    const r = await db.execute(sql`SELECT to_regclass('public."HalloweenEntry"') AS r`)
    return r.rows[0]?.r
  })
  out.columns = await tryQuery('columns', async () => {
    const r = await db.execute(sql`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'HalloweenEntry'
      ORDER BY ordinal_position
    `)
    return r.rows
  })
  out.indexes = await tryQuery('indexes', async () => {
    const r = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'HalloweenEntry'
      ORDER BY indexname
    `)
    return r.rows
  })
  out.enums = await tryQuery('enums', async () => {
    const r = await db.execute(sql`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('Status', 'HalloweenStatus', 'HalloweenEntryStatus')
      GROUP BY t.typname
    `)
    return r.rows
  })
  out.row_count = await tryQuery('row_count', async () => {
    const r = await db.execute(sql`SELECT count(*)::int AS n FROM "HalloweenEntry"`)
    return (r.rows[0] as { n: number })?.n
  })
  out.connection = await tryQuery('connection', async () => {
    const r = await db.execute(sql`SELECT current_database() AS db, current_user AS usr, inet_server_addr() AS ip`)
    return r.rows[0]
  })
  out.all_tables = await tryQuery('all_tables', async () => {
    const r = await db.execute(sql`
      SELECT schemaname, COUNT(*)::int AS n
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      GROUP BY schemaname
      ORDER BY schemaname
    `)
    return r.rows
  })
  out.moval_tables = await tryQuery('moval_tables', async () => {
    const r = await db.execute(sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `)
    return r.rows
  })

  return NextResponse.json(out, { status: 200 })
}
