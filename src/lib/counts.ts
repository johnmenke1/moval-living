import { and, count, inArray, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '@/db'

/**
 * Row counts grouped by a foreign-key column, as a Map keyed by the FK value.
 * Replaces Prisma's `_count: { select: { rel: true } }` for lists of parents:
 * pass the child table's FK column and the parent ids. Parents with no
 * children are absent from the map, so read with `?? 0`.
 *
 *   const reviews = await countGroupedBy(review.businessId, ids)
 */
export async function countGroupedBy(
  column: PgColumn,
  ids: string[],
  /** Extra filter on the child rows, e.g. `eq(eventAttendee.status, 'GOING')`. */
  extra?: SQL,
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ key: column, n: count() })
    .from(column.table as PgTable)
    .where(and(inArray(column, ids), extra))
    .groupBy(column)
  return new Map(rows.map((r) => [String(r.key), r.n]))
}
