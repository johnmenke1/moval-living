import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  guestAuthorUpdateSchema,
  updateGuestAuthor,
} from '@/lib/guest-content'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/admin/authors/[id] — update a guest author
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = guestAuthorUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const author = await updateGuestAuthor(id, parsed.data)
    return NextResponse.json(author)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// DELETE /api/admin/authors/[id] — soft-disable an author
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  // Soft-delete only — never hard-delete because posts reference them.
  // If the author has posts, set isActive=false. Otherwise allow hard delete.
  const posts = await prisma.guestPost.count({ where: { authorId: id } })
  if (posts > 0) {
    const author = await prisma.guestAuthor.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true, soft: true, author })
  }
  await prisma.guestAuthor.delete({ where: { id } })
  return NextResponse.json({ ok: true, soft: false })
}