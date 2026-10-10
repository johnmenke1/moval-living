/**
 * Calls real route handlers against the throwaway database. Only the session
 * (`@/auth`) and Next's cache invalidation (`@/lib/revalidate`) are stubbed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

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
import { db, business, review } from '@/db'
import { resetDb, seedBasics } from './helpers'

const asAdmin = () => vi.mocked(auth).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } } as never)
const asUser = (id: string) => vi.mocked(auth).mockResolvedValue({ user: { id, role: 'USER' } } as never)
const json = (body: unknown, method = 'PATCH') =>
  new Request('http://test.local/x', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) })

beforeEach(async () => {
  await resetDb()
  vi.mocked(auth).mockReset()
})

describe('GET /api/admin/businesses', () => {
  it('returns category, owner and a correct _count.reviews', async () => {
    asAdmin()
    const { biz } = await seedBasics()
    await db.insert(review).values([
      { businessId: biz.id, authorName: 'a', rating: 5, content: 'x' },
      { businessId: biz.id, authorName: 'b', rating: 4, content: 'y' },
    ])
    const { GET } = await import('@/app/api/admin/businesses/route')
    const res = await GET()
    const rows = await res.json()
    expect(rows).toHaveLength(1)
    expect(rows[0]._count.reviews).toBe(2)
    expect(rows[0].category).toEqual({ name: 'Food', slug: 'food' })
    expect(rows[0].owner.email).toBe('Sarah@Example.com')
  })

  it('rejects non-admins', async () => {
    asUser('someone')
    const { GET } = await import('@/app/api/admin/businesses/route')
    expect((await GET()).status).toBe(401)
  })
})

describe('GET /api/admin/businesses/search', () => {
  it('matches case-insensitively and treats % and _ literally', async () => {
    asAdmin()
    const { cat } = await seedBasics()
    const mk = (slug: string, name: string) =>
      db.insert(business).values({ slug, name, description: 'd', categoryId: cat.id, address: 'a', zip: '1', status: 'APPROVED' })
    await mk('a1', 'Joe_s Diner'); await mk('a2', 'Joexs Diner'); await mk('a3', '100% Pure')
    const { GET } = await import('@/app/api/admin/businesses/search/route')
    const search = async (q: string) => {
      const res = await GET({ nextUrl: new URL(`http://t.local/?q=${encodeURIComponent(q)}`) } as never)
      return (await res.json()).businesses.map((b: { name: string }) => b.name).sort()
    }
    expect(await search('joe')).toEqual(['Joe_s Diner', 'Joexs Diner'])
    expect(await search('e_s')).toEqual(['Joe_s Diner']) // `_` is not a wildcard
    expect(await search('100%')).toEqual(['100% Pure']) // `%` is not a wildcard
  })
})

describe('PATCH /api/admin/businesses/[id]', () => {
  it('changes category, stamps featuredAt once, and returns relations', async () => {
    asAdmin()
    const { biz, cat } = await seedBasics()
    const { PATCH } = await import('@/app/api/admin/businesses/[id]/route')

    const res = await PATCH(json({ tier: 'FEATURED' }) as never, ctx({ id: biz.id }))
    const body = await res.json()
    expect(body.tier).toBe('FEATURED')
    expect(body.category.name).toBe('Food')
    expect(body.featuredAt).toBeTruthy()

    const first = (await db.query.business.findFirst({ where: eq(business.id, biz.id) }))!.featuredAt!
    await PATCH(json({ tier: 'EXPERT_PARTNER' }) as never, ctx({ id: biz.id }))
    const second = (await db.query.business.findFirst({ where: eq(business.id, biz.id) }))!.featuredAt!
    expect(second.getTime()).toBe(first.getTime()) // idempotent

    const [other] = await db.insert((await import('@/db')).category).values({ name: 'Auto', slug: 'auto', icon: 'x' }).returning()
    const moved = await (await PATCH(json({ categoryId: other.id }) as never, ctx({ id: biz.id }))).json()
    expect(moved.categoryId).toBe(other.id)
    expect(moved.category.slug).toBe('auto')
    void cat
  })
})

describe('PUT /api/businesses/[slug] (owner edit)', () => {
  const valid = {
    name: ' Acme Co ', description: 'A long enough description here.', categoryId: '',
    address: '1 Main', city: 'Moreno Valley', state: 'ca', zip: '92553',
  }

  it('lets the owner update; hours:null clears; category is a plain FK', async () => {
    const { biz, cat, own } = await seedBasics()
    await db.update(business).set({ hours: { mon: { open: '9', close: '5', closed: false } } }).where(eq(business.id, biz.id))
    asUser(own.id)
    const { PUT } = await import('@/app/api/businesses/[slug]/route')
    const res = await PUT(json({ ...valid, categoryId: cat.id, hours: null }, 'PUT'), ctx({ slug: 'acme' }))
    expect(res.status).toBe(200)
    const row = (await db.query.business.findFirst({ where: eq(business.id, biz.id) }))!
    expect(row.name).toBe('Acme Co')
    expect(row.state).toBe('CA')
    expect(row.hours).toBeNull()
  })

  it('forbids other users and strips admin-only flags for owners', async () => {
    const { biz, cat, own } = await seedBasics()
    const { PUT } = await import('@/app/api/businesses/[slug]/route')
    asUser('stranger')
    expect((await PUT(json({ ...valid, categoryId: cat.id }, 'PUT'), ctx({ slug: 'acme' }))).status).toBe(403)

    asUser(own.id)
    await PUT(json({ ...valid, categoryId: cat.id, chamberMember: true }, 'PUT'), ctx({ slug: 'acme' }))
    const row = (await db.query.business.findFirst({ where: eq(business.id, biz.id) }))!
    expect(row.chamberMember).toBe(false)
  })

  it('GET returns approved listing with category + unflagged reviews only', async () => {
    const { biz } = await seedBasics()
    await db.insert(review).values([
      { businessId: biz.id, authorName: 'ok', rating: 5, content: 'good' },
      { businessId: biz.id, authorName: 'bad', rating: 1, content: 'spam', flagged: true },
    ])
    asUser('anyone')
    const { GET } = await import('@/app/api/businesses/[slug]/route')
    const body = await (await GET(new Request('http://t.local'), ctx({ slug: 'acme' }))).json()
    expect(body.category.slug).toBe('food')
    expect(body.reviews.map((r: { authorName: string }) => r.authorName)).toEqual(['ok'])
  })
})
