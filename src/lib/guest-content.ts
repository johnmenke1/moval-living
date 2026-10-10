// Guest author / guest post CRUD + cadence enforcement.
//
// Cadence rule: 1 post / calendar month per author. Soft block (warn + return
// the next available publish date) rather than hard block. If a post is in
// draft/in_review/rejected/scheduled, it doesn't count against the limit —
// only PUBLISHED posts do.

import { z } from 'zod'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db, guestAuthor, guestPost, requireRow } from '../db'

type GuestAuthorRow = typeof guestAuthor.$inferInsert
type GuestPostRow = typeof guestPost.$inferInsert

// ── Schemas ──────────────────────────────────────────────────────────────

const nullableUrl = z
  .union([
    z.string().trim().url().max(500),
    z.literal('').transform(() => null),
    z.null(),
  ])
  .optional()

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase letters, numbers, dashes only')

export const guestAuthorCreateSchema = z.object({
  slug: slugSchema,
  displayName: z.string().trim().min(1).max(120),
  title: z.union([z.string().trim().max(160), z.literal(''), z.null()]).optional(),
  bio: z.string().trim().min(1).max(2000),
  photoUrl: nullableUrl,
  personalSiteUrl: nullableUrl,
  companyName: z.union([z.string().trim().max(160), z.literal(''), z.null()]).optional(),
  companyUrl: nullableUrl,
  linkedinUrl: nullableUrl,
  twitterUrl: nullableUrl,
  facebookUrl: nullableUrl,
  instagramUrl: nullableUrl,
  businessId: z.union([z.string().trim().min(1), z.literal(''), z.null()]).optional(),
})

export const guestAuthorUpdateSchema = guestAuthorCreateSchema.partial()

export const guestPostCreateSchema = z.object({
  slug: slugSchema,
  postType: z.enum(['LIFE', 'GUEST', 'OUTING', 'SPOTLIGHT']).optional(),
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1),
  heroImageUrl: nullableUrl,
  // .nullish() handles both null and undefined, including missing keys
  // (Zod v4 quirk: .optional() alone doesn't accept missing keys)
  authorId: z.string().trim().nullish(),
  metaTitle: z.union([z.string().trim().max(200), z.literal(''), z.null()]).nullish(),
  metaDescription: z.union([z.string().trim().max(320), z.literal(''), z.null()]).nullish(),
  // Life in MoVal music sidebar
  spotifyTrack1: z.union([z.string().trim().max(100), z.literal(''), z.null()]).nullish(),
  spotifyTrack2: z.union([z.string().trim().max(100), z.literal(''), z.null()]).nullish(),
  // Guest Expert FAQ
  faqItems: z.array(z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(2000),
  })).nullish(),
  // Live Curiously photo gallery (array of { url, caption? })
  outingPhotos: z.array(z.object({
    url: z.string().trim().url().max(500),
    caption: z.string().trim().max(280).optional().default(''),
  })).nullish(),
  // YouTube video ID (the part after ?v=)
  youtubeVideoId: z.union([z.string().trim().max(20), z.literal(''), z.null()]).nullish(),
})

export const guestPostUpdateSchema = z.object({
  slug: slugSchema.optional(),
  postType: z.enum(['LIFE', 'GUEST', 'OUTING', 'SPOTLIGHT']).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  excerpt: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).optional(),
  heroImageUrl: nullableUrl,
  authorId: z.string().trim().nullish(),
  metaTitle: z.union([z.string().trim().max(200), z.literal(''), z.null()]).nullish(),
  metaDescription: z.union([z.string().trim().max(320), z.literal(''), z.null()]).nullish(),
  editorNotes: z.union([z.string().trim().max(4000), z.literal(''), z.null()]).nullish(),
  // Life in MoVal music sidebar
  spotifyTrack1: z.union([z.string().trim().max(100), z.literal(''), z.null()]).nullish(),
  spotifyTrack2: z.union([z.string().trim().max(100), z.literal(''), z.null()]).nullish(),
  // Guest Expert FAQ
  faqItems: z.array(z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(2000),
  })).nullish(),
  // Live Curiously photo gallery
  outingPhotos: z.array(z.object({
    url: z.string().trim().url().max(500),
    caption: z.string().trim().max(280).optional().default(''),
  })).nullish(),
  // YouTube video ID
  youtubeVideoId: z.union([z.string().trim().max(20), z.literal(''), z.null()]).nullish(),
})

