// Migrated to shared guest-content schema on 2026-08-08.
// The route used to inline its own Zod schema that hard-required authorId + a
// strictly-valid ISO datetime for scheduledFor, which broke LIFE posts (no
// authorId) and any post left "Scheduled For" blank. The shared schema
// already declares postType + Spotify + FAQ + photo + YouTube fields.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import {
  guestPostCreateSchema,
  createGuestPost,
} from '@/lib/guest-content'

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

// POST /api/admin/guest-posts — create a post
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = guestPostCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const created = await createGuestPost(parsed.data)

  const post = await prisma.guestPost.findUnique({
    where: { id: created.id },
    include: {
      author: {
        select: { id: true, displayName: true, slug: true, photoUrl: true, title: true },
      },
    },
  })

  return NextResponse.json(post, { status: 201 })
}
