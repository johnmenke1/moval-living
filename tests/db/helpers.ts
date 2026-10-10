import { is, sql } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../../src/db/schema'
import { db, category, owner, business } from '../../src/db'

/** Empty every table so each test starts clean. */
export async function resetDb() {
  const names = (Object.values(schema) as unknown[])
    .filter((v): v is PgTable => is(v, PgTable))
    .map((t) => `"${getTableConfig(t).name}"`)
  await db.execute(sql.raw(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`))
}

/** One category, one owner, one claimed + approved expert-partner business. */
export async function seedBasics() {
  const [cat] = await db.insert(category).values({ name: 'Food', slug: 'food', icon: 'x' }).returning()
  const [own] = await db.insert(owner).values({ email: 'Sarah@Example.com', name: 'Sarah' }).returning()
  const [biz] = await db
    .insert(business)
    .values({
      slug: 'acme', name: 'Acme', description: 'd', categoryId: cat.id,
      address: '1 Main', zip: '92553', ownerId: own.id, claimedAt: new Date(),
      isExpertPartner: true, status: 'APPROVED', expertPartnerSlug: 'acme',
    })
    .returning()
  return { cat, own, biz }
}
