/**
 * Covers the Drizzle query shapes behind the public pages and API routes
 * that were converted from Prisma: joined ordering, grouped counts, nested
 * relation filters/limits, unique-violation handling and the raw-SQL cron.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { and, asc, desc, eq } from 'drizzle-orm'

vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/revalidate', () => ({
  revalidateBusinessData: vi.fn(),
  revalidateEventData: vi.fn(),
  revalidateParkData: vi.fn(),
  revalidatePostData: vi.fn(),
  revalidateAuthorData: vi.fn(),
  revalidateBestOfData: vi.fn(),
  revalidateBestOfVoteData: vi.fn(),
  revalidateCategoryData: vi.fn(),
}))

import { auth } from '@/auth'
import {
  db,
  business,
  category,
  deal,
  review,
  owner,
  event,
  bestOfCategory,
  bestOfNominee,
  bestOfVote,
  eventAttendee,
} from '@/db'
import { countGroupedBy } from '@/lib/counts'
import { countNomineesByCategory } from '@/lib/best-of-counts'
import { queryPublicDeals } from '@/lib/deals-query'
import { resetDb, seedBasics } from './helpers'

beforeEach(async () => {
  await resetDb()
  vi.mocked(auth).mockReset()
})

async function mkBusiness(cat: string, slug: string, name: string, extra: Partial<typeof business.$inferInsert> = {}) {
  const [b] = await db
    .insert(business)
    .values({ slug, name, description: 'd', categoryId: cat, address: 'a', zip: '1', status: 'APPROVED', ...extra })
    .returning()
  return b
}

describe('queryPublicDeals', () => {
  it('orders by joined business name, filters expired/unapproved, pages and counts', async () => {
    const { cat } = await seedBasics()
    const zed = await mkBusiness(cat.id, 'zed', 'Zed')
    const abe = await mkBusiness(cat.id, 'abe', 'Abe')
    const pending = await mkBusiness(cat.id, 'pend', 'Pending Co', { status: 'PENDING' })
    const past = new Date(Date.now() - 86400000)
    const future = new Date(Date.now() + 86400000 * 5)
    await db.insert(deal).values([
      { businessId: zed.id, headline: 'zed-live', expiresAt: future },
      { businessId: abe.id, headline: 'abe-live' },
      { businessId: abe.id, headline: 'abe-expired', expiresAt: past },
      { businessId: abe.id, headline: 'abe-inactive', isActive: false },
      { businessId: pending.id, headline: 'pending-live' },
    ])
    await db.insert(review).values([
      { businessId: abe.id, authorName: 'a', rating: 5, content: 'x' },
      { businessId: abe.id, authorName: 'b', rating: 4, content: 'y' },
    ])

    const byBiz = await queryPublicDeals({ sort: 'business', skip: 0, take: 10 })
    expect(byBiz.total).toBe(2)
    expect(byBiz.deals.map((d) => d.headline)).toEqual(['abe-live', 'zed-live'])
    expect(byBiz.deals[0].business._count.reviews).toBe(2)
    expect(byBiz.deals[1].business._count.reviews).toBe(0)
    expect(byBiz.deals[0].business.category).toEqual({ name: 'Food', slug: 'food' })

    const page2 = await queryPublicDeals({ sort: 'business', skip: 1, take: 1 })
    expect(page2.deals.map((d) => d.headline)).toEqual(['zed-live'])
    expect(page2.total).toBe(2)

    // expiring: asc nulls last -> the dated deal first, undated last (Postgres default)
    const expiring = await queryPublicDeals({ sort: 'expiring', skip: 0, take: 10 })
    expect(expiring.deals.map((d) => d.headline)).toEqual(['zed-live', 'abe-live'])
  })
})

describe('countGroupedBy / countNomineesByCategory', () => {
  it('counts per parent with an optional extra filter and returns empty for no ids', async () => {
    const { cat } = await seedBasics()
    const a = await mkBusiness(cat.id, 'a', 'A')
    const b = await mkBusiness(cat.id, 'b', 'B')
    await db.insert(deal).values([
      { businessId: a.id, headline: '1' },
      { businessId: a.id, headline: '2', isActive: false },
      { businessId: b.id, headline: '3' },
    ])
    const all = await countGroupedBy(deal.businessId, [a.id, b.id])
    expect(all.get(a.id)).toBe(2)
    const active = await countGroupedBy(deal.businessId, [a.id, b.id], eq(deal.isActive, true))
    expect(active.get(a.id)).toBe(1)
    expect(active.get(b.id)).toBe(1)
    expect((await countGroupedBy(deal.businessId, [])).size).toBe(0)

    const [bc] = await db.insert(bestOfCategory).values({ name: 'Best', slug: 'best' }).returning()
    await db.insert(bestOfNominee).values({ categoryId: bc.id, businessId: a.id })
    expect((await countNomineesByCategory([bc.id])).get(bc.id)).toBe(1)
  })
})

describe('nested relation filters used by listing pages', () => {
  it('first active deal (ordered, limited) and non-winner nominees', async () => {
    const { cat } = await seedBasics()
    const b = await mkBusiness(cat.id, 'x', 'X')
    await db.insert(deal).values([
      { businessId: b.id, headline: 'inactive', isActive: false, displayOrder: 0 },
      { businessId: b.id, headline: 'second', displayOrder: 5 },
      { businessId: b.id, headline: 'first', displayOrder: 1 },
    ])
    const [bc1] = await db.insert(bestOfCategory).values({ name: 'One', slug: 'one' }).returning()
    const [bc2] = await db.insert(bestOfCategory).values({ name: 'Two', slug: 'two' }).returning()
    await db.insert(bestOfNominee).values([
      { categoryId: bc1.id, businessId: b.id, winner: true },
      { categoryId: bc2.id, businessId: b.id, winner: false },
    ])
    const rows = await db.query.business.findMany({
      where: eq(business.slug, 'x'),
      with: {
        reviews: { columns: { rating: true } },
        deals: {
          where: eq(deal.isActive, true),
          orderBy: [asc(deal.displayOrder), desc(deal.createdAt)],
          limit: 1,
          columns: { imageUrl: true, isActive: true, id: true, headline: true } as never,
        },
        bestOfNominees: {
          where: eq(bestOfNominee.winner, false),
          columns: {},
          with: { category: { columns: { name: true, slug: true } } },
        },
      },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].deals).toHaveLength(1)
    expect((rows[0].deals[0] as { headline?: string }).headline).toBe('first')
    expect(rows[0].bestOfNominees).toEqual([{ category: { name: 'Two', slug: 'two' } }])
  })
})

describe('POST /api/best-of/votes', () => {
  it('records a vote once, then answers 409 ALREADY_VOTED via the unique violation', async () => {
    const { cat, biz } = await seedBasics()
    void cat
    const [voter] = await db
      .insert(owner)
      .values({ email: 'v@example.com', name: 'Vera Voter', emailVerified: new Date() })
      .returning()
    const [bc] = await db.insert(bestOfCategory).values({ name: 'Best', slug: 'best', published: true }).returning()
    const [nominee] = await db.insert(bestOfNominee).values({ categoryId: bc.id, businessId: biz.id }).returning()
    vi.mocked(auth).mockResolvedValue({ user: { id: voter.id, role: 'USER' } } as never)

    const { POST } = await import('@/app/api/best-of/votes/route')
    const mk = () =>
      new Request('http://t.local/x', {
        method: 'POST',
        body: JSON.stringify({ nomineeId: nominee.id }),
        headers: { 'content-type': 'application/json' },
      }) as never

    const first = await POST(mk())
    expect(first.status).toBe(201)
    const second = await POST(mk())
    expect(second.status).toBe(409)
    expect((await second.json()).code).toBe('ALREADY_VOTED')

    expect(await db.$count(bestOfVote)).toBe(1)
    const [updated] = await db.select().from(owner).where(eq(owner.id, voter.id))
    // lastBestOfVoteAt is stamped fire-and-forget; give it a tick.
    await new Promise((r) => setTimeout(r, 100))
    const [after] = await db.select().from(owner).where(eq(owner.id, voter.id))
    expect(after.lastBestOfVoteAt).toBeInstanceOf(Date)
    void updated
  })
})

describe('GET /api/best-of', () => {
  it('lists published categories with nominee counts', async () => {
    const { biz } = await seedBasics()
    const [pub] = await db.insert(bestOfCategory).values({ name: 'Pub', slug: 'pub', published: true }).returning()
    await db.insert(bestOfCategory).values({ name: 'Hidden', slug: 'hidden', published: false })
    await db.insert(bestOfNominee).values({ categoryId: pub.id, businessId: biz.id })
    const { GET } = await import('@/app/api/best-of/route')
    const rows = await (await GET()).json()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ slug: 'pub', nomineeCount: 1, _count: { nominees: 1 } })
  })
})

describe('GET /api/cron/archive-past-events', () => {
  it('archives only events that ended more than 30 days ago', async () => {
    process.env.CRON_SECRET = 'sekret'
    const day = 86400000
    const base = { description: 'd', slug: '', title: '', startsAt: new Date(), source: 'MANUAL' } as never
    void base
    const mk = (slug: string, startsAt: Date, endsAt: Date | null) =>
      db.insert(event).values({ slug, title: slug, startsAt, endsAt, source: 'manual', sourceUrl: slug } as never)
    await mk('old-ended', new Date(Date.now() - 40 * day), new Date(Date.now() - 39 * day))
    await mk('old-open-ended', new Date(Date.now() - 40 * day), null)
    await mk('recent', new Date(Date.now() - 5 * day), new Date(Date.now() - 4 * day))
    await mk('future', new Date(Date.now() + 5 * day), null)

    const { GET } = await import('@/app/api/cron/archive-past-events/route')
    const res = await GET({ headers: new Headers({ 'x-cron-secret': 'sekret' }) } as never)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.archived).toBe(2)
    const rows = await db.select({ slug: event.slug, archivedAt: event.archivedAt }).from(event)
    const archived = rows.filter((r) => r.archivedAt).map((r) => r.slug).sort()
    expect(archived).toEqual(['old-ended', 'old-open-ended'])

    const denied = await GET({ headers: new Headers() } as never)
    expect(denied.status).toBe(401)
  })
})

describe('POST /api/events/[slug]/rsvp', () => {
  it('upserts a single attendee row and DELETE removes it', async () => {
    const { own } = await seedBasics()
    await db.insert(event).values({ slug: 'ev', title: 'Ev', startsAt: new Date(), source: 'manual', sourceUrl: 'u' } as never)
    vi.mocked(auth).mockResolvedValue({ user: { id: own.id, role: 'USER' } } as never)
    const { POST, DELETE } = await import('@/app/api/events/[slug]/rsvp/route')
    const call = (status: string) =>
      POST(
        new Request('http://t.local/x', { method: 'POST', body: JSON.stringify({ status }), headers: { 'content-type': 'application/json' } }) as never,
        { params: Promise.resolve({ slug: 'ev' }) },
      )
    expect((await call('GOING')).status).toBe(200)
    const res = await call('INTERESTED')
    expect((await res.json()).attendee.status).toBe('INTERESTED')
    expect(await db.$count(eventAttendee)).toBe(1)
    await DELETE({} as never, { params: Promise.resolve({ slug: 'ev' }) })
    expect(await db.$count(eventAttendee)).toBe(0)
  })
})

describe('and() helper sanity', () => {
  it('and(undefined, cond) behaves as cond', async () => {
    const { cat } = await seedBasics()
    await mkBusiness(cat.id, 'q', 'Q')
    const rows = await db.select().from(business).where(and(undefined, eq(business.slug, 'q')))
    expect(rows).toHaveLength(1)
  })
})