export const guestPostStatusSchema = z.object({
  status: z.enum([
    'draft',
    'submitted',
    'in_review',
    'scheduled',
    'published',
    'rejected',
  ]),
  // Allow either an ISO datetime string, null (to clear), or missing key
  scheduledFor: z.union([z.string().datetime(), z.null()]).nullish(),
  rejectionReason: z.union([z.string().trim().max(500), z.literal(''), z.null()]).nullish(),
})

export type GuestAuthorCreateInput = z.infer<typeof guestAuthorCreateSchema>
export type GuestAuthorUpdateInput = z.infer<typeof guestAuthorUpdateSchema>
export type GuestPostCreateInput = z.infer<typeof guestPostCreateSchema>
export type GuestPostUpdateInput = z.infer<typeof guestPostUpdateSchema>
export type GuestPostStatusInput = z.infer<typeof guestPostStatusSchema>

// ── Slug helpers ─────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// Find a slug that's unique. If "chris-leeper" exists, try "chris-leeper-2", etc.
export async function uniqueAuthorSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  const seed = slugify(base) || 'author'
  let candidate = seed
  let n = 2
  while (true) {
    const existing = await db.query.guestAuthor.findFirst({
      where: eq(guestAuthor.slug, candidate),
      columns: { id: true },
    })
    if (!existing || existing.id === excludeId) return candidate
    candidate = `${seed}-${n++}`
  }
}

export async function uniquePostSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  const seed = slugify(base) || 'post'
  let candidate = seed
  let n = 2
  while (true) {
    const existing = await db.query.guestPost.findFirst({
      where: eq(guestPost.slug, candidate),
      columns: { id: true },
    })
    if (!existing || existing.id === excludeId) return candidate
    candidate = `${seed}-${n++}`
  }
}

// ── Cadence ──────────────────────────────────────────────────────────────

// Has the author hit their monthly post limit? Returns the date the limit
// resets (always the first of next month, 00:00 UTC) if they have.
export async function checkPostCadence(authorId: string): Promise<{
  allowed: boolean
  postsThisPeriod: number
  periodStartedAt: Date
  resetsAt?: Date
}> {
  const author = await db.query.guestAuthor.findFirst({
    where: eq(guestAuthor.id, authorId),
    columns: { postsThisPeriod: true, periodStartedAt: true },
  })
  if (!author) throw new Error('Author not found')

  // If the period rolled over (we're in a new calendar month), reset count.
  const now = new Date()
  const sameMonth =
    author.periodStartedAt.getUTCFullYear() === now.getUTCFullYear() &&
    author.periodStartedAt.getUTCMonth() === now.getUTCMonth()

  const count = sameMonth ? author.postsThisPeriod : 0
  const periodStart = sameMonth ? author.periodStartedAt : now

  if (count < 1) {
    return { allowed: true, postsThisPeriod: count, periodStartedAt: periodStart }
  }
  // First day of next month
  const resetsAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  )
  return {
    allowed: false,
    postsThisPeriod: count,
    periodStartedAt: periodStart,
    resetsAt,
  }
}

// Called after a post transitions to "published". Bumps the count and
// rolls the period window if necessary.
export async function recordPostPublish(authorId: string): Promise<void> {
  const now = new Date()
  const author = await db.query.guestAuthor.findFirst({
    where: eq(guestAuthor.id, authorId),
    columns: { postsThisPeriod: true, periodStartedAt: true },
  })
  if (!author) return

  const sameMonth =
    author.periodStartedAt.getUTCFullYear() === now.getUTCFullYear() &&
    author.periodStartedAt.getUTCMonth() === now.getUTCMonth()

  await db
    .update(guestAuthor)
    .set({
      postsThisPeriod: sameMonth ? author.postsThisPeriod + 1 : 1,
      periodStartedAt: sameMonth ? author.periodStartedAt : now,
      lastPostedAt: now,
    })
    .where(eq(guestAuthor.id, authorId))
}

