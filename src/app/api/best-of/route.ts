import { NextResponse } from 'next/server'
import { asc, count, eq } from 'drizzle-orm'
import { db, bestOfCategory, bestOfNominee } from '@/db'

// GET /api/best-of — list all published BestOf categories with nominee count
export async function GET() {
  const [categories, nomineeCounts] = await Promise.all([
    db.query.bestOfCategory.findMany({
      where: eq(bestOfCategory.published, true),
      columns: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        tagHints: true,
      },
      orderBy: asc(bestOfCategory.name),
    }),
    db
      .select({ categoryId: bestOfNominee.categoryId, n: count() })
      .from(bestOfNominee)
      .groupBy(bestOfNominee.categoryId),
  ])
  const countByCategory = new Map(nomineeCounts.map((r) => [r.categoryId, r.n]))

  return NextResponse.json(
    categories.map((c) => {
      const nominees = countByCategory.get(c.id) ?? 0
      return { ...c, _count: { nominees }, nomineeCount: nominees }
    }),
  )
}
