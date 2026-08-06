import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  createGuestAuthor,
  guestAuthorCreateSchema,
  uniqueAuthorSlug,
} from '@/lib/guest-content'

// GET /api/admin/authors — list all guest authors
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authors = await prisma.guestAuthor.findMany({
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    include: { _count: { select: { posts: true } } },
  })
  return NextResponse.json(authors)
}

// POST /api/admin/authors — create a guest author
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

  const parsed = guestAuthorCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const slug = await uniqueAuthorSlug(parsed.data.slug || parsed.data.displayName)
  try {
    const author = await createGuestAuthor({ ...parsed.data, slug })
    return NextResponse.json(author, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}