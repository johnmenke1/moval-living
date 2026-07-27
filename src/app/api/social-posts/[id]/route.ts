import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { extractInstagramMedia } from '@/lib/instagram-media'

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

  // On approval, auto-extract media from the post URL if mediaUrl is missing
  const updateData: { status: string; mediaUrl?: string | null; caption?: string | null } = { status }
  if (status === 'APPROVED') {
    const post = await prisma.socialPost.findUnique({ where: { id } })
    if (post && !post.mediaUrl && post.platform === 'INSTAGRAM') {
      const extracted = await extractInstagramMedia(post.postUrl)
      if (extracted.mediaUrl) {
        updateData.mediaUrl = extracted.mediaUrl
        // Only clobber caption if we don't already have one
        if (!post.caption && extracted.caption) {
          updateData.caption = extracted.caption
        }
      }
    }
  }

  const updated = await prisma.socialPost.update({
    where: { id },
    data: updateData,
    include: { business: { select: { id: true, slug: true, name: true } } },
  })

  return NextResponse.json(updated)
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
