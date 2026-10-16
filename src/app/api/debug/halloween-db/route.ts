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
export async function GET() {
  const out: Record<string, unknown> = {}

  try {
    const table = await db.execute(sql`SELECT to_regclass('public."HalloweenEntry"') AS r`)
    out.table_exists = table.rows[0]?.r
  } catch (e) {
    out.table_exists_err = (e as Error).message
  }

  try {
    const cols = await db.execute(sql`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'HalloweenEntry'
      ORDER BY ordinal_position
    `)
    out.columns = cols.rows
  } catch (e) {
    out.columns_err = (e as Error).message
  }

  try {
    const idx = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'HalloweenEntry'
      ORDER BY indexname
    `)
    out.indexes = idx.rows
  } catch (e) {
    out.indexes_err = (e as Error).message
  }

  try {
    const e = await db.execute(sql`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname IN ('Status', 'HalloweenStatus', 'HalloweenEntryStatus')
      GROUP BY t.typname
    `)
    out.enums = e.rows
  } catch (e) {
    out.enums_err = (e as Error).message
  }

  try {
    const count = await db.execute(sql`SELECT count(*)::int AS n FROM "HalloweenEntry"`)
    out.row_count = (count.rows[0] as { n: number })?.n
  } catch (e) {
    out.row_count_err = (e as Error).message
  }

  try {
    const conn = await db.execute(sql`SELECT current_database() AS db, current_user AS usr, inet_server_addr() AS ip`)
    out.connection = conn.rows[0]
  } catch (e) {
    out.connection_err = (e as Error).message
  }

  return NextResponse.json(out, { status: 200 })
}