// Called when a published post is unpublished (rare). Decrements the count.
export async function recordPostUnpublish(authorId: string): Promise<void> {
  await db
    .update(guestAuthor)
    .set({ postsThisPeriod: sql`${guestAuthor.postsThisPeriod} - 1` })
    .where(eq(guestAuthor.id, authorId))
}

// ── Author CRUD ─────────────────────────────────────────────────────────

export async function createGuestAuthor(input: GuestAuthorCreateInput) {
  const data = normalizeAuthorInput(input) as GuestAuthorRow
  const [row] = await db.insert(guestAuthor).values(data).returning()
  return row
}

export async function updateGuestAuthor(
  id: string,
  input: GuestAuthorUpdateInput
) {
  const data = normalizeAuthorInput(input)
  const rows = await db.update(guestAuthor).set(data).where(eq(guestAuthor.id, id)).returning()
  return requireRow(rows, 'Guest author not found')
}

// Correlated subquery used by every "author + post count" query. The outer
// column MUST be alias-qualified: Drizzle renders a bare "id" here, which SQL
// resolves to the INNER table's id and silently counts 0. "guestAuthor" is the
// relational query's alias for GuestAuthor (the schema key).
const postCountSql = sql<number>`(select count(*)::int from "GuestPost" gp where gp."authorId" = "guestAuthor"."id")`

/** Old Prisma shape: the row plus `_count: { posts }` and a flat `postCount`. */
function withCounts<T extends { postCount: number }>(row: T) {
  return { ...row, _count: { posts: row.postCount } }
}

const ADMIN_BUSINESS = { columns: { id: true, name: true, slug: true, logo: true } } as const

/** Admin list: every author with its business summary and post count. */
export async function listGuestAuthorsAdmin() {
  const rows = await db.query.guestAuthor.findMany({
    with: { business: ADMIN_BUSINESS },
    extras: { postCount: postCountSql.as('post_count') },
    orderBy: asc(guestAuthor.displayName),
  })
  return rows.map(withCounts)
}

/** Admin detail for one author (same shape as one list row). */
export async function getGuestAuthorAdmin(id: string) {
  const row = await db.query.guestAuthor.findFirst({
    where: eq(guestAuthor.id, id),
    with: { business: ADMIN_BUSINESS },
    extras: { postCount: postCountSql.as('post_count') },
  })
  return row ? withCounts(row) : undefined
}

export async function listGuestAuthors() {
  const rows = await db.query.guestAuthor.findMany({
    orderBy: [desc(guestAuthor.isActive), asc(guestAuthor.displayName)],
    extras: { postCount: postCountSql.as('post_count') },
  })
  // Keep the old Prisma `_count: { posts }` shape so callers don't change.
  return rows.map(({ postCount, ...author }) => ({ ...author, _count: { posts: postCount } }))
}

export async function getGuestAuthorBySlug(slug: string) {
  return db.query.guestAuthor.findFirst({
    where: eq(guestAuthor.slug, slug),
    with: {
      posts: {
        where: and(eq(guestPost.status, 'published'), eq(guestPost.postType, 'GUEST')),
        orderBy: desc(guestPost.publishedAt),
        columns: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroImageUrl: true,
          publishedAt: true,
        },
      },
    },
  })
}

