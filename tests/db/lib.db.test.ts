import { beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db, business, submission, isUniqueViolation, NotFoundError } from '../../src/db'
import * as gc from '../../src/lib/guest-content'
import * as ep from '../../src/lib/expert-partner'
import * as cb from '../../src/lib/admin-claimed-businesses'
import * as ss from '../../src/lib/submission-slug'
import { resetDb, seedBasics } from './helpers'

beforeEach(resetDb)

describe('schema defaults (replace Prisma client-side behavior)', () => {
  it('generates cuid ids, Date timestamps and empty array defaults', async () => {
    const { biz } = await seedBasics()
    expect(biz.id.length).toBeGreaterThanOrEqual(20)
    expect(biz.createdAt).toBeInstanceOf(Date)
    expect(biz.updatedAt).toBeInstanceOf(Date)
    expect(biz.bestOfTags).toEqual([])
  })

  it('$onUpdate bumps updatedAt', async () => {
    const { biz } = await seedBasics()
    await new Promise((r) => setTimeout(r, 20))
    const [u] = await db.update(business).set({ tagline: 'hi' }).where(eq(business.id, biz.id)).returning()
    expect(u.updatedAt.getTime()).toBeGreaterThan(biz.updatedAt.getTime())
  })
})

describe('guest-content', () => {
  async function makeAuthor(businessId?: string) {
    return gc.createGuestAuthor({ slug: 'chris', displayName: 'Chris', bio: 'bio', businessId } as never)
  }

  it('creates an author and maps duplicate slugs to a unique violation', async () => {
    const { biz } = await seedBasics()
    const a = await makeAuthor(biz.id)
    expect(a.businessId).toBe(biz.id)
    await expect(makeAuthor()).rejects.toSatisfy(isUniqueViolation)
  })

  it('stores empty photo lists as JSON null (Prisma.JsonNull parity) and trims real ones', async () => {
    const empty = await gc.createGuestPost({ slug: 'p1', title: 'T', excerpt: 'e', body: 'b', outingPhotos: [] } as never)
    expect(empty.postType).toBe('GUEST')
    const raw = await db.execute(sql`select "outingPhotos"::text as v from "GuestPost" where id = ${empty.id}`)
    expect(raw.rows[0].v).toBe('null')

    const full = await gc.createGuestPost({
      slug: 'p2', title: 'T', excerpt: 'e', body: 'b',
      outingPhotos: [{ url: ' https://x.co/a.jpg ', caption: ' c ' }, { url: '  ' }],
    } as never)
    expect(full.outingPhotos).toEqual([{ url: 'https://x.co/a.jpg', caption: 'c' }])
  })

  it('counts posts per author (alias-qualified correlated subquery) and keeps the _count shape', async () => {
    const author = await makeAuthor()
    expect((await gc.listGuestAuthors())[0]._count.posts).toBe(0)
    await gc.createGuestPost({ slug: 'p1', title: 'T', excerpt: 'e', body: 'b', authorId: author.id } as never)
    await gc.createGuestPost({ slug: 'p2', title: 'T', excerpt: 'e', body: 'b', authorId: author.id } as never)
    expect((await gc.listGuestAuthors())[0]._count.posts).toBe(2)
  })

  it('publish / unpublish drives the monthly cadence counter', async () => {
    const author = await makeAuthor()
    const post = await gc.createGuestPost({ slug: 'p1', title: 'T', excerpt: 'e', body: 'b', authorId: author.id } as never)

    const published = await gc.transitionPostStatus(post.id, { status: 'published' } as never)
    expect(published!.status).toBe('published')
    expect(published!.publishedAt).toBeInstanceOf(Date)
    expect((await gc.listGuestAuthors())[0].postsThisPeriod).toBe(1)
    expect((await gc.checkPostCadence(author.id)).allowed).toBe(false)

    const fetched = await gc.getGuestAuthorBySlug('chris')
    expect(fetched!.posts.map((p) => p.slug)).toEqual(['p1'])

    await gc.transitionPostStatus(post.id, { status: 'draft' } as never)
    expect((await gc.listGuestAuthors())[0].postsThisPeriod).toBe(0)
  })

  it('admin author view: business summary, _count and flat postCount', async () => {
    const { biz } = await seedBasics()
    const author = await makeAuthor(biz.id)
    await gc.createGuestPost({ slug: 'p1', title: 'T', excerpt: 'e', body: 'b', authorId: author.id } as never)
    const [row] = await gc.listGuestAuthorsAdmin()
    expect(row.postCount).toBe(1)
    expect(row._count.posts).toBe(1)
    expect(row.business).toMatchObject({ id: biz.id, name: 'Acme', slug: 'acme' })
    expect((await gc.getGuestAuthorAdmin(author.id))!.postCount).toBe(1)
    expect(await gc.getGuestAuthorAdmin('missing')).toBeUndefined()
  })

  it('exposes the `author` relation on posts', async () => {
    const author = await makeAuthor()
    const post = await gc.createGuestPost({ slug: 'p1', title: 'T', excerpt: 'e', body: 'b', authorId: author.id } as never)
    const [listed] = await gc.listGuestPosts({ status: 'draft' })
    expect(listed.author!.displayName).toBe('Chris')
    expect((await gc.getGuestPostById(post.id))!.author!.slug).toBe('chris')
  })

  it('throws NotFoundError when updating a missing row (Prisma P2025 parity)', async () => {
    await expect(gc.updateGuestPost('nope', { title: 'x' })).rejects.toBeInstanceOf(NotFoundError)
    await expect(gc.updateGuestAuthor('nope', { displayName: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('an empty businessId disconnects the business', async () => {
    const { biz } = await seedBasics()
    const a = await makeAuthor(biz.id)
    expect((await gc.updateGuestAuthor(a.id, { businessId: '' })).businessId).toBeNull()
  })
})

describe('business-facing lib helpers', () => {
  it('expert-partner slug uniqueness and category exclusivity', async () => {
    const { cat, biz } = await seedBasics()
    expect(await ep.ensureUniqueExpertPartnerSlug('acme')).toBe('acme-2')
    expect(await ep.ensureUniqueExpertPartnerSlug('acme', biz.id)).toBe('acme')
    expect(await ep.isCategoryOpenForPartner(cat.id)).toBe(false)
    expect(await ep.isCategoryOpenForPartner('other')).toBe(true)
  })

  it('claimed businesses: relation shape and stats', async () => {
    await seedBasics()
    const rows = await cb.getClaimedBusinesses()
    expect(rows).toHaveLength(1)
    expect(rows[0].category.name).toBe('Food')
    expect(rows[0].owner!.email).toBe('Sarah@Example.com')
    expect(await cb.getClaimedBusinessStats()).toEqual({ total: 1, last7d: 1, last30d: 1, last90d: 1 })
  })

  it('submission slugs increment a, b, c per day', async () => {
    const day = new Date('2026-08-19T12:00:00Z')
    expect(await ss.nextSubmissionSlug(day)).toBe('08-19-26-a')
    await db.insert(submission).values({
      slug: '08-19-26-a', sourceUrl: 'https://example.com/e', sourcePlatform: 'OTHER',
      title: 'x', startsAt: day,
    })
    expect(await ss.nextSubmissionSlug(day)).toBe('08-19-26-b')
  })
})
