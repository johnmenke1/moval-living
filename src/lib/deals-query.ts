import { and, asc, count, desc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm'
import { db, deal as dealTable, business as businessTable, review as reviewTable } from '@/db'

export type DealSort = 'newest' | 'expiring' | 'business'

/**
 * Public deals listing: active deals (inside their start/expiry window)
 * attached to APPROVED businesses, one page at a time.
 *
 * Ordering by a joined column (business name) isn't expressible in the
 * relational query API, so the page of ids is selected with a core query
 * and then hydrated with relations.
 */
export async function queryPublicDeals(opts: { sort: DealSort; skip: number; take: number }) {
  const now = new Date()
  const where = and(
    eq(dealTable.isActive, true),
    or(isNull(dealTable.expiresAt), gt(dealTable.expiresAt, now)),
    or(isNull(dealTable.startsAt), lte(dealTable.startsAt, now)),
    eq(businessTable.status, 'APPROVED'),
  )

  const orderBy =
    opts.sort === 'expiring'
      ? [desc(dealTable.isActive), asc(dealTable.expiresAt)]
      : opts.sort === 'business'
        ? [asc(businessTable.name), desc(dealTable.createdAt)]
        : [asc(dealTable.displayOrder), desc(dealTable.createdAt)]

  const [pageRows, totalRows] = await Promise.all([
    db
      .select({ id: dealTable.id })
      .from(dealTable)
      .innerJoin(businessTable, eq(businessTable.id, dealTable.businessId))
      .where(where)
      .orderBy(...orderBy)
      .limit(opts.take)
      .offset(opts.skip),
    db
      .select({ n: count() })
      .from(dealTable)
      .innerJoin(businessTable, eq(businessTable.id, dealTable.businessId))
      .where(where),
  ])
  const total = totalRows[0]?.n ?? 0
  const ids = pageRows.map((r) => r.id)
  if (ids.length === 0) return { deals: [], total }

  const hydrated = await db.query.deal.findMany({
    where: inArray(dealTable.id, ids),
    with: {
      business: {
        columns: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          logo: true,
          coverImage: true,
        },
        with: { category: { columns: { name: true, slug: true } } },
      },
    },
  })
  const reviewCounts = await db
    .select({ businessId: reviewTable.businessId, n: count() })
    .from(reviewTable)
    .where(inArray(reviewTable.businessId, hydrated.map((d) => d.businessId)))
    .groupBy(reviewTable.businessId)
  const reviewsByBusiness = new Map(reviewCounts.map((r) => [r.businessId, r.n]))
  const byId = new Map(hydrated.map((d) => [d.id, d]))
  const deals = ids.flatMap((id) => {
    const d = byId.get(id)
    if (!d) return []
    return [
      {
        ...d,
        business: {
          ...d.business,
          _count: { reviews: reviewsByBusiness.get(d.businessId) ?? 0 },
        },
      },
    ]
  })
  return { deals, total }
}