function normalizeAuthorInput(input: GuestAuthorCreateInput | GuestAuthorUpdateInput) {
  const data: Partial<GuestAuthorRow> = {}
  if (input.slug !== undefined) data.slug = input.slug
  if (input.displayName !== undefined) data.displayName = input.displayName
  if (input.title !== undefined) data.title = emptyToNull(input.title)
  if (input.bio !== undefined) data.bio = input.bio
  if (input.photoUrl !== undefined) data.photoUrl = emptyToNull(input.photoUrl)
  if (input.personalSiteUrl !== undefined) data.personalSiteUrl = emptyToNull(input.personalSiteUrl)
  if (input.companyName !== undefined) data.companyName = emptyToNull(input.companyName)
  if (input.companyUrl !== undefined) data.companyUrl = emptyToNull(input.companyUrl)
  if (input.linkedinUrl !== undefined) data.linkedinUrl = emptyToNull(input.linkedinUrl)
  if (input.twitterUrl !== undefined) data.twitterUrl = emptyToNull(input.twitterUrl)
  if (input.facebookUrl !== undefined) data.facebookUrl = emptyToNull(input.facebookUrl)
  if (input.instagramUrl !== undefined) data.instagramUrl = emptyToNull(input.instagramUrl)
  if (input.businessId !== undefined) {
    // '' / null disconnects the business, an id connects it.
    data.businessId = input.businessId ? input.businessId : null
  }
  return data
}

// ── Post CRUD ────────────────────────────────────────────────────────────

export async function createGuestPost(input: GuestPostCreateInput) {
  const data = normalizePostInput(input)
  const [row] = await db.insert(guestPost).values(data).returning()
  return row
}

export async function updateGuestPost(
  id: string,
  input: GuestPostUpdateInput
) {
  const data = normalizePostUpdateInput(input)
  const rows = await db.update(guestPost).set(data).where(eq(guestPost.id, id)).returning()
  return requireRow(rows, 'Guest post not found')
}

export async function listGuestPosts(opts?: { status?: string }) {
  return db.query.guestPost.findMany({
    where: opts?.status ? eq(guestPost.status, opts.status) : undefined,
    orderBy: desc(guestPost.updatedAt),
    with: {
      author: { columns: { id: true, slug: true, displayName: true, photoUrl: true } },
    },
  })
}

export async function getGuestPostBySlug(slug: string) {
  return db.query.guestPost.findFirst({
    where: eq(guestPost.slug, slug),
    with: { author: true },
  })
}

export async function getGuestPostById(id: string) {
  return db.query.guestPost.findFirst({
    where: eq(guestPost.id, id),
    with: {
      author: {
        columns: { id: true, slug: true, displayName: true, photoUrl: true, companyName: true },
      },
    },
  })
}

// ── Status transitions ──────────────────────────────────────────────────
//
// Transitions that produce side effects (cadence, timestamps) live here so
// every API route calls them instead of doing direct updates.

export async function transitionPostStatus(
  postId: string,
  input: GuestPostStatusInput
) {
  const post = await db.query.guestPost.findFirst({
    where: eq(guestPost.id, postId),
    columns: { id: true, status: true, authorId: true },
  })
  if (!post) throw new Error('Post not found')

  const now = new Date()
  const data: Partial<GuestPostRow> = { status: input.status }

  if (input.status === 'scheduled') {
    if (!input.scheduledFor) throw new Error('scheduledFor required when status=scheduled')
    data.scheduledFor = new Date(input.scheduledFor)
    data.submittedAt = post.status === 'draft' ? now : undefined
  }
  if (input.status === 'submitted') {
    data.submittedAt = now
  }
  if (input.status === 'in_review') {
    // submittedAt stays as-is; in_review is the human-review state
  }
  if (input.status === 'published') {
    data.publishedAt = now
    // When publishing, also clear rejectionReason
    data.rejectionReason = null
  }
  if (input.status === 'rejected') {
    data.rejectionReason = input.rejectionReason ?? 'No reason given'
  }
  if (input.status === 'draft') {
    data.rejectionReason = null
    data.scheduledFor = null
  }

  const apply = async () =>
    requireRow(
      await db.update(guestPost).set(data).where(eq(guestPost.id, postId)).returning(),
      'Post not found'
    )

  // Side effects on publish / unpublish — only for guest-authored posts
  if (input.status === 'published' && post.status !== 'published') {
    const updated = await apply()
    if (post.authorId) await recordPostPublish(post.authorId)
    return updated
  }
  if (post.status === 'published' && input.status !== 'published') {
    const updated = await apply()
    if (post.authorId) await recordPostUnpublish(post.authorId)
    return updated
  }

  return apply()
}

