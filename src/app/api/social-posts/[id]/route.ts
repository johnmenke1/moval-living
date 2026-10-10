import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { eq } from 'drizzle-orm'
import { db, socialPost, requireRow } from '@/db'
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
  const { status, eventDate, eventEndDate } = body

  // Support two modes:
  // 1. Status change (approve/reject) — requires status to be APPROVED or REJECTED
  // 2. Date edit (any authed admin) — accepts eventDate/eventEndDate
  const isStatusChange = status !== undefined
  const isDateEdit = eventDate !== undefined || eventEndDate !== undefined

  if (isStatusChange && !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'status must be APPROVED or REJECTED' }, { status: 400 })
  }

  const updateData: Partial<typeof socialPost.$inferInsert> = {}

  if (isStatusChange) {
    updateData.status = status as typeof socialPost.$inferInsert['status']
  }

  if (eventDate !== undefined) {
    updateData.eventDate = eventDate ? new Date(eventDate) : null
  }
  if (eventEndDate !== undefined) {
    updateData.eventEndDate = eventEndDate ? new Date(eventEndDate) : null
  }

  // On approval, auto-extract media from the post URL if mediaUrl is missing
  if (isStatusChange && status === 'APPROVED') {
    const post = await db.query.socialPost.findFirst({ where: eq(socialPost.id, id) })
    if (post && !post.mediaUrl && post.platform === 'INSTAGRAM') {
      const extracted = await extractInstagramMedia(post.postUrl)
      if (extracted.mediaUrl) {
        updateData.mediaUrl = extracted.mediaUrl
        if (!post.caption && extracted.caption) {
          updateData.caption = extracted.caption
        }
      }
    }
  }

  if (Object.keys(updateData).length > 0) {
    requireRow(
      await db.update(socialPost).set(updateData).where(eq(socialPost.id, id)).returning({ id: socialPost.id }),
      'Post not found'
    )
  }
  const updated = requireRow(
    await db.query.socialPost.findMany({
      where: eq(socialPost.id, id),
      with: { business: { columns: { id: true, slug: true, name: true } } },
    }),
    'Post not found'
  )

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
  requireRow(
    await db.delete(socialPost).where(eq(socialPost.id, id)).returning({ id: socialPost.id }),
    'Post not found'
  )

  return NextResponse.json({ success: true })
}
