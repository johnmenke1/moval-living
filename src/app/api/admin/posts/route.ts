import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  createGuestPost,
  guestPostCreateSchema,
  uniquePostSlug,
  checkPostCadence,
} from '@/lib/guest-content'
import { prisma } from '@/lib/prisma'

// GET /api/admin/posts — list posts (optionally filtered by status)
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? undefined
  const posts = await prisma.guestPost.findMany({
    where: status ? { status } : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      author: { select: { id: true, slug: true, displayName: true, photoUrl: true } },
    },
  })
  return NextResponse.json(posts)
}

// POST /api/admin/posts — create a new guest post (status: draft)
export async function POST(req: Request) {
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

  const parsed = guestPostCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const slug = await uniquePostSlug(parsed.data.slug || parsed.data.title)

  try {
    const post = await createGuestPost({ ...parsed.data, slug })
    return NextResponse.json(post, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}