function normalizePostInput(input: GuestPostCreateInput): GuestPostRow {
  const data: GuestPostRow = {
    slug: input.slug,
    postType: input.postType, // undefined -> column default ('GUEST')
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    heroImageUrl: emptyToNull(input.heroImageUrl),
    metaTitle: emptyToNull(input.metaTitle),
    metaDescription: emptyToNull(input.metaDescription),
    spotifyTrack1: emptyToNull(input.spotifyTrack1),
    spotifyTrack2: emptyToNull(input.spotifyTrack2),
    faqItems: input.faqItems ?? undefined,
    outingPhotos: normalizePhotosArray(input.outingPhotos ?? undefined),
    youtubeVideoId: emptyToNull(input.youtubeVideoId),
  }
  if (input.authorId) {
    data.authorId = input.authorId
  }
  return data
}

function normalizePostUpdateInput(input: GuestPostUpdateInput) {
  const data: Partial<GuestPostRow> = {}
  if (input.slug !== undefined) data.slug = input.slug
  if (input.postType !== undefined) data.postType = input.postType
  if (input.title !== undefined) data.title = input.title
  if (input.excerpt !== undefined) data.excerpt = input.excerpt
  if (input.body !== undefined) data.body = input.body
  if (input.heroImageUrl !== undefined) data.heroImageUrl = emptyToNull(input.heroImageUrl)
  if (input.authorId !== undefined) {
    data.authorId = input.authorId ? input.authorId : null
  }
  if (input.metaTitle !== undefined) data.metaTitle = emptyToNull(input.metaTitle)
  if (input.metaDescription !== undefined) data.metaDescription = emptyToNull(input.metaDescription)
  if (input.editorNotes !== undefined) data.editorNotes = emptyToNull(input.editorNotes)
  if (input.spotifyTrack1 !== undefined) data.spotifyTrack1 = emptyToNull(input.spotifyTrack1)
  if (input.spotifyTrack2 !== undefined) data.spotifyTrack2 = emptyToNull(input.spotifyTrack2)
  if (input.faqItems !== undefined) data.faqItems = input.faqItems ?? undefined
  if (input.outingPhotos !== undefined) data.outingPhotos = normalizePhotosArray(input.outingPhotos)
  if (input.youtubeVideoId !== undefined) data.youtubeVideoId = emptyToNull(input.youtubeVideoId)
  return data
}

function emptyToNull<T>(v: T | '' | null | undefined): T | null {
  if (v === undefined) return undefined as T | null
  if (v === '' || v === null) return null
  return v
}

function normalizeStringArray(v: string[] | null | undefined): string[] | undefined {
  if (v === undefined || v === null) return undefined
  // Strip empty strings
  const filtered = v.filter(Boolean)
  return filtered.length > 0 ? filtered : undefined
}

// GuestPost.outingPhotos is a NOT NULL jsonb column. The old code wrote a JSON
// `null` literal (Prisma.JsonNull) for "no photos", not SQL NULL and not [].
// Preserve that exactly so readers see the same data as before.
const JSON_NULL = sql`'null'::jsonb`

function normalizePhotosArray(
  v: { url: string; caption?: string }[] | null | undefined
): { url: string; caption: string }[] | typeof JSON_NULL | undefined {
  if (v === undefined) return undefined
  if (v === null) return JSON_NULL
  // Strip entries with empty URLs; trim captions
  const filtered = v
    .filter((p) => typeof p.url === 'string' && p.url.trim() !== '')
    .map((p) => ({
      url: p.url.trim(),
      caption: (p.caption ?? '').trim(),
    }))
  return filtered.length > 0 ? filtered : JSON_NULL
}
