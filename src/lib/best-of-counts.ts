import { count, inArray } from 'drizzle-orm'
import { db, bestOfNominee } from '@/db'

/** Nominee totals keyed by category id (categories with none are absent). */
export async function countNomineesByCategory(categoryIds: string[]): Promise<Map<string, number>> {
  if (categoryIds.length === 0) return new Map()
  const rows = await db
    .select({ categoryId: bestOfNominee.categoryId, n: count() })
    .from(bestOfNominee)
    .where(inArray(bestOfNominee.categoryId, categoryIds))
    .groupBy(bestOfNominee.categoryId)
  return new Map(rows.map((r) => [r.categoryId, r.n]))
}
