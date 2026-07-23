import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/social-posts/[id] — approve/reject (admin only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status } = body // 'APPROVED' | 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'status must be APPROVED or REJECTED' }, { status: 400 })
  }

  const post = await prisma.socialPost.update({
    where: { id },
    data: { status },
    include: { business: { select: { id: true, slug: true, name: true } } },
  })

  return NextResponse.json(post)
}

// DELETE /api/social-posts/[id] — remove post (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { id } = await params
  await prisma.socialPost.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
