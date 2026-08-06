import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

const CreateGuestPostSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string(),
  body: z.string().min(1),
  heroImageUrl: z.string().url().optional().nullable(),
  authorId: z.string(),
  editorNotes: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'in_review', 'scheduled', 'published', 'rejected']).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
})

const UpdateGuestPostSchema = CreateGuestPostSchema.partial()

// GET /api/admin/guest-posts — list all posts
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const posts = await prisma.guestPost.findMany({
    include: {
      author: {
        select: { id: true, displayName: true, slug: true, photoUrl: true, title: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(posts)
}

// POST /api/admin/guest-posts — create post
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateGuestPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { slug, scheduledFor, ...data } = parsed.data

  const author = await prisma.guestAuthor.findUnique({ where: { id: parsed.data.authorId } })
  if (!author) {
    return NextResponse.json({ error: 'Author not found' }, { status: 400 })
  }

  const existing = await prisma.guestPost.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
  }

  const post = await prisma.guestPost.create({
    data: {
      ...data,
      slug,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      submittedAt: data.status && ['submitted', 'in_review', 'scheduled', 'published'].includes(data.status) ? new Date() : null,
      publishedAt: data.status === 'published' ? new Date() : null,
    },
    include: {
      author: {
        select: { id: true, displayName: true, slug: true, photoUrl: true, title: true },
      },
    },
  })

  return NextResponse.json(post, { status: 201 })
}
