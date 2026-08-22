import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePostData } from '@/lib/revalidate'
import {
  guestPostUpdateSchema,
  updateGuestPost,
} from '@/lib/guest-content'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/admin/posts/[id] — update content fields (NOT status)
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

  const parsed = guestPostUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const post = await updateGuestPost(id, parsed.data)
    return NextResponse.json(post)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// DELETE /api/admin/posts/[id] — hard-delete a post (admin only)
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  await prisma.guestPost.delete({ where: { id } })
  // ISR cache bust — see src/lib/revalidate.ts for the path map.
  revalidatePostData()
  return NextResponse.json({ ok: true })
}