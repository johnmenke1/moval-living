// Guest author / guest post CRUD + cadence enforcement.
//
// Cadence rule: 1 post / calendar month per author. Soft block (warn + return
// the next available publish date) rather than hard block. If a post is in
// draft/in_review/rejected/scheduled, it doesn't count against the limit —
// only PUBLISHED posts do.

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

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
  authorId: z.string().trim().optional().nullable(),
  metaTitle: z.union([z.string().trim().max(200), z.literal(''), z.null()]).optional(),
  metaDescription: z.union([z.string().trim().max(320), z.literal(''), z.null()]).optional(),
  // Life in MoVal music sidebar
  spotifyTrack1: z.union([z.string().trim().max(100), z.literal(''), z.null()]).optional(),
  spotifyTrack2: z.union([z.string().trim().max(100), z.literal(''), z.null()]).optional(),
  // Guest Expert FAQ
  faqItems: z.array(z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(2000),
  })).optional(),
  // Live Curiously photo gallery (array of URLs)
  outingPhotos: z.array(z.string().trim().url().max(500)).optional(),
  // YouTube video ID (the part after ?v=)
  youtubeVideoId: z.union([z.string().trim().max(20), z.literal(''), z.null()]).optional(),
})

export const guestPostUpdateSchema = z.object({
  slug: slugSchema.optional(),
  postType: z.enum(['LIFE', 'GUEST', 'OUTING', 'SPOTLIGHT']).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  excerpt: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).optional(),
  heroImageUrl: nullableUrl,
  authorId: z.string().trim().optional().nullable(),
  metaTitle: z.union([z.string().trim().max(200), z.literal(''), z.null()]).optional(),
  metaDescription: z.union([z.string().trim().max(320), z.literal(''), z.null()]).optional(),
  editorNotes: z.union([z.string().trim().max(4000), z.literal(''), z.null()]).optional(),
  // Life in MoVal music sidebar
  spotifyTrack1: z.union([z.string().trim().max(100), z.literal(''), z.null()]).optional(),
  spotifyTrack2: z.union([z.string().trim().max(100), z.literal(''), z.null()]).optional(),
  // Guest Expert FAQ
  faqItems: z.array(z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(2000),
  })).optional(),
  // Live Curiously photo gallery
  outingPhotos: z.array(z.string().trim().url().max(500)).optional(),
  // YouTube video ID
  youtubeVideoId: z.union([z.string().trim().max(20), z.literal(''), z.null()]).optional(),
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
  scheduledFor: z.union([z.string(), z.null()]).optional(),
  rejectionReason: z.union([z.string().trim().max(500), z.literal(''), z.null()]).optional(),
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
    const existing = await prisma.guestAuthor.findUnique({
      where: { slug: candidate },
      select: { id: true },
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
    const existing = await prisma.guestPost.findUnique({
      where: { slug: candidate },
      select: { id: true },
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
  const author = await prisma.guestAuthor.findUnique({
    where: { id: authorId },
    select: { postsThisPeriod: true, periodStartedAt: true },
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
  const author = await prisma.guestAuthor.findUnique({
    where: { id: authorId },
    select: { postsThisPeriod: true, periodStartedAt: true },
  })
  if (!author) return

  const sameMonth =
    author.periodStartedAt.getUTCFullYear() === now.getUTCFullYear() &&
    author.periodStartedAt.getUTCMonth() === now.getUTCMonth()

  await prisma.guestAuthor.update({
    where: { id: authorId },
    data: {
      postsThisPeriod: sameMonth ? author.postsThisPeriod + 1 : 1,
      periodStartedAt: sameMonth ? author.periodStartedAt : now,
      lastPostedAt: now,
    },
  })
}

// Called when a published post is unpublished (rare). Decrements the count.
export async function recordPostUnpublish(authorId: string): Promise<void> {
  await prisma.guestAuthor.update({
    where: { id: authorId },
    data: {
      postsThisPeriod: { decrement: 1 },
    },
  })
}

// ── Author CRUD ─────────────────────────────────────────────────────────

export async function createGuestAuthor(input: GuestAuthorCreateInput) {
  const data = normalizeAuthorInput(input) as Prisma.GuestAuthorUncheckedCreateInput
  return prisma.guestAuthor.create({ data })
}

export async function updateGuestAuthor(
  id: string,
  input: GuestAuthorUpdateInput
) {
  const data = normalizeAuthorInput(input) as Prisma.GuestAuthorUpdateInput
  return prisma.guestAuthor.update({ where: { id }, data })
}

export async function listGuestAuthors() {
  return prisma.guestAuthor.findMany({
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    include: {
      _count: { select: { posts: true } },
    },
  })
}

export async function getGuestAuthorBySlug(slug: string) {
  return prisma.guestAuthor.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { status: 'published', postType: 'GUEST' },
        orderBy: { publishedAt: 'desc' },
        select: {
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
  const data: Prisma.GuestAuthorUpdateInput = {}
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
    data.business =
      input.businessId && input.businessId !== ''
        ? { connect: { id: input.businessId } }
        : { disconnect: true }
  }
  return data
}

// ── Post CRUD ────────────────────────────────────────────────────────────

export async function createGuestPost(input: GuestPostCreateInput) {
  const data = normalizePostInput(input)
  return prisma.guestPost.create({ data })
}

export async function updateGuestPost(
  id: string,
  input: GuestPostUpdateInput
) {
  const data = normalizePostUpdateInput(input)
  return prisma.guestPost.update({ where: { id }, data })
}

export async function listGuestPosts(opts?: { status?: string }) {
  return prisma.guestPost.findMany({
    where: opts?.status ? { status: opts.status } : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      author: { select: { id: true, slug: true, displayName: true, photoUrl: true } },
    },
  })
}

export async function getGuestPostBySlug(slug: string) {
  return prisma.guestPost.findUnique({
    where: { slug },
    include: {
      author: true,
    },
  })
}

export async function getGuestPostById(id: string) {
  return prisma.guestPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, slug: true, displayName: true, photoUrl: true, companyName: true } },
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
  const post = await prisma.guestPost.findUnique({
    where: { id: postId },
    select: { id: true, status: true, authorId: true },
  })
  if (!post) throw new Error('Post not found')

  const now = new Date()
  const data: Prisma.GuestPostUpdateInput = { status: input.status }

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

  // Side effects on publish / unpublish — only for guest-authored posts
  if (input.status === 'published' && post.status !== 'published') {
    await prisma.guestPost.update({ where: { id: postId }, data })
    if (post.authorId) await recordPostPublish(post.authorId)
    return prisma.guestPost.findUnique({ where: { id: postId } })
  }
  if (post.status === 'published' && input.status !== 'published') {
    await prisma.guestPost.update({ where: { id: postId }, data })
    if (post.authorId) await recordPostUnpublish(post.authorId)
    return prisma.guestPost.findUnique({ where: { id: postId } })
  }

  return prisma.guestPost.update({ where: { id: postId }, data })
}

function normalizePostInput(input: GuestPostCreateInput) {
  const data: Prisma.GuestPostCreateInput = {
    slug: input.slug,
    postType: (input.postType as string) as 'LIFE' | 'GUEST' | 'OUTING' | 'SPOTLIGHT',
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    heroImageUrl: emptyToNull(input.heroImageUrl),
    metaTitle: emptyToNull(input.metaTitle),
    metaDescription: emptyToNull(input.metaDescription),
    spotifyTrack1: emptyToNull(input.spotifyTrack1),
    spotifyTrack2: emptyToNull(input.spotifyTrack2),
    faqItems: input.faqItems ?? undefined,
    outingPhotos: normalizeStringArray(input.outingPhotos),
    youtubeVideoId: emptyToNull(input.youtubeVideoId),
  }
  if (input.authorId) {
    data.author = { connect: { id: input.authorId } }
  }
  return data
}

function normalizePostUpdateInput(input: GuestPostUpdateInput) {
  const data: Prisma.GuestPostUpdateInput = {}
  if (input.slug !== undefined) data.slug = input.slug
  if (input.postType !== undefined) data.postType = input.postType as 'LIFE' | 'GUEST' | 'OUTING' | 'SPOTLIGHT'
  if (input.title !== undefined) data.title = input.title
  if (input.excerpt !== undefined) data.excerpt = input.excerpt
  if (input.body !== undefined) data.body = input.body
  if (input.heroImageUrl !== undefined) data.heroImageUrl = emptyToNull(input.heroImageUrl)
  if (input.authorId !== undefined) {
    data.author = input.authorId ? { connect: { id: input.authorId } } : { disconnect: true }
  }
  if (input.metaTitle !== undefined) data.metaTitle = emptyToNull(input.metaTitle)
  if (input.metaDescription !== undefined) data.metaDescription = emptyToNull(input.metaDescription)
  if (input.editorNotes !== undefined) data.editorNotes = emptyToNull(input.editorNotes)
  if (input.spotifyTrack1 !== undefined) data.spotifyTrack1 = emptyToNull(input.spotifyTrack1)
  if (input.spotifyTrack2 !== undefined) data.spotifyTrack2 = emptyToNull(input.spotifyTrack2)
  if (input.faqItems !== undefined) data.faqItems = input.faqItems ?? undefined
  if (input.outingPhotos !== undefined) data.outingPhotos = normalizeStringArray(input.outingPhotos)
  if (input.youtubeVideoId !== undefined) data.youtubeVideoId = emptyToNull(input.youtubeVideoId)
  return data
}

function emptyToNull<T>(v: T | '' | null | undefined): T | null {
  if (v === undefined) return undefined as T | null
  if (v === '' || v === null) return null
  return v
}

function normalizeStringArray(v: string[] | undefined): string[] | undefined {
  if (v === undefined) return undefined
  // Strip empty strings
  const filtered = v.filter(Boolean)
  return filtered.length > 0 ? filtered : undefined
}